require('dotenv').config();

const config = {
  development: {
    // Base de datos de desarrollo en MongoDB Atlas
    USERS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}dev_users` : 'mongodb://localhost:27017/dev_users',
    CARDS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}dev_cards` : 'mongodb://localhost:27017/dev_cards',
    TRANSACTIONS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}dev_transactions` : 'mongodb://localhost:27017/dev_transactions',
    HISTORY_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}dev_history` : 'mongodb://localhost:27017/dev_history',
    RECONCILIATIONS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}dev_reconciliations` : 'mongodb://localhost:27017/dev_reconciliations',
    SYNCLOG_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}dev_synclog` : 'mongodb://localhost:27017/dev_synclog',
    
    PORT: process.env.PORT || 3002,
    NODE_ENV: 'development',
    API_KEY: process.env.API_KEY,
    DEV: process.env.DEV || 'http://localhost:10001',
    BACKEND_URL: process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3002}`,
    JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-key',
    JWT_EXPIRE: process.env.JWT_EXPIRE || '2d',
    
    // Commission configuration
    WALLET_DEPOSIT_COMMISSION_RATE: process.env.WALLET_DEPOSIT_COMMISSION_RATE || 0.003, // 0.3%
    MERCURY_API_KEY: process.env.MERCURY_API_KEY,
    MERCURY_AUTH_TOKEN: process.env.MERCURY_AUTH_TOKEN,
    EMAIL: process.env.EMAIL,
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD
  },
  
  production: {
    // Base de datos de producción en MongoDB Atlas
    USERS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}prod_users` : 'mongodb://localhost:27017/prod_users',
    CARDS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}prod_cards` : 'mongodb://localhost:27017/prod_cards',
    TRANSACTIONS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}prod_transactions` : 'mongodb://localhost:27017/prod_transactions',
    HISTORY_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}prod_history` : 'mongodb://localhost:27017/prod_history',
    RECONCILIATIONS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}prod_reconciliations` : 'mongodb://localhost:27017/prod_reconciliations',
    SYNCLOG_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}prod_synclog` : 'mongodb://localhost:27017/prod_synclog',
    
    PORT: process.env.PORT || 3001,
    NODE_ENV: 'production',
    API_KEY: process.env.API_KEY,
    PRODUCTION: process.env.PRODUCTION || 'https://nanocard.xyz',
    BACKEND_URL: process.env.BACKEND_URL || process.env.PRODUCTION || 'https://nanocard.xyz',
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRE: process.env.JWT_EXPIRE,
    
    // Commission configuration
    WALLET_DEPOSIT_COMMISSION_RATE: process.env.WALLET_DEPOSIT_COMMISSION_RATE || 0.003, // 0.3%
    MERCURY_API_KEY: process.env.MERCURY_API_KEY,
    MERCURY_AUTH_TOKEN: process.env.MERCURY_AUTH_TOKEN,
    EMAIL: process.env.EMAIL,
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD
  },
  
  test: {
    // Base de datos de testing en MongoDB Atlas
    USERS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}test_users` : 'mongodb://localhost:27017/test_users',
    CARDS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}test_cards` : 'mongodb://localhost:27017/test_cards',
    TRANSACTIONS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}test_transactions` : 'mongodb://localhost:27017/test_transactions',
    HISTORY_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}test_history` : 'mongodb://localhost:27017/test_history',
    RECONCILIATIONS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}test_reconciliations` : 'mongodb://localhost:27017/test_reconciliations',
    SYNCLOG_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}test_synclog` : 'mongodb://localhost:27017/test_synclog',
    
    PORT: process.env.PORT || 3001,
    NODE_ENV: 'test',
    API_KEY: process.env.API_KEY,
    TEST: process.env.TEST || 'https://nanocard-test.onrender.com',
    JWT_SECRET: process.env.JWT_SECRET || 'test-secret-key',
    JWT_EXPIRE: process.env.JWT_EXPIRE || '1h',
    
    // Commission configuration
    WALLET_DEPOSIT_COMMISSION_RATE: process.env.WALLET_DEPOSIT_COMMISSION_RATE || 0.003, // 0.3%
  }
};

const env = process.env.NODE_ENV || 'development';
const currentConfig = config[env];

// Validar configuración requerida
const requiredFields = ['USERS_DB_URI', 'CARDS_DB_URI', 'TRANSACTIONS_DB_URI'];
for (const field of requiredFields) {
  if (!currentConfig[field]) {
    console.error(`❌ Missing required environment variable: ${field}`);
    process.exit(1);
  }
}

console.log(`🌍 Environment: ${env}`);
console.log(`🗄️ Users DB: ${currentConfig.USERS_DB_URI}`);
console.log(`💳 Cards DB: ${currentConfig.CARDS_DB_URI}`);
console.log(`💰 Transactions DB: ${currentConfig.TRANSACTIONS_DB_URI}`);
console.log(`📚 History DB: ${currentConfig.HISTORY_DB_URI}`);
console.log(`🔄 Reconciliations DB: ${currentConfig.RECONCILIATIONS_DB_URI}`);
console.log(`📊 SyncLog DB: ${currentConfig.SYNCLOG_DB_URI}`);

module.exports = currentConfig;
