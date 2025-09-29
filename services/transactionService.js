const { getTransactionModel } = require('../models/Transaction');
const { getUserModel } = require('../models/User');
const { getCardModel } = require('../models/Card');
const EventService = require('./eventService');

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
  
  // Emitir evento para actualizar stats
  EventService.emitTransactionCreated(
    transactionData.userId, 
    transactionData.cardId, 
    transaction
  );
  
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
    
    // Emitir evento para actualizar stats
    EventService.emitTransactionUpdated(
      transaction.userId, 
      transaction.cardId, 
      transaction
    );
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
  
  // Emitir evento para actualizar stats
  EventService.emitTransactionDeleted(
    transaction.userId, 
    transaction.cardId, 
    transaction
  );
  
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
  
  // Emitir evento para actualizar stats
  EventService.emitTransactionRestored(
    transaction.userId, 
    transaction.cardId, 
    transaction
  );
  
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


// Obtener las últimas 10 transacciones con información del usuario y tarjeta
const getRecentTransactions = async (limit = 10) => {
  const startTime = Date.now();
  
  const Transaction = getTransactionModel();
  const User = getUserModel();
  const Card = getCardModel();
  
  // Obtener todas las transacciones y ordenar por fecha real de transacción
  const allTransactions = await Transaction.find({ isDeleted: false });
  
  // Función para convertir fecha y hora a objeto Date para ordenamiento
  const parseTransactionDateTime = (dateStr, timeStr) => {
    try {
      // dateStr formato: "DD/MM/YYYY", timeStr formato: "HH:MM AM/PM"
      const [day, month, year] = dateStr.split('/');
      
      // Parsear tiempo
      let [time, period] = timeStr.split(' ');
      let [hours, minutes] = time.split(':');
      hours = parseInt(hours);
      minutes = parseInt(minutes);
      
      if (period && period.toLowerCase().includes('p') && hours !== 12) {
        hours += 12;
      } else if (period && period.toLowerCase().includes('a') && hours === 12) {
        hours = 0;
      }
      
      return new Date(year, month - 1, day, hours, minutes);
    } catch (error) {
      console.error('Error parsing date:', dateStr, timeStr);
      return new Date(0); // Fecha muy antigua como fallback
    }
  };
  
  // Ordenar por fecha real de transacción (más reciente primero)
  const sortedTransactions = allTransactions.sort((a, b) => {
    const dateA = parseTransactionDateTime(a.date, a.time);
    const dateB = parseTransactionDateTime(b.date, b.time);
    return dateB - dateA; // Orden descendente (más reciente primero)
  });
  
  // Tomar solo el límite solicitado
  const transactions = sortedTransactions.slice(0, limit);
  
  // Enriquecer cada transacción con información del usuario y tarjeta
  const enrichedTransactions = await Promise.all(
    transactions.map(async (transaction) => {
      try {
        const [user, card] = await Promise.all([
          User.findById(transaction.userId),
          Card.findById(transaction.cardId)
        ]);
        
        return {
          transactionId: transaction._id,
          userId: transaction.userId,
          userName: transaction.userName || (user ? user.username : 'Unknown User'),
          cardId: transaction.cardId,
          cardName: transaction.cardName || (card ? card.name : 'Unknown Card'),
          last4: card ? card.last4 : '****',
          transactionDetails: {
            name: transaction.name,
            amount: transaction.amount,
            date: transaction.date,
            time: transaction.time,
            operation: transaction.operation,
            status: transaction.status,
            city: transaction.city,
            country: transaction.country,
            mcc_category: transaction.mcc_category,
            mercuryCategory: transaction.mercuryCategory,
            credit: transaction.credit,
            comentario: transaction.comentario
          },
          timestamp: transaction.createdAt
        };
      } catch (error) {
        console.error(`Error enriching transaction ${transaction._id}:`, error);
        return {
          transactionId: transaction._id,
          userId: transaction.userId,
          userName: transaction.userName || 'Unknown User',
          cardId: transaction.cardId,
          cardName: transaction.cardName || 'Unknown Card',
          last4: '****',
          transactionDetails: {
            name: transaction.name,
            amount: transaction.amount,
            date: transaction.date,
            time: transaction.time,
            operation: transaction.operation,
            status: transaction.status,
            city: transaction.city,
            country: transaction.country,
            mcc_category: transaction.mcc_category,
            mercuryCategory: transaction.mercuryCategory,
            credit: transaction.credit,
            comentario: transaction.comentario
          },
          timestamp: transaction.createdAt
        };
      }
    })
  );
  
  const queryDuration = Date.now() - startTime;
  
  return {
    queryDate: new Date().toISOString(),
    totalTransactions: enrichedTransactions.length,
    transactions: enrichedTransactions,
    metadata: {
      generatedAt: new Date().toISOString(),
      queryDuration: `${queryDuration}ms`,
      filters: {
        limit: limit,
        orderBy: 'date',
        order: 'desc',
        includeDeleted: false
      }
    }
  };
};

module.exports = {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  restoreTransaction,
  getTransactionsByCard,
  getTransactionHistory,
  getDeletedTransactions,
  getRecentTransactions
};
