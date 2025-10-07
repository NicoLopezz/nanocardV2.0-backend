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
        serverSelectionTimeoutMS: 10000,     // ✅ Aumentar timeout
        socketTimeoutMS: 30000,              // ✅ Reducir timeout
        connectTimeoutMS: 10000,             // ✅ Aumentar timeout de conexión
        maxPoolSize: 5,                      // ✅ Más conexiones en pool
        minPoolSize: 1,                      // ✅ Mantener conexiones mínimas
        maxIdleTimeMS: 60000,                // ✅ Aumentar tiempo idle
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