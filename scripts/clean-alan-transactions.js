require('dotenv').config();
const mongoose = require('mongoose');

const NEW_DB_URI = process.env.MONGODB_URI;

const cleanAlanTransactions = async () => {
  try {
    console.log('🧹 Cleaning all Alan transactions...');
    
    // Conectar a la DB nueva
    const newConnection = await mongoose.connect(NEW_DB_URI);
    console.log('✅ Connected to new database');
    
    // Conectar a las nuevas bases de datos
    const newTransactionsDb = newConnection.connection.useDb('dev_transactions');
    const newCardsDb = newConnection.connection.useDb('dev_cards');
    const newHistoryDb = newConnection.connection.useDb('dev_history');
    
    const cardId = 'f5f5d844-926d-11f0-985a-0757a1677a52';
    const userId = 'f5f5d844-926d-11f0-985a-0757a1677a52'; // Alan's user ID
    
    console.log('\n📊 CLEANING ALAN DATA:');
    console.log('='.repeat(50));
    
    // 1. Eliminar todas las transacciones de Alan
    const transactionResult = await newTransactionsDb.collection('transactions').deleteMany({
      cardId: cardId
    });
    console.log(`🗑️ Deleted ${transactionResult.deletedCount} transactions`);
    
    // 2. Eliminar todo el historial de Alan
    const historyResult = await newHistoryDb.collection('histories').deleteMany({
      cardId: cardId
    });
    console.log(`🗑️ Deleted ${historyResult.deletedCount} history records`);
    
    // 3. Resetear las estadísticas de la tarjeta
    await newCardsDb.collection('cards').updateOne(
      { _id: cardId },
      {
        $set: {
          deposited: 0,
          refunded: 0,
          posted: 0,
          pending: 0,
          available: 0,
          updatedAt: new Date()
        }
      }
    );
    console.log(`🔄 Reset card statistics to zero`);
    
    // 4. Verificar que quedó limpio
    const remainingTransactions = await newTransactionsDb.collection('transactions').countDocuments({
      cardId: cardId
    });
    const remainingHistory = await newHistoryDb.collection('histories').countDocuments({
      cardId: cardId
    });
    
    console.log(`\n📊 CLEANUP VERIFICATION:`);
    console.log(`   - Remaining transactions: ${remainingTransactions}`);
    console.log(`   - Remaining history records: ${remainingHistory}`);
    
    if (remainingTransactions === 0 && remainingHistory === 0) {
      console.log(`\n✅ Alan's data completely cleaned!`);
      console.log(`🚀 Ready for fresh import with new approach`);
    } else {
      console.log(`\n⚠️ Some data still remains - manual cleanup may be needed`);
    }
    
  } catch (error) {
    console.error('❌ Cleanup error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from databases');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  cleanAlanTransactions();
}

module.exports = { cleanAlanTransactions };
