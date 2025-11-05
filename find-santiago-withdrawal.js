const mongoose = require('mongoose');

const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';

async function findWithdrawal() {
  try {
    await mongoose.connect(OLD_DB_URI);
    console.log('✅ Connected to old DB');
    
    const db = mongoose.connection.db;
    const cardsCollection = db.collection('test-db-27-10-25');
    
    const santiagoCard = await cardsCollection.findOne({
      'Card_id': '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2'
    });
    
    if (santiagoCard && santiagoCard.movimientos) {
      const withdrawals = santiagoCard.movimientos.filter(mov => {
        return mov.name === 'WITHDRAWAL' || mov.status === 'Completed' && mov.credit === false && mov.amount < 0;
      });
      
      console.log(`\n💰 Found ${withdrawals.length} WITHDRAWAL transactions\n`);
      
      if (withdrawals.length > 0) {
        withdrawals.forEach((withdrawal, index) => {
          console.log(`${index + 1}.`);
          console.log(`   ID: ${withdrawal.id}`);
          console.log(`   Name: ${withdrawal.name}`);
          console.log(`   Amount: $${withdrawal.MontoTransacction}`);
          console.log(`   Date: ${withdrawal.Date}`);
          console.log(`   Status: ${withdrawal.status}`);
          console.log(`   Credit: ${withdrawal.credit}`);
          console.log(`   Comment: ${withdrawal.comentario || 'No comment'}`);
          console.log('');
        });
        
        console.log('\n📄 Full withdrawal object:');
        console.log(JSON.stringify(withdrawals[0], null, 2));
      }
      
      const allMovements = santiagoCard.movimientos;
      console.log(`\n\n📊 Total movements: ${allMovements.length}`);
      
      const withComments = allMovements.filter(m => m.comentario);
      console.log(`   Movements with comments: ${withComments.length}`);
      
      const negativeMovements = allMovements.filter(m => m.MontoTransacction < 0);
      console.log(`   Negative amount movements: ${negativeMovements.length}`);
      
    } else {
      console.log('❌ Card not found or no movements');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findWithdrawal();
