const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  _id: String, // transactionId único
  
  // Referencias
  userId: { type: String, required: true, ref: 'User' },
  cardId: { type: String, required: true, ref: 'Card' },
  supplier: { 
    type: String, 
    enum: ['cryptomate', 'mercury'], 
    default: 'cryptomate' 
  }, // Proveedor
  
  // Información descriptiva del usuario y tarjeta
  userName: { type: String, required: true }, // Nombre del titular de la tarjeta
  cardName: { type: String, required: true }, // Nombre/descripción de la tarjeta
  
  // Información básica (coincide con tu interface Transaction_Data)
  name: { type: String, required: true }, // Nombre del comercio/transacción
  amount: { type: Number, required: true },
  
  // Fecha y hora (coincide con tu formato actual)
  date: { type: String, required: true }, // Formato DD/MM/YYYY
  time: { type: String, required: true }, // Formato HH:MM AM/PM
  
  // Estado (coincide con tu enum actual)
  status: { 
    type: String, 
    enum: [
      'TRANSACTION_APPROVED', 
      'TRANSACTION_REJECTED', 
      'TRANSACTION_REFUND', 
      'TRANSACTION_DELETED',
      'TRANSACTION_REVERSED',
      'WALLET_DEPOSIT',
      'DELETED',
      'Completed', 
      'PENDING',
      'SUCCESS',
      'FAILED'
    ], 
    required: true 
  },
  
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
  decline_reason: mongoose.Schema.Types.Mixed, // Puede ser string o objeto complejo
  
  // Campos contables para WALLET_DEPOSIT
  gross_amount: Number,        // Monto original de la API (antes de comisión)
  commission_rate: Number,     // Tasa de comisión aplicada (ej: 0.003 para 0.3%)
  commission_amount: Number,   // Monto de la comisión (gross_amount * commission_rate)
  net_amount: Number,          // Monto neto después de comisión (gross_amount - commission_amount)
  
  // SISTEMA DE VERSIONADO
  version: { type: Number, default: 1 },
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: String, // userId que la eliminó
  restoredAt: Date,
  restoredBy: String, // userId que la restauró
  
  // Historial de cambios
  history: [{
    version: { type: Number, required: true },
    action: { 
      type: String, 
      enum: ['created', 'updated', 'deleted', 'restored'],
      required: true 
    },
    changes: [{
      field: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed
    }],
    timestamp: { type: Date, default: Date.now },
    modifiedBy: String, // userId que hizo el cambio
    reason: String // motivo del cambio
  }],
  
  // SISTEMA DE CONCILIACIONES
  reconciled: { 
    type: Boolean, 
    default: false 
  },
  reconciledAt: Date,
  reconciledBy: String,
  reconciliationId: String,
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Función para obtener el modelo después de la conexión
const getTransactionModel = () => {
  const { databases } = require('../config/database');
  return databases.transactions.connection.model('Transaction', transactionSchema);
};

module.exports = { getTransactionModel, transactionSchema };