const { connectDatabases } = require('../config/database');
const { getTransactionModel } = require('../models/Transaction');
const { getCardModel } = require('../models/Card');
const { getUserModel } = require('../models/User');
const { getSyncLogModel } = require('../models/SyncLog');
const cryptomateService = require('../services/cryptomateService');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class SmartSyncService {
  constructor() {
    this.Transaction = null;
    this.Card = null;
    this.User = null;
    this.SyncLog = null;
  }

  initialize() {
    this.Transaction = getTransactionModel();
    this.Card = getCardModel();
    this.User = getUserModel();
    this.SyncLog = getSyncLogModel();
  }

  async getLastTransactionFromEndpoint() {
    try {
      console.log('🔍 Getting last transaction from endpoint...');
      
      const curlCommand = `curl -s "http://localhost:3001/api/transactions/recent?limit=1"`;
      const { stdout, stderr } = await execAsync(curlCommand);
      
      if (stderr) {
        console.error('❌ Curl error:', stderr);
        return null;
      }
      
      const response = JSON.parse(stdout);
      
      if (response.success && response.data.transactions.length > 0) {
        const lastTransaction = response.data.data.transactions[0];
        
        // Convertir fecha string a objeto Date
        const [day, month, year] = lastTransaction.transactionDetails.date.split('/');
        const [time, period] = lastTransaction.transactionDetails.time.split(' ');
        let [hours, minutes] = time.split(':');
        hours = parseInt(hours);
        minutes = parseInt(minutes);
        
        if (period && period.toLowerCase().includes('p') && hours !== 12) {
          hours += 12;
        } else if (period && period.toLowerCase().includes('a') && hours === 12) {
          hours = 0;
        }
        
        const lastTransactionDate = new Date(year, month - 1, day, hours, minutes);
        
        console.log(`📅 Last transaction date: ${lastTransactionDate.toISOString()}`);
        console.log(`📋 Last transaction: ${lastTransaction.transactionDetails.name} - $${lastTransaction.transactionDetails.amount}`);
        
        return {
          date: lastTransactionDate,
          transactionId: lastTransaction.transactionId,
          userId: lastTransaction.userId
        };
      } else {
        console.log('📝 No transactions found in database');
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting last transaction from endpoint:', error.message);
      return null;
    }
  }

  async detectNewCards() {
    try {
      console.log('🔍 Detecting new cards from CryptoMate...');
      
      const allCardsFromAPI = await cryptomateService.getAllCards();
      
      if (!allCardsFromAPI || !Array.isArray(allCardsFromAPI)) {
        console.log('⚠️ No cards received from CryptoMate API');
        return [];
      }
      
      const existingCardIds = await this.Card.find({}, '_id').lean();
      const existingIds = new Set(existingCardIds.map(card => card._id));
      
      const newCards = allCardsFromAPI.filter(card => !existingIds.has(card.id));
      
      console.log(`📊 Found ${newCards.length} new cards out of ${allCardsFromAPI.length} total cards`);
      
      return newCards;
    } catch (error) {
      console.error('❌ Error detecting new cards:', error);
      return [];
    }
  }

  async importNewCards(cards) {
    try {
      if (cards.length === 0) {
        console.log('📝 No new cards to import');
        return { imported: 0, errors: [] };
      }

      console.log(`📥 Importing ${cards.length} new cards...`);
      
      let importedCount = 0;
      const errors = [];

      for (const cardData of cards) {
        try {
          // Crear usuario si no existe
          let user = await this.User.findById(cardData.id);
          if (!user) {
            const userEmail = cardData.meta?.email || `${cardData.id}@nanocard.xyz`;
            
            user = new this.User({
              _id: cardData.id,
              username: cardData.id,
              email: userEmail,
              role: 'standard',
              profile: {
                firstName: cardData.card_holder_name.split(' ')[0] || '',
                lastName: cardData.card_holder_name.split(' ').slice(1).join(' ') || ''
              },
              stats: {
                totalTransactions: 0,
                totalDeposited: 0,
                totalPosted: 0,
                totalPending: 0,
                totalAvailable: 0,
                lastLogin: new Date(),
                loginCount: 0
              }
            });
            await user.save();
            console.log(`✅ Created user: ${cardData.id}`);
          }

          // Crear tarjeta
          const card = new this.Card({
            _id: cardData.id,
            userId: cardData.id,
            name: cardData.card_holder_name,
            supplier: 'cryptomate',
            last4: cardData.last4,
            type: cardData.type || 'Virtual',
            status: cardData.status,
            approval_method: cardData.approval_method || 'TopUp',
            forwarded_3ds_type: cardData.forwarded_3ds_type || 'sms',
            limits: {
              daily: cardData.daily_limit,
              weekly: cardData.weekly_limit,
              monthly: cardData.monthly_limit,
              perTransaction: null
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
          console.log(`✅ Imported card: ${cardData.card_holder_name} (${cardData.last4})`);
          
        } catch (error) {
          console.error(`❌ Error importing card ${cardData.id}:`, error.message);
          errors.push(`Card ${cardData.id}: ${error.message}`);
        }
      }

      console.log(`✅ Successfully imported ${importedCount}/${cards.length} cards`);
      return { imported: importedCount, errors };
      
    } catch (error) {
      console.error('❌ Error importing cards:', error);
      return { imported: 0, errors: [error.message] };
    }
  }

  async importTransactionsFromDate(fromDate) {
    try {
      console.log(`📥 Importing transactions from ${fromDate.toISOString()}...`);
      
      const allTransactionsFromAPI = await cryptomateService.getAllTransactions();
      
      if (!allTransactionsFromAPI || !Array.isArray(allTransactionsFromAPI)) {
        console.log('⚠️ No transactions received from CryptoMate API');
        return { imported: 0, errors: [] };
      }

      // Filtrar transacciones por fecha
      const newTransactions = allTransactionsFromAPI.filter(txn => {
        try {
          // Convertir fecha de la transacción a Date
          const txnDate = new Date(txn.date || txn.createdAt || txn.timestamp);
          return txnDate > fromDate;
        } catch (error) {
          console.error(`❌ Error parsing date for transaction ${txn.id}:`, error);
          return false;
        }
      });

      console.log(`📊 Found ${newTransactions.length} new transactions since ${fromDate.toISOString()}`);

      if (newTransactions.length === 0) {
        return { imported: 0, errors: [] };
      }

      let importedCount = 0;
      const errors = [];

      for (const txnData of newTransactions) {
        try {
          // Verificar si la transacción ya existe
          const existingTransaction = await this.Transaction.findById(txnData.id);
          if (existingTransaction) {
            continue; // Ya existe, saltar
          }

          const date = new Date(txnData.date || txnData.createdAt || Date.now());
          
          const transaction = new this.Transaction({
            _id: txnData.id,
            userId: txnData.user_id,
            cardId: txnData.card_id,
            userName: txnData.user_name || 'Unknown User',
            cardName: txnData.card_name || 'Unknown Card',
            name: txnData.name || txnData.description || 'Transaction',
            amount: txnData.amount || txnData.MontoTransacction || 0,
            date: date.toLocaleDateString('en-GB'),
            time: date.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true 
            }),
            status: txnData.status || 'TRANSACTION_APPROVED',
            operation: txnData.operation || 'TRANSACTION_APPROVED',
            city: txnData.city || '',
            country: txnData.country || '',
            mcc_category: txnData.mcc_category || '',
            mercuryCategory: txnData.mercuryCategory || '',
            credit: txnData.credit || txnData.type === 'credit',
            comentario: txnData.comentario || txnData.comment || '',
            version: 1,
            history: [{
              version: 1,
              action: 'created',
              timestamp: new Date(),
              modifiedBy: 'smart_sync_service',
              reason: 'Imported via smart sync service'
            }]
          });

          await transaction.save();
          importedCount++;
          
        } catch (error) {
          console.error(`❌ Error importing transaction ${txnData.id}:`, error.message);
          errors.push(`Transaction ${txnData.id}: ${error.message}`);
        }
      }

      console.log(`✅ Successfully imported ${importedCount}/${newTransactions.length} transactions`);
      return { imported: importedCount, errors };
      
    } catch (error) {
      console.error('❌ Error importing transactions:', error);
      return { imported: 0, errors: [error.message] };
    }
  }

  async updateSyncLog(executionStats, status = 'success', errors = []) {
    try {
      const existingSync = await this.SyncLog.findById('last_sync');
      const currentExecutions = existingSync ? existingSync.totalExecutions : 0;

      const updateData = {
        lastSyncTimestamp: new Date(),
        lastSyncCardId: null,
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
    }
  }

  async performSmartSync() {
    const startTime = Date.now();
    console.log('🚀 Starting Smart Sync...');
    console.log('=' .repeat(50));
    
    try {
      // 1. Obtener última transacción del endpoint
      const lastTransaction = await this.getLastTransactionFromEndpoint();
      const fromDate = lastTransaction ? lastTransaction.date : new Date('2024-01-01');
      
      const executionStats = {
        cardsImported: 0,
        transactionsImported: 0,
        cardsUpdated: 0,
        transactionsUpdated: 0
      };

      const allErrors = [];

      // 2. Detectar e importar cards nuevas
      console.log('\n📋 STEP 1: Detecting and importing new cards...');
      const newCards = await this.detectNewCards();
      
      if (newCards.length > 0) {
        const cardResult = await this.importNewCards(newCards);
        executionStats.cardsImported = cardResult.imported;
        allErrors.push(...cardResult.errors);
      }

      // 3. Importar transacciones desde la última fecha
      console.log('\n💳 STEP 2: Importing new transactions...');
      const transactionResult = await this.importTransactionsFromDate(fromDate);
      executionStats.transactionsImported = transactionResult.imported;
      allErrors.push(...transactionResult.errors);

      const executionTime = `${Date.now() - startTime}ms`;
      executionStats.executionTime = executionTime;

      const syncStatus = allErrors.length > 0 ? 'partial' : 'success';

      // 4. Actualizar registro de sincronización
      await this.updateSyncLog(executionStats, syncStatus, allErrors);

      console.log('\n' + '=' .repeat(50));
      console.log('✅ Smart Sync completed successfully!');
      console.log(`📊 Summary:`);
      console.log(`   - Cards imported: ${executionStats.cardsImported}`);
      console.log(`   - Transactions imported: ${executionStats.transactionsImported}`);
      console.log(`   - Execution time: ${executionTime}`);
      console.log(`   - Status: ${syncStatus}`);
      
      if (allErrors.length > 0) {
        console.log(`⚠️  Errors encountered: ${allErrors.length}`);
        allErrors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`);
        });
      }
      
      console.log('=' .repeat(50));

      return {
        success: true,
        executionStats,
        executionTime,
        status: syncStatus,
        errors: allErrors
      };

    } catch (error) {
      console.error('❌ Smart sync failed:', error.message);
      
      const executionTime = `${Date.now() - startTime}ms`;
      
      await this.updateSyncLog({
        cardsImported: 0,
        transactionsImported: 0,
        executionTime
      }, 'error', [error.message]);

      throw error;
    }
  }
}

const main = async () => {
  try {
    console.log('🚀 Starting Nano Backend Smart Sync');
    console.log('=' .repeat(50));
    
    await connectDatabases();
    console.log('✅ Databases connected successfully');
    
    const smartSync = new SmartSyncService();
    smartSync.initialize();
    console.log('✅ Smart sync service initialized');
    
    console.log('=' .repeat(50));
    
    const result = await smartSync.performSmartSync();
    
  } catch (error) {
    console.error('❌ Smart sync failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

module.exports = { SmartSyncService };
