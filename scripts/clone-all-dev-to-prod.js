require('dotenv').config();
const mongoose = require('mongoose');

const cloneAllDevToProd = async () => {
  try {
    console.log('🚀 Starting complete clone from DEV to PROD (excluding TEST)...');
    console.log('⚠️  WARNING: This will overwrite all production data!');
    
    // Configuración de bases de datos
    const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/';
    
    const databases = [
      { name: 'users', collection: 'users' },
      { name: 'cards', collection: 'cards' },
      { name: 'transactions', collection: 'transactions' },
      { name: 'history', collection: 'histories' },
      { name: 'reconciliations', collection: 'reconciliations' }
    ];
    
    // Conectar a MongoDB
    const connection = await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const results = {
      users: 0,
      cards: 0,
      transactions: 0,
      history: 0,
      reconciliations: 0
    };
    
    // Procesar cada base de datos
    for (const db of databases) {
      console.log(`\n📊 Processing ${db.name}...`);
      
      try {
        const devDb = connection.connection.useDb(`dev_${db.name}`);
        const prodDb = connection.connection.useDb(`prod_${db.name}`);
        
        // Verificar si la base de datos dev existe
        const devCollections = await devDb.db.listCollections().toArray();
        if (devCollections.length === 0) {
          console.log(`⚠️  dev_${db.name} database is empty or doesn't exist, skipping...`);
          continue;
        }
        
        // Limpiar la base de datos de producción
        console.log(`🧹 Cleaning prod_${db.name}...`);
        try {
          await prodDb.db.collection(db.collection).drop();
          console.log(`✅ Dropped existing ${db.collection} collection in prod_${db.name}`);
        } catch (e) {
          console.log(`ℹ️  Collection ${db.collection} didn't exist in prod_${db.name}`);
        }
        
        // Obtener todos los documentos de dev
        const documents = await devDb.db.collection(db.collection).find({}).toArray();
        console.log(`📊 Found ${documents.length} documents in dev_${db.name}`);
        
        if (documents.length > 0) {
          // Insertar en prod
          await prodDb.db.collection(db.collection).insertMany(documents);
          results[db.name] = documents.length;
          console.log(`✅ Cloned ${documents.length} documents to prod_${db.name}`);
        } else {
          console.log(`ℹ️  No documents to clone in dev_${db.name}`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${db.name}:`, error.message);
        results[db.name] = 'ERROR';
      }
    }
    
    console.log('\n🎉 Clone completed!');
    console.log('📊 Summary:');
    console.log(`   - Users: ${results.users}`);
    console.log(`   - Cards: ${results.cards}`);
    console.log(`   - Transactions: ${results.transactions}`);
    console.log(`   - History: ${results.history}`);
    console.log(`   - Reconciliations: ${results.reconciliations}`);
    
    console.log('\n✅ All DEV databases have been cloned to PROD');
    console.log('🚫 TEST databases were excluded as requested');
    
  } catch (error) {
    console.error('❌ Clone error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Función para confirmar antes de ejecutar
const confirmExecution = () => {
  console.log('⚠️  IMPORTANT: This script will:');
  console.log('   1. Connect to your MongoDB database');
  console.log('   2. CLEAR all production databases');
  console.log('   3. Copy all data from dev_* to prod_* databases');
  console.log('   4. EXCLUDE all test_* databases');
  console.log('\n🚨 This action cannot be undone!');
  console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...');
  
  setTimeout(() => {
    console.log('\n🚀 Starting clone process...');
    cloneAllDevToProd();
  }, 5000);
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  confirmExecution();
}

module.exports = { cloneAllDevToProd };
