const { getUserModel } = require('../models/User');
const { getCardModel } = require('../models/Card');
const { getTransactionModel } = require('../models/Transaction');
const { recalculateCardStats } = require('./cardStatsService');

class StatsRefreshService {
  
  // Actualizar stats del usuario cuando hay cambios en transacciones
  static async refreshUserStats(userId, transactionData, action = 'create') {
    try {
      const User = getUserModel();
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const operation = transactionData.operation;
      const amount = transactionData.amount;
      const multiplier = action === 'create' ? 1 : (action === 'delete' ? -1 : 0);
      
      if (multiplier === 0) return; // No changes for update
      
      // Actualizar contadores
      user.stats.totalTransactions += multiplier;
      
      // Actualizar montos según la operación
      switch (operation) {
        case 'WALLET_DEPOSIT':
        case 'OVERRIDE_VIRTUAL_BALANCE':
          user.stats.totalDeposited += (amount * multiplier);
          break;
        case 'TRANSACTION_REFUND':
          user.stats.totalRefunded += (amount * multiplier);
          break;
        case 'TRANSACTION_APPROVED':
          user.stats.totalPosted += (amount * multiplier);
          break;
        case 'TRANSACTION_PENDING':
          user.stats.totalPending += (amount * multiplier);
          break;
        case 'WITHDRAWAL':
          // WITHDRAWAL reduce el available (dinero que sale)
          user.stats.totalAvailable -= (amount * multiplier);
          break;
        case 'TRANSACTION_REVERSED':
          // TRANSACTION_REVERSED reduce el posted
          user.stats.totalPosted -= (amount * multiplier);
          break;
        case 'TRANSACTION_REJECTED':
          // TRANSACTION_REJECTED no afecta balances
          break;
      }
      
      // Recalcular available
      user.stats.totalAvailable = user.stats.totalDeposited + user.stats.totalRefunded - user.stats.totalPosted - user.stats.totalPending;
      
      await user.save();
      
      console.log(`✅ User stats refreshed for user ${userId} - Action: ${action}`);
      
    } catch (error) {
      console.error('❌ Error refreshing user stats:', error);
      throw error;
    }
  }
  
  // Actualizar stats de la tarjeta cuando hay cambios en transacciones
  static async refreshCardStats(cardId) {
    try {
      await recalculateCardStats(cardId);
      console.log(`✅ Card stats refreshed for card ${cardId}`);
    } catch (error) {
      console.error('❌ Error refreshing card stats:', error);
      throw error;
    }
  }
  
  // Actualizar stats completas (usuario + tarjeta) cuando hay cambios en transacciones
  static async refreshAllStats(userId, cardId, transactionData, action = 'create') {
    try {
      // Actualizar stats del usuario
      await this.refreshUserStats(userId, transactionData, action);
      
      // Actualizar stats de la tarjeta
      await this.refreshCardStats(cardId);
      
      console.log(`✅ All stats refreshed - User: ${userId}, Card: ${cardId}, Action: ${action}`);
      
    } catch (error) {
      console.error('❌ Error refreshing all stats:', error);
      throw error;
    }
  }
  
  // Recalcular stats completas de un usuario (útil para migraciones o correcciones)
  static async recalculateUserStats(userId) {
    try {
      const User = getUserModel();
      const Transaction = getTransactionModel();
      
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Obtener todas las transacciones activas del usuario
      const transactions = await Transaction.find({ 
        userId: userId, 
        isDeleted: { $ne: true } 
      });
      
      // Resetear stats
      user.stats = {
        totalTransactions: 0,
        totalDeposited: 0,
        totalRefunded: 0,
        totalPosted: 0,
        totalPending: 0,
        totalAvailable: 0
      };
      
      // Recalcular desde cero
      for (const transaction of transactions) {
        const operation = transaction.operation;
        const amount = transaction.amount;
        
        user.stats.totalTransactions += 1;
        
        switch (operation) {
          case 'WALLET_DEPOSIT':
          case 'OVERRIDE_VIRTUAL_BALANCE':
            user.stats.totalDeposited += amount;
            break;
          case 'TRANSACTION_REFUND':
            user.stats.totalRefunded += amount;
            break;
          case 'TRANSACTION_APPROVED':
            user.stats.totalPosted += amount;
            break;
          case 'TRANSACTION_PENDING':
            user.stats.totalPending += amount;
            break;
          case 'WITHDRAWAL':
            // WITHDRAWAL reduce el available
            user.stats.totalAvailable -= amount;
            break;
          case 'TRANSACTION_REVERSED':
            // TRANSACTION_REVERSED reduce el posted
            user.stats.totalPosted -= amount;
            break;
          case 'TRANSACTION_REJECTED':
            // TRANSACTION_REJECTED no afecta balances
            break;
        }
      }
      
      // Recalcular available
      user.stats.totalAvailable = user.stats.totalDeposited + user.stats.totalRefunded - user.stats.totalPosted - user.stats.totalPending;
      
      await user.save();
      
      console.log(`✅ User stats recalculated for user ${userId}`);
      
    } catch (error) {
      console.error('❌ Error recalculating user stats:', error);
      throw error;
    }
  }
  
  // Recalcular stats completas de una tarjeta
  static async recalculateCardStats(cardId) {
    try {
      await recalculateCardStats(cardId);
      console.log(`✅ Card stats recalculated for card ${cardId}`);
    } catch (error) {
      console.error('❌ Error recalculating card stats:', error);
      throw error;
    }
  }
  
  // Recalcular stats de todas las tarjetas de un usuario
  static async recalculateUserCardsStats(userId) {
    try {
      const Card = getCardModel();
      const cards = await Card.find({ userId: userId });
      
      let processed = 0;
      let errors = 0;
      
      for (const card of cards) {
        try {
          await this.recalculateCardStats(card._id);
          processed++;
        } catch (error) {
          console.error(`❌ Error processing card ${card._id}:`, error);
          errors++;
        }
      }
      
      console.log(`✅ User cards stats recalculated - User: ${userId}, Processed: ${processed}, Errors: ${errors}`);
      
      return {
        success: true,
        processed,
        errors,
        total: cards.length
      };
      
    } catch (error) {
      console.error('❌ Error recalculating user cards stats:', error);
      throw error;
    }
  }
}

module.exports = StatsRefreshService;
