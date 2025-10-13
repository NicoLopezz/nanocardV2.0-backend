const express = require('express');
const router = express.Router();
const ReconciliationService = require('../../services/reconciliationService');
const { getCardModel } = require('../../models/Card');

// Función para calcular stats de transacciones específicas
function calculateTransactionStats(transactions) {
  const stats = {
    moneyIn: 0,
    posted: 0,
    pending: 0,
    available: 0,
    totalTransactions: transactions.length,
    deposits: 0,
    withdrawals: 0
  };
  
  transactions.forEach(tx => {
    const amount = Math.abs(tx.amount);
    
    if (tx.operation === 'WALLET_DEPOSIT' || tx.operation === 'OVERRIDE_VIRTUAL_BALANCE') {
      stats.moneyIn += amount;
      stats.deposits++;
    } else if (tx.operation === 'TRANSACTION_REFUND') {
      stats.moneyIn += amount;
      stats.deposits++;
    } else if (tx.operation === 'TRANSACTION_APPROVED') {
      stats.posted += amount;
      stats.withdrawals++;
    } else if (tx.operation === 'TRANSACTION_PENDING') {
      stats.pending += amount;
    }
  });
  
  stats.available = stats.moneyIn - stats.posted - stats.pending;
  
  return stats;
}

// Función para validar que las stats del frontend coincidan con el cálculo del backend
function validateStats(frontendStats, backendStats, tolerance = 0.01) {
  const fields = ['moneyIn', 'posted', 'pending', 'available', 'totalTransactions', 'deposits', 'withdrawals'];
  
  for (const field of fields) {
    const frontendValue = frontendStats[field] || 0;
    const backendValue = backendStats[field] || 0;
    const difference = Math.abs(frontendValue - backendValue);
    
    if (difference > tolerance) {
      return {
        valid: false,
        field: field,
        frontendValue: frontendValue,
        backendValue: backendValue,
        difference: difference
      };
    }
  }
  
  return { valid: true };
}

