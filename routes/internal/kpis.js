const express = require('express');
const router = express.Router();
const { getTransactionModel } = require('../../models/Transaction');
const { getCardModel } = require('../../models/Card');
const { getUserModel } = require('../../models/User');
const { authenticateToken } = require('../../middleware/auth');

// Endpoint para obtener las últimas 10 movimientos del sistema con detalles de usuario y tarjeta
router.get('/last-10-movements', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const Transaction = getTransactionModel();
    const Card = getCardModel();
    const User = getUserModel();

    // Obtener las últimas 10 transacciones del sistema (ordenadas por fecha de creación)
    const transactions = await Transaction.find({
      isDeleted: { $ne: true },
      status: { $ne: 'DELETED' }
    })
    .select({
      _id: 1,
      userId: 1,
      cardId: 1,
      name: 1,
      amount: 1,
      date: 1,
      time: 1,
      status: 1,
      operation: 1,
      createdAt: 1
    })
    .sort({ createdAt: -1 })
    .limit(10);

    // Enriquecer cada transacción con información del usuario y tarjeta
    const enrichedTransactions = await Promise.all(transactions.map(async (transaction) => {
      // Obtener información del usuario
      const user = await User.findById(transaction.userId).select({
        _id: 1,
        username: 1,
        email: 1,
        profile: 1
      });

      // Obtener información de la tarjeta
      const card = await Card.findById(transaction.cardId).select({
        _id: 1,
        name: 1,
        last4: 1,
        status: 1
      });

      return {
        _id: transaction._id,
        name: transaction.name,
        amount: transaction.amount,
        date: transaction.date,
        time: transaction.time,
        status: transaction.status,
        operation: transaction.operation,
        createdAt: transaction.createdAt,
        user: user ? {
          _id: user._id,
          username: user.username,
          email: user.email,
          profile: user.profile
        } : null,
        card: card ? {
          _id: card._id,
          name: card.name,
          last4: card.last4,
          status: card.status
        } : null
      };
    }));

    const responseTime = Date.now() - startTime;
    console.log(`✅ Last 10 movements KPIs fetched in ${responseTime}ms`);

    res.json({
      success: true,
      kpis: {
        last10Movements: enrichedTransactions,
        count: enrichedTransactions.length,
        timestamp: new Date().toISOString(),
        responseTime: responseTime
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching last 10 movements KPIs (${responseTime}ms):`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      responseTime: responseTime 
    });
  }
});

module.exports = router;
