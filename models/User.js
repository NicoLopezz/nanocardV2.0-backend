const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  _id: String, // username como ID
  username: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  role: { 
    type: String, 
    enum: ['admin', 'standard'], 
    default: 'standard' 
  },
  
  // Metadata del usuario
  profile: {
    firstName: String,
    lastName: String,
    phone: String,
    avatar: String
  },
  
  // Configuraciones
  preferences: {
    currency: { type: String, default: 'USD' },
    timezone: { type: String, default: 'UTC' },
    language: { type: String, default: 'en' }
  },
  
  // KPIs que realmente importan - RESUMEN RÁPIDO
  stats: {
    totalTransactions: { type: Number, default: 0 },
    totalDeposited: { type: Number, default: 0 },       // Solo WALLET_DEPOSIT
    totalRefunded: { type: Number, default: 0 },        // Solo TRANSACTION_REFUND
    totalPosted: { type: Number, default: 0 },          // Solo TRANSACTION_APPROVED
    totalPending: { type: Number, default: 0 },         // Solo TRANSACTION_PENDING
    totalAvailable: { type: Number, default: 0 },       // deposited + refunded - posted - pending
    lastLogin: Date,
    loginCount: { type: Number, default: 0 },
    lastSync: Date,  // Última sincronización de transacciones
    lastSyncSource: { type: String, default: 'manual' } // 'manual', 'automatic', 'api'
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Función para obtener el modelo después de la conexión
const getUserModel = () => {
  const { databases } = require('../config/database');
  
  if (!databases.users.connection || databases.users.connection.readyState !== 1) {
    throw new Error('Users database connection is not ready. Please wait for database initialization.');
  }
  
  return databases.users.connection.model('User', userSchema);
};

module.exports = { getUserModel, userSchema };
