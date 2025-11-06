const { getHistoryModel } = require('../models/History');
const { v4: uuidv4 } = require('uuid');

const historyService = {
  // Crear un evento de historial
  createEvent: async (eventData) => {
    try {
      const History = getHistoryModel();
      
      console.log('📝 Creating history event with metadata:', JSON.stringify(eventData.metadata || {}, null, 2));
      
      const historyEvent = new History({
        _id: uuidv4(),
        ...eventData,
        timestamp: new Date()
      });
      
      console.log('💾 History event before save:', JSON.stringify({
        eventType: historyEvent.eventType,
        entityType: historyEvent.entityType,
        entityId: historyEvent.entityId,
        metadata: historyEvent.metadata
      }, null, 2));
      
      await historyEvent.save();
      
      console.log('✅ History event saved successfully');
      console.log('📊 Saved metadata:', JSON.stringify(historyEvent.metadata || {}, null, 2));
      
      return historyEvent;
    } catch (error) {
      console.error('❌ Error creating history event:', error);
      console.error('❌ Event data:', JSON.stringify(eventData, null, 2));
      throw error;
    }
  },

  // Log de login exitoso
  logLoginSuccess: async (user, card, requestInfo) => {
    // Obtener nombre real del usuario (NUNCA usar ID)
    let userName = '';
    if (user.profile?.firstName || user.profile?.lastName) {
      userName = `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim();
    }
    // Si no tiene firstName/lastName, usar username SOLO si no es un ID
    if (!userName && user.username) {
      const isLikelyId = user.username.length > 20 && /^[a-zA-Z0-9]+$/.test(user.username);
      if (!isLikelyId) {
        userName = user.username;
      }
    }
    // Si aún no tenemos nombre, usar nombre de la tarjeta
    if (!userName && card?.name) {
      userName = card.name;
    }
    // Fallback final
    userName = userName || 'Unknown User';
    
    // Parsear información del dispositivo y navegador desde User-Agent
    let deviceInfo = {};
    let browserInfo = {};
    let osInfo = {};
    
    try {
      const UAParser = require('ua-parser-js');
      const parser = new UAParser(requestInfo.userAgent || '');
      const result = parser.getResult();
      
      deviceInfo = {
        type: result.device?.type || 'Unknown',
        vendor: result.device?.vendor || 'Unknown',
        model: result.device?.model || 'Unknown'
      };
      
      browserInfo = {
        name: result.browser?.name || 'Unknown',
        version: result.browser?.version || 'Unknown',
        major: result.browser?.major || 'Unknown'
      };
      
      osInfo = {
        name: result.os?.name || 'Unknown',
        version: result.os?.version || 'Unknown'
      };
    } catch (error) {
      console.error('❌ Error parsing user agent:', error);
    }
    
    // Construir metadata completo con toda la información
    const metadata = {
      loginMethod: 'card',
      cardLast4: card.last4,
      cardName: card.name,
      device: {
        type: deviceInfo.type,
        vendor: deviceInfo.vendor,
        model: deviceInfo.model,
        isMobile: deviceInfo.type === 'mobile' || deviceInfo.type === 'tablet'
      },
      browser: {
        name: browserInfo.name,
        version: browserInfo.version,
        major: browserInfo.major
      },
      os: {
        name: osInfo.name,
        version: osInfo.version
      },
      network: {
        ip: requestInfo.ip || 'Unknown',
        origin: requestInfo.origin || 'Unknown',
        referer: requestInfo.referer || 'Unknown',
        host: requestInfo.host || 'Unknown',
        xForwardedFor: requestInfo.xForwardedFor || null,
        xRealIp: requestInfo.xRealIp || null,
        xForwardedProto: requestInfo.xForwardedProto || null
      },
      headers: {
        acceptLanguage: requestInfo.acceptLanguage || 'Unknown',
        acceptEncoding: requestInfo.acceptEncoding || 'Unknown',
        accept: requestInfo.accept || 'Unknown',
        connection: requestInfo.connection || 'Unknown',
        secFetchSite: requestInfo.secFetchSite || null,
        secFetchMode: requestInfo.secFetchMode || null,
        secFetchUser: requestInfo.secFetchUser || null,
        secChUa: requestInfo.secChUa || null,
        secChUaPlatform: requestInfo.secChUaPlatform || null,
        secChUaMobile: requestInfo.secChUaMobile || null
      },
      rawUserAgent: requestInfo.userAgent || 'Unknown'
    };
    
    return await historyService.createEvent({
      eventType: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user._id,
      userId: user._id,
      userRole: user.role,
      userEmail: user.email,
      userName: userName,
      action: 'authenticated',
      category: 'authentication',
      severity: 'low',
      description: `User ${userName} logged in successfully`,
      metadata: metadata,
      requestInfo: {
        method: requestInfo.method || 'POST',
        endpoint: requestInfo.endpoint || '/api/auth/login',
        statusCode: requestInfo.statusCode || 200,
        responseTime: requestInfo.responseTime || 0
      },
      ipAddress: requestInfo.ip || 'Unknown',
      userAgent: requestInfo.userAgent || 'Unknown'
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
  logCRUDOperation: async (eventType, entityType, entityId, user, changes, metadata = {}, requestInfo) => {
    // Mapear eventType a action válido
    const getActionFromEventType = (eventType) => {
      if (eventType.includes('CREATED')) return 'created';
      if (eventType.includes('UPDATED')) return 'updated';
      if (eventType.includes('DELETED')) return 'deleted';
      if (eventType.includes('RESTORED')) return 'restored';
      if (eventType.includes('LOGIN')) return 'authenticated';
      return 'viewed';
    };
    
    return await historyService.createEvent({
      eventType: eventType,
      entityType: entityType,
      entityId: entityId,
      userId: user.userId,
      userRole: user.role,
      userEmail: user.email,
      userName: user.username,
      action: getActionFromEventType(eventType),
      category: 'data_operation',
      severity: 'low',
      description: `${entityType} ${eventType.toLowerCase().replace('_', ' ')} by ${user.username}`,
      changes: changes,
      metadata: metadata,
      requestInfo: requestInfo
    });
  },

  // Log de transacciones específicas
  logTransactionUpdate: async (transaction, user, changes, requestInfo, additionalMetadata = {}) => {
    // Obtener nombre real del usuario (NUNCA usar ID)
    let userName = '';
    if (user.profile?.firstName || user.profile?.lastName) {
      userName = `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim();
    }
    if (!userName && user.username) {
      const isLikelyId = user.username.length > 20 && /^[a-zA-Z0-9]+$/.test(user.username);
      if (!isLikelyId) {
        userName = user.username;
      }
    }
    userName = userName || 'Unknown User';
    
    return await historyService.createEvent({
      eventType: 'TRANSACTION_UPDATED',
      entityType: 'Transaction',
      entityId: transaction._id,
      userId: user.userId || user._id,
      userRole: user.role,
      userEmail: user.email,
      userName: userName,
      action: 'updated',
      category: 'data_operation',
      severity: 'medium',
      description: `Transaction ${transaction.name || transaction._id} (${transaction.operation || 'N/A'}) updated by ${userName}`,
      changes: changes,
      metadata: {
        transactionId: transaction._id,
        transactionName: transaction.name,
        transactionAmount: transaction.amount,
        transactionOperation: transaction.operation,
        transactionStatus: transaction.status,
        cardId: transaction.cardId,
        cardLast4: transaction.cardLast4 || null,
        ...additionalMetadata
      },
      requestInfo: requestInfo
    });
  },

  // Log de eliminación de transacciones
  logTransactionDelete: async (transaction, user, requestInfo, additionalMetadata = {}) => {
    // Obtener nombre real del usuario (NUNCA usar ID)
    let userName = '';
    if (user.profile?.firstName || user.profile?.lastName) {
      userName = `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim();
    }
    if (!userName && user.username) {
      const isLikelyId = user.username.length > 20 && /^[a-zA-Z0-9]+$/.test(user.username);
      if (!isLikelyId) {
        userName = user.username;
      }
    }
    userName = userName || 'Unknown User';
    
    return await historyService.createEvent({
      eventType: 'TRANSACTION_DELETED',
      entityType: 'Transaction',
      entityId: transaction._id,
      userId: user.userId || user._id,
      userRole: user.role,
      userEmail: user.email,
      userName: userName,
      action: 'deleted',
      category: 'data_operation',
      severity: 'medium',
      description: `Transaction ${transaction.name || transaction._id} (${transaction.operation || 'N/A'}) deleted by ${userName}`,
      changes: [{
        field: 'status',
        oldValue: transaction.status,
        newValue: 'DELETED'
      }],
      metadata: {
        transactionId: transaction._id,
        transactionName: transaction.name,
        transactionAmount: transaction.amount,
        transactionOperation: transaction.operation,
        transactionStatus: 'DELETED',
        cardId: transaction.cardId,
        cardLast4: transaction.cardLast4 || null,
        ...additionalMetadata
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
