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
    for (const [name, dbConfig] of Object.entries(databases)) {
      dbConfig.connection = await mongoose.createConnection(dbConfig.uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 5000,
        maxPoolSize: 1,
        minPoolSize: 0,
        maxIdleTimeMS: 30000
      });
      console.log(`✅ Connected to ${name} database`);
    }
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

module.exports = { databases, connectDatabases };
