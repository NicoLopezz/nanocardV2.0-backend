const mongoose = require('mongoose');

const reconciliationTransactionSchema = new mongoose.Schema({
  _id: String, // ID único de la transacción de conciliación
  
  // Referencias
  reconciliationId: { type: String, required: true, ref: 'Reconciliation' },
  originalTransactionId: { type: String, required: true }, // ID de la transacción original
  userId: { type: String, required: true },
  cardId: { type: String, required: true },
  
  // Datos de la transacción al momento de la conciliación
  userName: String,
  cardName: String,
  name: String,
  amount: Number,
  date: String,
  time: String,
  status: String,
  operation: String,
  city: String,
  country: String,
  mcc_category: String,
  mercuryCategory: String,
  credit: Boolean,
  comentario: String,
  version: Number,
  isDeleted: Boolean,
  deletedAt: Date,
  deletedBy: String,
  
  // Timestamps
  originalCreatedAt: Date,
  originalUpdatedAt: Date,
  reconciledAt: { type: Date, default: Date.now },
  reconciledBy: String,
  
  // Metadatos de la conciliación
  reconciliationDate: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Índices para optimizar consultas
reconciliationTransactionSchema.index({ reconciliationId: 1 });
reconciliationTransactionSchema.index({ userId: 1, reconciliationDate: -1 });
reconciliationTransactionSchema.index({ cardId: 1, reconciliationDate: -1 });
reconciliationTransactionSchema.index({ originalTransactionId: 1 });

// Función para obtener el modelo después de la conexión
const getReconciliationTransactionModel = () => {
  const { databases } = require('../config/database');
  return databases.reconciliations.connection.model('ReconciliationTransaction', reconciliationTransactionSchema);
};

module.exports = { getReconciliationTransactionModel };
