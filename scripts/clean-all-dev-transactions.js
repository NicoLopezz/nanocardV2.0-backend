require('dotenv').config();
const mongoose = require('mongoose');

const NEW_DB_URI = process.env.MONGODB_URI;

const cleanAllDevTransactions = async () => {
  try {
    console.log('🧹 Cleaning ALL development database transactions...');
    
    // Conectar a la DB nueva
    const newConnection = await mongoose.connect(NEW_DB_URI);
    console.log('✅ Connected to new database');
    
    // Conectar a las nuevas bases de datos
    const newUsersDb = newConnection.connection.useDb('dev_users');
    const newCardsDb = newConnection.connection.useDb('dev_cards');
    const newTransactionsDb = newConnection.connection.useDb('dev_transactions');
    const newHistoryDb = newConnection.connection.useDb('dev_history');
    const newReconciliationsDb = newConnection.connection.useDb('dev_reconciliations');
    
    console.log('\n📊 CLEANING ALL DEV DATABASES:');
    console.log('='.repeat(60));
    
    let totalDeleted = 0;
    
    // 1. Eliminar TODAS las transacciones
    const transactionResult = await newTransactionsDb.collection('transactions').deleteMany({});
    console.log(`🗑️ Deleted ${transactionResult.deletedCount} transactions from dev_transactions`);
    totalDeleted += transactionResult.deletedCount;
    
    // 2. Eliminar TODO el historial
    const historyResult = await newHistoryDb.collection('histories').deleteMany({});
    console.log(`🗑️ Deleted ${historyResult.deletedCount} history records from dev_history`);
    totalDeleted += historyResult.deletedCount;
    
    // 3. Eliminar TODAS las reconciliaciones
    const reconciliationResult = await newReconciliationsDb.collection('reconciliations').deleteMany({});
    console.log(`🗑️ Deleted ${reconciliationResult.deletedCount} reconciliations from dev_reconciliations`);
    totalDeleted += reconciliationResult.deletedCount;
    
    // 4. Resetear estadísticas de TODAS las tarjetas
    const cardsResult = await newCardsDb.collection('cards').updateMany(
      {},
      {
        $set: {
          deposited: 0,
          refunded: 0,
          posted: 0,
          pending: 0,
          available: 0,
          transactionStats: {
            totalTransactions: 0,
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
            },
            lastUpdated: new Date()
          },
          updatedAt: new Date()
        }
      }
    );
    console.log(`🔄 Reset statistics for ${cardsResult.modifiedCount} cards`);
    
    // 5. Resetear estadísticas de TODOS los usuarios
    const usersResult = await newUsersDb.collection('users').updateMany(
      {},
      {
        $set: {
          'stats.totalTransactions': 0,
          'stats.totalDeposited': 0,
          'stats.totalPosted': 0,
          'stats.totalPending': 0,
          'stats.totalAvailable': 0,
          'stats.lastLogin': new Date(),
          'stats.loginCount': 0,
          updatedAt: new Date()
        }
      }
    );
    console.log(`🔄 Reset statistics for ${usersResult.modifiedCount} users`);
    
    // 6. Verificar que quedó limpio
    const remainingTransactions = await newTransactionsDb.collection('transactions').countDocuments({});
    const remainingHistory = await newHistoryDb.collection('histories').countDocuments({});
    const remainingReconciliations = await newReconciliationsDb.collection('reconciliations').countDocuments({});
    const totalCards = await newCardsDb.collection('cards').countDocuments({});
    const totalUsers = await newUsersDb.collection('users').countDocuments({});
    
    console.log('\n📊 CLEANUP VERIFICATION:');
    console.log('='.repeat(60));
    console.log(`   - Remaining transactions: ${remainingTransactions}`);
    console.log(`   - Remaining history records: ${remainingHistory}`);
    console.log(`   - Remaining reconciliations: ${remainingReconciliations}`);
    console.log(`   - Total cards: ${totalCards}`);
    console.log(`   - Total users: ${totalUsers}`);
    console.log(`   - Total documents deleted: ${totalDeleted}`);
    
    if (remainingTransactions === 0 && remainingHistory === 0 && remainingReconciliations === 0) {
      console.log(`\n✅ ALL DEVELOPMENT DATABASES COMPLETELY CLEANED!`);
      console.log(`🚀 Ready for fresh import with new approach`);
      console.log(`📋 Structure preserved: ${totalUsers} users and ${totalCards} cards remain`);
    } else {
      console.log(`\n⚠️ Some data still remains - manual cleanup may be needed`);
    }
    
  } catch (error) {
    console.error('❌ Cleanup error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from databases');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  cleanAllDevTransactions();
}

module.exports = { cleanAllDevTransactions };
