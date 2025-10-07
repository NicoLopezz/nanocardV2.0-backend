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

// Funciones getter para las conexiones
const getUsersConnection = () => databases.users.connection;
const getCardsConnection = () => databases.cards.connection;
const getTransactionsConnection = () => databases.transactions.connection;
const getHistoryConnection = () => databases.history.connection;
const getReconciliationsConnection = () => databases.reconciliations.connection;
const getSynclogConnection = () => databases.synclog.connection;

// Función para cerrar todas las conexiones
const closeDatabaseConnections = async () => {
  try {
    for (const [name, dbConfig] of Object.entries(databases)) {
      if (dbConfig.connection) {
        await dbConfig.connection.close();
        console.log(`🔌 Closed ${name} database connection`);
      }
    }
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
  }
};

module.exports = { 
  databases, 
  connectDatabases, 
  closeDatabaseConnections,
  getUsersConnection,
  getCardsConnection,
  getTransactionsConnection,
  getHistoryConnection,
  getReconciliationsConnection,
  getSynclogConnection
};
