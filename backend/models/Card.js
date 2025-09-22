const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  _id: String, // cardId único (id de CryptoMate)
  userId: { type: String, required: true, ref: 'User' },
  
  // Información básica (mapeado desde CryptoMate)
  name: { type: String, required: true }, // card_holder_name de CryptoMate
  supplier: { type: String, default: 'CryptoMate' }, // Proveedor
  last4: { type: String, required: true }, // last4 de CryptoMate
  type: { type: String, default: 'Virtual' }, // type de CryptoMate
  
  // Estados financieros (inicializados en 0, se actualizarán con transacciones)
  deposited: { type: Number, default: 0 },    // Solo depósitos reales (WALLET_DEPOSIT)
  refunded: { type: Number, default: 0 },     // Solo reembolsos (TRANSACTION_REFUND)
  posted: { type: Number, default: 0 },       // Solo gastos (TRANSACTION_APPROVED)
  pending: { type: Number, default: 0 },
  available: { type: Number, default: 0 },    // deposited + refunded - posted
  
  // Balance real de CryptoMate (para comparación)
  cryptoMateBalance: {
    available_credit: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
    source: { type: String, default: 'cryptomate_api' }
  },
  
  // Estadísticas detalladas por tipo de operación
  transactionStats: {
    totalTransactions: { type: Number, default: 0 },
    byOperation: {
      TRANSACTION_APPROVED: { type: Number, default: 0 },
      TRANSACTION_REJECTED: { type: Number, default: 0 },
      TRANSACTION_REVERSED: { type: Number, default: 0 },
      TRANSACTION_REFUND: { type: Number, default: 0 },
      WALLET_DEPOSIT: { type: Number, default: 0 },
      OVERRIDE_VIRTUAL_BALANCE: { type: Number, default: 0 }
    },
    byAmount: {
      TRANSACTION_APPROVED: { type: Number, default: 0 },
      TRANSACTION_REJECTED: { type: Number, default: 0 },
      TRANSACTION_REVERSED: { type: Number, default: 0 },
      TRANSACTION_REFUND: { type: Number, default: 0 },
      WALLET_DEPOSIT: { type: Number, default: 0 },
      OVERRIDE_VIRTUAL_BALANCE: { type: Number, default: 0 }
    },
    lastUpdated: { type: Date, default: Date.now }
  },
  
  // Configuraciones de CryptoMate
  status: { 
    type: String, 
    enum: ['ACTIVE', 'FROZEN', 'BLOCKED', 'CLOSED', 'active', 'suspended', 'blocked', 'closed'], 
    default: 'ACTIVE' 
  },
  approval_method: { type: String, default: 'TopUp' }, // approval_method de CryptoMate
  forwarded_3ds_type: { type: String, default: 'sms' }, // forwarded_3ds_type de CryptoMate
  
  // Límites de CryptoMate
  limits: {
    daily: Number, // daily_limit de CryptoMate
    weekly: Number, // weekly_limit de CryptoMate
    monthly: Number, // monthly_limit de CryptoMate
    perTransaction: Number
  },
  
  // Metadatos de CryptoMate
  meta: {
    email: String, // meta.email de CryptoMate
    otp_phone_number: {
      dial_code: Number, // meta.otp_phone_number.dial_code
      phone_number: String // meta.otp_phone_number.phone_number
    }
  },
  
  // Metadata del sistema
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Función para obtener el modelo después de la conexión
const getCardModel = () => {
  const { databases } = require('../config/database');
  return databases.cards.connection.model('Card', cardSchema);
};

module.exports = { getCardModel };