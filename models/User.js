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
    totalDeposited: { type: Number, default: 0 },       // Money In
    totalPosted: { type: Number, default: 0 },          // Posted
    totalPending: { type: Number, default: 0 },         // Pending
    totalAvailable: { type: Number, default: 0 },       // Available
    lastLogin: Date,
    loginCount: { type: Number, default: 0 }
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Función para obtener el modelo después de la conexión
const getUserModel = () => {
  const { databases } = require('../config/database');
  return databases.users.connection.model('User', userSchema);
};

module.exports = { getUserModel };
