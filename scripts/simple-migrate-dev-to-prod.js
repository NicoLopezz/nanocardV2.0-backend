require('dotenv').config();
const mongoose = require('mongoose');

const simpleMigrateDevToProd = async () => {
  try {
    console.log('🚀 Starting simple migration from dev to prod...');
    
    // Conectar a MongoDB
    const connection = await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Migrar usuarios
    console.log('\n👥 Migrating users...');
    try {
      const devUsersDb = connection.connection.useDb('dev_users');
      const prodUsersDb = connection.connection.useDb('prod_users');
      
      // Obtener todos los usuarios de dev
      const users = await devUsersDb.collection('users').find({}).toArray();
      console.log(`📊 Found ${users.length} users in dev_users`);
      
      if (users.length > 0) {
        // Insertar en prod_users
        await prodUsersDb.collection('users').insertMany(users);
        console.log(`✅ Migrated ${users.length} users to prod_users`);
      }
    } catch (error) {
      console.error('❌ Error migrating users:', error.message);
    }
    
    // Migrar tarjetas
    console.log('\n💳 Migrating cards...');
    try {
      const devCardsDb = connection.connection.useDb('dev_cards');
      const prodCardsDb = connection.connection.useDb('prod_cards');
      
      // Obtener todas las tarjetas de dev
      const cards = await devCardsDb.collection('cards').find({}).toArray();
      console.log(`📊 Found ${cards.length} cards in dev_cards`);
      
      if (cards.length > 0) {
        // Insertar en prod_cards
        await prodCardsDb.collection('cards').insertMany(cards);
        console.log(`✅ Migrated ${cards.length} cards to prod_cards`);
      }
    } catch (error) {
      console.error('❌ Error migrating cards:', error.message);
    }
    
    // Migrar transacciones
    console.log('\n💰 Migrating transactions...');
    try {
      const devTransactionsDb = connection.connection.useDb('dev_transactions');
      const prodTransactionsDb = connection.connection.useDb('prod_transactions');
      
      // Obtener todas las transacciones de dev
      const transactions = await devTransactionsDb.collection('transactions').find({}).toArray();
      console.log(`📊 Found ${transactions.length} transactions in dev_transactions`);
      
      if (transactions.length > 0) {
        // Insertar en prod_transactions
        await prodTransactionsDb.collection('transactions').insertMany(transactions);
        console.log(`✅ Migrated ${transactions.length} transactions to prod_transactions`);
      }
    } catch (error) {
      console.error('❌ Error migrating transactions:', error.message);
    }
    
    // Migrar historial
    console.log('\n📚 Migrating history...');
    try {
      const devHistoryDb = connection.connection.useDb('dev_history');
      const prodHistoryDb = connection.connection.useDb('prod_history');
      
      // Obtener todo el historial de dev
      const history = await devHistoryDb.collection('histories').find({}).toArray();
      console.log(`📊 Found ${history.length} history records in dev_history`);
      
      if (history.length > 0) {
        // Insertar en prod_history
        await prodHistoryDb.collection('histories').insertMany(history);
        console.log(`✅ Migrated ${history.length} history records to prod_history`);
      }
    } catch (error) {
      console.error('❌ Error migrating history:', error.message);
    }
    
    // Migrar reconciliaciones
    console.log('\n🔄 Migrating reconciliations...');
    try {
      const devReconciliationsDb = connection.connection.useDb('dev_reconciliations');
      const prodReconciliationsDb = connection.connection.useDb('prod_reconciliations');
      
      // Obtener todas las reconciliaciones de dev
      const reconciliations = await devReconciliationsDb.collection('reconciliations').find({}).toArray();
      console.log(`📊 Found ${reconciliations.length} reconciliations in dev_reconciliations`);
      
      if (reconciliations.length > 0) {
        // Insertar en prod_reconciliations
        await prodReconciliationsDb.collection('reconciliations').insertMany(reconciliations);
        console.log(`✅ Migrated ${reconciliations.length} reconciliations to prod_reconciliations`);
      }
    } catch (error) {
      console.error('❌ Error migrating reconciliations:', error.message);
    }
    
    console.log('\n🎉 Simple migration completed!');
    console.log('📊 Summary:');
    console.log('   - Users: dev_users → prod_users');
    console.log('   - Cards: dev_cards → prod_cards');
    console.log('   - Transactions: dev_transactions → prod_transactions');
    console.log('   - History: dev_history → prod_history');
    console.log('   - Reconciliations: dev_reconciliations → prod_reconciliations');
    
  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  simpleMigrateDevToProd();
}

module.exports = { simpleMigrateDevToProd };
