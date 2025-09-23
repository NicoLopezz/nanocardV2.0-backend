const mongoose = require('mongoose');

const reconciliationSchema = new mongoose.Schema({
  _id: String, // reconciliationId único
  
  // Información básica
  userId: { type: String, required: true, ref: 'User' },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  
  // Metadatos de la conciliación
  name: { type: String, required: true },
  description: String,
  status: { 
    type: String, 
    enum: ['ACTIVE', 'ARCHIVED', 'DELETED'], 
    default: 'ACTIVE' 
  },
  
  // Fecha y hora de la conciliación
  reconciliationDate: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: String, required: true },
  
  // SNAPSHOT COMPLETO DEL USUARIO
  userSnapshot: {
    profile: {
      firstName: String,
      lastName: String,
      phone: String,
      avatar: String
    },
    preferences: {
      currency: String,
      timezone: String,
      language: String
    },
    stats: {
      totalTransactions: Number,
      totalDeposited: Number,
      totalPosted: Number,
      totalPending: Number,
      totalAvailable: Number,
      lastLogin: Date,
      loginCount: Number
    }
  },
  
  // RESUMEN FINANCIERO TOTAL
  financialSummary: mongoose.Schema.Types.Mixed,
  
  // METADATOS DEL SNAPSHOT
  snapshotMetadata: {
    totalCards: Number,
    totalTransactions: Number,
    dateRange: {
      from: Date,
      to: Date
    },
    version: { type: String, default: '1.0' },
    checksum: String
  },
  
  // Timestamps
  updatedAt: { type: Date, default: Date.now }
});

// Índices para optimizar consultas
reconciliationSchema.index({ userId: 1, reconciliationDate: -1 });
reconciliationSchema.index({ status: 1, reconciliationDate: -1 });
reconciliationSchema.index({ createdBy: 1, reconciliationDate: -1 });
reconciliationSchema.index({ reconciliationDate: -1 });

// Función para obtener el modelo después de la conexión
const getReconciliationModel = () => {
  const { databases } = require('../config/database');
  return databases.reconciliations.connection.model('Reconciliation', reconciliationSchema);
};

module.exports = { getReconciliationModel };
