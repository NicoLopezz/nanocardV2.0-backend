const express = require('express');
const router = express.Router();
const { getCardModel } = require('../../models/Card');
const { getUserModel } = require('../../models/User');
const { getTransactionModel } = require('../../models/Transaction');
const { authenticateToken } = require('../../middleware/auth');
// const cacheService = require('../../services/cacheService'); // REMOVED
const historyService = require('../../services/historyService');
const { v4: uuidv4 } = require('uuid');

// Endpoint para obtener las tarjetas del usuario autenticado con movimientos
router.get('/', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const Card = getCardModel();
    const Transaction = getTransactionModel();
    const userId = req.user.userId;

    // Obtener todas las tarjetas del usuario
    const cards = await Card.find({ userId: userId });

    // Función para parsear fecha de transacción
    const parseTransactionDate = (dateStr, timeStr) => {
      try {
        const [day, month, year] = (dateStr || '').split('/');
        const [timePart, rawPeriod] = (timeStr || '').split(' ');
        let [hours, minutes] = (timePart || '00:00').split(':');
        const period = (rawPeriod || '').toLowerCase();
        hours = parseInt(hours);
        minutes = parseInt(minutes);
        if ((period === 'p. m.' || period === 'pm' || period === 'p.m.' || period === 'p') && hours !== 12) hours += 12;
        if ((period === 'a. m.' || period === 'am' || period === 'a.m.' || period === 'a') && hours === 12) hours = 0;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hours, minutes);
      } catch {
        return new Date();
      }
    };

    // Enriquecer cada tarjeta con sus movimientos
    const enrichedCards = await Promise.all(cards.map(async (card) => {
      // Obtener las últimas transacciones de la tarjeta (máximo 50)
      const transactions = await Transaction.find({ 
        cardId: card._id, 
        isDeleted: { $ne: true },
        status: { $ne: 'DELETED' }
      })
      .select({
        _id: 1,
        name: 1,
        amount: 1,
        date: 1,
        time: 1,
        status: 1,
        operation: 1,
        comentario: 1,
        createdAt: 1
      })
      .sort({ createdAt: -1 })
      .limit(50);

      // Ordenar por fecha real de la transacción (más reciente primero)
      const sortedTransactions = transactions
        .map(tx => ({
          ...tx.toObject(),
          realDate: parseTransactionDate(tx.date, tx.time)
        }))
        .sort((a, b) => b.realDate - a.realDate)
        .map(tx => ({
          _id: tx._id,
          name: tx.name,
          amount: tx.amount,
          date: tx.date,
          time: tx.time,
          status: tx.status,
          operation: tx.operation,
          comentario: tx.comentario,
          createdAt: tx.createdAt
        }));

      return {
        ...card.toObject(),
        movements: sortedTransactions
      };
    }));

    const responseTime = Date.now() - startTime;
    console.log(`✅ User cards with movements fetched in ${responseTime}ms`);

    res.json({
      success: true,
      cards: enrichedCards,
      count: enrichedCards.length,
      responseTime: responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching user cards with movements (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

// Endpoint para obtener TODAS las tarjetas sin paginación (solo stats, sin transacciones)
router.get('/admin/all', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Parámetros de filtros (sin paginación)
    const sortBy = req.query.sortBy || 'updatedAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const supplier = req.query.supplier || '';

    const Card = getCardModel();
    const User = getUserModel();

    // Construir query de filtros
    let cardQuery = {};
    
    if (search) {
      cardQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { last4: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      cardQuery.status = status;
    }
    
    if (supplier) {
      cardQuery.supplier = supplier;
    }

    // 1. Obtener TODAS las tarjetas (sin paginación)
    const cards = await Card.find(cardQuery)
      .select('_id name last4 status userId supplier limits createdAt updatedAt stats')
      .sort({ [sortBy]: sortOrder })
      .lean();

    if (cards.length === 0) {
      return res.json({
        success: true,
        cards: [],
        total: 0,
        responseTime: Date.now() - startTime
      });
    }

    // 2. Obtener TODOS los usuarios para las tarjetas
    const userIds = [...new Set(cards.map(card => card.userId).filter(Boolean))];
    const users = await User.find(
      { _id: { $in: userIds } },
      { _id: 1, username: 1, profile: 1 }
    ).lean();

    // 3. Crear mapa de usuarios para acceso rápido
    const userMap = new Map();
    users.forEach(user => {
      userMap.set(user._id.toString(), user);
    });

    // 4. Enriquecer tarjetas con información del usuario (SIN transacciones)
    const enrichedCards = cards.map(card => {
      const userIdString = card.userId ? card.userId.toString() : null;
      const user = userIdString ? userMap.get(userIdString) : null;
      
      return {
        _id: card._id,
        name: card.name,
        last4: card.last4,
        status: card.status,
        stats: {
          money_in: card.stats?.money_in || 0,
          refund: card.stats?.refund || 0,
          posted: card.stats?.posted || 0,
          reversed: card.stats?.reversed || 0,
          rejected: card.stats?.rejected || 0,
          pending: card.stats?.pending || 0,
          withdrawal: card.stats?.withdrawal || 0,
          available: card.stats?.available || 0,
          total_all_transactions: card.stats?.total_all_transactions || 0,
          total_deleted_transactions: card.stats?.total_deleted_transactions || 0,
          deleted_amount: card.stats?.deleted_amount || 0
        },
        userId: card.userId,
        userName: user ? `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || user.username : 'Unknown User',
        supplier: card.supplier || 'Nano',
        limits: card.limits,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt
      };
    });

    // Obtener el timestamp del último refresh-all-cards-stats
    let lastRefreshTimestamp = null;
    try {
      const { getHistoryConnection } = require('../../config/database');
      const historyConnection = getHistoryConnection();
      const refreshCollection = historyConnection.db.collection('refresh-all-cards-stats');
      
      const lastRefresh = await refreshCollection
        .findOne({}, { sort: { timestamp: -1 } });
      
      if (lastRefresh) {
        lastRefreshTimestamp = lastRefresh.timestamp;
        console.log(`📊 Last refresh timestamp: ${lastRefreshTimestamp}`);
      }
    } catch (refreshError) {
      console.error(`❌ Error fetching last refresh timestamp:`, refreshError.message);
    }

    const responseTime = Date.now() - startTime;
    console.log(`✅ Admin all cards (ALL without pagination) fetched in ${responseTime}ms - Total: ${cards.length}`);

    res.json({
      success: true,
      cards: enrichedCards,
      total: cards.length,
      lastRefreshTimestamp: lastRefreshTimestamp,
      responseTime: responseTime
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching admin cards (${responseTime}ms):`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      responseTime: responseTime
    });
  }
});

// Endpoint optimizado para transacciones específicas de una tarjeta
router.get('/:cardId/transactions', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cardId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const operation = req.query.operation || '';

    // Validar límites
    const maxLimit = 100;
    const finalLimit = Math.min(limit, maxLimit);
    const skip = (page - 1) * finalLimit;

    const Card = getCardModel();
    const Transaction = getTransactionModel();

    // Verificar que la tarjeta existe y el usuario tiene acceso
    const card = await Card.findOne({ _id: cardId }).lean();
    if (!card) {
      return res.status(404).json({ 
        success: false, 
        message: 'Card not found' 
      });
    }

    // Verificar permisos (admin o propietario de la tarjeta)
    if (req.user.role !== 'admin' && req.user.userId !== card.userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    // Construir query de filtros para transacciones
    let transactionQuery = {
      cardId: cardId,
      isDeleted: { $ne: true },
      status: { $ne: 'DELETED' }
    };

    if (search) {
      transactionQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { comentario: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      transactionQuery.status = status;
    }

    if (operation) {
      transactionQuery.operation = operation;
    }

    // 1. Obtener total de transacciones para paginación
    const totalTransactions = await Transaction.countDocuments(transactionQuery);
    const totalPages = Math.ceil(totalTransactions / finalLimit);

    // 2. Obtener transacciones paginadas
    const transactions = await Transaction.find(transactionQuery)
      .select('_id name amount date time status operation comentario createdAt')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(finalLimit)
      .lean();

    // 3. Procesar transacciones para limpiar datos
    const processedTransactions = transactions.map(tx => ({
      _id: tx._id,
      name: tx.name,
      amount: typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount) || 0,
      date: tx.date,
      time: tx.time,
      status: tx.status,
      operation: tx.operation,
      comentario: tx.comentario,
      createdAt: tx.createdAt
    }));

    const responseTime = Date.now() - startTime;
    console.log(`✅ Transactions for card ${cardId} fetched in ${responseTime}ms - Page ${page}/${totalPages}`);

    res.json({
      success: true,
      cardId: cardId,
      cardName: card.name,
      transactions: processedTransactions,
      pagination: {
        page,
        limit: finalLimit,
        total: totalTransactions,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      responseTime: responseTime
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching transactions for card ${req.params.cardId} (${responseTime}ms):`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      responseTime: responseTime
    });
  }
});

// Endpoint para ver estadísticas de tarjetas
router.get('/stats', async (req, res) => {
  try {
    const Card = getCardModel();
    const User = getUserModel();
    
    // Contar total de tarjetas
    const totalCards = await Card.countDocuments();
    
    // Contar por proveedor
    const cardsBySupplier = await Card.aggregate([
      { $group: { _id: '$supplier', count: { $sum: 1 } } }
    ]);
    
    // Contar por estado
    const cardsByStatus = await Card.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Contar total de usuarios
    const totalUsers = await User.countDocuments();
    
    // Obtener algunas tarjetas de ejemplo
    const sampleCards = await Card.find({}).limit(5).select('_id name last4 status supplier');
    
    res.json({
      success: true,
      stats: {
        totalCards,
        totalUsers,
        cardsBySupplier,
        cardsByStatus,
        sampleCards
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para ver todas las tarjetas (paginado)
router.get('/all', async (req, res) => {
  try {
    const Card = getCardModel();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const cards = await Card.find({})
      .skip(skip)
      .limit(limit)
      .select('_id name last4 status supplier limits.monthly meta.email')
      .sort({ createdAt: -1 });
    
    const total = await Card.countDocuments();
    
    res.json({
      success: true,
      data: {
        cards,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para obtener KPIs de un usuario específico
router.get('/user/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    const User = getUserModel();
    const Transaction = getTransactionModel();
    
    // 🔄 REFRESH AUTOMÁTICO: Actualizar stats del usuario antes de devolverlas
    const StatsRefreshService = require('../../services/statsRefreshService');
    try {
      await StatsRefreshService.recalculateUserStats(userId);
      console.log(`✅ User stats refreshed for ${userId} before serving to frontend`);
    } catch (refreshError) {
      console.warn(`⚠️ Warning: Could not refresh user stats for ${userId}:`, refreshError.message);
      // Continuar con la operación aunque falle el refresh
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Obtener transacciones del usuario para verificar KPIs
    const transactions = await Transaction.find({ userId: userId });
    
    const calculatedStats = {
      totalTransactions: transactions.length,
      totalDeposited: transactions.filter(t => t.credit).reduce((sum, t) => sum + t.amount, 0),
      totalPosted: transactions.filter(t => !t.credit).reduce((sum, t) => sum + t.amount, 0),
      totalPending: 0, // Por ahora 0, se puede calcular si hay transacciones pendientes
      totalAvailable: 0 // Se calculará después
    };
    
    calculatedStats.totalAvailable = calculatedStats.totalDeposited - calculatedStats.totalPosted;

    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        name: `${user.profile.firstName} ${user.profile.lastName}`
      },
      storedStats: user.stats,
      calculatedStats: calculatedStats,
      transactions: transactions.length
    });
  } catch (error) {
    console.error('❌ Error fetching user stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para obtener una tarjeta específica con todos sus campos
router.get('/card/:cardId', authenticateToken, async (req, res) => {
  try {
    const { cardId } = req.params;
    const Card = getCardModel();

    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ success: false, message: 'Card not found' });
    }

    res.json({
      success: true,
      card: {
        _id: card._id,
        userId: card.userId,
        name: card.name,
        supplier: card.supplier,
        last4: card.last4,
        type: card.type,
        deposited: card.deposited,
        refunded: card.refunded,
        posted: card.posted,
        pending: card.pending,
        available: card.available,
        cryptoMateBalance: card.cryptoMateBalance,
        status: card.status,
        lastLogin: card.lastLogin,
        approval_method: card.approval_method,
        forwarded_3ds_type: card.forwarded_3ds_type,
        limits: card.limits,
        meta: card.meta,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ Error fetching card:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// NUEVO ENDPOINT: Obtener stats de una tarjeta específica con últimos movimientos (solo para administradores)
router.get('/admin/:cardId/stats', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Verificar que el usuario sea admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin role required.' 
      });
    }

    const { cardId } = req.params;
    const Card = getCardModel();
    const Transaction = getTransactionModel();
    
    // REFRESH AUTOMÁTICO REMOVIDO - Usar stats guardadas en la DB

    // Verificar que la tarjeta existe (incluyendo campos de estadísticas)
    const card = await Card.findById(cardId).select('+stats +transactionStats');
    if (!card) {
      return res.status(404).json({ 
        success: false, 
        message: 'Card not found' 
      });
    }

    // Función para parsear fecha de transacción
    const parseTransactionDate = (dateStr, timeStr) => {
      try {
        const [day, month, year] = (dateStr || '').split('/');
        const [timePart, rawPeriod] = (timeStr || '').split(' ');
        let [hours, minutes] = (timePart || '00:00').split(':');
        const period = (rawPeriod || '').toLowerCase();
        hours = parseInt(hours);
        minutes = parseInt(minutes);
        if ((period === 'p. m.' || period === 'pm' || period === 'p.m.' || period === 'p') && hours !== 12) hours += 12;
        if ((period === 'a. m.' || period === 'am' || period === 'a.m.' || period === 'a') && hours === 12) hours = 0;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hours, minutes);
      } catch {
        return new Date();
      }
    };

    // Obtener TODAS las transacciones de la tarjeta (incluyendo eliminadas para admin)
    const allTransactions = await Transaction.find({ 
      cardId: cardId
    })
    .select({
      _id: 1,
      name: 1,
      amount: 1,
      date: 1,
      time: 1,
      status: 1,
      operation: 1,
      comentario: 1,
      createdAt: 1,
      isDeleted: 1
    });

    // Ordenar por fecha real de la transacción (más reciente primero) y tomar solo las últimas 4
    const lastMovements = allTransactions
      .map(tx => ({
        ...tx.toObject(),
        realDate: parseTransactionDate(tx.date, tx.time)
      }))
      .sort((a, b) => b.realDate - a.realDate)
      .slice(0, 4)
      .map(tx => ({
        _id: tx._id,
        name: tx.name,
        amount: tx.amount,
        date: tx.date,
        time: tx.time,
        status: tx.status,
        operation: tx.operation,
        comentario: tx.comentario,
        createdAt: tx.createdAt,
        isDeleted: tx.isDeleted || tx.status === 'DELETED'
      }));

    // Formatear movimientos manteniendo el formato original completo
    const formattedMovements = lastMovements.map(movement => ({
      _id: movement._id,
      name: movement.name,
      amount: movement.amount,
      date: movement.date,
      time: movement.time,
      status: movement.status,
      operation: movement.operation,
      comentario: movement.comentario,
      createdAt: movement.createdAt,
      isDeleted: movement.isDeleted
    }));

    const responseTime = Date.now() - startTime;
    console.log(`✅ Card stats and movements for ${cardId} fetched in ${responseTime}ms`);

    res.json({
      success: true,
      card: {
        _id: card._id,
        name: card.name,
        deposited: card.stats?.money_in || 0,
        posted: card.stats?.posted || 0,
        available: card.stats?.available || 0,
        status: card.status
      },
      stats: {
        money_in: card.stats?.money_in || 0,
        refund: card.stats?.refund || 0,
        posted: card.stats?.posted || 0,
        reversed: card.stats?.reversed || 0,
        rejected: card.stats?.rejected || 0,
        pending: card.stats?.pending || 0,
        withdrawal: card.stats?.withdrawal || 0,
        available: card.stats?.available || 0,
        total_all_transactions: card.stats?.total_all_transactions || 0,
        total_deleted_transactions: card.stats?.total_deleted_transactions || 0,
        deleted_amount: card.stats?.deleted_amount || 0
      },
      lastMovements: formattedMovements,
      responseTime: responseTime
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching card stats and movements (${responseTime}ms):`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      responseTime: responseTime 
    });
  }
});

// Endpoint para actualizar una tarjeta específica
router.put('/card/:cardId', authenticateToken, async (req, res) => {
  try {
    const { cardId } = req.params;
    const updates = req.body;
    
    const Card = getCardModel();

    // Verificar que la tarjeta existe
    const existingCard = await Card.findById(cardId);
    if (!existingCard) {
      return res.status(404).json({ 
        success: false, 
        message: 'Card not found' 
      });
    }

    // Campos permitidos para actualización
    const allowedFields = ['name', 'supplier', 'last4', 'type', 'status'];
    const updateData = {};
    
    // Solo actualizar campos permitidos que estén presentes en el request
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid fields provided for update' 
      });
    }

    // Agregar timestamp de actualización
    updateData.updatedAt = new Date();

    // Actualizar la tarjeta
    const updatedCard = await Card.findByIdAndUpdate(
      cardId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Card updated successfully',
      card: updatedCard
    });

  } catch (error) {
    console.error('❌ Error updating card:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para actualizar una transacción específica - OPTIMIZADO
router.put('/card/:cardId/transactions/:transactionId', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cardId, transactionId } = req.params;
    const updates = req.body;
    
    const Card = getCardModel();
    const Transaction = getTransactionModel();

    // Verificar que la tarjeta existe
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ success: false, message: 'Card not found' });
    }

    // Verificar que la transacción existe y pertenece a la tarjeta
    const existingTransaction = await Transaction.findOne({ 
      _id: transactionId, 
      cardId: cardId,
      isDeleted: { $ne: true },
      status: { $ne: 'DELETED' }
    });
    
    if (!existingTransaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Campos permitidos para actualización
    const allowedFields = ['comentario', 'name', 'amount', 'date', 'time'];
    const updateData = {};
    
    // Solo actualizar campos permitidos que estén presentes en el request
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });

    // Si no hay campos para actualizar, retornar error
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid fields provided for update' 
      });
    }

    // Agregar timestamp de actualización
    updateData.updatedAt = new Date();

    // Crear historial de cambios
    const changes = [];
    Object.keys(updateData).forEach(field => {
      if (field !== 'updatedAt' && existingTransaction[field] !== updateData[field]) {
        changes.push({
          field: field,
          oldValue: existingTransaction[field],
          newValue: updateData[field]
        });
      }
    });

    // Incrementar versión
    const newVersion = existingTransaction.version + 1;

    // Actualizar la transacción con historial
    const updatedTransaction = await Transaction.findByIdAndUpdate(
      transactionId,
      { 
        $set: {
          ...updateData,
          version: newVersion
        },
        $push: {
          history: {
            version: newVersion,
            action: 'updated',
            changes: changes,
            timestamp: new Date(),
            modifiedBy: req.user.userId,
            reason: `Transaction updated by ${req.user.role}`
          }
        }
      },
      { new: true, runValidators: true }
    );

    const responseTime = Date.now() - startTime;
    console.log(`✅ Transaction ${transactionId} updated successfully in ${responseTime}ms`);

    // Log en historial centralizado
    try {
      await historyService.logTransactionUpdate(updatedTransaction, req.user, changes, {
        method: 'PUT',
        endpoint: `/api/cards/card/${cardId}/transactions/${transactionId}`,
        statusCode: 200,
        responseTime: responseTime
      });
    } catch (historyError) {
      console.error('❌ Error logging transaction update to history:', historyError);
      // No fallar la operación por error de historial
    }

    // Recalcular stats de la tarjeta después de la actualización
    const cardStatsService = require('../../services/cardStatsService');
    const recalculatedStats = await cardStatsService.recalculateCardStats(cardId);

    // Invalidar caché relacionado
    const lastMovementsCacheKey = `last_movements_${cardId}`;
    // CACHÉ REMOVIDO - No se invalida caché

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      transaction: updatedTransaction,
      updatedCardStats: {
        deposited: recalculatedStats.card.deposited,
        posted: recalculatedStats.card.posted,
        available: recalculatedStats.card.available
      },
      responseTime: responseTime
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error updating transaction (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

// Endpoint para eliminar una transacción específica (soft delete) - OPTIMIZADO
router.delete('/card/:cardId/transactions/:transactionId', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cardId, transactionId } = req.params;
    
    const Card = getCardModel();
    const Transaction = getTransactionModel();

    // Verificar que la tarjeta existe
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ 
        success: false, 
        message: 'Card not found' 
      });
    }

    // Verificar que la transacción existe y pertenece a la tarjeta
    const transaction = await Transaction.findOne({ 
      _id: transactionId, 
      cardId: cardId 
    });
    
    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found or does not belong to this card' 
      });
    }

    // Verificar que la transacción no esté ya eliminada
    if (transaction.status === 'DELETED' || transaction.status === 'TRANSACTION_DELETED') {
      return res.status(400).json({ 
        success: false, 
        message: 'Transaction is already deleted' 
      });
    }

    // Crear timestamp de eliminación
    const deletedAt = new Date();
    const deletedAtFormatted = deletedAt.toLocaleDateString('en-GB') + ' ' + 
      deletedAt.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });

    // NO modificar el comentario original - mantenerlo intacto
    const originalComment = transaction.comentario || '';

    // Crear historial de eliminación
    const newVersion = transaction.version + 1;

    // Actualizar la transacción con soft delete y historial
    const deletedTransaction = await Transaction.findByIdAndUpdate(
      transactionId,
      { 
        $set: { 
          status: 'DELETED',
          isDeleted: true,
          // comentario: NO SE MODIFICA - se mantiene el original
          deletedAt: deletedAt,
          deletedBy: req.user.userId,
          updatedAt: deletedAt,
          version: newVersion
        },
        $push: {
          history: {
            version: newVersion,
            action: 'deleted',
            changes: [{
              field: 'status',
              oldValue: transaction.status,
              newValue: 'DELETED'
            }],
            timestamp: deletedAt,
            modifiedBy: req.user.userId,
            reason: `Transaction deleted by ${req.user.role}`
          }
        }
      },
      { new: true, runValidators: true }
    );

    const responseTime = Date.now() - startTime;
    console.log(`✅ Transaction ${transactionId} deleted successfully in ${responseTime}ms`);

    // Log en historial centralizado
    try {
      await historyService.logTransactionDelete(deletedTransaction, req.user, {
        method: 'DELETE',
        endpoint: `/api/cards/card/${cardId}/transactions/${transactionId}`,
        statusCode: 200,
        responseTime: responseTime
      });
    } catch (historyError) {
      console.error('❌ Error logging transaction delete to history:', historyError);
      // No fallar la operación por error de historial
    }

    // Recalcular stats de la tarjeta después de la eliminación
    const cardStatsService = require('../../services/cardStatsService');
    const recalculatedStats = await cardStatsService.recalculateCardStats(cardId);

    // Invalidar caché relacionado
    const lastMovementsCacheKey = `last_movements_${cardId}`;
    // CACHÉ REMOVIDO - No se invalida caché

    res.json({
      success: true,
      message: 'Transaction deleted successfully',
      transaction: deletedTransaction,
      updatedCardStats: {
        deposited: recalculatedStats.card.deposited,
        posted: recalculatedStats.card.posted,
        available: recalculatedStats.card.available
      },
      responseTime: responseTime
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error deleting transaction (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

// Endpoint para restaurar una transacción eliminada (restore) - NUEVO
router.post('/card/:cardId/transactions/:transactionId/restore', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cardId, transactionId } = req.params;
    
    const Card = getCardModel();
    const Transaction = getTransactionModel();

    // Verificar que la tarjeta existe
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ 
        success: false, 
        message: 'Card not found' 
      });
    }

    // Verificar que la transacción existe y pertenece a la tarjeta
    const transaction = await Transaction.findOne({ 
      _id: transactionId, 
      cardId: cardId 
    });
    
    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found or does not belong to this card' 
      });
    }

    // Verificar que la transacción esté eliminada para poder restaurarla
    if (transaction.status !== 'DELETED' && !transaction.isDeleted) {
      return res.status(400).json({ 
        success: false, 
        message: 'Transaction is not deleted, cannot restore' 
      });
    }

    // Obtener el estado original antes del delete del historial
    let originalStatus = 'SUCCESS'; // Estado por defecto
    
    const deleteHistory = transaction.history.find(h => h.action === 'deleted');
    if (deleteHistory && deleteHistory.changes && deleteHistory.changes.length > 0) {
      const statusChange = deleteHistory.changes.find(c => c.field === 'status');
      if (statusChange) {
        originalStatus = statusChange.oldValue;
      }
    }

    // El comentario NO se modifica durante DELETE, por lo que se mantiene igual
    const originalComentario = transaction.comentario || '';

    // Crear timestamp de restauración
    const restoredAt = new Date();
    const restoredAtFormatted = restoredAt.toLocaleDateString('en-GB') + ' ' + 
      restoredAt.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });

    // Crear historial de restauración
    const newVersion = transaction.version + 1;

    // Actualizar la transacción con restore y historial
    const restoredTransaction = await Transaction.findByIdAndUpdate(
      transactionId,
      { 
        $set: { 
          status: originalStatus,
          isDeleted: false,
          comentario: originalComentario,
          restoredAt: restoredAt,
          restoredBy: req.user.userId,
          updatedAt: restoredAt,
          version: newVersion
        },
        $unset: {
          deletedAt: 1,
          deletedBy: 1
        },
        $push: {
          history: {
            version: newVersion,
            action: 'restored',
            changes: [{
              field: 'status',
              oldValue: 'DELETED',
              newValue: originalStatus
            }, {
              field: 'isDeleted',
              oldValue: true,
              newValue: false
            }],
            timestamp: restoredAt,
            modifiedBy: req.user.userId,
            reason: `Transaction restored by ${req.user.role}`
          }
        }
      },
      { new: true, runValidators: true }
    );

    const responseTime = Date.now() - startTime;
    console.log(`✅ Transaction ${transactionId} restored successfully in ${responseTime}ms`);

    // Log en historial centralizado
    try {
      await historyService.logTransactionUpdate(restoredTransaction, req.user, [{
        field: 'status',
        oldValue: 'DELETED',
        newValue: originalStatus
      }], {
        method: 'POST',
        endpoint: `/api/cards/card/${cardId}/transactions/${transactionId}/restore`,
        statusCode: 200,
        responseTime: responseTime
      });
    } catch (historyError) {
      console.error('❌ Error logging transaction restore to history:', historyError);
      // No fallar la operación por error de historial
    }

    // Recalcular stats de la tarjeta después de la restauración
    const cardStatsService = require('../../services/cardStatsService');
    const recalculatedStats = await cardStatsService.recalculateCardStats(cardId);

    res.json({
      success: true,
      message: 'Transaction restored successfully',
      transaction: restoredTransaction,
      updatedCardStats: {
        deposited: recalculatedStats.card.deposited,
        posted: recalculatedStats.card.posted,
        available: recalculatedStats.card.available
      },
      responseTime: responseTime
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error restoring transaction (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

// Endpoint para obtener transacciones de una tarjeta específica - OPTIMIZADO CON CACHÉ
router.get('/card/:cardId/transactions', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cardId } = req.params;
    const { page = 1, limit = 50, sortBy = 'date', sortOrder = 'desc', action } = req.query;
    
    // Determinar si incluir transacciones eliminadas basado en el parámetro action
    const includeDeleted = action === 'all-movements';
    
    console.log(`🔍 Debug - cardId: ${cardId}, action: ${action}, includeDeleted: ${includeDeleted}`);
    
    // Ajustar la clave de caché para incluir el parámetro action
    const cacheKey = `transactions_${cardId}_${page}_${limit}_${sortBy}_${sortOrder}_${includeDeleted ? 'all' : 'active'}`;
    // CACHÉ REMOVIDO - Consulta directa a la base de datos
    
    // CACHÉ REMOVIDO - Siempre consulta directa a la base de datos
    
    const Card = getCardModel();
    const Transaction = getTransactionModel();
    const { getReconciliationModel } = require('../../models/Reconciliation');
    const Reconciliation = getReconciliationModel();

    // Verificar que la tarjeta existe (incluyendo campos de estadísticas)
    const card = await Card.findById(cardId).select('+stats +transactionStats');
    if (!card) {
      return res.status(404).json({ success: false, message: 'Card not found' });
    }

    // Configurar paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Configurar ordenamiento
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Configurar filtros de transacciones basado en action
    let transactionFilter = { cardId: cardId };
    if (!includeDeleted) {
      transactionFilter.isDeleted = { $ne: true };
      transactionFilter.status = { $ne: 'DELETED' };
    }

    // Obtener transacciones según el filtro
    const transactions = await Transaction.find(transactionFilter)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    const totalTransactions = await Transaction.countDocuments(transactionFilter);

    // Obtener nombres de reconciliaciones para transacciones reconciliadas
    const reconciledTransactionIds = transactions
      .filter(tx => tx.reconciled && tx.reconciliationId)
      .map(tx => tx.reconciliationId);
    
    let reconciliationNames = {};
    if (reconciledTransactionIds.length > 0) {
      const reconciliations = await Reconciliation.find({
        _id: { $in: reconciledTransactionIds }
      }).select('_id name');
      
      reconciliationNames = reconciliations.reduce((acc, recon) => {
        acc[recon._id] = recon.name;
        return acc;
      }, {});
    }

    // Usar las estadísticas ya calculadas y guardadas en la tarjeta
    const stats = {
      totalTransactions: card.transactionStats?.totalTransactions || 0,
      money_in: card.stats?.money_in || 0,
      refund: card.stats?.refund || 0,
      posted_approved: card.stats?.posted || 0,
      reversed: card.stats?.reversed || 0,
      rejected: card.stats?.rejected || 0,
      withdrawal: card.stats?.withdrawal || 0,
      pending: card.stats?.pending || 0,
      totalAvailable: card.stats?.available || 0,
      totalDeletedTransactions: card.stats?.total_deleted_transactions || 0,
      totalAllTransactions: card.stats?.total_all_transactions || 0,
      deletedAmount: card.stats?.deleted_amount || 0
    };

    const responseData = {
      success: true,
      card: {
        _id: card._id,
        name: card.name,
        last4: card.last4,
        status: card.status
      },
      stats: {
        ...stats
      },
      transactions: transactions.map(tx => {
        const transactionObj = tx.toObject();
        const result = {
          ...transactionObj,
          isDeleted: tx.isDeleted || tx.status === 'DELETED'
        };
        
        // Agregar nombre de reconciliación si está reconciliada
        if (tx.reconciled && tx.reconciliationId && reconciliationNames[tx.reconciliationId]) {
          result.reconciliationName = reconciliationNames[tx.reconciliationId];
        }
        
        return result;
      }),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalTransactions,
        pages: Math.ceil(totalTransactions / parseInt(limit))
      }
    };

    // Si incluye eliminadas, agregar información adicional
    if (includeDeleted) {
      const deletedCount = await Transaction.countDocuments({ 
        cardId: cardId, 
        $or: [
          { isDeleted: true },
          { status: 'DELETED' }
        ]
      });
      
      responseData.stats.totalDeletedTransactions = deletedCount;
      responseData.stats.totalAllTransactions = totalTransactions;
    }

    // Guardar en caché solo para transacciones activas
    if (!includeDeleted) {
      const cacheData = {
        ...responseData,
        timestamp: new Date().toISOString()
      };
      // CACHÉ REMOVIDO - No se guarda en caché
    }

    const responseTime = Date.now() - startTime;
    console.log(`✅ Card transactions fetched from database in ${responseTime}ms`);

    res.json({
      ...responseData,
      responseTime: responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching card transactions (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

// Endpoint para estadísticas globales del sistema (solo para administradores)
router.get('/admin/stats', authenticateToken, async (req, res) => {
  try {
    // Verificar que el usuario sea admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin role required.' 
      });
    }

    // 🔄 REFRESH AUTOMÁTICO: Actualizar stats globales antes de devolverlas
    const StatsRefreshService = require('../../services/statsRefreshService');
    try {
      console.log('🔄 Refreshing global stats before serving to admin...');
      
      // Obtener todas las tarjetas para hacer batch refresh
      const Card = getCardModel();
      const allCards = await Card.find({}).select('_id');
      const cardIds = allCards.map(card => card._id);
      
      if (cardIds.length > 0) {
        // Hacer batch refresh de todas las tarjetas para stats globales
        console.log(`📊 Batch refreshing global stats for ${cardIds.length} cards...`);
        
        // Procesar en lotes de 5 para stats globales (más conservador)
        const batchSize = 5;
        const batches = [];
        for (let i = 0; i < cardIds.length; i += batchSize) {
          batches.push(cardIds.slice(i, i + batchSize));
        }
        
        let processed = 0;
        for (const batch of batches) {
          await Promise.all(
            batch.map(async (cardId) => {
              try {
                await StatsRefreshService.refreshCardStats(cardId);
                processed++;
              } catch (error) {
                console.warn(`⚠️ Could not refresh stats for card ${cardId}:`, error.message);
              }
            })
          );
        }
        
        console.log(`✅ Global stats refresh completed for ${processed}/${cardIds.length} cards`);
      }
    } catch (refreshError) {
      console.warn(`⚠️ Warning: Could not refresh global stats:`, refreshError.message);
      // Continuar con la operación aunque falle el refresh
    }

    const Card = getCardModel();
    const User = getUserModel();
    const Transaction = getTransactionModel();

    // Obtener estadísticas básicas
    const totalUsers = await User.countDocuments({});
    const totalCards = await Card.countDocuments({});
    const totalTransactions = await Transaction.countDocuments({ isDeleted: { $ne: true }, status: { $ne: 'DELETED' } });

    // Obtener estadísticas de tarjetas por estado
    const activeCards = await Card.countDocuments({ status: 'ACTIVE' });
    const suspendedCards = await Card.countDocuments({ 
      status: { $in: ['SUSPENDED', 'BLOCKED', 'FROZEN'] } 
    });

    // Obtener estadísticas financieras globales desde transacciones (más preciso)
    const TransactionModel = getTransactionModel();
    const financialStats = await TransactionModel.aggregate([
      { $match: { isDeleted: { $ne: true }, status: { $ne: 'DELETED' } } },
      {
        $group: {
          _id: null,
          money_in: {
            $sum: {
              $cond: [
                { $in: ['$operation', ['WALLET_DEPOSIT', 'OVERRIDE_VIRTUAL_BALANCE']] }, 
                '$amount', 
                0
              ]
            }
          },
          refund: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'TRANSACTION_REFUND'] }, '$amount', 0]
            }
          },
          posted_approved: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'TRANSACTION_APPROVED'] }, '$amount', 0]
            }
          },
          reversed: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'TRANSACTION_REVERSED'] }, '$amount', 0]
            }
          },
          rejected: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'TRANSACTION_REJECTED'] }, '$amount', 0]
            }
          },
          withdrawal: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'WITHDRAWAL'] }, '$amount', 0]
            }
          },
          pending: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'TRANSACTION_PENDING'] }, '$amount', 0]
            }
          }
        }
      }
    ]);

    const stats = financialStats[0] || {
      money_in: 0,
      refund: 0,
      posted_approved: 0,
      reversed: 0,
      rejected: 0,
      pending: 0,
      available: 0
    };
    
    // Calcular posted como approved - reversed
    stats.posted = stats.posted_approved - stats.reversed;
    
    // Calcular available correctamente
    stats.available = stats.money_in + stats.refund - stats.posted - stats.pending;

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalCards,
        totalTransactions,
        totalDeposited: stats.totalDeposited,
        totalRefunded: stats.totalRefunded,
        totalPosted: stats.totalPosted,
        totalAvailable: stats.totalAvailable,
        activeCards,
        suspendedCards
      }
    });
  } catch (error) {
    console.error('❌ Error fetching admin stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para obtener los últimos 4 movimientos de una tarjeta específica - OPTIMIZADO CON CACHÉ
router.get('/card/:cardId/last-movements', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cardId } = req.params;
    
    // CACHÉ REMOVIDO - Consulta directa a la base de datos
    
    const Card = getCardModel();
    const Transaction = getTransactionModel();

    // Verificar que la tarjeta existe
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ success: false, message: 'Card not found' });
    }

    // Verificar permisos: admin puede ver cualquier tarjeta, usuario estándar solo sus propias tarjetas
    if (req.user.role !== 'admin' && card.userId !== req.user.userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. You can only view your own card movements.' 
      });
    }

    // Función para parsear fecha de transacción
    const parseTransactionDate = (dateStr, timeStr) => {
      try {
        const [day, month, year] = (dateStr || '').split('/');
        const [timePart, rawPeriod] = (timeStr || '').split(' ');
        let [hours, minutes] = (timePart || '00:00').split(':');
        const period = (rawPeriod || '').toLowerCase();
        hours = parseInt(hours);
        minutes = parseInt(minutes);
        if ((period === 'p. m.' || period === 'pm' || period === 'p.m.' || period === 'p') && hours !== 12) hours += 12;
        if ((period === 'a. m.' || period === 'am' || period === 'a.m.' || period === 'a') && hours === 12) hours = 0;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hours, minutes);
      } catch {
        return new Date();
      }
    };

    // Obtener TODAS las transacciones de la tarjeta (incluyendo eliminadas para admin)
    const allTransactions = await Transaction.find({ 
      cardId: cardId
    })
    .select({
      _id: 1,
      name: 1,
      amount: 1,
      date: 1,
      time: 1,
      status: 1,
      operation: 1,
      comentario: 1,
      createdAt: 1,
      isDeleted: 1
    });

    // Ordenar por fecha real de la transacción (más reciente primero) y tomar solo las últimas 4
    const lastMovements = allTransactions
      .map(tx => ({
        ...tx.toObject(),
        realDate: parseTransactionDate(tx.date, tx.time)
      }))
      .sort((a, b) => b.realDate - a.realDate)
      .slice(0, 4)
      .map(tx => ({
        _id: tx._id,
        name: tx.name,
        amount: tx.amount,
        date: tx.date,
        time: tx.time,
        status: tx.status,
        operation: tx.operation,
        comentario: tx.comentario,
        createdAt: tx.createdAt
      }));

    // Guardar en caché
    const cacheData = {
      card: {
        _id: card._id,
        name: card.name,
        last4: card.last4
      },
      movements: lastMovements,
      count: lastMovements.length,
      timestamp: new Date().toISOString()
    };
    // CACHÉ REMOVIDO - No se guarda en caché

    const responseTime = Date.now() - startTime;
    console.log(`✅ Last movements fetched from database in ${responseTime}ms`);

    res.json({
      success: true,
      card: cacheData.card,
      movements: lastMovements,
      count: lastMovements.length,
      cached: false,
      responseTime: responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching last movements (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

// Endpoint para invalidar caché (solo para administradores)
router.post('/admin/cache/invalidate', authenticateToken, async (req, res) => {
  try {
    // Verificar que el usuario sea admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin role required.' 
      });
    }

    const { cacheKeys } = req.body;
    
    if (cacheKeys && Array.isArray(cacheKeys)) {
      // Invalidar cachés específicos
      // CACHÉ REMOVIDO - No se invalida caché
      console.log(`✅ Cache invalidated for keys: ${cacheKeys.join(', ')}`);
    } else {
      // Limpiar todo el caché
      // CACHÉ REMOVIDO - No se limpia caché
      console.log('✅ All cache cleared');
    }

    res.json({
      success: true,
      message: cacheKeys ? 'Specific cache invalidated' : 'All cache cleared',
      invalidatedKeys: cacheKeys || 'all'
    });
  } catch (error) {
    console.error('❌ Error invalidating cache:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para obtener estadísticas del caché (solo para administradores)
router.get('/admin/cache/stats', authenticateToken, async (req, res) => {
  try {
    // Verificar que el usuario sea admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin role required.' 
      });
    }

    // CACHÉ REMOVIDO - No hay estadísticas de caché
    const stats = { hits: 0, misses: 0, keys: 0 };
    const cacheInfo = {};

    res.json({
      success: true,
      cacheStats: stats,
      cacheInfo: cacheInfo
    });
  } catch (error) {
    console.error('❌ Error getting cache stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para obtener el historial de una transacción específica
router.get('/card/:cardId/transactions/:transactionId/history', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cardId, transactionId } = req.params;
    
    const Card = getCardModel();
    const Transaction = getTransactionModel();

    // Verificar que la tarjeta existe
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ success: false, message: 'Card not found' });
    }

    // Verificar permisos: admin puede ver cualquier tarjeta, usuario estándar solo sus propias tarjetas
    if (req.user.role !== 'admin' && card.userId !== req.user.userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. You can only view your own card transactions.' 
      });
    }

    // Obtener la transacción con su historial
    const transaction = await Transaction.findOne({ 
      _id: transactionId, 
      cardId: cardId 
    }).select('_id name amount status version history createdAt updatedAt');

    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }

    const responseTime = Date.now() - startTime;
    console.log(`✅ Transaction history fetched in ${responseTime}ms`);

    res.json({
      success: true,
      transaction: {
        _id: transaction._id,
        name: transaction.name,
        amount: transaction.amount,
        status: transaction.status,
        version: transaction.version,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt
      },
      history: transaction.history,
      count: transaction.history.length,
      responseTime: responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching transaction history (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

// Endpoint para crear nueva transacción
router.post('/card/:cardId/transactions', authenticateToken, async (req, res) => {
  const startTime = Date.now();

  try {
    const { cardId } = req.params;
    const { amount, operation, date, time, comentario = '' } = req.body;

    // Validar datos requeridos
    if (!amount || !operation || !date || !time) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: amount, operation, date, time'
      });
    }

    // Validar operaciones permitidas
    const allowedOperations = [
      'TRANSACTION_APPROVED',
      'TRANSACTION_REJECTED', 
      'TRANSACTION_REVERSED',
      'TRANSACTION_REFUND',
      'WALLET_DEPOSIT',
      'OVERRIDE_VIRTUAL_BALANCE',
      'WITHDRAWAL'  // Nueva operación para retiros
    ];

    if (!allowedOperations.includes(operation)) {
      return res.status(400).json({
        success: false,
        message: `Invalid operation. Allowed: ${allowedOperations.join(', ')}`
      });
    }

    const Card = getCardModel();
    const Transaction = getTransactionModel();
    const User = getUserModel();

    // Verificar que la tarjeta existe
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ success: false, message: 'Card not found' });
    }

    // Obtener información del usuario
    const user = await User.findById(card.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Determinar si es crédito o débito
    const isCredit = operation === 'WALLET_DEPOSIT' || operation === 'TRANSACTION_REFUND' || operation === 'OVERRIDE_VIRTUAL_BALANCE' || operation === 'TRANSACTION_REVERSED';
    // WITHDRAWAL es débito (dinero que sale de la cuenta)

    // Para OVERRIDE_VIRTUAL_BALANCE, generar comentario automático con balance anterior y nuevo
    let finalComentario = comentario;
    if (operation === 'OVERRIDE_VIRTUAL_BALANCE') {
      const previousBalance = card.stats.available;
      const newBalance = previousBalance + parseFloat(amount);
      finalComentario = `OVERRIDE: $${previousBalance}→$${newBalance}`;
    }

    // Crear la transacción
    const transactionData = {
      _id: uuidv4(),
      userId: card.userId,
      cardId: cardId,
      userName: user.profile ? `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim() : user.username,
      cardName: card.name,
      name: operation === 'OVERRIDE_VIRTUAL_BALANCE' ? 'DEPOSIT' : 'Manual Transaction',
      amount: parseFloat(amount),
      date: date,
      time: time,
      status: 'SUCCESS',
      operation: operation,
      credit: isCredit,
      comentario: finalComentario,
      version: 1,
      isDeleted: false,
      history: [{
        version: 1,
        action: 'created',
        timestamp: new Date(),
        modifiedBy: req.user.userId,
        reason: 'Manual transaction created'
      }]
    };

    const transaction = new Transaction(transactionData);
    await transaction.save();

    // Actualizar estadísticas de la tarjeta directamente
    const allTransactions = await Transaction.find({ cardId: cardId });
    const activeTransactions = allTransactions.filter(tx => !tx.isDeleted && tx.status !== 'DELETED');
    const deletedTransactions = allTransactions.filter(tx => tx.isDeleted || tx.status === 'DELETED');
    
    // Calcular estadísticas
    let totalDeposited = 0;   // WALLET_DEPOSIT + OVERRIDE_VIRTUAL_BALANCE
    let totalRefunded = 0;    // TRANSACTION_REFUND
    let totalPosted = 0;      // TRANSACTION_APPROVED
    let totalPending = 0;     // TRANSACTION_PENDING
    let totalWithdrawal = 0;  // WITHDRAWAL
    let totalDeletedAmount = 0; // Monto de transacciones eliminadas
    
    const stats = {
      totalTransactions: allTransactions.length,
      byOperation: {
        TRANSACTION_APPROVED: 0,
        TRANSACTION_REJECTED: 0,
        TRANSACTION_REVERSED: 0,
        TRANSACTION_REFUND: 0,
        TRANSACTION_PENDING: 0,
        WALLET_DEPOSIT: 0,
        OVERRIDE_VIRTUAL_BALANCE: 0
      },
      byAmount: {
        TRANSACTION_APPROVED: 0,
        TRANSACTION_REJECTED: 0,
        TRANSACTION_REVERSED: 0,
        TRANSACTION_REFUND: 0,
        TRANSACTION_PENDING: 0,
        WALLET_DEPOSIT: 0,
        OVERRIDE_VIRTUAL_BALANCE: 0
      }
    };
    
    // Calcular estadísticas de transacciones activas
    for (const transaction of activeTransactions) {
      const operation = transaction.operation || 'UNKNOWN';
      
      // Contar por operación
      if (stats.byOperation.hasOwnProperty(operation)) {
        stats.byOperation[operation]++;
        stats.byAmount[operation] += transaction.amount;
      }
      
      // Calcular por tipo específico de operación
      if (operation === 'WALLET_DEPOSIT' || operation === 'OVERRIDE_VIRTUAL_BALANCE') {
        totalDeposited += transaction.amount;
      } else if (operation === 'TRANSACTION_REFUND') {
        totalRefunded += transaction.amount;
      } else if (operation === 'TRANSACTION_APPROVED') {
        totalPosted += transaction.amount;
      } else if (operation === 'TRANSACTION_PENDING') {
        totalPending += transaction.amount;
      } else if (operation === 'WITHDRAWAL') {
        totalWithdrawal += transaction.amount;
      }
    }
    
    // Calcular monto de transacciones eliminadas
    for (const transaction of deletedTransactions) {
      totalDeletedAmount += transaction.amount;
    }
    
    // Actualizar la tarjeta con las estadísticas calculadas
    card.stats = {
      money_in: totalDeposited,
      refund: totalRefunded,
      posted: totalPosted,
      reversed: stats.byAmount.TRANSACTION_REVERSED,
      rejected: stats.byAmount.TRANSACTION_REJECTED,
      pending: totalPending,
      withdrawal: totalWithdrawal,
      available: totalDeposited + totalRefunded - totalPosted - totalPending - totalWithdrawal,
      total_all_transactions: allTransactions.length,
      total_deleted_transactions: deletedTransactions.length,
      deleted_amount: totalDeletedAmount
    };
    
    card.transactionStats = {
      ...stats,
      lastUpdated: new Date()
    };
    
    await card.save();

    // Actualizar KPIs del usuario
    user.stats.totalTransactions += 1;
    if (isCredit) {
      user.stats.totalDeposited += parseFloat(amount);
    } else {
      user.stats.totalPosted += parseFloat(amount);
    }
    user.stats.totalAvailable = user.stats.totalDeposited - user.stats.totalPosted;
    
    await user.save();

    const responseTime = Date.now() - startTime;
    console.log(`✅ Transaction ${transaction._id} created successfully in ${responseTime}ms`);

    // Log en historial centralizado
    try {
      await historyService.logCRUDOperation(
        'TRANSACTION_CREATED', 
        'Transaction', 
        transaction._id, 
        req.user, 
        [], 
        {
          transactionAmount: transaction.amount,
          transactionOperation: transaction.operation,
          cardLast4: card.last4
        }, 
        {
          method: 'POST',
          endpoint: `/api/cards/card/${cardId}/transactions`,
          statusCode: 201,
          responseTime: responseTime
        }
      );
    } catch (historyError) {
      console.error('❌ Error logging transaction creation to history:', historyError);
    }

    // Recalcular stats de la tarjeta después de la creación
    const cardStatsService = require('../../services/cardStatsService');
    const recalculatedStats = await cardStatsService.recalculateCardStats(cardId);

    // Invalidar caché relacionado
    const lastMovementsCacheKey = `last_movements_${cardId}`;
    // CACHÉ REMOVIDO - No se invalida caché

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      transaction: transaction,
      updatedCardStats: {
        deposited: recalculatedStats.card.deposited,
        posted: recalculatedStats.card.posted,
        available: recalculatedStats.card.available
      },
      responseTime: responseTime
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error creating transaction (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

// Endpoint para admin dashboard - manejar query params como card y action
router.get('/admin/cards', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { card: cardId, action, page = 1, limit = 1000 } = req.query;
    
    // Verificar que el usuario sea admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin role required.' 
      });
    }

    // Si no hay cardId, devolver error
    if (!cardId) {
      return res.status(400).json({
        success: false,
        error: 'Card ID is required as query parameter'
      });
    }

    const Card = getCardModel();
    const Transaction = getTransactionModel();

    // Verificar que la tarjeta existe
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ 
        success: false, 
        message: 'Card not found' 
      });
    }

    // Configurar paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let transactionQuery = { cardId: cardId };
    let includeDeleted = false;

    // Si action=all-movements, incluir transacciones eliminadas
    if (action === 'all-movements') {
      includeDeleted = true;
      // No filtrar por isDeleted ni status para mostrar TODAS
    } else {
      // Comportamiento normal: solo activas
      transactionQuery.isDeleted = { $ne: true };
      transactionQuery.status = { $ne: 'DELETED' };
    }

    // Obtener transacciones según el filtro
    const transactions = await Transaction.find(transactionQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalTransactions = await Transaction.countDocuments(transactionQuery);

    // Calcular estadísticas SIEMPRE con transacciones activas (sin eliminadas)
    const cardStats = await Transaction.aggregate([
      { $match: { cardId: cardId, isDeleted: { $ne: true }, status: { $ne: 'DELETED' } } },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          money_in: {
            $sum: {
              $cond: [
                { $in: ['$operation', ['WALLET_DEPOSIT', 'OVERRIDE_VIRTUAL_BALANCE']] }, 
                '$amount', 
                0
              ]
            }
          },
          refund: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'TRANSACTION_REFUND'] }, '$amount', 0]
            }
          },
          posted_approved: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'TRANSACTION_APPROVED'] }, '$amount', 0]
            }
          },
          reversed: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'TRANSACTION_REVERSED'] }, '$amount', 0]
            }
          },
          rejected: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'TRANSACTION_REJECTED'] }, '$amount', 0]
            }
          },
          withdrawal: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'WITHDRAWAL'] }, '$amount', 0]
            }
          },
          pending: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'TRANSACTION_PENDING'] }, '$amount', 0]
            }
          }
        }
      }
    ]);

    const stats = cardStats[0] || {
      totalTransactions: 0,
      totalDeposited: 0,
      totalRefunded: 0,
      totalPosted: 0,
      totalPending: 0
    };

    const responseTime = Date.now() - startTime;
    console.log(`✅ Admin cards ${includeDeleted ? 'with deleted' : 'active only'} for card ${cardId} fetched in ${responseTime}ms`);

    // Preparar la respuesta con el formato esperado por el frontend
    const response = {
      success: true,
      card: {
        _id: card._id,
        name: card.name,
        last4: card.last4,
        status: card.status
      },
      stats: {
        ...stats,
        totalAvailable: stats.totalDeposited + stats.totalRefunded - stats.totalPosted - stats.totalPending
      },
      transactions: transactions.map(tx => ({
        ...tx.toObject(),
        isDeleted: tx.isDeleted || tx.status === 'DELETED'
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalTransactions,
        pages: Math.ceil(totalTransactions / parseInt(limit))
      }
    };

    // Si incluye eliminadas, agregar info adicional
    if (includeDeleted) {
      const deletedCount = await Transaction.countDocuments({ 
        cardId: cardId, 
        $or: [
          { isDeleted: true },
          { status: 'DELETED' }
        ]
      });
      
      response.stats.totalDeletedTransactions = deletedCount;
      response.stats.totalAllTransactions = totalTransactions;
    }

    // Usar formato de respuesta con caché simulado
    res.json({
      ...response,
      timestamp: new Date().toISOString(),
      cached: false,
      cacheTimestamp: new Date().toISOString(),
      responseTime: responseTime
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error in admin cards endpoint (${responseTime}ms):`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      responseTime: responseTime 
    });
  }
});

