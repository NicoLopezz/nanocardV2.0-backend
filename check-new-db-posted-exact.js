require('dotenv').config();
process.env.NODE_ENV = 'development';

const { databases, connectDatabases } = require('./config/database');

async function checkNewDBPosted() {
  try {
    await connectDatabases();
    console.log('✅ Connected to databases\n');
    
    const CARD_ID = '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2';
    
    const Transaction = require('./models/Transaction').getTransactionModel();
    
    const approved = await Transaction.find({
      cardId: CARD_ID,
      operation: 'TRANSACTION_APPROVED',
      isDeleted: { $ne: true }
    });
    
    console.log(`Total TRANSACTION_APPROVED in NEW DB: ${approved.length}`);
    
    const total = approved.reduce((sum, t) => sum + (t.amount || 0), 0);
    console.log(`Total amount: $${total.toFixed(2)}\n`);
    
    const sorted = approved.sort((a, b) => (b.amount || 0) - (a.amount || 0));
    
    console.log('Top 10 largest in NEW DB:');
    sorted.slice(0, 10).forEach((t, i) => {
      console.log(`${i + 1}. ${t.name}: $${t.amount} (id: ${t._id})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkNewDBPosted();
