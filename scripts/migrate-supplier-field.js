const mongoose = require('mongoose');
require('dotenv').config();

// Configurar conexiones a las bases de datos
const config = require('../config/environment');

const databases = {
  transactions: {
    uri: config.TRANSACTIONS_DB_URI,
    connection: null
  }
};

async function connectDatabases() {
  try {
    console.log('🔗 Conectando a la base de datos de transacciones...');
    
    databases.transactions.connection = await mongoose.createConnection(databases.transactions.uri);
    console.log('✅ Conectado a la base de datos de transacciones');
    
  } catch (error) {
    console.error('❌ Error conectando a las bases de datos:', error);
    process.exit(1);
  }
}

async function migrateSupplierField() {
  try {
    const Transaction = databases.transactions.connection.model('Transaction', new mongoose.Schema({}, { strict: false }));
    
    console.log('📊 Iniciando migración del campo supplier...');
    
    // Contar transacciones sin supplier
    const totalWithoutSupplier = await Transaction.countDocuments({ supplier: { $exists: false } });
    console.log(`📈 Total de transacciones sin campo supplier: ${totalWithoutSupplier}`);
    
    if (totalWithoutSupplier === 0) {
      console.log('✅ Todas las transacciones ya tienen el campo supplier');
      return;
    }
    
    // Migrar transacciones sin supplier (asumir que son de CryptoMate por defecto)
    const result = await Transaction.updateMany(
      { supplier: { $exists: false } },
      { $set: { supplier: 'cryptomate' } }
    );
    
    console.log(`✅ Migración completada:`);
    console.log(`   - Transacciones actualizadas: ${result.modifiedCount}`);
    console.log(`   - Transacciones sin cambios: ${totalWithoutSupplier - result.modifiedCount}`);
    
    // Verificar resultado
    const remainingWithoutSupplier = await Transaction.countDocuments({ supplier: { $exists: false } });
    console.log(`🔍 Transacciones restantes sin supplier: ${remainingWithoutSupplier}`);
    
    // Estadísticas por proveedor
    const cryptomateCount = await Transaction.countDocuments({ supplier: 'cryptomate' });
    const mercuryCount = await Transaction.countDocuments({ supplier: 'mercury' });
    
    console.log(`📊 Estadísticas finales:`);
    console.log(`   - CryptoMate: ${cryptomateCount} transacciones`);
    console.log(`   - Mercury: ${mercuryCount} transacciones`);
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDatabases();
    await migrateSupplierField();
    
    console.log('🎉 Migración completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  } finally {
    // Cerrar conexiones
    if (databases.transactions.connection) {
      await databases.transactions.connection.close();
      console.log('🔌 Conexión a transacciones cerrada');
    }
    
    process.exit(0);
  }
}

// Ejecutar migración
main();
