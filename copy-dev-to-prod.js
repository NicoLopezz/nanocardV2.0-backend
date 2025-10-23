const { connectDatabases, databases } = require('./config/database');
const mongoose = require('mongoose');

async function copyDevToProd() {
  try {
    console.log('🔄 Copying development data to production...');
    
    // Conectar a ambas bases de datos
    await connectDatabases();
    
    // Esperar a que las conexiones estén listas
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('📊 Starting data migration from dev to prod...');
    
    // 1. COPIAR USUARIOS
    console.log('\n👥 Copying users...');
    const devUsers = databases.users.connection.useDb('dev_users');
    const prodUsers = databases.users.connection.useDb('prod_users');
    
    // Limpiar usuarios de producción
    await prodUsers.collection('users').deleteMany({});
    console.log('   ✅ Cleared production users');
    
    // Copiar usuarios de desarrollo
    const users = await devUsers.collection('users').find({}).toArray();
    if (users.length > 0) {
      await prodUsers.collection('users').insertMany(users);
      console.log(`   ✅ Copied ${users.length} users`);
    }
    
    // 2. COPIAR TARJETAS
    console.log('\n💳 Copying cards...');
    const devCards = databases.cards.connection.useDb('dev_cards');
    const prodCards = databases.cards.connection.useDb('prod_cards');
    
    // Limpiar tarjetas de producción
    await prodCards.collection('cards').deleteMany({});
    console.log('   ✅ Cleared production cards');
    
    // Copiar tarjetas de desarrollo
    const cards = await devCards.collection('cards').find({}).toArray();
    if (cards.length > 0) {
      await prodCards.collection('cards').insertMany(cards);
      console.log(`   ✅ Copied ${cards.length} cards`);
    }
    
    // 3. COPIAR TRANSACCIONES
    console.log('\n💰 Copying transactions...');
    const devTransactions = databases.transactions.connection.useDb('dev_transactions');
    const prodTransactions = databases.transactions.connection.useDb('prod_transactions');
    
    // Limpiar transacciones de producción
    await prodTransactions.collection('transactions').deleteMany({});
    console.log('   ✅ Cleared production transactions');
    
    // Copiar transacciones de desarrollo
    const transactions = await devTransactions.collection('transactions').find({}).toArray();
    if (transactions.length > 0) {
      await prodTransactions.collection('transactions').insertMany(transactions);
      console.log(`   ✅ Copied ${transactions.length} transactions`);
    }
    
    // 4. COPIAR HISTORIAL
    console.log('\n📚 Copying history...');
    const devHistory = databases.history.connection.useDb('dev_history');
    const prodHistory = databases.history.connection.useDb('prod_history');
    
    // Limpiar historial de producción
    await prodHistory.collection('history').deleteMany({});
    console.log('   ✅ Cleared production history');
    
    // Copiar historial de desarrollo
    const history = await devHistory.collection('history').find({}).toArray();
    if (history.length > 0) {
      await prodHistory.collection('history').insertMany(history);
      console.log(`   ✅ Copied ${history.length} history records`);
    }
    
    // 5. COPIAR RECONCILIACIONES
    console.log('\n🔄 Copying reconciliations...');
    const devReconciliations = databases.reconciliations.connection.useDb('dev_reconciliations');
    const prodReconciliations = databases.reconciliations.connection.useDb('prod_reconciliations');
    
    // Limpiar reconciliaciones de producción
    await prodReconciliations.collection('reconciliations').deleteMany({});
    console.log('   ✅ Cleared production reconciliations');
    
    // Copiar reconciliaciones de desarrollo
    const reconciliations = await devReconciliations.collection('reconciliations').find({}).toArray();
    if (reconciliations.length > 0) {
      await prodReconciliations.collection('reconciliations').insertMany(reconciliations);
      console.log(`   ✅ Copied ${reconciliations.length} reconciliations`);
    }
    
    // 6. COPIAR SYNC LOGS
    console.log('\n📊 Copying sync logs...');
    const devSynclog = databases.synclog.connection.useDb('dev_synclog');
    const prodSynclog = databases.synclog.connection.useDb('prod_synclog');
    
    // Limpiar sync logs de producción
    await prodSynclog.collection('synclogs').deleteMany({});
    console.log('   ✅ Cleared production sync logs');
    
    // Copiar sync logs de desarrollo
    const synclogs = await devSynclog.collection('synclogs').find({}).toArray();
    if (synclogs.length > 0) {
      await prodSynclog.collection('synclogs').insertMany(synclogs);
      console.log(`   ✅ Copied ${synclogs.length} sync logs`);
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Cards: ${cards.length}`);
    console.log(`   - Transactions: ${transactions.length}`);
    console.log(`   - History: ${history.length}`);
    console.log(`   - Reconciliations: ${reconciliations.length}`);
    console.log(`   - Sync Logs: ${synclogs.length}`);
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  copyDevToProd();
}

module.exports = { copyDevToProd };


