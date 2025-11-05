const mongoose = require('mongoose');

const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';

async function findRefundsReversed() {
  try {
    await mongoose.connect(OLD_DB_URI);
    console.log('✅ Connected to old DB\n');
    
    const db = mongoose.connection.db;
    const cardsCollection = db.collection('test-db-27-10-25');
    
    const santiagoCard = await cardsCollection.findOne({
      'Card_id': '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2'
    });
    
    if (!santiagoCard) {
      console.log('❌ Card not found');
      return;
    }
    
    console.log('🔍 Searching for REFUND and REVERSED transactions in OLD DB\n');
    
    const movements = santiagoCard.movimientos || [];
    
    const refunds = movements.filter(mov => {
      return mov.credit === true && mov.name && mov.name.toLowerCase().includes('refund');
    });
    
    const reversed = movements.filter(mov => {
      return mov.credit === true && mov.name && mov.name.toLowerCase().includes('reverse');
    });
    
    const allPositiveCredit = movements.filter(mov => {
      return mov.credit === true && mov.MontoTransacction > 0 && mov.name !== 'Deposit' && mov.name !== 'Deposited' && mov.name !== 'WITHDRAWAL';
    });
    
    console.log(`Total movements: ${movements.length}\n`);
    
    console.log('🔄 Transactions that might be REFUNDS:');
    if (refunds.length > 0) {
      refunds.forEach((ref, i) => {
        console.log(`   ${i + 1}. $${ref.MontoTransacction} - ${ref.name} - ${ref.Date} - "${ref.comentario || 'No comment'}"`);
      });
    } else {
      console.log('   None found');
    }
    
    console.log('\n↩️ Transactions that might be REVERSED:');
    if (reversed.length > 0) {
      reversed.forEach((rev, i) => {
        console.log(`   ${i + 1}. $${rev.MontoTransacction} - ${rev.name} - ${rev.Date} - "${rev.comentario || 'No comment'}"`);
      });
    } else {
      console.log('   None found');
    }
    
    console.log('\n📋 All positive credit transactions (excluding deposits):');
    if (allPositiveCredit.length > 0) {
      allPositiveCredit.forEach((tx, i) => {
        console.log(`   ${i + 1}. $${tx.MontoTransacction} - ${tx.name} - ${tx.Date || tx.date} - credit: ${tx.credit}`);
      });
    } else {
      console.log('   None found');
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findRefundsReversed();
