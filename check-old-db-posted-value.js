const mongoose = require('mongoose');

const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';
const CARD_ID = '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2';

async function checkOldDBPosted() {
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
    
    console.log('🔍 Analyzing old DB structure...\n');
    
    if (santiagoCard.stats) {
      console.log('📊 OLD DB STATS OBJECT:');
      console.log(JSON.stringify(santiagoCard.stats, null, 2));
      console.log('\n');
    }
    
    if (santiagoCard.saldo) {
      console.log('💰 OLD DB SALDO:');
      console.log(`Available: $${santiagoCard.saldo}`);
      console.log('\n');
    }
    
    const movements = santiagoCard.movimientos || [];
    console.log(`Total movements: ${movements.length}\n`);
    
    let approvedCount = 0;
    let depositCount = 0;
    let approvedAmount = 0;
    let depositAmount = 0;
    
    movements.forEach(mov => {
      if (mov.status === 'Completed' && mov.credit === false) {
        approvedCount++;
        approvedAmount += Math.abs(mov.MontoTransacction || 0);
      } else if (mov.credit === true && mov.MontoTransacction > 0) {
        depositCount++;
        depositAmount += mov.MontoTransacction;
      }
    });
    
    console.log('📋 BREAKDOWN OF MOVEMENTS:');
    console.log(`  Debit transactions (cred=false): ${approvedCount}`);
    console.log(`  Credit transactions (cred=true): ${depositCount}`);
    console.log(`\n  Approved amount: $${approvedAmount.toFixed(2)}`);
    console.log(`  Deposit amount: $${depositAmount.toFixed(2)}`);
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkOldDBPosted();
