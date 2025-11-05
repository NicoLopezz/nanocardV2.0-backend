const mongoose = require('mongoose');

const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';
const CARD_ID = '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2';

async function comparePosted() {
  try {
    await mongoose.connect(OLD_DB_URI);
    console.log('✅ Connected to old DB\n');
    
    const db = mongoose.connection.db;
    const cardsCollection = db.collection('test-db-27-10-25');
    
    const santiagoCard = await cardsCollection.findOne({
      'Card_id': CARD_ID
    });
    
    const movements = santiagoCard.movimientos || [];
    
    console.log('📊 OLD DB - Transaction Status Analysis:\n');
    
    const statusGroups = {};
    
    movements.forEach(mov => {
      const status = mov.status || 'N/A';
      if (!statusGroups[status]) {
        statusGroups[status] = [];
      }
      statusGroups[status].push(mov);
    });
    
    Object.entries(statusGroups).forEach(([status, movs]) => {
      const total = movs.reduce((sum, m) => sum + Math.abs(m.MontoTransacction || 0), 0);
      console.log(`${status}: ${movs.length} transactions = $${total.toFixed(2)}`);
    });
    
    console.log('\n\n🔍 Analyzing what should be "APPROVED":\n');
    
    const approved = movements.filter(mov => {
      return mov.credit === false && 
             mov.status !== 'TRANSACTION_REFUND' && 
             mov.status !== 'TRANSACTION_REVERSED' &&
             mov.name !== 'WITHDRAWAL' &&
             mov.name !== 'Withdrawal';
    });
    
    const approvedTotal = approved.reduce((sum, m) => sum + Math.abs(m.MontoTransacction || 0), 0);
    
    console.log(`Transactions that should be APPROVED: ${approved.length}`);
    console.log(`Total amount: $${approvedTotal.toFixed(2)}\n`);
    
    console.log('First 10 approved transactions:');
    approved.slice(0, 10).forEach(m => {
      console.log(`  - ${m.name}: $${m.MontoTransacction} (status: ${m.status})`);
    });
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

comparePosted();
