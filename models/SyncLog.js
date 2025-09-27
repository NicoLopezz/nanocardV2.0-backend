const mongoose = require('mongoose');

const syncLogSchema = new mongoose.Schema({
  _id: String, // "last_sync"
  type: { 
    type: String, 
    enum: ['last_sync', 'sync_history'],
    required: true,
    default: 'last_sync'
  },
  lastSyncTimestamp: Date,
  lastSyncCardId: String,
  totalExecutions: { type: Number, default: 0 },
  lastExecution: {
    timestamp: Date,
    cardsImported: { type: Number, default: 0 },
    transactionsImported: { type: Number, default: 0 },
    cardsUpdated: { type: Number, default: 0 },
    transactionsUpdated: { type: Number, default: 0 },
    executionTime: String,
    status: { 
      type: String, 
      enum: ['success', 'error', 'partial'],
      default: 'success'
    },
    errors: [String]
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

syncLogSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const getSyncLogModel = () => {
  const { databases } = require('../config/database');
  return databases.transactions.connection.model('SyncLog', syncLogSchema);
};

module.exports = { getSyncLogModel };
