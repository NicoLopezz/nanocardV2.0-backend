const express = require('express');
const router = express.Router();
const { getTransactionModel } = require('../../../models/Transaction');
const { connectDatabases, closeDatabaseConnections } = require('../../../config/database');

// Endpoint para verificar transacciones Mercury en la base de datos
router.get('/check-mercury-transactions', async (req, res) => {
  try {
    await connectDatabases();
    const Transaction = getTransactionModel();
    
    const mercuryTransactions = await Transaction.find({ supplier: 'mercury' }).lean();
    
    const transactionsByCard = mercuryTransactions.reduce((acc, transaction) => {
      if (transaction.cardId) {
        acc[transaction.cardId] = (acc[transaction.cardId] || 0) + 1;
      }
      return acc;
    }, {});
    
    const formattedTransactionsByCard = Object.entries(transactionsByCard).map(([cardId, count]) => ({
      _id: cardId,
      count: count
    }));
    
    res.json({
      success: true,
      debug: {
        totalMercuryTransactions: mercuryTransactions.length,
        sampleTransactions: mercuryTransactions.slice(0, 5), // Muestra 5 ejemplos
        transactionsByCard: formattedTransactionsByCard,
        message: "Mercury transactions in dev_transactions database"
      }
    });
  } catch (error) {
    console.error('Error checking Mercury transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await closeDatabaseConnections();
  }
});

// Endpoint específico para verificar fees de Mercury
router.get('/check-mercury-fees', async (req, res) => {
  try {
    await connectDatabases();
    const Transaction = getTransactionModel();
    
    // Buscar todas las transacciones con mercuryKind de fee
    const feeTransactions = await Transaction.find({ 
      supplier: 'mercury',
      mercuryKind: { $regex: /fee|Fee/ }
    }).lean();
    
    // Buscar transacciones con originalTransactionId
    const relatedTransactions = await Transaction.find({ 
      supplier: 'mercury',
      originalTransactionId: { $exists: true, $ne: null }
    }).lean();
    
    // Estadísticas por tipo de fee
    const feeStats = feeTransactions.reduce((acc, transaction) => {
      const kind = transaction.mercuryKind || 'unknown';
      acc[kind] = (acc[kind] || 0) + 1;
      return acc;
    }, {});
    
    res.json({
      success: true,
      debug: {
        totalFeeTransactions: feeTransactions.length,
        totalRelatedTransactions: relatedTransactions.length,
        feeStats: feeStats,
        sampleFeeTransactions: feeTransactions.slice(0, 5),
        sampleRelatedTransactions: relatedTransactions.slice(0, 5),
        message: "Mercury fees and related transactions analysis"
      }
    });
  } catch (error) {
    console.error('Error checking Mercury fees:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await closeDatabaseConnections();
  }
});

module.exports = router;
