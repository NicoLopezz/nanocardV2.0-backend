const express = require('express');
const router = express.Router();
const ReconciliationService = require('../../services/reconciliationService');

router.get('/', async (req, res) => {
  try {
    const { cardId } = req.query;
    
    if (!cardId) {
      return res.status(400).json({
        success: false,
        message: 'cardId parameter is required'
      });
    }

    const { getCardModel } = require('../../models/Card');
    const Card = getCardModel();
    
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    const { getReconciliationModel } = require('../../models/Reconciliation');
    const Reconciliation = getReconciliationModel();
    
    const reconciliations = await Reconciliation.find({
      userId: card.userId,
      'metadata.cardId': cardId,
      status: 'ACTIVE'
    }).sort({ reconciliationDate: -1 });

    const consolidations = reconciliations.map(reconciliation => ({
      id: reconciliation._id,
      name: reconciliation.name,
      cardId: reconciliation.metadata.cardId,
      transactionIds: reconciliation.transactions.ids || [],
      notes: reconciliation.metadata.notes || reconciliation.description,
      createdAt: reconciliation.createdAt,
      updatedAt: reconciliation.updatedAt
    }));

    res.json(consolidations);
    
  } catch (error) {
    console.error('Error getting consolidations:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting consolidations',
      error: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { 
      name, 
      cardId, 
      transactionIds, 
      notes, 
      createdBy, 
      summary 
    } = req.body;
    
    if (!name || !cardId || !createdBy) {
      return res.status(400).json({
        success: false,
        message: 'name, cardId, and createdBy are required'
      });
    }

    const { getCardModel } = require('../../models/Card');
    const Card = getCardModel();
    
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    const { getTransactionModel } = require('../../models/Transaction');
    const Transaction = getTransactionModel();
    
    const transactions = await Transaction.find({
      _id: { $in: transactionIds || [] },
      userId: card.userId,
      isDeleted: false
    });

    const reconciliationData = {
      name,
      description: notes,
      summary: summary || {
        moneyIn: 0,
        posted: 0,
        pending: 0,
        available: 0,
        totalTransactions: transactionIds?.length || 0,
        deposits: 0,
        withdrawals: 0
      },
      transactions: {
        count: transactionIds?.length || 0,
        ids: transactionIds || [],
        details: transactions
      },
      metadata: {
        cardId: cardId,
        status: 'ACTIVE',
        notes: notes
      }
    };

    const reconciliation = await ReconciliationService.createReconciliation(
      card.userId,
      reconciliationData,
      createdBy
    );

    const consolidation = {
      id: reconciliation._id,
      name: reconciliation.name,
      cardId: reconciliation.metadata.cardId,
      transactionIds: reconciliation.transactions.ids,
      notes: reconciliation.metadata.notes,
      createdAt: reconciliation.createdAt,
      updatedAt: reconciliation.updatedAt
    };

    res.status(201).json(consolidation);
    
  } catch (error) {
    console.error('Error creating consolidation:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating consolidation',
      error: error.message
    });
  }
});

module.exports = router;
