const mongoose = require('mongoose');

const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';
const CARD_ID = '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2';

async function findMissing() {
  try {
    await mongoose.connect(OLD_DB_URI);
    console.log('✅ Connected to old DB\n');
    
    const db = mongoose.connection.db;
    const cardsCollection = db.collection('test-db-27-10-25');
    
    const santiagoCard = await cardsCollection.findOne({
      'Card_id': CARD_ID
    });
    
    const movements = santiagoCard.movimientos || [];
    
    const approved = movements.filter(m => m.status === 'TRANSACTION_APPROVED');
    
    console.log(`Found ${approved.length} with status TRANSACTION_APPROVED\n`);
    
    const sortedApproved = approved.sort((a, b) => Math.abs(b.MontoTransacction) - Math.abs(a.MontoTransacction));
    
    console.log('Top 20 largest TRANSACTION_APPROVED:');
    sortedApproved.slice(0, 20).forEach((m, i) => {
      console.log(`${i + 1}. ${m.name}: $${m.MontoTransacction}`);
    });
    
    const total = approved.reduce((sum, m) => sum + Math.abs(m.MontoTransacction || 0), 0);
    console.log(`\nTotal: $${total.toFixed(2)}`);
    console.log(`Expected: $13154.12`);
    console.log(`Difference: $${(13154.12 - total).toFixed(2)}`);
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findMissing();
