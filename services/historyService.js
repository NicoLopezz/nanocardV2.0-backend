const { getHistoryModel } = require('../models/History');
const { v4: uuidv4 } = require('uuid');

const historyService = {
  // Crear un evento de historial
  createEvent: async (eventData) => {
    try {
      const History = getHistoryModel();
      
      const historyEvent = new History({
        _id: uuidv4(),
        ...eventData,
        timestamp: new Date()
      });
      
      await historyEvent.save();
      return historyEvent;
    } catch (error) {
      console.error('❌ Error creating history event:', error);
      throw error;
    }
  },

  // Log de login exitoso
  logLoginSuccess: async (user, card, requestInfo) => {
    return await historyService.createEvent({
      eventType: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user._id,
      userId: user._id,
      userRole: user.role,
      userEmail: user.email,
      userName: `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || user.username,
      action: 'authenticated',
      category: 'authentication',
      severity: 'low',
      description: `User ${user.username} logged in successfully`,
      metadata: {
        loginMethod: 'card',
        cardLast4: card.last4,
        cardName: card.name
      },
      requestInfo: requestInfo
    });
  },

  // Log de login fallido
  logLoginFailed: async (loginName, last4, reason, requestInfo) => {
    return await historyService.createEvent({
      eventType: 'LOGIN_FAILED',
      entityType: 'User',
      entityId: null,
      userId: null,
      userRole: null,
      userEmail: null,
      userName: loginName,
      action: 'failed',
      category: 'authentication',
      severity: 'medium',
      description: `Failed login attempt for ${loginName}`,
      metadata: {
        loginMethod: 'card',
        loginAttempts: 1,
        errorMessage: reason
      },
      requestInfo: requestInfo
    });
  },

  // Log de operaciones CRUD
  logCRUDOperation: async (eventType, entityType, entityId, user, changes, requestInfo) => {
    return await historyService.createEvent({
      eventType: eventType,
      entityType: entityType,
      entityId: entityId,
      userId: user.userId,
      userRole: user.role,
      userEmail: user.email,
      userName: user.username,
      action: eventType.toLowerCase().replace('_', ''),
      category: 'data_operation',
      severity: 'low',
      description: `${entityType} ${eventType.toLowerCase().replace('_', ' ')} by ${user.username}`,
      changes: changes,
      requestInfo: requestInfo
    });
  },

  // Log de transacciones específicas
  logTransactionUpdate: async (transaction, user, changes, requestInfo) => {
    return await historyService.createEvent({
      eventType: 'TRANSACTION_UPDATED',
      entityType: 'Transaction',
      entityId: transaction._id,
      userId: user.userId,
      userRole: user.role,
      userEmail: user.email,
      userName: user.username,
      action: 'updated',
      category: 'data_operation',
      severity: 'medium',
      description: `Transaction ${transaction.name} updated by ${user.username}`,
      changes: changes,
      metadata: {
        transactionAmount: transaction.amount,
        transactionStatus: transaction.status,
        cardLast4: transaction.cardId
      },
      requestInfo: requestInfo
    });
  },

  // Log de eliminación de transacciones
  logTransactionDelete: async (transaction, user, requestInfo) => {
    return await historyService.createEvent({
      eventType: 'TRANSACTION_DELETED',
      entityType: 'Transaction',
      entityId: transaction._id,
      userId: user.userId,
      userRole: user.role,
      userEmail: user.email,
      userName: user.username,
      action: 'deleted',
      category: 'data_operation',
      severity: 'high',
      description: `Transaction ${transaction.name} deleted by ${user.username}`,
      changes: [{
        field: 'status',
        oldValue: transaction.status,
        newValue: 'DELETED',
        dataType: 'string'
      }],
      metadata: {
        transactionAmount: transaction.amount,
        transactionStatus: 'DELETED',
        cardLast4: transaction.cardId
      },
      requestInfo: requestInfo
    });
  },

  // Log de operaciones de caché
  logCacheOperation: async (operation, user, cacheKey, requestInfo) => {
    return await historyService.createEvent({
      eventType: operation === 'clear' ? 'CACHE_CLEARED' : 'CACHE_INVALIDATED',
      entityType: 'Cache',
      entityId: cacheKey,
      userId: user.userId,
      userRole: user.role,
      userEmail: user.email,
      userName: user.username,
      action: 'updated',
      category: 'system',
      severity: 'low',
      description: `Cache ${operation} by ${user.username}`,
      metadata: {
        cacheKey: cacheKey
      },
      requestInfo: requestInfo
    });
  },

  // Log de errores del sistema
  logSystemError: async (error, requestInfo, user = null) => {
    return await historyService.createEvent({
      eventType: 'SYSTEM_ERROR',
      entityType: 'System',
      entityId: null,
      userId: user?.userId || null,
      userRole: user?.role || null,
      userEmail: user?.email || null,
      userName: user?.username || 'System',
      action: 'failed',
      category: 'system',
      severity: 'critical',
      description: `System error: ${error.message}`,
      metadata: {
        errorCode: error.code,
        errorMessage: error.message
      },
      requestInfo: requestInfo
    });
  },

  // Log de permisos denegados
  logPermissionDenied: async (user, resource, action, requestInfo) => {
    return await historyService.createEvent({
      eventType: 'PERMISSION_DENIED',
      entityType: 'System',
      entityId: null,
      userId: user.userId,
      userRole: user.role,
      userEmail: user.email,
      userName: user.username,
      action: 'failed',
      category: 'authorization',
      severity: 'high',
      description: `Permission denied for ${user.username} to ${action} ${resource}`,
      requestInfo: requestInfo
    });
  },

  // Obtener historial por entidad
  getHistoryByEntity: async (entityType, entityId, limit = 50) => {
    try {
      const History = getHistoryModel();
      return await History.find({ entityType, entityId })
        .sort({ timestamp: -1 })
        .limit(limit);
    } catch (error) {
      console.error('❌ Error fetching history:', error);
      throw error;
    }
  },

  // Obtener historial por usuario
  getHistoryByUser: async (userId, limit = 50) => {
    try {
      const History = getHistoryModel();
      return await History.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit);
    } catch (error) {
      console.error('❌ Error fetching user history:', error);
      throw error;
    }
  },

  // Obtener historial por categoría
  getHistoryByCategory: async (category, limit = 50) => {
    try {
      const History = getHistoryModel();
      return await History.find({ category })
        .sort({ timestamp: -1 })
        .limit(limit);
    } catch (error) {
      console.error('❌ Error fetching category history:', error);
      throw error;
    }
  },

  // Obtener estadísticas del historial
  getHistoryStats: async (timeRange = '24h') => {
    try {
      const History = getHistoryModel();
      const now = new Date();
      const timeRangeMs = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };
      
      const startTime = new Date(now.getTime() - timeRangeMs[timeRange]);
      
      const stats = await History.aggregate([
        { $match: { timestamp: { $gte: startTime } } },
        {
          $group: {
            _id: null,
            totalEvents: { $sum: 1 },
            loginSuccess: { $sum: { $cond: [{ $eq: ['$eventType', 'LOGIN_SUCCESS'] }, 1, 0] } },
            loginFailed: { $sum: { $cond: [{ $eq: ['$eventType', 'LOGIN_FAILED'] }, 1, 0] } },
            transactionsUpdated: { $sum: { $cond: [{ $eq: ['$eventType', 'TRANSACTION_UPDATED'] }, 1, 0] } },
            transactionsDeleted: { $sum: { $cond: [{ $eq: ['$eventType', 'TRANSACTION_DELETED'] }, 1, 0] } },
            systemErrors: { $sum: { $cond: [{ $eq: ['$eventType', 'SYSTEM_ERROR'] }, 1, 0] } },
            permissionDenied: { $sum: { $cond: [{ $eq: ['$eventType', 'PERMISSION_DENIED'] }, 1, 0] } }
          }
        }
      ]);
      
      return stats[0] || {
        totalEvents: 0,
        loginSuccess: 0,
        loginFailed: 0,
        transactionsUpdated: 0,
        transactionsDeleted: 0,
        systemErrors: 0,
        permissionDenied: 0
      };
    } catch (error) {
      console.error('❌ Error fetching history stats:', error);
      throw error;
    }
  }
};

module.exports = historyService;
