const mongoose = require('mongoose');

// Schema para transacciones - Compatible con tu interface
const transactionSchema = new mongoose.Schema({
  _id: String, // transactionId único
  userId: { type: String, required: true, ref: 'User' },
  cardId: { type: String, required: true, ref: 'Card' },
  supplier: {
    type: String,
    enum: ['cryptomate', 'mercury'],
    default: 'cryptomate'
  }, // Proveedor
  
  // Campos básicos (coincide con tu interface)
  name: { type: String, required: true }, // NOMBRE/DESCRIPCIÓN DE LA TRANSACCIÓN
  amount: { type: Number, required: true },
  date: { type: String, required: true }, // Formato DD/MM/YYYY
  time: { type: String, required: true }, // Formato HH:MM AM/PM
  status: { 
    type: String, 
    enum: ['SUCCESS', 'FAILED', 'PENDING', 'CANCELLED', 'DELETED'],
    default: 'SUCCESS'
  },
  userName: { type: String, required: true }, // NOMBRE DEL USUARIO
  cardName: { type: String, required: true }, // NOMBRE/DESCRIPCIÓN DE LA TARJETA
  version: { type: Number, default: 1 },
  isDeleted: { type: Boolean, default: false },
  reconciled: { type: Boolean, default: false },
  reconciledAt: { type: Date },
  reconciledBy: { type: String },
  reconciliationId: { type: String },
  
  // Tipo de operación de CryptoMate (MUY IMPORTANTE)
  operation: {
    type: String,
    enum: [
      // Operaciones unificadas (CryptoMate + Mercury)
      'TRANSACTION_APPROVED',    // ← Unificado (CryptoMate + Mercury sent)
      'TRANSACTION_REJECTED', 
      'TRANSACTION_REVERSED',
      'TRANSACTION_REFUND',
      'TRANSACTION_PENDING',
      'TRANSACTION_CANCELLED',
      'TRANSACTION_BLOCKED',
      // Otras operaciones
      'WALLET_DEPOSIT',
      'OVERRIDE_VIRTUAL_BALANCE',
      'WITHDRAWAL'
    ],
    required: true
  },
  
  // Campos adicionales (coincide con tu interface)
  city: String,
  country: String,
  mcc_category: String,
  mercuryCategory: String,
  // Campos para cadena de transacciones Mercury
  originalTransactionId: String, // ID de la transacción original (para fees)
  mercuryKind: String, // Tipo de transacción de Mercury (cardInternationalTransactionFee, debitCardTransaction, etc.)
  rawDate: String, // Fecha original de Mercury (ISO string) para preservar el dato original
  credit: { type: Boolean, default: false },
  comentario: String,
  originalMovementId: String, // ID del movimiento original en old_db para depósitos manuales
  
  // Campos específicos de OVERRIDE_VIRTUAL_BALANCE
  bill_amount: Number,
  bill_currency: String,
  transaction_amount: Number,
  transaction_currency: String,
  exchange_rate: Number,
  merchant_name: String,
  original_balance: Number,
  new_balance: Number,
  decline_reason: mongoose.Schema.Types.Mixed,
  
  // Campos contables para WALLET_DEPOSIT
  gross_amount: Number,
  commission_rate: Number,
  commission_amount: Number,
  net_amount: Number,
  
  // Campos de auditoría
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  
  // Historial de cambios (para auditoría)
  history: [{
    version: Number,
    action: String, // 'created', 'updated', 'deleted', 'restored', 'reconciled'
    timestamp: Date,
    modifiedBy: String,
    reason: String,
    changes: mongoose.Schema.Types.Mixed,
    reconciliationId: String // ID de la reconciliación cuando la acción es 'reconciled'
  }]
}, {
  timestamps: true,
  _id: false // Deshabilitar _id automático de MongoDB
});

// Índices para optimizar consultas
transactionSchema.index({ userId: 1, cardId: 1 });
transactionSchema.index({ cardId: 1, createdAt: -1 });
transactionSchema.index({ operation: 1 });
transactionSchema.index({ supplier: 1 });
transactionSchema.index({ originalTransactionId: 1 }); // Para consultar fees relacionados

// Función para obtener el modelo según el entorno
let transactionModel = null;

const getTransactionModel = () => {
  if (!transactionModel) {
    const { getTransactionsConnection } = require('../config/database');
    const connection = getTransactionsConnection();
    transactionModel = connection.model('Transaction', transactionSchema);
  }
  return transactionModel;
};

module.exports = { getTransactionModel };
