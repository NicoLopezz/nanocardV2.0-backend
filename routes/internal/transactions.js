const express = require('express');
const router = express.Router();
const {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  restoreTransaction,
  getTransactionsByCard,
  getTransactionHistory,
  getDeletedTransactions,
  getRecentTransactions
} = require('../../services/transactionService');
const { getTransactionModel } = require('../../models/Transaction');

// Obtener transacciones por tarjeta
router.get('/:userId/cards/:cardId/transactions', async (req, res) => {
  try {
    const { includeDeleted } = req.query;
    const transactions = await getTransactionsByCard(
      req.params.cardId, 
      includeDeleted === 'true'
    );
    res.json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear transacción
router.post('/:userId/cards/:cardId/transactions', async (req, res) => {
  try {
    const transactionData = {
      ...req.body,
      userId: req.params.userId,
      cardId: req.params.cardId
    };
    
    const transaction = await createTransaction(transactionData);
    res.status(201).json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar transacción
router.put('/:transactionId', async (req, res) => {
  try {
    const { modifiedBy, reason, ...updates } = req.body;
    const transaction = await updateTransaction(
      req.params.transactionId, 
      updates, 
      modifiedBy, 
      reason
    );
    res.json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar transacción
router.delete('/:transactionId', async (req, res) => {
  try {
    const { deletedBy, reason } = req.body;
    const transaction = await deleteTransaction(
      req.params.transactionId, 
      deletedBy, 
      reason
    );
    res.json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restaurar transacción
router.post('/:transactionId/restore', async (req, res) => {
  try {
    const { restoredBy, reason } = req.body;
    const transaction = await restoreTransaction(
      req.params.transactionId, 
      restoredBy, 
      reason
    );
    res.json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener historial de transacción
router.get('/:transactionId/history', async (req, res) => {
  try {
    const history = await getTransactionHistory(req.params.transactionId);
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener transacciones eliminadas de un usuario
router.get('/:userId/deleted', async (req, res) => {
  try {
    const transactions = await getDeletedTransactions(req.params.userId);
    res.json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener las últimas 10 transacciones registradas
router.get('/recent', async (req, res) => {
  try {
    const { limit } = req.query;
    const limitNumber = limit ? parseInt(limit) : 10;
    
    if (limitNumber > 50) {
      return res.status(400).json({ 
        error: 'Limit cannot exceed 50 transactions' 
      });
    }
    
    const result = await getRecentTransactions(limitNumber);
    res.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error('Error getting recent transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
