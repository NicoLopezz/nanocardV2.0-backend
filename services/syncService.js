const { getSyncLogModel } = require('../models/SyncLog');
const { getCardModel } = require('../models/Card');
const { getTransactionModel } = require('../models/Transaction');
const { getUserModel } = require('../models/User');
const cryptomateService = require('./cryptomateService');

class SyncService {
  constructor() {
    this.SyncLog = null;
    this.Card = null;
    this.Transaction = null;
    this.User = null;
  }

  initialize() {
    this.SyncLog = getSyncLogModel();
    this.Card = getCardModel();
    this.Transaction = getTransactionModel();
    this.User = getUserModel();
  }

  async getLastSyncData() {
    try {
      const lastSync = await this.SyncLog.findById('last_sync');
      
      if (!lastSync) {
        console.log('📝 No previous sync found, this will be the first sync');
        return {
          timestamp: null,
          cardId: null,
          isFirstSync: true
        };
      }

      return {
        timestamp: lastSync.lastSyncTimestamp,
        cardId: lastSync.lastSyncCardId,
        totalExecutions: lastSync.totalExecutions,
        isFirstSync: false
      };
    } catch (error) {
      console.error('❌ Error getting last sync data:', error);
      throw error;
    }
  }

  async updateSyncLog(syncData) {
    try {
      const {
        lastSyncTimestamp,
        lastSyncCardId,
        executionStats,
        status = 'success',
        errors = []
      } = syncData;

      // Obtener el documento actual para incrementar totalExecutions
      const existingSync = await this.SyncLog.findById('last_sync');
      const currentExecutions = existingSync ? existingSync.totalExecutions : 0;

      const updateData = {
        lastSyncTimestamp,
        lastSyncCardId,
        totalExecutions: currentExecutions + 1,
        lastExecution: {
          timestamp: new Date(),
          cardsImported: executionStats.cardsImported || 0,
          transactionsImported: executionStats.transactionsImported || 0,
          cardsUpdated: executionStats.cardsUpdated || 0,
          transactionsUpdated: executionStats.transactionsUpdated || 0,
          executionTime: executionStats.executionTime,
          status,
          errors
        },
        updatedAt: new Date()
      };

      await this.SyncLog.findByIdAndUpdate('last_sync', updateData, { upsert: true });
      
      console.log('✅ Sync log updated successfully');
    } catch (error) {
      console.error('❌ Error updating sync log:', error);
      throw error;
    }
  }

  async detectNewCards(lastSyncTimestamp) {
    try {
      console.log('🔍 Detecting new cards...');
      
      const allCardsFromAPI = await cryptomateService.getAllCards();
      
      // Verificar si la respuesta es válida
      if (!allCardsFromAPI || !Array.isArray(allCardsFromAPI)) {
        console.log('⚠️ No cards received from API or invalid format');
        return {
          newCards: [],
          totalCardsFromAPI: 0,
          existingCardsCount: 0
        };
      }
      
      const existingCardIds = await this.Card.find({}, '_id').lean();
      const existingIds = new Set(existingCardIds.map(card => card._id));
      
      const newCards = allCardsFromAPI.filter(card => !existingIds.has(card.id));
      
      console.log(`📊 Found ${newCards.length} new cards out of ${allCardsFromAPI.length} total cards`);
      
      return {
        newCards,
        totalCardsFromAPI: allCardsFromAPI.length,
        existingCardsCount: existingIds.size
      };
    } catch (error) {
      console.error('❌ Error detecting new cards:', error);
      throw error;
    }
  }

  async detectMissingTransactions(lastSyncTimestamp, newCardIds = []) {
    try {
      console.log('🔍 Detecting missing transactions...');
      
      const allTransactionsFromAPI = await cryptomateService.getAllTransactions();
      
      // Verificar si la respuesta es válida
      if (!allTransactionsFromAPI || !Array.isArray(allTransactionsFromAPI)) {
        console.log('⚠️ No transactions received from API or invalid format');
        return {
          missingTransactions: [],
          totalTransactionsFromAPI: 0,
          existingTransactionsCount: 0
        };
      }
      
      const existingTransactionIds = await this.Transaction.find({}, '_id').lean();
      const existingIds = new Set(existingTransactionIds.map(txn => txn._id));
      
      const missingTransactions = allTransactionsFromAPI.filter(txn => !existingIds.has(txn.id));
      
      console.log(`📊 Found ${missingTransactions.length} missing transactions out of ${allTransactionsFromAPI.length} total transactions`);
      
      return {
        missingTransactions,
        totalTransactionsFromAPI: allTransactionsFromAPI.length,
        existingTransactionsCount: existingIds.size
      };
    } catch (error) {
      console.error('❌ Error detecting missing transactions:', error);
      throw error;
    }
  }

