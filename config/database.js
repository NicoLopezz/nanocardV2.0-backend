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
      console.log(`🔄 Connecting to ${name} database...`);
      
      dbConfig.connection = await mongoose.createConnection(dbConfig.uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000,     // ✅ Aumentar timeout a 30s
        socketTimeoutMS: 45000,              // ✅ Aumentar timeout a 45s
        connectTimeoutMS: 30000,             // ✅ Aumentar timeout de conexión a 30s
        maxPoolSize: 10,                     // ✅ Más conexiones en pool
        minPoolSize: 2,                      // ✅ Mantener más conexiones mínimas
        maxIdleTimeMS: 300000,               // ✅ 5 minutos idle
        retryWrites: true,
        w: 'majority',
        bufferCommands: false                // ✅ Deshabilitar buffering
      });
      
      // ✅ Manejo de eventos de conexión
      dbConfig.connection.on('connected', () => {
        console.log(`✅ ${name} database connected`);
      });
      
      dbConfig.connection.on('error', (err) => {
        console.error(`❌ ${name} database error:`, err);
      });
      
      dbConfig.connection.on('disconnected', () => {
        console.warn(`⚠️ ${name} database disconnected`);
      });
      
      dbConfig.connection.on('reconnected', () => {
        console.log(`🔄 ${name} database reconnected`);
      });
      
      // ✅ Esperar a que la conexión esté completamente lista
      await new Promise((resolve, reject) => {
        if (dbConfig.connection.readyState === 1) {
          resolve();
        } else {
          const timeout = setTimeout(() => {
            reject(new Error(`Timeout waiting for ${name} database connection`));
          }, 30000);
          
          dbConfig.connection.once('open', () => {
            clearTimeout(timeout);
            resolve();
          });
          
          dbConfig.connection.once('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        }
      });
      
      console.log(`✅ ${name} database ready for queries`);
    }
    
    console.log('✅ All databases connected and ready');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    console.error('❌ Retrying connection in 5 seconds...');
    setTimeout(() => {
      connectDatabases();
    }, 5000);
  }
};

// Funciones getter para las conexiones
const getUsersConnection = () => databases.users.connection;
const getCardsConnection = () => databases.cards.connection;
const getTransactionsConnection = () => databases.transactions.connection;
const getHistoryConnection = () => databases.history.connection;
const getReconciliationsConnection = () => databases.reconciliations.connection;
const getSynclogConnection = () => databases.synclog.connection;

// Función para verificar el estado de las conexiones
const checkDatabaseHealth = async () => {
  const health = {};
  
  for (const [name, dbConfig] of Object.entries(databases)) {
    try {
      if (dbConfig.connection && dbConfig.connection.readyState === 1) {
        health[name] = { status: 'connected', readyState: dbConfig.connection.readyState };
      } else {
        health[name] = { status: 'disconnected', readyState: dbConfig.connection?.readyState || 0 };
      }
    } catch (error) {
      health[name] = { status: 'error', error: error.message };
    }
  }
  
  return health;
};

// Función para verificar si todas las conexiones están listas
const areAllConnectionsReady = () => {
  for (const [name, dbConfig] of Object.entries(databases)) {
    if (!dbConfig.connection || dbConfig.connection.readyState !== 1) {
      return false;
    }
  }
  return true;
};

// Función para esperar a que todas las conexiones estén listas
const waitForAllConnections = async (timeoutMs = 30000) => {
  const startTime = Date.now();
  
  while (!areAllConnectionsReady()) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Timeout waiting for database connections');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return true;
};

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
  checkDatabaseHealth,
  areAllConnectionsReady,
  waitForAllConnections,
  getUsersConnection,
  getCardsConnection,
  getTransactionsConnection,
  getHistoryConnection,
  getReconciliationsConnection,
  getSynclogConnection
};
