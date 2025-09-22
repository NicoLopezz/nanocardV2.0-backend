const express = require('express');
const router = express.Router();
const { getCardModel } = require('../models/Card');
const { getUserModel } = require('../models/User');
const { getTransactionModel } = require('../models/Transaction');
const { authenticateToken } = require('../middleware/auth');

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

// Endpoint para obtener TODAS las tarjetas (solo para administradores)
router.get('/admin/all', authenticateToken, async (req, res) => {
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

    // Obtener todas las tarjetas
    const cards = await Card.find({});
    
    // Enriquecer con información del usuario
    const enrichedCards = await Promise.all(
      cards.map(async (card) => {
        const user = await User.findById(card.userId);
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
      })
    );

    res.json({
      success: true,
      cards: enrichedCards,
      count: enrichedCards.length
    });
  } catch (error) {
    console.error('❌ Error fetching all cards for admin:', error);
    res.status(500).json({ success: false, error: error.message });
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

// Endpoint para actualizar una transacción específica
router.put('/card/:cardId/transactions/:transactionId', authenticateToken, async (req, res) => {
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

    // Actualizar la transacción
    const updatedTransaction = await Transaction.findByIdAndUpdate(
      transactionId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    console.log(`✅ Transaction ${transactionId} updated successfully`);

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      transaction: updatedTransaction
    });

  } catch (error) {
    console.error('❌ Error updating transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para eliminar una transacción específica (soft delete)
router.delete('/card/:cardId/transactions/:transactionId', authenticateToken, async (req, res) => {
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

    // Actualizar la transacción con soft delete
    const deletedTransaction = await Transaction.findByIdAndUpdate(
      transactionId,
      { 
        $set: { 
          status: 'DELETED',
          comentario: `Deleted at ${deletedAtFormatted}`,
          deletedAt: deletedAt,
          updatedAt: deletedAt
        }
      },
      { new: true, runValidators: true }
    );

    console.log(`✅ Transaction ${transactionId} deleted successfully`);

    res.json({
      success: true,
      message: 'Transaction deleted successfully',
      transaction: deletedTransaction
    });

  } catch (error) {
    console.error('❌ Error deleting transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para obtener transacciones de una tarjeta específica
router.get('/card/:cardId/transactions', async (req, res) => {
  try {
    const { cardId } = req.params;
    const { page = 1, limit = 10, sortBy = 'date', sortOrder = 'desc' } = req.query;
    
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
          }
        }
      }
    ]);

    const stats = cardStats[0] || {
      totalTransactions: 0,
      totalDeposited: 0,
      totalRefunded: 0,
      totalPosted: 0
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
        totalAvailable: stats.totalDeposited + stats.totalRefunded - stats.totalPosted
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

// Endpoint para obtener los últimos 4 movimientos de una tarjeta específica
router.get('/card/:cardId/last-movements', authenticateToken, async (req, res) => {
  try {
    const { cardId } = req.params;
    
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

    res.json({
      success: true,
      card: {
        _id: card._id,
        name: card.name,
        last4: card.last4
      },
      movements: lastMovements,
      count: lastMovements.length
    });
  } catch (error) {
    console.error('❌ Error fetching last movements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
