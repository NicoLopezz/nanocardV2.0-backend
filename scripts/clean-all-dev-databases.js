require('dotenv').config();
const mongoose = require('mongoose');

const cleanAllDevDatabases = async () => {
  try {
    console.log('🧹 Starting complete cleanup of all development databases...');
    
    // Conectar a la DB nueva
    const connection = await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to new database');
    
    // Conectar a las bases de datos de desarrollo
    const usersDb = connection.connection.useDb('dev_users');
    const cardsDb = connection.connection.useDb('dev_cards');
    const transactionsDb = connection.connection.useDb('dev_transactions');
    const historyDb = connection.connection.useDb('dev_history');
    const reconciliationsDb = connection.connection.useDb('dev_reconciliations');
    
    console.log('\n📊 CLEANUP STARTING...');
    console.log('='.repeat(50));
    
    // 1. LIMPIAR USUARIOS
    console.log('\n👤 CLEANING USERS DATABASE:');
    try {
      const userCount = await usersDb.collection('users').countDocuments();
      console.log(`   - Found ${userCount} users to delete`);
      
      if (userCount > 0) {
        const userResult = await usersDb.collection('users').deleteMany({});
        console.log(`   ✅ Deleted ${userResult.deletedCount} users`);
      } else {
        console.log(`   ✅ No users to delete`);
      }
    } catch (error) {
      console.log(`   ❌ Error cleaning users: ${error.message}`);
    }
    
    // 2. LIMPIAR TARJETAS
    console.log('\n💳 CLEANING CARDS DATABASE:');
    try {
      const cardCount = await cardsDb.collection('cards').countDocuments();
      console.log(`   - Found ${cardCount} cards to delete`);
      
      if (cardCount > 0) {
        const cardResult = await cardsDb.collection('cards').deleteMany({});
        console.log(`   ✅ Deleted ${cardResult.deletedCount} cards`);
      } else {
        console.log(`   ✅ No cards to delete`);
      }
    } catch (error) {
      console.log(`   ❌ Error cleaning cards: ${error.message}`);
    }
    
    // 3. LIMPIAR TRANSACCIONES
    console.log('\n💰 CLEANING TRANSACTIONS DATABASE:');
    try {
      const transactionCount = await transactionsDb.collection('transactions').countDocuments();
      console.log(`   - Found ${transactionCount} transactions to delete`);
      
      if (transactionCount > 0) {
        const transactionResult = await transactionsDb.collection('transactions').deleteMany({});
        console.log(`   ✅ Deleted ${transactionResult.deletedCount} transactions`);
      } else {
        console.log(`   ✅ No transactions to delete`);
      }
    } catch (error) {
      console.log(`   ❌ Error cleaning transactions: ${error.message}`);
    }
    
    // 4. LIMPIAR HISTORIAL
    console.log('\n📚 CLEANING HISTORY DATABASE:');
    try {
      const historyCount = await historyDb.collection('histories').countDocuments();
      console.log(`   - Found ${historyCount} history records to delete`);
      
      if (historyCount > 0) {
        const historyResult = await historyDb.collection('histories').deleteMany({});
        console.log(`   ✅ Deleted ${historyResult.deletedCount} history records`);
      } else {
        console.log(`   ✅ No history records to delete`);
      }
    } catch (error) {
      console.log(`   ❌ Error cleaning history: ${error.message}`);
    }
    
    // 5. LIMPIAR RECONCILIACIONES
    console.log('\n🔄 CLEANING RECONCILIATIONS DATABASE:');
    try {
      const reconciliationCount = await reconciliationsDb.collection('reconciliations').countDocuments();
      console.log(`   - Found ${reconciliationCount} reconciliations to delete`);
      
      if (reconciliationCount > 0) {
        const reconciliationResult = await reconciliationsDb.collection('reconciliations').deleteMany({});
        console.log(`   ✅ Deleted ${reconciliationResult.deletedCount} reconciliations`);
      } else {
        console.log(`   ✅ No reconciliations to delete`);
      }
    } catch (error) {
      console.log(`   ❌ Error cleaning reconciliations: ${error.message}`);
    }
    
    // 6. VERIFICAR LIMPIEZA
    console.log('\n🔍 VERIFYING CLEANUP:');
    console.log('='.repeat(50));
    
    const finalUserCount = await usersDb.collection('users').countDocuments();
    const finalCardCount = await cardsDb.collection('cards').countDocuments();
    const finalTransactionCount = await transactionsDb.collection('transactions').countDocuments();
    const finalHistoryCount = await historyDb.collection('histories').countDocuments();
    const finalReconciliationCount = await reconciliationsDb.collection('reconciliations').countDocuments();
    
    console.log(`   - Users remaining: ${finalUserCount}`);
    console.log(`   - Cards remaining: ${finalCardCount}`);
    console.log(`   - Transactions remaining: ${finalTransactionCount}`);
    console.log(`   - History records remaining: ${finalHistoryCount}`);
    console.log(`   - Reconciliations remaining: ${finalReconciliationCount}`);
    
    // 7. RESUMEN
    console.log('\n' + '='.repeat(50));
    console.log('🎉 CLEANUP COMPLETED!');
    console.log('📊 Summary:');
    console.log(`   - dev_users: ${finalUserCount === 0 ? '✅ CLEAN' : '❌ NOT CLEAN'}`);
    console.log(`   - dev_cards: ${finalCardCount === 0 ? '✅ CLEAN' : '❌ NOT CLEAN'}`);
    console.log(`   - dev_transactions: ${finalTransactionCount === 0 ? '✅ CLEAN' : '❌ NOT CLEAN'}`);
    console.log(`   - dev_history: ${finalHistoryCount === 0 ? '✅ CLEAN' : '❌ NOT CLEAN'}`);
    console.log(`   - dev_reconciliations: ${finalReconciliationCount === 0 ? '✅ CLEAN' : '❌ NOT CLEAN'}`);
    
    const allClean = finalUserCount === 0 && finalCardCount === 0 && finalTransactionCount === 0 && finalHistoryCount === 0 && finalReconciliationCount === 0;
    
    if (allClean) {
      console.log('\n✅ ALL DEVELOPMENT DATABASES ARE NOW CLEAN!');
      console.log('🚀 Ready for fresh migration from old database');
    } else {
      console.log('\n❌ Some databases still contain data');
    }
    
  } catch (error) {
    console.error('❌ Cleanup error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  cleanAllDevDatabases();
}

module.exports = { cleanAllDevDatabases };
