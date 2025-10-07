const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  _id: String, // cardId único (id de CryptoMate)
  userId: { type: String, required: true, ref: 'User' },
  
  // Información básica (mapeado desde CryptoMate)
  name: { type: String, required: true }, // card_holder_name de CryptoMate
  supplier: { 
    type: String, 
    enum: ['cryptomate', 'mercury'], 
    default: 'cryptomate' 
  }, // Proveedor
  last4: { type: String, required: true }, // last4 de CryptoMate
  lastFourDigits: String, // lastFourDigits de Mercury
  network: String, // network de Mercury (mastercard, visa, etc.)
  type: { type: String, default: 'Virtual' }, // type de CryptoMate
  
  // Estados financieros organizados en stats
  stats: {
    money_in: { type: Number, default: 0 },     // WALLET_DEPOSIT + OVERRIDE_VIRTUAL_BALANCE
    refund: { type: Number, default: 0 },       // TRANSACTION_REFUND
    posted: { type: Number, default: 0 },       // TRANSACTION_APPROVED - TRANSACTION_REVERSED
    reversed: { type: Number, default: 0 },     // TRANSACTION_REVERSED
    rejected: { type: Number, default: 0 },     // TRANSACTION_REJECTED
    pending: { type: Number, default: 0 },      // TRANSACTION_PENDING
    withdrawal: { type: Number, default: 0 },   // WITHDRAWAL
    available: { type: Number, default: 0 },    // money_in + refund - posted - pending - withdrawal
    
    // Campos para auditoría (transacciones eliminadas)
    total_all_transactions: { type: Number, default: 0 },     // Total incluyendo eliminadas
    total_deleted_transactions: { type: Number, default: 0 }, // Solo eliminadas
    deleted_amount: { type: Number, default: 0 }              // Monto de transacciones eliminadas
  },
  
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
      OVERRIDE_VIRTUAL_BALANCE: { type: Number, default: 0 },
      WITHDRAWAL: { type: Number, default: 0 }
    },
    byAmount: {
      TRANSACTION_APPROVED: { type: Number, default: 0 },
      TRANSACTION_REJECTED: { type: Number, default: 0 },
      TRANSACTION_REVERSED: { type: Number, default: 0 },
      TRANSACTION_REFUND: { type: Number, default: 0 },
      WALLET_DEPOSIT: { type: Number, default: 0 },
      OVERRIDE_VIRTUAL_BALANCE: { type: Number, default: 0 },
      WITHDRAWAL: { type: Number, default: 0 }
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

module.exports = { getCardModel, cardSchema };