const mongoose = require('mongoose');
require('dotenv').config();

process.env.NODE_ENV = 'development';

const config = require('./config/environment');

const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';
const NEW_DB_URI = config.TRANSACTIONS_DB_URI;

const CARD_ID = '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2';

async function checkMissingTransactions() {
  try {
    console.log('🔍 Checking for missing transactions from Oct 25 onwards...\n');
    
    const oldConnection = await mongoose.createConnection(OLD_DB_URI);
    const oldDb = oldConnection.useDb('tarjetasCrypto-Mercury');
    
    const newConnection = await mongoose.createConnection(NEW_DB_URI);
    const newDb = newConnection.useDb('dev_transactions');
    
    const oldCardsCollection = oldDb.collection('test-db-27-10-25');
    const newTransactionsCollection = newDb.collection('transactions');
    
    const santiagoCard = await oldCardsCollection.findOne({
      'Card_id': CARD_ID
    });
    
    const movements = santiagoCard.movimientos || [];
    
    const cutoffDate = new Date('2025-10-25T00:00:00.000Z');
    
    const recentMovements = movements.filter(mov => {
      const movDate = new Date(mov.Date);
      return movDate >= cutoffDate;
    });
    
    console.log(`Total movements in old DB: ${movements.length}`);
    console.log(`Movements from Oct 25 onwards: ${recentMovements.length}\n`);
    
    const newTransactions = await newTransactionsCollection.find({
      cardId: CARD_ID
    }).toArray();
    
    console.log(`Total transactions in new DB: ${newTransactions.length}\n`);
    
    const recentTransactions = newTransactions.filter(tx => {
      const txDate = new Date(tx.createdAt);
      return txDate >= cutoffDate;
    });
    
    console.log(`Transactions from Oct 25 onwards in new DB: ${recentTransactions.length}\n`);
    
    console.log('🔍 Comparing by ID...\n');
    
    const oldIds = new Set(recentMovements.map(m => m.id));
    const newIds = new Set(recentTransactions.map(t => t._id));
    
    const missingIds = [...oldIds].filter(id => !newIds.has(id));
    
    console.log(`Missing transaction IDs: ${missingIds.length}\n`);
    
    if (missingIds.length > 0) {
      console.log('Missing transactions from old DB:\n');
      
      recentMovements
        .filter(m => missingIds.includes(m.id))
        .slice(0, 20)
        .forEach((m, i) => {
          console.log(`${i + 1}. ${m.name} - $${m.MontoTransacction} - ${new Date(m.Date).toLocaleDateString()} - status: ${m.status}`);
        });
    }
    
    await oldConnection.close();
    await newConnection.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkMissingTransactions();
