require('dotenv').config();
const mongoose = require('mongoose');

// Script para limpiar todas las colecciones de historial
async function cleanHistoryDatabases() {
  try {
    console.log('🧹 Starting history database cleanup...\n');

    // Obtener las URIs de las bases de datos de historial
    const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/';
    const devHistoryUri = `${baseUri}dev_history`;
    const prodHistoryUri = `${baseUri}prod_history`;

    console.log('📚 Dev History URI:', devHistoryUri);
    console.log('📚 Prod History URI:', prodHistoryUri);
    console.log('\n⚠️  WARNING: This will delete ALL history records!');
    console.log('Press Ctrl+C within 5 seconds to cancel...\n');

    // Esperar 5 segundos para cancelar
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Limpiar dev_history
    console.log('\n🧹 Cleaning dev_history...');
    const devConnection = await mongoose.createConnection(devHistoryUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000
    });

    const devHistoryModel = devConnection.model('History', new mongoose.Schema({}, { strict: false }));
    const devCount = await devHistoryModel.countDocuments();
    console.log(`   📊 Found ${devCount} records in dev_history`);

    if (devCount > 0) {
      const devResult = await devHistoryModel.deleteMany({});
      console.log(`   ✅ Deleted ${devResult.deletedCount} records from dev_history`);
    } else {
      console.log('   ℹ️  No records to delete in dev_history');
    }

    await devConnection.close();
    console.log('   ✅ dev_history cleaned');

    // Limpiar prod_history
    console.log('\n🧹 Cleaning prod_history...');
    const prodConnection = await mongoose.createConnection(prodHistoryUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000
    });

    const prodHistoryModel = prodConnection.model('History', new mongoose.Schema({}, { strict: false }));
    const prodCount = await prodHistoryModel.countDocuments();
    console.log(`   📊 Found ${prodCount} records in prod_history`);

    if (prodCount > 0) {
      const prodResult = await prodHistoryModel.deleteMany({});
      console.log(`   ✅ Deleted ${prodResult.deletedCount} records from prod_history`);
    } else {
      console.log('   ℹ️  No records to delete in prod_history');
    }

    await prodConnection.close();
    console.log('   ✅ prod_history cleaned');

    console.log('\n✅ History database cleanup completed!');
    console.log('📝 From now on, all new history records will be properly formatted.');

  } catch (error) {
    console.error('❌ Error cleaning history databases:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Ejecutar limpieza
cleanHistoryDatabases();

