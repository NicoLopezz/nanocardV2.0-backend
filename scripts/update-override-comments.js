require('dotenv').config();
const { databases, connectDatabases } = require('../config/database');

// Configuración de base de datos
const connectToDatabase = async () => {
  try {
    await connectDatabases();
    console.log('✅ Connected to all databases');
  } catch (error) {
    console.error('❌ Error connecting to databases:', error);
    process.exit(1);
  }
};

// Usar los modelos del sistema
const { getCardModel, getTransactionModel } = require('../models/Card');
const { getTransactionModel: getTransactionModelFromTransaction } = require('../models/Transaction');

const updateOverrideComments = async () => {
  try {
    console.log('🔍 Buscando transacciones OVERRIDE_VIRTUAL_BALANCE...');
    
    // Obtener modelos
    const Card = getCardModel();
    const Transaction = getTransactionModelFromTransaction();
    
    // Buscar todas las transacciones OVERRIDE_VIRTUAL_BALANCE
    const overrideTransactions = await Transaction.find({
      operation: 'OVERRIDE_VIRTUAL_BALANCE',
      isDeleted: { $ne: true }
    }).sort({ createdAt: 1 }); // Ordenar por fecha de creación para procesar en orden cronológico

    console.log(`📊 Encontradas ${overrideTransactions.length} transacciones OVERRIDE_VIRTUAL_BALANCE`);

    if (overrideTransactions.length === 0) {
      console.log('✅ No hay transacciones para actualizar');
      return;
    }

    let updatedCount = 0;
    let errorCount = 0;

    // Procesar cada transacción individualmente
    for (const transaction of overrideTransactions) {
      try {
        // Usar los campos original_balance y new_balance que ya están en la transacción
        const originalBalance = transaction.original_balance || 0;
        const newBalance = transaction.new_balance || 0;
        
        // Generar comentario automático
        const newComment = `OVERRIDE: $${originalBalance}→$${newBalance}`;
        
        // Actualizar la transacción
        await Transaction.updateOne(
          { _id: transaction._id },
          { 
            $set: { 
              comentario: newComment,
              updatedAt: new Date()
            }
          }
        );
        
        console.log(`✅ ${transaction._id}: ${newComment}`);
        updatedCount++;
        
      } catch (txError) {
        console.error(`❌ Error actualizando transacción ${transaction._id}:`, txError.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`  ✅ Transacciones actualizadas: ${updatedCount}`);
    console.log(`  ❌ Errores: ${errorCount}`);
    console.log(`  📋 Total procesadas: ${overrideTransactions.length}`);

  } catch (error) {
    console.error('❌ Error en updateOverrideComments:', error);
  }
};

const main = async () => {
  try {
    await connectToDatabase();
    await updateOverrideComments();
    console.log('\n🎉 Proceso completado');
  } catch (error) {
    console.error('❌ Error en main:', error);
  } finally {
    // Cerrar todas las conexiones
    for (const [name, dbConfig] of Object.entries(databases)) {
      if (dbConfig.connection) {
        await dbConfig.connection.close();
        console.log(`🔌 Desconectado de ${name} database`);
      }
    }
    process.exit(0);
  }
};

main();
