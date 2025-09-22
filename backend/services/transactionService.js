const { getTransactionModel } = require('../models/Transaction');
const { getUserModel } = require('../models/User');

// Crear transacción con historial
const createTransaction = async (transactionData) => {
  const Transaction = getTransactionModel();
  const transaction = new Transaction({
    ...transactionData,
    version: 1,
    history: [{
      version: 1,
      action: 'created',
      timestamp: new Date(),
      modifiedBy: transactionData.userId,
      reason: 'Transaction created'
    }]
  });
  
  await transaction.save();
  
  // Actualizar KPIs del usuario
  await updateUserStats(transactionData.userId, transactionData);
  
  return transaction;
};

// Actualizar transacción con versionado
const updateTransaction = async (transactionId, updates, modifiedBy, reason = '') => {
  const Transaction = getTransactionModel();
  const transaction = await Transaction.findById(transactionId);
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }
  
  // Crear historial de cambios
  const changes = [];
  for (const [field, newValue] of Object.entries(updates)) {
    if (transaction[field] !== newValue) {
      changes.push({
        field,
        oldValue: transaction[field],
        newValue
      });
      transaction[field] = newValue;
    }
  }
  
  if (changes.length > 0) {
    transaction.version += 1;
    transaction.history.push({
      version: transaction.version,
      action: 'updated',
      changes,
      timestamp: new Date(),
      modifiedBy,
      reason
    });
    transaction.updatedAt = new Date();
    
    await transaction.save();
  }
  
  return transaction;
};

// Eliminar transacción (soft delete)
const deleteTransaction = async (transactionId, deletedBy, reason = '') => {
  const Transaction = getTransactionModel();
  const transaction = await Transaction.findById(transactionId);
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }
  
  // Marcar como eliminada (soft delete)
  transaction.isDeleted = true;
  transaction.deletedAt = new Date();
  transaction.deletedBy = deletedBy;
  transaction.version += 1;
  transaction.history.push({
    version: transaction.version,
    action: 'deleted',
    timestamp: new Date(),
    modifiedBy: deletedBy,
    reason
  });
  
  await transaction.save();
  
  // Actualizar KPIs del usuario (restar de los totales)
  await updateUserStatsAfterDelete(transaction.userId, transaction);
  
  return transaction;
};

// Restaurar transacción
const restoreTransaction = async (transactionId, restoredBy, reason = '') => {
  const Transaction = getTransactionModel();
  const transaction = await Transaction.findById(transactionId);
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }
  
  transaction.isDeleted = false;
  transaction.deletedAt = null;
  transaction.deletedBy = null;
  transaction.version += 1;
  transaction.history.push({
    version: transaction.version,
    action: 'restored',
    timestamp: new Date(),
    modifiedBy: restoredBy,
    reason
  });
  
  await transaction.save();
  
  // Actualizar KPIs del usuario (sumar a los totales)
  await updateUserStats(transaction.userId, transaction);
  
  return transaction;
};

// Obtener transacciones por tarjeta
const getTransactionsByCard = async (cardId, includeDeleted = false) => {
  const Transaction = getTransactionModel();
  const query = { cardId };
  
  if (!includeDeleted) {
    query.isDeleted = false;
  }
  
  return await Transaction.find(query).sort({ createdAt: -1 });
};

// Obtener historial de transacción
const getTransactionHistory = async (transactionId) => {
  const Transaction = getTransactionModel();
  const transaction = await Transaction.findById(transactionId);
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }
  
  return {
    current: transaction,
    history: transaction.history.sort((a, b) => b.timestamp - a.timestamp)
  };
};

// Obtener transacciones eliminadas
const getDeletedTransactions = async (userId) => {
  const Transaction = getTransactionModel();
  return await Transaction.find({ 
    userId, 
    isDeleted: true 
  }).sort({ deletedAt: -1 });
};

// Actualizar KPIs del usuario
const updateUserStats = async (userId, transactionData) => {
  const User = getUserModel();
  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // Incrementar contadores
  user.stats.totalTransactions += 1;
  
  // Actualizar montos según el tipo de transacción
  if (transactionData.credit) {
    user.stats.totalDeposited += transactionData.amount; // Money In
  } else {
    user.stats.totalPosted += transactionData.amount;    // Posted
  }
  
  // Recalcular available (deposited - posted)
  user.stats.totalAvailable = user.stats.totalDeposited - user.stats.totalPosted;
  
  await user.save();
};

// Actualizar KPIs después de eliminar
const updateUserStatsAfterDelete = async (userId, transaction) => {
  const User = getUserModel();
  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // Decrementar contadores
  user.stats.totalTransactions -= 1;
  
  // Restar montos según el tipo de transacción
  if (transaction.credit) {
    user.stats.totalDeposited -= transaction.amount;
  } else {
    user.stats.totalPosted -= transaction.amount;
  }
  
  // Recalcular available
  user.stats.totalAvailable = user.stats.totalDeposited - user.stats.totalPosted;
  
  await user.save();
};

module.exports = {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  restoreTransaction,
  getTransactionsByCard,
  getTransactionHistory,
  getDeletedTransactions,
  updateUserStats
};
