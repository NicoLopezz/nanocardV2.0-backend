const mongoose = require('mongoose');

const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';
const CARD_ID = '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2';

async function checkOldDBStats() {
  try {
    await mongoose.connect(OLD_DB_URI);
    console.log('✅ Connected to old DB\n');
    
    const db = mongoose.connection.db;
    const cardsCollection = db.collection('test-db-27-10-25');
    
    const santiagoCard = await cardsCollection.findOne({
      'Card_id': CARD_ID
    });
    
    if (!santiagoCard) {
      console.log('❌ Card not found');
      return;
    }
    
    console.log('📊 OLD DB CARD OBJECT:\n');
    
    if (santiagoCard.stats) {
      console.log('Stats object found:');
      console.log(JSON.stringify(santiagoCard.stats, null, 2));
    } else {
      console.log('No stats object in old DB card\n');
    }
    
    if (santiagoCard.saldo !== undefined) {
      console.log(`\nCard.saldo: ${santiagoCard.saldo}`);
    }
    
    console.log('\n\nChecking for "posted" field directly:');
    console.log(`santiagoCard.posted: ${santiagoCard.posted}`);
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkOldDBStats();
