const mongoose = require('mongoose');

const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';

async function findAllDeposits() {
  try {
    await mongoose.connect(OLD_DB_URI);
    console.log('✅ Connected to old DB');
    
    const db = mongoose.connection.db;
    const cardsCollection = db.collection('test-db-27-10-25');
    
    const allCards = await cardsCollection.find({}).toArray();
    
    console.log(`\n📊 Total cards in database: ${allCards.length}\n`);
    
    let totalDeposits = 0;
    
    for (const card of allCards) {
      if (card.movimientos && card.movimientos.length > 0) {
        const deposits = card.movimientos.filter(mov => {
          return mov.status === 'Completed' && mov.credit === true && mov.MontoTransacction > 0;
        });
        
        if (deposits.length > 0) {
          console.log(`\n👤 ${card.nombre} (${card.email || 'No email'})`);
          console.log(`   Card ID: ${card.Card_id}`);
          console.log(`   Total deposits: ${deposits.length}`);
          
          deposits.forEach((deposit, index) => {
            console.log(`   ${index + 1}. $${deposit.MontoTransacction} - ${deposit.Date} (ID: ${deposit.id})`);
          });
          
          totalDeposits += deposits.length;
        }
      }
    }
    
    console.log(`\n\n💰 TOTAL DEPOSITS FOUND: ${totalDeposits}`);
    console.log('\n✅ Done!');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findAllDeposits();
