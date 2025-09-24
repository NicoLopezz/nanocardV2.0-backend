require('dotenv').config();
const mongoose = require('mongoose');

const migrateDevToProd = async () => {
  try {
    console.log('🚀 Starting migration from dev to prod...');
    
    // Conectar a MongoDB
    const connection = await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Obtener bases de datos
    const admin = connection.connection.db.admin();
    const dbs = await admin.listDatabases();
    
    console.log('📋 Available databases:');
    dbs.databases.forEach(db => {
      console.log(`  - ${db.name}`);
    });
    
    // Migrar usuarios
    console.log('\n👥 Migrating users from dev_users to prod_users...');
    try {
      const devUsersDb = connection.connection.useDb('dev_users');
      const prodUsersDb = connection.connection.useDb('prod_users');
      
      // Obtener todas las colecciones de usuarios
      const devCollections = await devUsersDb.listCollections().toArray();
      console.log(`📊 Found ${devCollections.length} collections in dev_users`);
      
      for (const collection of devCollections) {
        const collectionName = collection.name;
        console.log(`📄 Processing collection: ${collectionName}`);
        
        // Obtener todos los documentos de la colección
        const documents = await devUsersDb.collection(collectionName).find({}).toArray();
        console.log(`   - Found ${documents.length} documents`);
        
        if (documents.length > 0) {
          // Insertar en prod_users
          await prodUsersDb.collection(collectionName).insertMany(documents);
          console.log(`   ✅ Migrated ${documents.length} documents to prod_users`);
        }
      }
    } catch (error) {
      console.error('❌ Error migrating users:', error.message);
    }
    
    // Migrar tarjetas
    console.log('\n💳 Migrating cards from dev_cards to prod_cards...');
    try {
      const devCardsDb = connection.connection.useDb('dev_cards');
      const prodCardsDb = connection.connection.useDb('prod_cards');
      
      // Obtener todas las colecciones de tarjetas
      const devCollections = await devCardsDb.listCollections().toArray();
      console.log(`📊 Found ${devCollections.length} collections in dev_cards`);
      
      for (const collection of devCollections) {
        const collectionName = collection.name;
        console.log(`📄 Processing collection: ${collectionName}`);
        
        // Obtener todos los documentos de la colección
        const documents = await devCardsDb.collection(collectionName).find({}).toArray();
        console.log(`   - Found ${documents.length} documents`);
        
        if (documents.length > 0) {
          // Insertar en prod_cards
          await prodCardsDb.collection(collectionName).insertMany(documents);
          console.log(`   ✅ Migrated ${documents.length} documents to prod_cards`);
        }
      }
    } catch (error) {
      console.error('❌ Error migrating cards:', error.message);
    }
    
    // Migrar transacciones
    console.log('\n💰 Migrating transactions from dev_transactions to prod_transactions...');
    try {
      const devTransactionsDb = connection.connection.useDb('dev_transactions');
      const prodTransactionsDb = connection.connection.useDb('prod_transactions');
      
      // Obtener todas las colecciones de transacciones
      const devCollections = await devTransactionsDb.listCollections().toArray();
      console.log(`📊 Found ${devCollections.length} collections in dev_transactions`);
      
      for (const collection of devCollections) {
        const collectionName = collection.name;
        console.log(`📄 Processing collection: ${collectionName}`);
        
        // Obtener todos los documentos de la colección
        const documents = await devTransactionsDb.collection(collectionName).find({}).toArray();
        console.log(`   - Found ${documents.length} documents`);
        
        if (documents.length > 0) {
          // Insertar en prod_transactions
          await prodTransactionsDb.collection(collectionName).insertMany(documents);
          console.log(`   ✅ Migrated ${documents.length} documents to prod_transactions`);
        }
      }
    } catch (error) {
      console.error('❌ Error migrating transactions:', error.message);
    }
    
    // Migrar historial
    console.log('\n📚 Migrating history from dev_history to prod_history...');
    try {
      const devHistoryDb = connection.connection.useDb('dev_history');
      const prodHistoryDb = connection.connection.useDb('prod_history');
      
      // Obtener todas las colecciones de historial
      const devCollections = await devHistoryDb.listCollections().toArray();
      console.log(`📊 Found ${devCollections.length} collections in dev_history`);
      
      for (const collection of devCollections) {
        const collectionName = collection.name;
        console.log(`📄 Processing collection: ${collectionName}`);
        
        // Obtener todos los documentos de la colección
        const documents = await devHistoryDb.collection(collectionName).find({}).toArray();
        console.log(`   - Found ${documents.length} documents`);
        
        if (documents.length > 0) {
          // Insertar en prod_history
          await prodHistoryDb.collection(collectionName).insertMany(documents);
          console.log(`   ✅ Migrated ${documents.length} documents to prod_history`);
        }
      }
    } catch (error) {
      console.error('❌ Error migrating history:', error.message);
    }
    
    // Migrar reconciliaciones
    console.log('\n🔄 Migrating reconciliations from dev_reconciliations to prod_reconciliations...');
    try {
      const devReconciliationsDb = connection.connection.useDb('dev_reconciliations');
      const prodReconciliationsDb = connection.connection.useDb('prod_reconciliations');
      
      // Obtener todas las colecciones de reconciliaciones
      const devCollections = await devReconciliationsDb.listCollections().toArray();
      console.log(`📊 Found ${devCollections.length} collections in dev_reconciliations`);
      
      for (const collection of devCollections) {
        const collectionName = collection.name;
        console.log(`📄 Processing collection: ${collectionName}`);
        
        // Obtener todos los documentos de la colección
        const documents = await devReconciliationsDb.collection(collectionName).find({}).toArray();
        console.log(`   - Found ${documents.length} documents`);
        
        if (documents.length > 0) {
          // Insertar en prod_reconciliations
          await prodReconciliationsDb.collection(collectionName).insertMany(documents);
          console.log(`   ✅ Migrated ${documents.length} documents to prod_reconciliations`);
        }
      }
    } catch (error) {
      console.error('❌ Error migrating reconciliations:', error.message);
    }
    
    console.log('\n🎉 Migration completed successfully!');
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
  migrateDevToProd();
}

module.exports = { migrateDevToProd };
