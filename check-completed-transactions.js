const mongoose = require('mongoose');

const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';
const CARD_ID = '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2';

async function checkCompleted() {
  try {
    await mongoose.connect(OLD_DB_URI);
    console.log('✅ Connected to old DB\n');
    
    const db = mongoose.connection.db;
    const cardsCollection = db.collection('test-db-27-10-25');
    
    const santiagoCard = await cardsCollection.findOne({
      'Card_id': CARD_ID
    });
    
    const movements = santiagoCard.movimientos || [];
    
    const completed = movements.filter(m => m.status === 'Completed');
    
    console.log(`Total movements: ${movements.length}`);
    console.log(`Completed movements: ${completed.length}\n`);
    
    console.log('Completed transactions:');
    completed.forEach((m, i) => {
      console.log(`${i + 1}. ${m.name} - $${m.MontoTransacction} - credit:${m.credit}`);
    });
    
    const completedDebit = completed.filter(m => m.credit === false);
    const totalCompletedDebit = completedDebit.reduce((sum, m) => sum + Math.abs(m.MontoTransacction || 0), 0);
    
    console.log(`\nCompleted DEBIT transactions: ${completedDebit.length}`);
    console.log(`Total: $${totalCompletedDebit.toFixed(2)}`);
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCompleted();
