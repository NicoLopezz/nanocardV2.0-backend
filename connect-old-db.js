const mongoose = require('mongoose');

const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';

async function getOldCards() {
  try {
    await mongoose.connect(OLD_DB_URI);
    console.log('✅ Connected to old DB');
    
    const db = mongoose.connection.db;
    const cardsCollection = db.collection('test-db-27-10-25');
    
    const santiagoCard = await cardsCollection.findOne({
      'nombre': 'santiago romano'
    });
    
    if (santiagoCard) {
      console.log('\n📋 Santiago Romano Card:');
      console.log(JSON.stringify(santiagoCard, null, 2));
      
      if (santiagoCard.recargas && santiagoCard.recargas.length > 0) {
        console.log('\n💰 Recargas:');
        santiagoCard.recargas.forEach((recarga, index) => {
          console.log(`\n  ${index + 1}. ID: ${recarga.id}`);
          console.log(`     Monto: $${recarga.monto}`);
          console.log(`     Fecha: ${recarga.fecha}`);
        });
      }
    } else {
      console.log('❌ Card not found');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from old DB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

getOldCards();