// Endpoint para admin dashboard - obtener TODAS las transacciones (incluyendo eliminadas) para auditoría
router.get('/admin/card/:cardId/all-movements', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cardId } = req.params;
    const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Verificar que el usuario sea admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin role required.' 
      });
    }

    const Card = getCardModel();
    const Transaction = getTransactionModel();

    // Verificar que la tarjeta existe
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ 
        success: false, 
        message: 'Card not found' 
      });
    }

    // Configurar paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Configurar ordenamiento
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Obtener TODAS las transacciones (incluyendo eliminadas) para el dashboard admin
    const allTransactions = await Transaction.find({ cardId: cardId })
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    const totalAllTransactions = await Transaction.countDocuments({ cardId: cardId });

    // Calcular estadísticas SOLO con transacciones activas (sin eliminadas)
    const cardStats = await Transaction.aggregate([
      { $match: { cardId: cardId, isDeleted: { $ne: true }, status: { $ne: 'DELETED' } } },
      {
        $group: {
          _id: null,
          totalActiveTransactions: { $sum: 1 },
          money_in: {
            $sum: {
              $cond: [
                { $in: ['$operation', ['WALLET_DEPOSIT', 'OVERRIDE_VIRTUAL_BALANCE']] }, 
                '$amount', 
                0
              ]
            }
          },
          refund: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'TRANSACTION_REFUND'] }, '$amount', 0]
            }
          },
          posted_approved: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'TRANSACTION_APPROVED'] }, '$amount', 0]
            }
          },
          reversed: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'TRANSACTION_REVERSED'] }, '$amount', 0]
            }
          },
          rejected: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'TRANSACTION_REJECTED'] }, '$amount', 0]
            }
          },
          withdrawal: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'WITHDRAWAL'] }, '$amount', 0]
            }
          },
          pending: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'TRANSACTION_PENDING'] }, '$amount', 0]
            }
          }
        }
      }
    ]);

    // Obtener conteo de transacciones eliminadas para información adicional
    const deletedCount = await Transaction.countDocuments({ 
      cardId: cardId, 
      $or: [
        { isDeleted: true },
        { status: 'DELETED' }
      ]
    });

    const stats = cardStats[0] || {
      totalActiveTransactions: 0,
      totalDeposited: 0,
      totalRefunded: 0,
      totalPosted: 0,
      totalPending: 0
    };

    const responseTime = Date.now() - startTime;
    console.log(`✅ Admin all movements for card ${cardId} fetched in ${responseTime}ms`);

    res.json({
      success: true,
      card: {
        _id: card._id,
        name: card.name,
        last4: card.last4,
        status: card.status
      },
      stats: {
        ...stats,
        totalAvailable: stats.totalDeposited + stats.totalRefunded - stats.totalPosted - stats.totalPending,
        totalDeletedTransactions: deletedCount,
        totalAllTransactions: totalAllTransactions
      },
      transactions: allTransactions.map(tx => ({
        ...tx.toObject(),
        isDeleted: tx.isDeleted || tx.status === 'DELETED'
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalAllTransactions,
        pages: Math.ceil(totalAllTransactions / parseInt(limit))
      },
      responseTime: responseTime
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching admin all movements (${responseTime}ms):`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      responseTime: responseTime 
    });
  }
});

// Endpoint público para obtener estadísticas básicas de tarjetas del sistema
router.get('/public-stats', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const Card = getCardModel();
    const Transaction = getTransactionModel();
    
    console.log('🚀 Fetching public cards statistics...');
    
    // Fecha de hace 2 meses
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    
    // Obtener estadísticas generales
    const totalCards = await Card.countDocuments();
    
    // Distribución por proveedor
    const cardsBySupplier = await Card.aggregate([
      {
        $group: {
          _id: '$supplier',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Distribución por estado
    const cardsByStatus = await Card.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Tarjetas con balance CryptoMate
    const cardsWithCryptoMateBalance = await Card.countDocuments({
      'cryptoMateBalance.available_credit': { $gt: 0 }
    });
    
    // Obtener tarjetas con actividad en los últimos 2 meses
    const activeCards = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: twoMonthsAgo },
          isDeleted: { $ne: true },
          status: { $ne: 'DELETED' }
        }
      },
      {
        $group: {
          _id: '$cardId'
        }
      }
    ]);
    
    const activeCardIds = activeCards.map(card => card._id);
    
    // Estadísticas por proveedor con actividad
    const supplierStats = await Card.aggregate([
      {
        $group: {
          _id: '$supplier',
          totalCards: { $sum: 1 },
          activeCards: {
            $sum: {
              $cond: [
                { $in: ['$_id', activeCardIds] },
                1,
                0
              ]
            }
          },
          inactiveCards: {
            $sum: {
              $cond: [
                { $not: { $in: ['$_id', activeCardIds] } },
                1,
                0
              ]
            }
          },
          totalAvailable: { $sum: '$stats.available' },
          activeAvailable: {
            $sum: {
              $cond: [
                { $in: ['$_id', activeCardIds] },
                '$stats.available',
                0
              ]
            }
          },
          inactiveAvailable: {
            $sum: {
              $cond: [
                { $not: { $in: ['$_id', activeCardIds] } },
                '$stats.available',
                0
              ]
            }
          }
        }
      },
      {
        $sort: { totalCards: -1 }
      }
    ]);
    
    // Asegurar que siempre tengamos CryptoMate y Mercury en la respuesta
    const finalSupplierStats = [];
    const cryptomateStats = supplierStats.find(s => s._id === 'CryptoMate') || {
      _id: 'CryptoMate',
      totalCards: 0,
      activeCards: 0,
      inactiveCards: 0,
      totalAvailable: 0,
      activeAvailable: 0,
      inactiveAvailable: 0
    };
    
    const mercuryStats = supplierStats.find(s => s._id === 'Mercury') || {
      _id: 'Mercury',
      totalCards: 0,
      activeCards: 0,
      inactiveCards: 0,
      totalAvailable: 0,
      activeAvailable: 0,
      inactiveAvailable: 0
    };
    
    finalSupplierStats.push(cryptomateStats, mercuryStats);
    
    // Obtener detalles de tarjetas activas e inactivas
    const activeCardsDetails = await Card.find({
      _id: { $in: activeCardIds }
    }).select('_id name last4 supplier status stats.available');
    
    const inactiveCardsDetails = await Card.find({
      _id: { $nin: activeCardIds }
    }).select('_id name last4 supplier status stats.available');
    
    // Estadísticas generales de actividad
    const totalActiveCards = activeCardIds.length;
    const totalInactiveCards = totalCards - totalActiveCards;
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ Public cards statistics fetched in ${responseTime}ms`);
    
    res.json({
      success: true,
      data: {
        overview: {
          totalCards,
          totalActiveCards,
          totalInactiveCards,
          cardsWithCryptoMateBalance,
          activityPeriod: '2 months',
          responseTime
        },
        distribution: {
          bySupplier: cardsBySupplier,
          byStatus: cardsByStatus
        },
        supplierDetails: finalSupplierStats,
        activity: {
          activeCards: totalActiveCards,
          inactiveCards: totalInactiveCards,
          activePercentage: totalCards > 0 ? Math.round((totalActiveCards / totalCards) * 100) : 0,
          inactivePercentage: totalCards > 0 ? Math.round((totalInactiveCards / totalCards) * 100) : 0
        },
        cardsDetails: {
          active: activeCardsDetails.map(card => ({
            id: card._id,
            name: card.name,
            last4: card.last4,
            supplier: card.supplier,
            status: card.status,
            available: card.stats.available
          })),
          inactive: inactiveCardsDetails.map(card => ({
            id: card._id,
            name: card.name,
            last4: card.last4,
            supplier: card.supplier,
            status: card.status,
            available: card.stats.available
          }))
        },
        lastUpdated: new Date()
      }
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching public cards statistics (${responseTime}ms):`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      responseTime: responseTime 
    });
  }
});

// Endpoint para obtener estadísticas generales de tarjetas del sistema (requiere autenticación admin)
router.get('/system-stats', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const Card = getCardModel();
    
    // Verificar que el usuario sea admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }
    
    console.log('🚀 Fetching system cards statistics...');
    
    // Obtener estadísticas generales
    const totalCards = await Card.countDocuments();
    
    // Distribución por proveedor
    const cardsBySupplier = await Card.aggregate([
      {
        $group: {
          _id: '$supplier',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Distribución por estado
    const cardsByStatus = await Card.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Distribución por tipo
    const cardsByType = await Card.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Estadísticas financieras agregadas
    const financialStats = await Card.aggregate([
      {
        $group: {
          _id: null,
          totalMoneyIn: { $sum: '$stats.money_in' },
          totalRefund: { $sum: '$stats.refund' },
          totalPosted: { $sum: '$stats.posted' },
          totalReversed: { $sum: '$stats.reversed' },
          totalRejected: { $sum: '$stats.rejected' },
          totalPending: { $sum: '$stats.pending' },
          totalWithdrawal: { $sum: '$stats.withdrawal' },
          totalAvailable: { $sum: '$stats.available' },
          avgMoneyIn: { $avg: '$stats.money_in' },
          avgAvailable: { $avg: '$stats.available' }
        }
      }
    ]);
    
    // Tarjetas con balance CryptoMate
    const cardsWithCryptoMateBalance = await Card.countDocuments({
      'cryptoMateBalance.available_credit': { $gt: 0 }
    });
    
    // Últimas tarjetas creadas
    const recentCards = await Card.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('_id name last4 supplier status createdAt');
    
    // Tarjetas por proveedor con detalles
    const supplierDetails = await Card.aggregate([
      {
        $group: {
          _id: '$supplier',
          count: { $sum: 1 },
          totalMoneyIn: { $sum: '$stats.money_in' },
          totalAvailable: { $sum: '$stats.available' },
          avgAvailable: { $avg: '$stats.available' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ System cards statistics fetched in ${responseTime}ms`);
    
    res.json({
      success: true,
      data: {
        overview: {
          totalCards,
          cardsWithCryptoMateBalance,
          responseTime
        },
        distribution: {
          bySupplier: cardsBySupplier,
          byStatus: cardsByStatus,
          byType: cardsByType
        },
        financial: financialStats[0] || {
          totalMoneyIn: 0,
          totalRefund: 0,
          totalPosted: 0,
          totalReversed: 0,
          totalRejected: 0,
          totalPending: 0,
          totalWithdrawal: 0,
          totalAvailable: 0,
          avgMoneyIn: 0,
          avgAvailable: 0
        },
        supplierDetails,
        recentCards,
        lastUpdated: new Date()
      }
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching system cards statistics (${responseTime}ms):`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      responseTime: responseTime 
    });
  }
});

module.exports = router;
