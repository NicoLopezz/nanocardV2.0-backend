const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  _id: String, // transactionId único
  
  // Referencias
  userId: { type: String, required: true, ref: 'User' },
  cardId: { type: String, required: true, ref: 'Card' },
  
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
      'Pending',
      'SUCCESS',
      'FAILED'
    ], 
    required: true 
  },
  
  // Tipo de operación de CryptoMate (MUY IMPORTANTE)
  operation: {
    type: String,
    enum: [
      'TRANSACTION_APPROVED',
      'TRANSACTION_REJECTED', 
      'TRANSACTION_REVERSED',
      'TRANSACTION_REFUND',
      'WALLET_DEPOSIT',
      'OVERRIDE_VIRTUAL_BALANCE',
      'WITHDRAWAL'  // Nueva operación para retiros
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
  
  // SISTEMA DE VERSIONADO
  version: { type: Number, default: 1 },
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: String, // userId que la eliminó
  
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

module.exports = { getTransactionModel };