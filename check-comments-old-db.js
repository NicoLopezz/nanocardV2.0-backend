const mongoose = require('mongoose');

const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';

async function checkComments() {
  try {
    await mongoose.connect(OLD_DB_URI);
    console.log('✅ Connected to old DB');
    
    const db = mongoose.connection.db;
    const cardsCollection = db.collection('test-db-27-10-25');
    
    const santiagoCard = await cardsCollection.findOne({
      'Card_id': '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2'
    });
    
    if (santiagoCard && santiagoCard.movimientos) {
      const deposits = santiagoCard.movimientos.filter(mov => {
        return mov.status === 'Completed' && mov.credit === true && mov.MontoTransacction > 0;
      });
      
      console.log('\n📋 Santiago Romano Deposits - Checking for comments/comentarios\n');
      
      deposits.forEach((deposit, index) => {
        console.log(`\n${index + 1}. ID: ${deposit.id}`);
        console.log(`   Amount: $${deposit.MontoTransacction}`);
        console.log(`   Date: ${deposit.Date}`);
        console.log('   Fields with potential comments:');
        console.log(`   - comentario: ${deposit.comentario || 'NOT FOUND'}`);
        console.log(`   - comment: ${deposit.comment || 'NOT FOUND'}`);
        console.log(`   - description: ${deposit.description || 'NOT FOUND'}`);
        console.log(`   - Full object keys:`, Object.keys(deposit));
      });
      
      console.log('\n\n📄 Sample full deposit object (first one):');
      if (deposits[0]) {
        console.log(JSON.stringify(deposits[0], null, 2));
      }
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkComments();
