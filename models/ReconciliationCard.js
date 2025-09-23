const mongoose = require('mongoose');

const reconciliationCardSchema = new mongoose.Schema({
  _id: String, // ID único de la tarjeta de conciliación
  
  // Referencias
  reconciliationId: { type: String, required: true, ref: 'Reconciliation' },
  originalCardId: { type: String, required: true }, // ID de la tarjeta original
  userId: { type: String, required: true },
  
  // Datos de la tarjeta al momento de la conciliación
  name: String,
  supplier: String,
  last4: String,
  type: String,
  status: String,
  approval_method: String,
  forwarded_3ds_type: String,
  
  // Estados financieros al momento del snapshot
  deposited: Number,
  refunded: Number,
  posted: Number,
  pending: Number,
  available: Number,
  
  // Balance de CryptoMate
  cryptoMateBalance: {
    available_credit: Number,
    lastUpdated: Date,
    source: String
  },
  
  // Estadísticas de transacciones
  transactionStats: {
    totalTransactions: Number,
    byOperation: {
      TRANSACTION_APPROVED: Number,
      TRANSACTION_REJECTED: Number,
      TRANSACTION_REVERSED: Number,
      TRANSACTION_REFUND: Number,
      WALLET_DEPOSIT: Number,
      OVERRIDE_VIRTUAL_BALANCE: Number
    },
    byAmount: {
      TRANSACTION_APPROVED: Number,
      TRANSACTION_REJECTED: Number,
      TRANSACTION_REVERSED: Number,
      TRANSACTION_REFUND: Number,
      WALLET_DEPOSIT: Number,
      OVERRIDE_VIRTUAL_BALANCE: Number
    },
    lastUpdated: Date
  },
  
  // Límites
  limits: {
    daily: Number,
    weekly: Number,
    monthly: Number,
    perTransaction: Number
  },
  
  // Metadatos
  meta: {
    email: String,
    otp_phone_number: {
      dial_code: Number,
      phone_number: String
    }
  },
  
  // Timestamps
  reconciledAt: { type: Date, default: Date.now },
  reconciledBy: String,
  reconciliationDate: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Índices para optimizar consultas
reconciliationCardSchema.index({ reconciliationId: 1 });
reconciliationCardSchema.index({ userId: 1, reconciliationDate: -1 });
reconciliationCardSchema.index({ originalCardId: 1 });

// Función para obtener el modelo después de la conexión
const getReconciliationCardModel = () => {
  const { databases } = require('../config/database');
  return databases.reconciliations.connection.model('ReconciliationCard', reconciliationCardSchema);
};

module.exports = { getReconciliationCardModel };
