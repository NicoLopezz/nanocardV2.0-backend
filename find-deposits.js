const mongoose = require('mongoose');

const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';

async function findDeposits() {
  try {
    await mongoose.connect(OLD_DB_URI);
    console.log('✅ Connected to old DB');
    
    const db = mongoose.connection.db;
    const cardsCollection = db.collection('test-db-27-10-25');
    
    const santiagoCard = await cardsCollection.findOne({
      'nombre': 'santiago romano'
    });
    
    if (santiagoCard && santiagoCard.movimientos) {
      const deposits = santiagoCard.movimientos.filter(mov => {
        return mov.status === 'Completed' && mov.credit === true && mov.MontoTransacction > 0;
      });
      
      console.log(`\n💰 Found ${deposits.length} DEPOSIT transactions for Santiago Romano:\n`);
      
      deposits.forEach((deposit, index) => {
        console.log(`${index + 1}. ID: ${deposit.id}`);
        console.log(`   Monto: $${deposit.MontoTransacction}`);
        console.log(`   Fecha: ${deposit.Date}`);
        console.log(`   Nombre: ${deposit.name}`);
        console.log(`   Status: ${deposit.status}`);
        console.log(`   Credit: ${deposit.credit}`);
        console.log('');
      });
      
      console.log(`\nTotal: ${deposits.length} deposits`);
    } else {
      console.log('❌ Card not found or no movements');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from old DB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findDeposits();
