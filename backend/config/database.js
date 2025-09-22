const mongoose = require('mongoose');
const config = require('./environment');

const databases = {
  users: {
    uri: config.USERS_DB_URI,
    connection: null
  },
  cards: {
    uri: config.CARDS_DB_URI,
    connection: null
  },
  transactions: {
    uri: config.TRANSACTIONS_DB_URI,
    connection: null
  }
};

const connectDatabases = async () => {
  try {
    for (const [name, dbConfig] of Object.entries(databases)) {
      dbConfig.connection = await mongoose.createConnection(dbConfig.uri);
      console.log(`✅ Connected to ${name} database`);
    }
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

module.exports = { databases, connectDatabases };