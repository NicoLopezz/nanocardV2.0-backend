const mongoose = require('mongoose');

const authSchema = new mongoose.Schema({
  _id: String, // userId como ID
  userId: { type: String, required: true, ref: 'User' },
  cardId: { type: String, required: true, ref: 'Card' },
  
  // Credenciales de login
  loginName: { type: String, required: true }, // Nombre normalizado para login
  last4: { type: String, required: true },
  
  // Información de sesión
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date, default: Date.now },
  loginCount: { type: Number, default: 0 },
  
  // Tokens
  refreshTokens: [{
    token: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date
  }],
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Función para obtener el modelo después de la conexión
const getAuthModel = () => {
  const { databases } = require('../config/database');
  
  if (!databases.users.connection || databases.users.connection.readyState !== 1) {
    throw new Error('Users database connection is not ready. Please wait for database initialization.');
  }
  
  return databases.users.connection.model('Auth', authSchema);
};

module.exports = { getAuthModel };

