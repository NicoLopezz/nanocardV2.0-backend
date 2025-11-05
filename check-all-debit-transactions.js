const mongoose = require('mongoose');

const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';
const CARD_ID = '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2';

async function checkAllDebit() {
  try {
    await mongoose.connect(OLD_DB_URI);
    console.log('✅ Connected to old DB\n');
    
    const db = mongoose.connection.db;
    const cardsCollection = db.collection('test-db-27-10-25');
    
    const santiagoCard = await cardsCollection.findOne({
      'Card_id': CARD_ID
    });
    
    const movements = santiagoCard.movimientos || [];
    
    const allDebit = movements.filter(m => m.credit === false);
    
    console.log(`Total movements: ${movements.length}`);
    console.log(`All debit (credit=false) transactions: ${allDebit.length}\n`);
    
    const statusBreakdown = {};
    allDebit.forEach(m => {
      const status = m.status || 'N/A';
      if (!statusBreakdown[status]) {
        statusBreakdown[status] = [];
      }
      statusBreakdown[status].push(m);
    });
    
    console.log('Breakdown by status:\n');
    Object.entries(statusBreakdown).forEach(([status, movs]) => {
      const total = movs.reduce((sum, m) => sum + Math.abs(m.MontoTransacction || 0), 0);
      console.log(`${status}: ${movs.length} transactions = $${total.toFixed(2)}`);
      
      if (total < 100) {
        console.log('  Transactions:');
        movs.forEach(m => {
          console.log(`    - ${m.name}: $${m.MontoTransacction}`);
        });
      }
    });
    
    const totalDebit = allDebit.reduce((sum, m) => sum + Math.abs(m.MontoTransacction || 0), 0);
    console.log(`\nTotal all debit: $${totalDebit.toFixed(2)}`);
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAllDebit();
