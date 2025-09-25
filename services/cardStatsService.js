const { getCardModel } = require('../models/Card');
const { getTransactionModel } = require('../models/Transaction');

// Función para recalcular estadísticas de una tarjeta
const recalculateCardStats = async (cardId) => {
  try {
    const Card = getCardModel();
    const Transaction = getTransactionModel();
    
    // Obtener la tarjeta
    const card = await Card.findById(cardId);
    if (!card) {
      throw new Error(`Card ${cardId} not found`);
    }
    
    // Obtener todas las transacciones activas de la tarjeta (no eliminadas)
    const transactions = await Transaction.find({ cardId: cardId, isDeleted: { $ne: true } });
    
    // Inicializar contadores
    const stats = {
      totalTransactions: transactions.length,
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
    
    // Calcular estadísticas
    let totalDeposited = 0;   // Solo WALLET_DEPOSIT
    let totalRefunded = 0;    // Solo TRANSACTION_REFUND
    let totalPosted = 0;      // Solo TRANSACTION_APPROVED
    let totalPending = 0;     // Solo TRANSACTION_PENDING
    
    for (const transaction of transactions) {
      const operation = transaction.operation || 'UNKNOWN';
      
      // Contar por operación
      if (stats.byOperation.hasOwnProperty(operation)) {
        stats.byOperation[operation]++;
        stats.byAmount[operation] += transaction.amount;
      }
      
      // Calcular por tipo específico de operación
      if (operation === 'WALLET_DEPOSIT') {
        totalDeposited += transaction.amount;
      } else if (operation === 'TRANSACTION_REFUND') {
        totalRefunded += transaction.amount;
      } else if (operation === 'TRANSACTION_APPROVED') {
        totalPosted += transaction.amount;
      } else if (operation === 'TRANSACTION_PENDING') {
        totalPending += transaction.amount;
      }
      // Otras operaciones no afectan los balances principales
    }
    
    // Actualizar la tarjeta
    card.deposited = totalDeposited;
    card.refunded = totalRefunded;
    card.posted = totalPosted;
    card.pending = totalPending;
    card.available = totalDeposited - totalPosted - totalPending;
    
    card.transactionStats = {
      ...stats,
      lastUpdated: new Date()
    };
    
    await card.save();
    
    console.log(`✅ Card stats recalculated for ${cardId}:`);
    console.log(`   - Total transactions: ${stats.totalTransactions}`);
    console.log(`   - Deposited: $${totalDeposited}`);
    console.log(`   - Refunded: $${totalRefunded}`);
    console.log(`   - Posted: $${totalPosted}`);
    console.log(`   - Pending: $${totalPending}`);
    console.log(`   - Available: $${card.available}`);
    console.log(`   - By operation:`, stats.byOperation);
    
    return {
      success: true,
      card: {
        _id: card._id,
        name: card.name,
        deposited: card.deposited,
        refunded: card.refunded,
        posted: card.posted,
        pending: card.pending,
        available: card.available,
        transactionStats: card.transactionStats
      }
    };
    
  } catch (error) {
    console.error('❌ Error recalculating card stats:', error);
    throw error;
  }
};

// Función para obtener estadísticas de una tarjeta
const getCardStats = async (cardId) => {
  try {
    const Card = getCardModel();
    const Transaction = getTransactionModel();
    
    const card = await Card.findById(cardId);
    if (!card) {
      throw new Error(`Card ${cardId} not found`);
    }
    
    // Obtener transacciones recientes (solo activas)
    const recentTransactions = await Transaction.find({ cardId: cardId, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(10);
    
    return {
      success: true,
      card: {
        _id: card._id,
        name: card.name,
        last4: card.last4,
        status: card.status,
        deposited: card.deposited,
        refunded: card.refunded,
        posted: card.posted,
        available: card.available,
        cryptoMateBalance: card.cryptoMateBalance,
        transactionStats: card.transactionStats,
        recentTransactions: recentTransactions
      }
    };
    
  } catch (error) {
    console.error('❌ Error getting card stats:', error);
    throw error;
  }
};

// Función para recalcular estadísticas de todas las tarjetas
const recalculateAllCardStats = async () => {
  try {
    const Card = getCardModel();
    const cards = await Card.find({});
    
    let processed = 0;
    let errors = 0;
    
    for (const card of cards) {
      try {
        await recalculateCardStats(card._id);
        processed++;
      } catch (error) {
        console.error(`❌ Error processing card ${card._id}:`, error);
        errors++;
      }
    }
    
    return {
      success: true,
      processed,
      errors,
      total: cards.length
    };
    
  } catch (error) {
    console.error('❌ Error recalculating all card stats:', error);
    throw error;
  }
};

module.exports = {
  recalculateCardStats,
  getCardStats,
  recalculateAllCardStats
};
