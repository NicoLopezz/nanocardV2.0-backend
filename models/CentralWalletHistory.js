const mongoose = require('mongoose');

const centralWalletHistorySchema = new mongoose.Schema({
  _id: { type: String, default: () => require('uuid').v4() },
  
  // Saldos
  previousBalance: { type: Number, required: true },
  currentBalance: { type: Number, required: true },
  difference: { type: Number, required: true }, // currentBalance - previousBalance
  
  // Información de la wallet
  blockchain: { type: String, required: true },
  walletAddress: { type: String, required: true },
  
  // Tokens (opcional, para referencia)
  tokens: {
    USDT: String,
    USDC: String
  },
  
  // Metadatos
  consultedBy: { type: String }, // userId del que consultó
  source: { type: String, default: 'api' }, // 'api', 'frontend', etc.
  userAgent: { type: String }, // Para tracking
  
  // Timestamps
  consultedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Función para obtener el modelo después de la conexión
const getCentralWalletHistoryModel = () => {
  const { databases } = require('../config/database');
  return databases.history.connection.model('CentralWalletHistory', centralWalletHistorySchema);
};

module.exports = { getCentralWalletHistoryModel, centralWalletHistorySchema };
