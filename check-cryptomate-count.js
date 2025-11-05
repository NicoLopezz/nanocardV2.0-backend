require('dotenv').config();
const mongoose = require('mongoose');

const BKP_OLD_DB_URI = 'mongodb+srv://nico7913:7913@clusterinitial.eagt2m6.mongodb.net/bkp_old_db';

async function checkCount() {
  try {
    const bkpConnection = await mongoose.createConnection(BKP_OLD_DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    await new Promise((resolve) => {
      if (bkpConnection.readyState === 1) {
        resolve();
      } else {
        bkpConnection.once('open', resolve);
      }
    });
    
    const count = await bkpConnection.db.collection('bkp_old_db').countDocuments({ supplier: 'CryptoMate' });
    
    console.log(`CryptoMate cards in old DB: ${count}`);
    
    await bkpConnection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCount();


