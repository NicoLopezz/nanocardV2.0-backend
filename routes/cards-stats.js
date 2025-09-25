const express = require('express');
const router = express.Router();
const { getCardModel } = require('../models/Card');
const { getUserModel } = require('../models/User');
const { getTransactionModel } = require('../models/Transaction');
const { authenticateToken } = require('../middleware/auth');
const cacheService = require('../services/cacheService');
const historyService = require('../services/historyService');
const { v4: uuidv4 } = require('uuid');

// Endpoint para obtener las tarjetas del usuario autenticado
router.get('/', authenticateToken, async (req, res) => {
  try {
    const Card = getCardModel();
    const userId = req.user.userId;

    // Obtener todas las tarjetas del usuario
    const cards = await Card.find({ userId: userId });

    res.json({
      success: true,
      cards: cards,
      count: cards.length
    });
  } catch (error) {
    console.error('❌ Error fetching user cards:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para obtener TODAS las tarjetas (solo para administradores) - OPTIMIZADO CON CACHÉ
router.get('/admin/all', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Verificar que el usuario sea admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin role required.' 
      });
    }

    // Verificar caché primero
    const cacheKey = cacheService.KEYS.ADMIN_ALL_CARDS;
    const cachedData = cacheService.get(cacheKey);
    
    if (cachedData) {
      const responseTime = Date.now() - startTime;
      console.log(`✅ Admin all cards served from cache in ${responseTime}ms`);
      
      return res.json({
        success: true,
        cards: cachedData.cards,
        count: cachedData.count,
        cached: true,
        cacheTimestamp: cachedData.timestamp,
        responseTime: responseTime
      });
    }

    const Card = getCardModel();
    const User = getUserModel();

    // Obtener todas las tarjetas con campos específicos
    const cards = await Card.find({}, {
      _id: 1,
      name: 1,
      last4: 1,
      status: 1,
      deposited: 1,
      refunded: 1,
      posted: 1,
      available: 1,
      userId: 1,
      supplier: 1,
      limits: 1,
      createdAt: 1,
      updatedAt: 1
    });

    // Obtener todos los usuarios de una vez (optimización)
    const userIds = [...new Set(cards.map(card => card.userId))];
    const users = await User.find(
      { _id: { $in: userIds } },
      { _id: 1, username: 1, profile: 1 }
    );

    // Crear mapa de usuarios para acceso rápido
    const userMap = new Map();
    users.forEach(user => {
      userMap.set(user._id.toString(), user);
    });
    
    // Enriquecer tarjetas con información del usuario (sin consultas individuales)
    const enrichedCards = cards.map(card => {
      const user = userMap.get(card.userId.toString());
      return {
        _id: card._id,
        name: card.name,
        last4: card.last4,
        status: card.status,
        deposited: card.deposited || 0,
        refunded: card.refunded || 0,
        posted: card.posted || 0,
        available: card.available || 0,
        userId: card.userId,
        userName: user ? `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || user.username : 'Unknown User',
        supplier: card.supplier || 'Nano',
        limits: card.limits,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt
      };
    });

    // Guardar en caché
    const cacheData = {
      cards: enrichedCards,
      count: enrichedCards.length,
      timestamp: new Date().toISOString()
    };
    cacheService.set(cacheKey, cacheData);

    const responseTime = Date.now() - startTime;
    console.log(`✅ Admin all cards fetched from database in ${responseTime}ms`);

    res.json({
      success: true,
      cards: enrichedCards,
      count: enrichedCards.length,
      cached: false,
      responseTime: responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching all cards for admin (${responseTime}ms):`, error);
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

    console.log(`✅ Card ${cardId} updated successfully`);

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
      isDeleted: { $ne: true }
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

    // Invalidar caché relacionado
    const lastMovementsCacheKey = `last_movements_${cardId}`;
    cacheService.invalidate(lastMovementsCacheKey);

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      transaction: updatedTransaction,
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

    // Crear historial de eliminación
    const newVersion = transaction.version + 1;

    // Actualizar la transacción con soft delete y historial
    const deletedTransaction = await Transaction.findByIdAndUpdate(
      transactionId,
      { 
        $set: { 
          status: 'DELETED',
          comentario: `Deleted at ${deletedAtFormatted}`,
          deletedAt: deletedAt,
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

    // Invalidar caché relacionado
    const lastMovementsCacheKey = `last_movements_${cardId}`;
    cacheService.invalidate(lastMovementsCacheKey);

    res.json({
      success: true,
      message: 'Transaction deleted successfully',
      transaction: deletedTransaction,
      responseTime: responseTime
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error deleting transaction (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

// Endpoint para obtener transacciones de una tarjeta específica
router.get('/card/:cardId/transactions', async (req, res) => {
  try {
    const { cardId } = req.params;
    const { page = 1, limit = 50, sortBy = 'date', sortOrder = 'desc' } = req.query;
    
    const Card = getCardModel();
    const Transaction = getTransactionModel();

    // Verificar que la tarjeta existe
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ success: false, message: 'Card not found' });
    }

    // Configurar paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Configurar ordenamiento
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Obtener transacciones activas de la tarjeta
    const transactions = await Transaction.find({ cardId: cardId, isDeleted: { $ne: true } })
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    const totalTransactions = await Transaction.countDocuments({ cardId: cardId, isDeleted: { $ne: true } });

    // Calcular estadísticas de la tarjeta
    const cardStats = await Transaction.aggregate([
      { $match: { cardId: cardId, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalDeposited: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'WALLET_DEPOSIT'] }, '$amount', 0]
            }
          },
          totalRefunded: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'TRANSACTION_REFUND'] }, '$amount', 0]
            }
          },
          totalPosted: {
            $sum: {
              $cond: [{ $eq: ['$operation', 'TRANSACTION_APPROVED'] }, '$amount', 0]
            }
          },
          totalPending: {
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
        totalAvailable: stats.totalDeposited + stats.totalRefunded - stats.totalPosted - stats.totalPending
      },
      transactions: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalTransactions,
        pages: Math.ceil(totalTransactions / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching card transactions:', error);
    res.status(500).json({ success: false, error: error.message });
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

    const Card = getCardModel();
    const User = getUserModel();
    const Transaction = getTransactionModel();

    // Obtener estadísticas básicas
    const totalUsers = await User.countDocuments({});
    const totalCards = await Card.countDocuments({});
    const totalTransactions = await Transaction.countDocuments({ isDeleted: { $ne: true } });

    // Obtener estadísticas de tarjetas por estado
    const activeCards = await Card.countDocuments({ status: 'ACTIVE' });
    const suspendedCards = await Card.countDocuments({ 
      status: { $in: ['SUSPENDED', 'BLOCKED', 'FROZEN'] } 
    });

    // Obtener estadísticas financieras globales
    const financialStats = await Card.aggregate([
      {
        $group: {
          _id: null,
          totalDeposited: { $sum: '$deposited' },
          totalRefunded: { $sum: '$refunded' },
          totalPosted: { $sum: '$posted' },
          totalAvailable: { $sum: '$available' }
        }
      }
    ]);

    const stats = financialStats[0] || {
      totalDeposited: 0,
      totalRefunded: 0,
      totalPosted: 0,
      totalAvailable: 0
    };

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
    
    // Verificar caché primero
    const cacheKey = `last_movements_${cardId}`;
    const cachedData = cacheService.get(cacheKey);
    
    if (cachedData) {
      const responseTime = Date.now() - startTime;
      console.log(`✅ Last movements served from cache in ${responseTime}ms`);
      
      return res.json({
        success: true,
        card: cachedData.card,
        movements: cachedData.movements,
        count: cachedData.count,
        cached: true,
        cacheTimestamp: cachedData.timestamp,
        responseTime: responseTime
      });
    }
    
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

    // Obtener los últimos 4 movimientos activos de la tarjeta
    const lastMovements = await Transaction.find({ 
      cardId: cardId, 
      isDeleted: { $ne: true } 
    })
    .sort({ createdAt: -1 }) // Ordenar por fecha de creación descendente
    .limit(4)
    .select({
      _id: 1,
      name: 1,
      amount: 1,
      date: 1,
      time: 1,
      status: 1,
      operation: 1,
      createdAt: 1
    });

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
    cacheService.set(cacheKey, cacheData, 180); // 3 minutos de TTL

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
      cacheService.invalidateMultiple(cacheKeys);
      console.log(`✅ Cache invalidated for keys: ${cacheKeys.join(', ')}`);
    } else {
      // Limpiar todo el caché
      cacheService.clear();
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

    const stats = cacheService.getStats();
    const cacheKeys = Object.values(cacheService.KEYS);
    const cacheInfo = {};

    cacheKeys.forEach(key => {
      const hasKey = cacheService.has(key);
      const ttl = cacheService.getTtl(key);
      cacheInfo[key] = {
        exists: hasKey,
        ttl: ttl,
        ttlSeconds: ttl > 0 ? Math.floor(ttl / 1000) : 0
      };
    });

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
    const isCredit = operation === 'WALLET_DEPOSIT' || operation === 'TRANSACTION_REFUND' || operation === 'OVERRIDE_VIRTUAL_BALANCE';
    // WITHDRAWAL es débito (dinero que sale de la cuenta)

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
      status: operation === 'TRANSACTION_APPROVED' ? 'SUCCESS' : 'Completed',
      operation: operation,
      credit: isCredit,
      comentario: comentario,
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

    // Actualizar totales de la tarjeta
    const cardTransactions = await Transaction.find({ cardId: cardId });
    
    card.deposited = cardTransactions
      .filter(t => t.credit)
      .reduce((sum, t) => sum + t.amount, 0);
    
    card.posted = cardTransactions
      .filter(t => !t.credit)
      .reduce((sum, t) => sum + t.amount, 0);
    
    card.available = card.deposited - card.posted;
    
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
      await historyService.logCRUDOperation('TRANSACTION_CREATED', 'Transaction', transaction._id, req.user, [], {
        transactionAmount: transaction.amount,
        transactionOperation: transaction.operation,
        cardLast4: card.last4
      }, {
        method: 'POST',
        endpoint: `/api/cards/card/${cardId}/transactions`,
        statusCode: 201,
        responseTime: responseTime
      });
    } catch (historyError) {
      console.error('❌ Error logging transaction creation to history:', historyError);
    }

    // Invalidar caché relacionado
    const lastMovementsCacheKey = `last_movements_${cardId}`;
    cacheService.invalidate(lastMovementsCacheKey);

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      transaction: transaction,
      responseTime: responseTime
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error creating transaction (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

module.exports = router;
