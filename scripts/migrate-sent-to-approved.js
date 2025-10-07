const mongoose = require('mongoose');
require('dotenv').config();

// Forzar entorno de desarrollo
process.env.NODE_ENV = 'development';

// Configurar conexiones a las bases de datos
const config = require('../config/environment');

const databases = {
  transactions: {
    uri: config.TRANSACTIONS_DB_URI, // Ya está configurado para desarrollo
    connection: null
  }
};

async function connectDatabases() {
  try {
    console.log('🔗 Conectando a la base de datos de transacciones (DESARROLLO)...');
    console.log(`📍 URI: ${databases.transactions.uri}`);
    
    databases.transactions.connection = await mongoose.createConnection(databases.transactions.uri);
    console.log('✅ Conectado a la base de datos de transacciones (DESARROLLO)');
    
  } catch (error) {
    console.error('❌ Error conectando a las bases de datos:', error);
    process.exit(1);
  }
}

async function migrateSentToApproved() {
  try {
    const Transaction = databases.transactions.connection.model('Transaction', new mongoose.Schema({}, { strict: false }));
    
    console.log('📊 Iniciando migración: TRANSACTION_SENT → TRANSACTION_APPROVED...');
    
    // Contar transacciones TRANSACTION_SENT
    const sentTransactions = await Transaction.countDocuments({ operation: 'TRANSACTION_SENT' });
    console.log(`📈 Total de transacciones TRANSACTION_SENT encontradas: ${sentTransactions}`);
    
    if (sentTransactions === 0) {
      console.log('✅ No hay transacciones TRANSACTION_SENT para migrar');
      return;
    }
    
    // Mostrar estadísticas por proveedor
    const statsBySupplier = await Transaction.aggregate([
      { $match: { operation: 'TRANSACTION_SENT' } },
      { $group: { _id: '$supplier', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log('📊 Estadísticas por proveedor:');
    statsBySupplier.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count} transacciones`);
    });
    
    // Migrar TRANSACTION_SENT → TRANSACTION_APPROVED
    const result = await Transaction.updateMany(
      { operation: 'TRANSACTION_SENT' },
      { 
        $set: { 
          operation: 'TRANSACTION_APPROVED',
          updatedAt: new Date()
        } 
      }
    );
    
    console.log(`✅ Migración completada:`);
    console.log(`   - Transacciones migradas: ${result.modifiedCount}`);
    console.log(`   - TRANSACTION_SENT → TRANSACTION_APPROVED`);
    
    // Verificar resultado
    const remainingSentTransactions = await Transaction.countDocuments({ operation: 'TRANSACTION_SENT' });
    const approvedTransactions = await Transaction.countDocuments({ operation: 'TRANSACTION_APPROVED' });
    
    console.log(`📊 Verificación:`);
    console.log(`   - Transacciones restantes TRANSACTION_SENT: ${remainingSentTransactions}`);
    console.log(`   - Total transacciones TRANSACTION_APPROVED: ${approvedTransactions}`);
    
    // Estadísticas finales por operación
    const finalStats = await Transaction.aggregate([
      { $group: { _id: '$operation', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log(`📊 Estadísticas finales por operación:`);
    finalStats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count} transacciones`);
    });
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDatabases();
    await migrateSentToApproved();
    
    console.log('🎉 Migración TRANSACTION_SENT → TRANSACTION_APPROVED completada exitosamente (DESARROLLO)');
    
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