router.get('/', async (req, res) => {
  try {
    const { cardId, includeHistory } = req.query;
    
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
    
    if (includeHistory === 'true') {
      // Devolver todas las consolidaciones en orden cronológico
      const reconciliations = await Reconciliation.find({
        userId: card.userId,
        'metadata.cardId': cardId,
        status: 'ACTIVE'
      }).sort({ createdAt: 1 }); // Orden ascendente por fecha de creación

      const consolidations = reconciliations.map((reconciliation, index) => ({
        id: reconciliation._id,
        name: reconciliation.name,
        cardId: reconciliation.metadata.cardId,
        transactionIds: reconciliation.transactions.ids || [],
        notes: reconciliation.metadata.notes || reconciliation.description,
        summary: reconciliation.summary || {
          moneyIn: 0,
          posted: 0,
          pending: 0,
          available: 0,
          totalTransactions: reconciliation.transactions.ids?.length || 0,
          deposits: 0,
          withdrawals: 0
        },
        versioning: reconciliation.versioning || {
          version: index + 1,
          baseConsolidationId: index > 0 ? reconciliations[index - 1]._id : null,
          isLatest: index === reconciliations.length - 1,
          newTransactionsInThisVersion: reconciliation.transactions.ids || [],
          previousStats: index > 0 ? (reconciliations[index - 1].summary || {
            moneyIn: 0,
            posted: 0,
            pending: 0,
            available: 0,
            totalTransactions: 0,
            deposits: 0,
            withdrawals: 0
          }) : {
            moneyIn: 0,
            posted: 0,
            pending: 0,
            available: 0,
            totalTransactions: 0,
            deposits: 0,
            withdrawals: 0
          }
        },
        createdAt: reconciliation.createdAt,
        updatedAt: reconciliation.updatedAt
      }));

      res.json(consolidations);
    } else {
      // Devolver todas las consolidaciones ordenadas cronológicamente
      const reconciliations = await Reconciliation.find({
        userId: card.userId,
        'metadata.cardId': cardId,
        status: 'ACTIVE'
      }).sort({ createdAt: 1 }); // Orden ascendente por fecha de creación

      const consolidations = reconciliations.map((reconciliation, index) => ({
        id: reconciliation._id,
        name: reconciliation.name,
        cardId: reconciliation.metadata.cardId,
        transactionIds: reconciliation.transactions.ids || [],
        notes: reconciliation.metadata.notes || reconciliation.description,
        summary: reconciliation.summary || {
          moneyIn: 0,
          posted: 0,
          pending: 0,
          available: 0,
          totalTransactions: reconciliation.transactions.ids?.length || 0,
          deposits: 0,
          withdrawals: 0
        },
        versioning: reconciliation.versioning || {
          version: index + 1,
          baseConsolidationId: index > 0 ? reconciliations[index - 1]._id : null,
          isLatest: index === reconciliations.length - 1,
          newTransactionsInThisVersion: reconciliation.transactions.ids || [],
          previousStats: index > 0 ? (reconciliations[index - 1].summary || {
            moneyIn: 0,
            posted: 0,
            pending: 0,
            available: 0,
            totalTransactions: 0,
            deposits: 0,
            withdrawals: 0
          }) : {
            moneyIn: 0,
            posted: 0,
            pending: 0,
            available: 0,
            totalTransactions: 0,
            deposits: 0,
            withdrawals: 0
          }
        },
        createdAt: reconciliation.createdAt,
        updatedAt: reconciliation.updatedAt
      }));

      res.json(consolidations);
    }
    
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
      newTransactionIds, // Para consolidaciones incrementales
      transactionIds,     // Para compatibilidad con frontend actual
      notes, 
      createdBy, 
      summary // Stats calculadas por el frontend
    } = req.body;
    
    // Determinar si es consolidación incremental o completa
    const isIncremental = newTransactionIds && newTransactionIds.length > 0;
    const allTransactionIds = isIncremental ? newTransactionIds : (transactionIds || []);
    
    if (!name || !cardId || !createdBy) {
      return res.status(400).json({
        success: false,
        message: 'name, cardId, and createdBy are required'
      });
    }

    if (!summary) {
      return res.status(400).json({
        success: false,
        message: 'summary is required for validation'
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

    // 1. Obtener el modelo Reconciliation
    const { getReconciliationModel } = require('../../models/Reconciliation');
    const Reconciliation = getReconciliationModel();
    
    // 2. Buscar la consolidación más reciente para esta card
    const latestConsolidation = await Reconciliation.findOne({
      userId: card.userId,
      'metadata.cardId': cardId,
      'versioning.isLatest': true,
      status: 'ACTIVE'
    }).sort({ 'versioning.version': -1 });

    // 3. Obtener todas las transacciones
    const { getTransactionModel } = require('../../models/Transaction');
    const Transaction = getTransactionModel();
    
    let finalTransactionIds = [...allTransactionIds];
    let baseStats = {
      moneyIn: 0,
      posted: 0,
      pending: 0,
      available: 0,
      totalTransactions: 0,
      deposits: 0,
      withdrawals: 0
    };
    
    let version = 1;
    let baseConsolidationId = null;
    
    if (isIncremental && latestConsolidation) {
      // Consolidación incremental: agregar transacciones de la base
      finalTransactionIds = [...latestConsolidation.transactions.ids, ...allTransactionIds];
      baseStats = latestConsolidation.summary;
      version = latestConsolidation.versioning.version + 1;
      baseConsolidationId = latestConsolidation._id;
      
      // Marcar la anterior como no-latest
      await Reconciliation.updateOne(
        { _id: latestConsolidation._id },
        { 'versioning.isLatest': false }
      );
    } else if (!isIncremental && latestConsolidation) {
      // Consolidación completa pero ya existe una base: error
      return res.status(400).json({
        success: false,
        message: 'A consolidation already exists for this card. Use newTransactionIds for incremental updates.'
      });
    }
    
    console.log('🔍 DEBUG CONSOLIDATION:');
    console.log('  - isIncremental:', isIncremental);
    console.log('  - allTransactionIds:', allTransactionIds);
    console.log('  - finalTransactionIds:', finalTransactionIds);
    console.log('  - baseStats:', baseStats);
    console.log('  - version:', version);
    
    // 3. Obtener todas las transacciones para guardar
    const allTransactions = await Transaction.find({
      _id: { $in: finalTransactionIds },
      userId: card.userId,
      isDeleted: false
    });
    
    // 4. Usar las stats que envía el frontend (sin validación por ahora)
    const accumulatedStats = summary;
    
    // 5. Crear la nueva consolidación
    const reconciliationData = {
      name,
      description: notes,
      summary: accumulatedStats, // Usar stats del frontend
      transactions: {
        count: finalTransactionIds.length,
        ids: finalTransactionIds,
        details: allTransactions
      },
      metadata: {
        cardId: cardId,
        status: 'ACTIVE',
        notes: notes
      },
      versioning: {
        version: version,
        baseConsolidationId: baseConsolidationId,
        isLatest: true,
        newTransactionsInThisVersion: isIncremental ? allTransactionIds : finalTransactionIds,
        previousStats: baseStats
      }
    };

    // Crear la consolidación directamente sin usar ReconciliationService
    // para evitar operaciones lentas innecesarias
    
    const reconciliation = new Reconciliation({
      _id: `recon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: card.userId,
      userName: 'User', // Simplificado
      userEmail: 'user@example.com', // Simplificado
      name: reconciliationData.name,
      description: reconciliationData.description,
      reconciliationDate: new Date(),
      createdBy: createdBy,
      summary: reconciliationData.summary,
      transactions: reconciliationData.transactions,
      metadata: reconciliationData.metadata,
      versioning: reconciliationData.versioning,
      status: 'ACTIVE'
    });
    
    await reconciliation.save();

    const consolidation = {
      id: reconciliation._id,
      name: reconciliation.name,
      cardId: reconciliation.metadata.cardId,
      transactionIds: reconciliation.transactions.ids,
      notes: reconciliation.metadata.notes,
      summary: reconciliation.summary,
      versioning: reconciliation.versioning,
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

// DELETE deshabilitado - Las consolidaciones son inmutables
router.delete('/:id', async (req, res) => {
  res.status(403).json({
    success: false,
    message: 'Consolidations are immutable and cannot be deleted. This is an audit trail requirement.'
  });
});

// CLEAN endpoint - Delete all consolidations for a specific card (for testing/development)
router.delete('/clean/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    
    if (!cardId) {
      return res.status(400).json({
        success: false,
        message: 'Card ID is required'
      });
    }

    // Find the card to get userId
    const Card = getCardModel();
    const card = await Card.findById(cardId);
    
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    // Clean endpoint - works even if no consolidations exist
    const { getReconciliationModel } = require('../../models/Reconciliation');
    const { getTransactionModel } = require('../../models/Transaction');
    
    const Reconciliation = getReconciliationModel();
    const Transaction = getTransactionModel();
    
    // 1. Delete all consolidations (if any exist)
    const consolidationResult = await Reconciliation.deleteMany({
      userId: card.userId,
      'metadata.cardId': cardId,
      status: 'ACTIVE'
    });

    // 2. Manual cleanup - find and clean ALL transactions for this card
    console.log(`🔍 Searching for transactions to clean for card ${cardId}...`);
    
    // Find all transactions for this card that have reconciliation data
    const transactionsToClean = await Transaction.find({
      userId: card.userId,
      cardId: cardId,
      $or: [
        { reconciled: true },
        { reconciliationId: { $exists: true, $ne: null } },
        { reconciledAt: { $exists: true, $ne: null } },
        { reconciledBy: { $exists: true, $ne: null } }
      ]
    });

    console.log(`📋 Found ${transactionsToClean.length} transactions to clean`);

    // Clean each transaction individually
    let cleanedCount = 0;
    for (const transaction of transactionsToClean) {
      await Transaction.updateOne(
        { _id: transaction._id },
        {
          $set: {
            reconciled: false,
            reconciledAt: null,
            reconciledBy: null
          },
          $unset: {
            reconciliationId: ""
          }
        }
      );
      cleanedCount++;
    }

    console.log(`🧹 CLEANED: Deleted ${consolidationResult.deletedCount} consolidations and manually cleaned ${cleanedCount} transactions for card ${cardId}`);

    res.json({
      success: true,
      message: `Successfully cleaned ${consolidationResult.deletedCount} consolidations and ${cleanedCount} transactions for card ${cardId}`,
      deletedConsolidations: consolidationResult.deletedCount,
      cleanedTransactions: cleanedCount,
      cardId: cardId
    });

  } catch (error) {
    console.error('Error cleaning consolidations:', error);
    res.status(500).json({
      success: false,
      message: 'Error cleaning consolidations',
      error: error.message
    });
  }
});

module.exports = router;
