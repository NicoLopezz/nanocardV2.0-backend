const mongoose = require('mongoose');

const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';
const CARD_ID = '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2';

async function compareDBs() {
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
    
    const movements = santiagoCard.movimientos || [];
    
    let deposits = 0;
    let withdrawals = 0;
    let approved = 0;
    let pending = 0;
    let refunds = 0;
    let reversed = 0;
    
    movements.forEach(mov => {
      const amount = Math.abs(mov.MontoTransacction || 0);
      
      if (mov.name === 'WITHDRAWAL' || mov.name === 'Withdrawal') {
        withdrawals += amount;
      } else if (mov.credit === true && amount > 0) {
        deposits += amount;
      } else if (mov.status === 'TRANSACTION_REFUND') {
        refunds += amount;
      } else if (mov.status === 'TRANSACTION_REVERSED') {
        reversed += amount;
      } else if (mov.status === 'TRANSACTION_PENDING') {
        pending += amount;
      } else if (mov.credit === false) {
        approved += amount;
      }
    });
    
    const oldMoneyIn = deposits - withdrawals;
    const oldAvailable = oldMoneyIn + refunds - approved - pending;
    
    console.log('📊 OLD DB VALUES:');
    console.log('='.repeat(60));
    console.log(`Deposits:      $${deposits.toFixed(2)}`);
    console.log(`Withdrawals:   $${withdrawals.toFixed(2)}`);
    console.log(`money_in:      $${oldMoneyIn.toFixed(2)}`);
    console.log(`refund:        $${refunds.toFixed(2)}`);
    console.log(`posted:        $${approved.toFixed(2)}`);
    console.log(`pending:       $${pending.toFixed(2)}`);
    console.log(`reversed:      $${reversed.toFixed(2)}`);
    console.log('-'.repeat(60));
    console.log(`available:     $${oldAvailable.toFixed(2)}`);
    console.log('='.repeat(60));
    
    console.log('\n📊 NEW DB VALUES:');
    console.log('='.repeat(60));
    console.log(`money_in:      $13037.99`);
    console.log(`refund:        $98.53`);
    console.log(`posted:        $33942.82`);
    console.log(`pending:       $0.00`);
    console.log(`withdrawal:    $1796.59`);
    console.log('-'.repeat(60));
    console.log(`available:     $-20806.30`);
    console.log('='.repeat(60));
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

compareDBs();