  async importCards(cards) {
    try {
      console.log(`📥 Importing ${cards.length} new cards...`);
      
      let importedCount = 0;
      const errors = [];

      for (const cardData of cards) {
        try {
          const card = new this.Card({
            _id: cardData.id,
            userId: cardData.user_id,
            name: cardData.card_holder_name,
            supplier: 'cryptomate',
            last4: cardData.last4,
            type: cardData.type,
            status: cardData.status,
            approval_method: cardData.approval_method,
            forwarded_3ds_type: cardData.forwarded_3ds_type,
            limits: {
              daily: cardData.daily_limit,
              weekly: cardData.weekly_limit,
              monthly: cardData.monthly_limit,
              perTransaction: cardData.per_transaction_limit
            },
            meta: {
              email: cardData.meta?.email,
              otp_phone_number: {
                dial_code: cardData.meta?.otp_phone_number?.dial_code,
                phone_number: cardData.meta?.otp_phone_number?.phone_number
              }
            },
            cryptoMateBalance: {
              available_credit: cardData.available_credit || 0,
              lastUpdated: new Date(),
              source: 'cryptomate_api'
            }
          });

          await card.save();
          importedCount++;
        } catch (error) {
          console.error(`❌ Error importing card ${cardData.id}:`, error.message);
          errors.push(`Card ${cardData.id}: ${error.message}`);
        }
      }

      console.log(`✅ Successfully imported ${importedCount}/${cards.length} cards`);
      
      return {
        importedCount,
        totalCards: cards.length,
        errors
      };
    } catch (error) {
      console.error('❌ Error importing cards:', error);
      throw error;
    }
  }

  async importTransactions(transactions) {
    try {
      console.log(`📥 Importing ${transactions.length} missing transactions...`);
      
      let importedCount = 0;
      const errors = [];

      for (const txnData of transactions) {
        try {
          const transaction = new this.Transaction({
            _id: txnData.id,
            userId: txnData.user_id,
            cardId: txnData.card_id,
            userName: txnData.user_name || 'Unknown User',
            cardName: txnData.card_name || 'Unknown Card',
            name: txnData.name,
            amount: txnData.amount,
            date: txnData.date,
            time: txnData.time,
            status: txnData.status,
            operation: txnData.operation,
            city: txnData.city,
            country: txnData.country,
            mcc_category: txnData.mcc_category,
            mercuryCategory: txnData.mercuryCategory,
            credit: txnData.credit || false,
            comentario: txnData.comentario || '',
            version: 1,
            history: [{
              version: 1,
              action: 'created',
              timestamp: new Date(),
              modifiedBy: 'sync_service',
              reason: 'Imported via sync service'
            }]
          });

          await transaction.save();
          importedCount++;
        } catch (error) {
          console.error(`❌ Error importing transaction ${txnData.id}:`, error.message);
          errors.push(`Transaction ${txnData.id}: ${error.message}`);
        }
      }

      console.log(`✅ Successfully imported ${importedCount}/${transactions.length} transactions`);
      
      return {
        importedCount,
        totalTransactions: transactions.length,
        errors
      };
    } catch (error) {
      console.error('❌ Error importing transactions:', error);
      throw error;
    }
  }

  async performIncrementalSync(options = {}) {
    const startTime = Date.now();
    console.log('🚀 Starting incremental sync...');
    
    try {
      const lastSyncData = await this.getLastSyncData();
      console.log('📋 Last sync data:', lastSyncData);

      const executionStats = {
        cardsImported: 0,
        transactionsImported: 0,
        cardsUpdated: 0,
        transactionsUpdated: 0
      };

      const errors = [];

      if (lastSyncData.isFirstSync || options.fullSync) {
        console.log('🔄 Performing full sync...');
        
        const { newCards } = await this.detectNewCards();
        const { missingTransactions } = await this.detectMissingTransactions();
        
        if (newCards.length > 0) {
          const cardResult = await this.importCards(newCards);
          executionStats.cardsImported = cardResult.importedCount;
          errors.push(...cardResult.errors);
        }
        
        if (missingTransactions.length > 0) {
          const txnResult = await this.importTransactions(missingTransactions);
          executionStats.transactionsImported = txnResult.importedCount;
          errors.push(...txnResult.errors);
        }
      } else {
        console.log('🔄 Performing incremental sync...');
        
        const { newCards } = await this.detectNewCards(lastSyncData.timestamp);
        const { missingTransactions } = await this.detectMissingTransactions(lastSyncData.timestamp);
        
        if (newCards.length > 0) {
          const cardResult = await this.importCards(newCards);
          executionStats.cardsImported = cardResult.importedCount;
          errors.push(...cardResult.errors);
        }
        
        if (missingTransactions.length > 0) {
          const txnResult = await this.importTransactions(missingTransactions);
          executionStats.transactionsImported = txnResult.importedCount;
          errors.push(...txnResult.errors);
        }
      }

      const executionTime = `${Date.now() - startTime}ms`;
      executionStats.executionTime = executionTime;

      const syncStatus = errors.length > 0 ? 'partial' : 'success';

      await this.updateSyncLog({
        lastSyncTimestamp: new Date(),
        lastSyncCardId: null,
        executionStats,
        status: syncStatus,
        errors
      });

      console.log('✅ Incremental sync completed successfully');
      console.log(`📊 Stats: ${executionStats.cardsImported} cards, ${executionStats.transactionsImported} transactions in ${executionTime}`);

      return {
        success: true,
        executionStats,
        executionTime,
        status: syncStatus,
        errors
      };

    } catch (error) {
      console.error('❌ Error during incremental sync:', error);
      
      const executionTime = `${Date.now() - startTime}ms`;
      
      await this.updateSyncLog({
        lastSyncTimestamp: null,
        lastSyncCardId: null,
        executionStats: {
          cardsImported: 0,
          transactionsImported: 0,
          executionTime
        },
        status: 'error',
        errors: [error.message]
      });

      throw error;
    }
  }
}

module.exports = new SyncService();
