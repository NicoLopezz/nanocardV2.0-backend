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
  },
  history: {
    uri: config.HISTORY_DB_URI,
    connection: null
  },
  reconciliations: {
    uri: config.RECONCILIATIONS_DB_URI,
    connection: null
  },
  synclog: {
    uri: config.SYNCLOG_DB_URI,
    connection: null
  }
};

const connectDatabases = async () => {
  try {
    for (const [name, dbConfig] of Object.entries(databases)) {
      dbConfig.connection = await mongoose.createConnection(dbConfig.uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 5000,
        maxPoolSize: 1,
        minPoolSize: 0,
        maxIdleTimeMS: 30000,
        retryWrites: true,
        w: 'majority'
      });
      console.log(`✅ Connected to ${name} database`);
    }
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

module.exports = { databases, connectDatabases };