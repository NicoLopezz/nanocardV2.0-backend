const express = require('express');
const router = express.Router();
const { getTransactionModel } = require('../../../models/Transaction');

// Endpoint temporal para debugging - verificar transacciones de Mercury en la DB
router.get('/check-mercury-transactions', async (req, res) => {
  try {
    const Transaction = getTransactionModel();
    
    // Contar todas las transacciones de Mercury
    const totalMercuryTransactions = await Transaction.countDocuments({ supplier: 'mercury' });
    
    // Obtener algunas transacciones de muestra
    const sampleTransactions = await Transaction.find({ supplier: 'mercury' })
      .limit(5)
      .lean();
    
    // Contar por cardId
    const transactionsByCard = await Transaction.aggregate([
      { $match: { supplier: 'mercury' } },
      { $group: { _id: '$cardId', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
      debug: {
        totalMercuryTransactions,
        sampleTransactions,
        transactionsByCard,
        message: 'Mercury transactions in dev_transactions database'
      }
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
