require('dotenv').config();

const config = {
  development: {
    // Base de datos de desarrollo en MongoDB Atlas
    USERS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}nano_users_dev` : 'mongodb://localhost:27017/nano_users_dev',
    CARDS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}nano_cards_dev` : 'mongodb://localhost:27017/nano_cards_dev',
    TRANSACTIONS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}nano_transactions_dev` : 'mongodb://localhost:27017/nano_transactions_dev',
    
    PORT: process.env.PORT || 3001,
    NODE_ENV: 'development',
    API_KEY: process.env.API_KEY,
    DEV: process.env.DEV || 'http://localhost:10001',
    JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-key',
    JWT_EXPIRE: process.env.JWT_EXPIRE || '2d',
    MERCURY_API_KEY: process.env.MERCURY_API_KEY,
    MERCURY_AUTH_TOKEN: process.env.MERCURY_AUTH_TOKEN,
    EMAIL: process.env.EMAIL,
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD
  },
  
  production: {
    // Base de datos de producción en MongoDB Atlas
    USERS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}nano_users_prod` : 'mongodb://localhost:27017/nano_users_prod',
    CARDS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}nano_cards_prod` : 'mongodb://localhost:27017/nano_cards_prod',
    TRANSACTIONS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}nano_transactions_prod` : 'mongodb://localhost:27017/nano_transactions_prod',
    
    PORT: process.env.PORT || 3001,
    NODE_ENV: 'production',
    API_KEY: process.env.API_KEY,
    PRODUCTION: process.env.PRODUCTION || 'https://nanocard.xyz',
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRE: process.env.JWT_EXPIRE,
    MERCURY_API_KEY: process.env.MERCURY_API_KEY,
    MERCURY_AUTH_TOKEN: process.env.MERCURY_AUTH_TOKEN,
    EMAIL: process.env.EMAIL,
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD
  },
  
  test: {
    // Base de datos de testing en MongoDB Atlas
    USERS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}nano_users_test` : 'mongodb://localhost:27017/nano_users_test',
    CARDS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}nano_cards_test` : 'mongodb://localhost:27017/nano_cards_test',
    TRANSACTIONS_DB_URI: process.env.MONGODB_URI ? `${process.env.MONGODB_URI}nano_transactions_test` : 'mongodb://localhost:27017/nano_transactions_test',
    
    PORT: process.env.PORT || 3002,
    NODE_ENV: 'test',
    API_KEY: process.env.API_KEY,
    TEST: process.env.TEST || 'https://nanocard-test.onrender.com',
    JWT_SECRET: process.env.JWT_SECRET || 'test-secret-key',
    JWT_EXPIRE: process.env.JWT_EXPIRE || '1h'
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

module.exports = currentConfig;
