require('dotenv').config();
const mongoose = require('mongoose');

const previewCloneDevToProd = async () => {
  try {
    console.log('🔍 Previewing DEV to PROD clone (excluding TEST)...');
    
    // Configuración de bases de datos
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
    
    console.log('\n📊 DEV Databases Status:');
    console.log('='.repeat(50));
    
    const devSummary = {};
    const prodSummary = {};
    
    // Verificar cada base de datos
    for (const db of databases) {
      try {
        const devDb = connection.connection.useDb(`dev_${db.name}`);
        const prodDb = connection.connection.useDb(`prod_${db.name}`);
        
        // Contar documentos en dev
        const devCount = await devDb.db.collection(db.collection).countDocuments();
        devSummary[db.name] = devCount;
        
        // Contar documentos en prod
        const prodCount = await prodDb.db.collection(db.collection).countDocuments();
        prodSummary[db.name] = prodCount;
        
        console.log(`📁 ${db.name.toUpperCase()}:`);
        console.log(`   DEV:  ${devCount} documents`);
        console.log(`   PROD: ${prodCount} documents`);
        console.log(`   → Will copy ${devCount} documents to PROD`);
        console.log('');
        
      } catch (error) {
        console.log(`❌ Error checking ${db.name}: ${error.message}`);
        devSummary[db.name] = 'ERROR';
        prodSummary[db.name] = 'ERROR';
      }
    }
    
    console.log('📋 SUMMARY:');
    console.log('='.repeat(50));
    console.log('DEV → PROD Migration Preview:');
    console.log(`   Users:         ${devSummary.users} → prod_users`);
    console.log(`   Cards:         ${devSummary.cards} → prod_cards`);
    console.log(`   Transactions:  ${devSummary.transactions} → prod_transactions`);
    console.log(`   History:       ${devSummary.history} → prod_history`);
    console.log(`   Reconciliations: ${devSummary.reconciliations} → prod_reconciliations`);
    
    console.log('\n🚫 EXCLUDED (as requested):');
    console.log('   test_users, test_cards, test_transactions, test_history, test_reconciliations');
    
    const totalDevDocs = Object.values(devSummary).reduce((sum, count) => {
      return sum + (typeof count === 'number' ? count : 0);
    }, 0);
    
    console.log(`\n📊 Total documents to migrate: ${totalDevDocs}`);
    
    if (totalDevDocs > 0) {
      console.log('\n⚠️  WARNING: This will OVERWRITE all production data!');
      console.log('💡 To proceed, run: node scripts/clone-all-dev-to-prod.js');
    } else {
      console.log('\nℹ️  No data found in DEV databases to migrate.');
    }
    
  } catch (error) {
    console.error('❌ Preview error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  previewCloneDevToProd();
}

module.exports = { previewCloneDevToProd };
