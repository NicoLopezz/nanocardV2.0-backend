require('dotenv').config();
process.env.NODE_ENV = 'development';

const config = require('./config/environment');
const mongoose = require('mongoose');

async function checkWhatWeHadBefore() {
  try {
    console.log('🔍 Checking transaction history...\n');
    
    const NEW_DB_URI = config.TRANSACTIONS_DB_URI;
    const newConnection = await mongoose.createConnection(NEW_DB_URI);
    const newDb = newConnection.useDb('dev_transactions');
    
    const CARD_ID = '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2';
    
    const History = require('./models/History').getHistoryModel();
    
    const histories = await History.find({
      cardId: CARD_ID
    }).sort({ timestamp: -1 }).limit(10);
    
    console.log('📚 RECENT CARD HISTORY ENTRIES:');
    histories.forEach((hist, i) => {
      console.log(`\n${i + 1}. ${hist.action} at ${hist.timestamp}`);
      if (hist.changes) {
        console.log('   Changes:', JSON.stringify(hist.changes, null, 2));
      }
    });
    
    await newConnection.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkWhatWeHadBefore();
