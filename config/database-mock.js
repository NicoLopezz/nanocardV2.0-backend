const mongoose = require('mongoose');

const databases = {
  users: {
    uri: 'mongodb://localhost:27017/nano_users_dev',
    connection: null
  },
  cards: {
    uri: 'mongodb://localhost:27017/nano_cards_dev',
    connection: null
  },
  transactions: {
    uri: 'mongodb://localhost:27017/nano_transactions_dev',
    connection: null
  }
};

const connectDatabases = async () => {
  try {
    console.log('⚠️  MongoDB connection disabled for testing');
    console.log('✅ Mock databases initialized');
    
    // Crear conexiones mock
    for (const [name, dbConfig] of Object.entries(databases)) {
      dbConfig.connection = {
        readyState: 1,
        name: name,
        host: 'mock',
        port: 27017
      };
      console.log(`✅ Mock connected to ${name} database`);
    }
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

module.exports = { databases, connectDatabases };
