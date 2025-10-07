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

async function migrateMercuryOperations() {
  try {
    const Transaction = databases.transactions.connection.model('Transaction', new mongoose.Schema({}, { strict: false }));
    
    console.log('📊 Iniciando migración de operaciones Mercury a formato unificado...');
    
    // Mapeo de operaciones antiguas a nuevas
    const operationMapping = {
      'MERCURY_PENDING': 'TRANSACTION_PENDING',
      'MERCURY_SENT': 'TRANSACTION_SENT',
      'MERCURY_CANCELLED': 'TRANSACTION_CANCELLED',
      'MERCURY_FAILED': 'TRANSACTION_REJECTED',
      'MERCURY_REVERSED': 'TRANSACTION_REVERSED',
      'MERCURY_BLOCKED': 'TRANSACTION_BLOCKED'
    };
    
    // Contar transacciones Mercury que necesitan migración
    const mercuryTransactions = await Transaction.find({ supplier: 'mercury' }).lean();
    console.log(`📈 Total de transacciones Mercury encontradas: ${mercuryTransactions.length}`);
    
    if (mercuryTransactions.length === 0) {
      console.log('✅ No hay transacciones Mercury para migrar');
      return;
    }
    
    // Contar cuántas necesitan migración
    const transactionsToMigrate = mercuryTransactions.filter(t => 
      Object.keys(operationMapping).includes(t.operation)
    );
    
    console.log(`📊 Transacciones que necesitan migración: ${transactionsToMigrate.length}`);
    
    if (transactionsToMigrate.length === 0) {
      console.log('✅ Todas las transacciones Mercury ya están en formato unificado');
      return;
    }
    
    // Mostrar estadísticas por operación
    const operationStats = {};
    transactionsToMigrate.forEach(t => {
      operationStats[t.operation] = (operationStats[t.operation] || 0) + 1;
    });
    
    console.log('📊 Estadísticas por operación:');
    Object.entries(operationStats).forEach(([oldOp, count]) => {
      const newOp = operationMapping[oldOp];
      console.log(`   ${oldOp} → ${newOp}: ${count} transacciones`);
    });
    
    // Migrar operaciones
    let totalMigrated = 0;
    for (const [oldOperation, newOperation] of Object.entries(operationMapping)) {
      const result = await Transaction.updateMany(
        { 
          supplier: 'mercury',
          operation: oldOperation 
        },
        { 
          $set: { 
            operation: newOperation,
            updatedAt: new Date()
          } 
        }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`✅ Migradas ${result.modifiedCount} transacciones: ${oldOperation} → ${newOperation}`);
        totalMigrated += result.modifiedCount;
      }
    }
    
    // Verificar resultado
    const remainingOldOperations = await Transaction.countDocuments({
      supplier: 'mercury',
      operation: { $in: Object.keys(operationMapping) }
    });
    
    console.log(`✅ Migración completada:`);
    console.log(`   - Transacciones migradas: ${totalMigrated}`);
    console.log(`   - Transacciones restantes con formato antiguo: ${remainingOldOperations}`);
    
    // Estadísticas finales por operación
    const finalStats = await Transaction.aggregate([
      { $match: { supplier: 'mercury' } },
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
    await migrateMercuryOperations();
    
    console.log('🎉 Migración de operaciones Mercury completada exitosamente (DESARROLLO)');
    
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
