require('dotenv').config();
process.env.NODE_ENV = 'development';

const { databases, connectDatabases } = require('./config/database');

async function cleanSantiagoTransactions() {
  try {
    await connectDatabases();
    console.log('✅ Connected to databases\n');
    
    const CARD_ID = '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2';
    
    const Transaction = require('./models/Transaction').getTransactionModel();
    
    const existing = await Transaction.find({
      cardId: CARD_ID
    });
    
    console.log(`Found ${existing.length} transactions to delete\n`);
    
    if (existing.length > 0) {
      const deleteResult = await Transaction.deleteMany({
        cardId: CARD_ID
      });
      console.log(`✅ Deleted ${deleteResult.deletedCount} transactions\n`);
    }
    
    console.log('✅ Cleanup completed!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanSantiagoTransactions();
