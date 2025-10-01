require('dotenv').config();
const mongoose = require('mongoose');

// Configuración de base de datos
const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nano2_dev');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

const transactionSchema = new mongoose.Schema({
  _id: String,
  operation: String,
  comentario: String,
  amount: Number,
  cardId: String,
  createdAt: Date
}, { collection: 'transactions' });

const Transaction = mongoose.model('Transaction', transactionSchema);

const checkTransactions = async () => {
  try {
    console.log('🔍 Verificando transacciones en la base de datos...');
    
    // Contar total de transacciones
    const totalTransactions = await Transaction.countDocuments();
    console.log(`📊 Total de transacciones: ${totalTransactions}`);
    
    if (totalTransactions === 0) {
      console.log('⚠️  No hay transacciones en la base de datos');
      return;
    }
    
    // Buscar todas las operaciones únicas
    const uniqueOperations = await Transaction.distinct('operation');
    console.log(`\n📋 Operaciones encontradas (${uniqueOperations.length}):`);
    uniqueOperations.forEach(op => {
      console.log(`  - ${op}`);
    });
    
    // Buscar específicamente OVERRIDE_VIRTUAL_BALANCE
    const overrideCount = await Transaction.countDocuments({ operation: 'OVERRIDE_VIRTUAL_BALANCE' });
    console.log(`\n🎯 Transacciones OVERRIDE_VIRTUAL_BALANCE: ${overrideCount}`);
    
    // Mostrar algunas transacciones de ejemplo
    console.log('\n📄 Ejemplos de transacciones:');
    const sampleTransactions = await Transaction.find({}).limit(5).select('_id operation amount comentario cardId createdAt');
    sampleTransactions.forEach(tx => {
      console.log(`  - ${tx._id}: ${tx.operation} | $${tx.amount} | ${tx.comentario || 'Sin comentario'}`);
    });
    
  } catch (error) {
    console.error('❌ Error en checkTransactions:', error);
  }
};

const main = async () => {
  try {
    await connectToDatabase();
    await checkTransactions();
    console.log('\n🎉 Verificación completada');
  } catch (error) {
    console.error('❌ Error en main:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
};

main();
