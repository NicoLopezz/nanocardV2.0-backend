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

// Endpoint temporal para migrar operaciones Mercury
router.post('/migrate-operations', async (req, res) => {
  try {
    await connectDatabases();
    const Transaction = getTransactionModel();
    
    console.log('🔄 Iniciando migración manual de operaciones Mercury...');
    
    const operationMapping = {
      'MERCURY_PENDING': 'TRANSACTION_PENDING',
      'MERCURY_SENT': 'TRANSACTION_APPROVED',
      'MERCURY_CANCELLED': 'TRANSACTION_CANCELLED',
      'MERCURY_FAILED': 'TRANSACTION_REJECTED',
      'MERCURY_REVERSED': 'TRANSACTION_REVERSED',
      'MERCURY_BLOCKED': 'TRANSACTION_BLOCKED'
    };
    
    const mercuryTransactions = await Transaction.find({ supplier: 'mercury' }).lean();
    console.log(`📈 Total de transacciones Mercury encontradas: ${mercuryTransactions.length}`);
    
    const transactionsToMigrate = mercuryTransactions.filter(t => 
      Object.keys(operationMapping).includes(t.operation)
    );
    
    console.log(`📊 Transacciones que necesitan migración: ${transactionsToMigrate.length}`);
    
    if (transactionsToMigrate.length === 0) {
      return res.json({
        success: true,
        message: 'No hay transacciones que necesiten migración',
        summary: {
          totalTransactions: mercuryTransactions.length,
          migrated: 0
        }
      });
    }
    
    const bulkOperations = [];
    const migrationSummary = {};
    
    for (const transaction of transactionsToMigrate) {
      const oldOperation = transaction.operation;
      const newOperation = operationMapping[oldOperation];
      
      if (oldOperation !== newOperation) {
        bulkOperations.push({
          updateOne: {
            filter: { _id: transaction._id },
            update: { $set: { operation: newOperation, updatedAt: new Date() } }
          }
        });
        const key = `${oldOperation} → ${newOperation}`;
        migrationSummary[key] = (migrationSummary[key] || 0) + 1;
      }
    }
    
    if (bulkOperations.length > 0) {
      await Transaction.bulkWrite(bulkOperations, { ordered: false });
      console.log('✅ Migración completada:');
      for (const key in migrationSummary) {
        console.log(`   - ${key}: ${migrationSummary[key]} transacciones`);
      }
    }
    
    await closeDatabaseConnections();
    
    res.json({
      success: true,
      message: 'Migración de operaciones Mercury completada',
      summary: {
        totalTransactions: mercuryTransactions.length,
        migrated: bulkOperations.length,
        migrationSummary: migrationSummary
      }
    });
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para debuggear una transacción específica
router.get('/debug-transaction/:transactionId', async (req, res) => {
  try {
    await connectDatabases();
    const Transaction = getTransactionModel();
    
    const { transactionId } = req.params;
    console.log(`🔍 Debugging transaction: ${transactionId}`);
    
    // Buscar en la base de datos
    const dbTransaction = await Transaction.findById(transactionId).lean();
    
    // Buscar en Mercury API
    const mercuryService = require('../../../services/mercuryService');
    const allMercuryTransactions = await mercuryService.getAllTransactions();
    const mercuryTransaction = allMercuryTransactions.find(t => t.id === transactionId);
    
    if (!mercuryTransaction) {
      return res.json({
        success: false,
        message: `Transaction ${transactionId} not found in Mercury API`
      });
    }
    
    // Probar la resolución de cardId
    const { cardId, originalTransactionId } = mercuryService.getCardIdFromTransaction(mercuryTransaction, allMercuryTransactions);
    
    res.json({
      success: true,
      debug: {
        transactionId,
        mercuryTransaction: {
          id: mercuryTransaction.id,
          amount: mercuryTransaction.amount,
          status: mercuryTransaction.status,
          kind: mercuryTransaction.kind,
          hasDirectCardId: !!mercuryTransaction.details?.debitCardInfo?.id,
          directCardId: mercuryTransaction.details?.debitCardInfo?.id,
          hasRelatedTransactions: !!mercuryTransaction.relatedTransactions?.length,
          relatedTransactions: mercuryTransaction.relatedTransactions,
          relatedTransactionsCount: mercuryTransaction.relatedTransactions?.length || 0
        },
        resolvedCardId: {
          cardId,
          originalTransactionId,
          wasResolved: !!cardId
        },
        relatedTransactionDetails: mercuryTransaction.relatedTransactions?.map(related => {
          const relatedTxn = allMercuryTransactions.find(t => t.id === related.id);
          return {
            relatedId: related.id,
            amount: related.amount,
            relationKind: related.relationKind,
            hasRelatedCardId: !!relatedTxn?.details?.debitCardInfo?.id,
            relatedCardId: relatedTxn?.details?.debitCardInfo?.id,
            relatedStatus: relatedTxn?.status,
            relatedKind: relatedTxn?.kind
          };
        }) || [],
        dbTransaction: dbTransaction || null
      }
    });
    
  } catch (error) {
    console.error('❌ Error debugging transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await closeDatabaseConnections();
  }
});

// Endpoint para limpiar todas las transacciones Mercury de dev_transactions
router.delete('/clear-all-mercury-transactions', async (req, res) => {
  try {
    await connectDatabases();
    
    console.log('🗑️ Iniciando limpieza de transacciones Mercury...');
    
    // Esperar un momento para asegurar que la conexión esté establecida
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const Transaction = getTransactionModel();
    
    // Contar transacciones Mercury antes de borrar
    const countBefore = await Transaction.countDocuments({ supplier: 'mercury' });
    console.log(`📊 Transacciones Mercury encontradas: ${countBefore}`);
    
    if (countBefore === 0) {
      return res.json({
        success: true,
        message: 'No hay transacciones Mercury para borrar',
        summary: {
          deletedCount: 0
        }
      });
    }
    
    // Borrar todas las transacciones Mercury
    const result = await Transaction.deleteMany({ supplier: 'mercury' });
    
    console.log(`✅ Borradas ${result.deletedCount} transacciones Mercury`);
    
    // Verificar que se borraron todas
    const countAfter = await Transaction.countDocuments({ supplier: 'mercury' });
    
    await closeDatabaseConnections();
    
    res.json({
      success: true,
      message: 'Todas las transacciones Mercury han sido borradas exitosamente',
      summary: {
        deletedCount: result.deletedCount,
        remainingCount: countAfter,
        wasSuccessful: countAfter === 0
      }
    });
    
  } catch (error) {
    console.error('❌ Error borrando transacciones Mercury:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await closeDatabaseConnections();
  }
});

// Endpoint para verificar transacciones de una card específica
router.get('/check-card-transactions/:cardId', async (req, res) => {
  try {
    await connectDatabases();
    const Transaction = getTransactionModel();
    
    const { cardId } = req.params;
    console.log(`🔍 Checking transactions for card: ${cardId}`);
    
    // Buscar todas las transacciones de esta card
    const transactions = await Transaction.find({ 
      cardId: cardId,
      supplier: 'mercury'
    }).lean();
    
    // Buscar con filtros del stats service
    const activeTransactions = await Transaction.find({ 
      cardId: cardId, 
      isDeleted: { $ne: true }, 
      status: { $ne: 'DELETED' },
      supplier: 'mercury'
    }).lean();
    
    // Agrupar por operación
    const operationStats = transactions.reduce((acc, txn) => {
      acc[txn.operation] = (acc[txn.operation] || 0) + 1;
      return acc;
    }, {});
    
    res.json({
      success: true,
      debug: {
        cardId,
        totalTransactions: transactions.length,
        activeTransactions: activeTransactions.length,
        operationStats: operationStats,
        sampleTransactions: transactions.slice(0, 3).map(t => ({
          _id: t._id,
          operation: t.operation,
          amount: t.amount,
          credit: t.credit,
          isDeleted: t.isDeleted,
          status: t.status
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking card transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await closeDatabaseConnections();
  }
});

module.exports = router;
