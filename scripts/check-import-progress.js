require('dotenv').config();
const mongoose = require('mongoose');

const NEW_DB_URI = process.env.MONGODB_URI;

const checkImportProgress = async () => {
  try {
    console.log('🔍 Checking import progress...');
    
    // Conectar a la DB
    const connection = await mongoose.connect(NEW_DB_URI);
    console.log('✅ Connected to database');
    
    // Conectar a las bases de datos
    const cardsDb = connection.connection.useDb('dev_cards');
    const transactionsDb = connection.connection.useDb('dev_transactions');
    
    // Obtener estadísticas
    const totalCards = await cardsDb.collection('cards').countDocuments();
    const totalTransactions = await transactionsDb.collection('transactions').countDocuments();
    
    // Obtener cards con transacciones
    const cardsWithTransactions = await transactionsDb.collection('transactions').aggregate([
      {
        $group: {
          _id: '$cardId',
          transactionCount: { $sum: 1 },
          totalDeposited: { 
            $sum: { 
              $cond: [{ $eq: ['$credit', true] }, '$amount', 0] 
            } 
          },
          totalPosted: { 
            $sum: { 
              $cond: [{ $eq: ['$credit', false] }, '$amount', 0] 
            } 
          }
        }
      },
      {
        $sort: { transactionCount: -1 }
      }
    ]).toArray();
    
    console.log('\n📊 IMPORT PROGRESS SUMMARY:');
    console.log('='.repeat(60));
    console.log(`📋 Total cards: ${totalCards}`);
    console.log(`💳 Cards with transactions: ${cardsWithTransactions.length}`);
    console.log(`💰 Total transactions: ${totalTransactions}`);
    console.log(`📈 Progress: ${Math.round((cardsWithTransactions.length / totalCards) * 100)}%`);
    
    console.log('\n🔝 TOP 10 CARDS BY TRANSACTION COUNT:');
    console.log('='.repeat(60));
    
    for (let i = 0; i < Math.min(10, cardsWithTransactions.length); i++) {
      const cardData = cardsWithTransactions[i];
      const available = cardData.totalDeposited - cardData.totalPosted;
      
      // Buscar el nombre de la card
      const card = await cardsDb.collection('cards').findOne({ _id: cardData._id });
      const cardName = card?.name || 'Unknown Card';
      
      console.log(`${i + 1}. ${cardName}`);
      console.log(`   - ID: ${cardData._id}`);
      console.log(`   - Transactions: ${cardData.transactionCount}`);
      console.log(`   - Deposited: $${cardData.totalDeposited.toFixed(2)}`);
      console.log(`   - Posted: $${cardData.totalPosted.toFixed(2)}`);
      console.log(`   - Available: $${available.toFixed(2)}`);
      console.log('');
    }
    
    // Obtener cards sin transacciones más eficientemente
    const cardsWithTransactionsIds = cardsWithTransactions.map(c => c._id);
    const cardsWithoutTransactions = await cardsDb.collection('cards').find({
      _id: { $nin: cardsWithTransactionsIds }
    }).limit(5).toArray();
    
    if (cardsWithoutTransactions.length > 0) {
      console.log('\n⏳ CARDS STILL PENDING (showing first 5):');
      console.log('='.repeat(60));
      cardsWithoutTransactions.forEach((card, index) => {
        console.log(`${index + 1}. ${card.name} (${card._id})`);
      });
    }
    
    console.log('\n✅ Progress check completed!');
    
  } catch (error) {
    console.error('❌ Progress check error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  checkImportProgress();
}

module.exports = { checkImportProgress };
