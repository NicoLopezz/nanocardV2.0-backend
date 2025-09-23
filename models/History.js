const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  _id: String, // ID único del evento
  
  // Información del evento
  eventType: {
    type: String,
    enum: [
      // Autenticación
      'LOGIN_SUCCESS',
      'LOGIN_FAILED',
      'LOGOUT',
      'TOKEN_REFRESH',
      'TOKEN_EXPIRED',
      
      // CRUD Operations
      'CREATE',
      'READ',
      'UPDATE',
      'DELETE',
      'RESTORE',
      
      // Transacciones específicas
      'TRANSACTION_CREATED',
      'TRANSACTION_UPDATED',
      'TRANSACTION_DELETED',
      'TRANSACTION_RESTORED',
      'TRANSACTION_APPROVED',
      'TRANSACTION_REJECTED',
      'TRANSACTION_REFUNDED',
      
      // Tarjetas específicas
      'CARD_CREATED',
      'CARD_UPDATED',
      'CARD_DELETED',
      'CARD_SUSPENDED',
      'CARD_ACTIVATED',
      
      // Usuarios específicos
      'USER_CREATED',
      'USER_UPDATED',
      'USER_DELETED',
      'USER_ROLE_CHANGED',
      'USER_ACTIVATED',
      'USER_DEACTIVATED',
      
      // Sistema
      'CACHE_INVALIDATED',
      'CACHE_CLEARED',
      'SYSTEM_ERROR',
      'PERMISSION_DENIED',
      'RATE_LIMIT_EXCEEDED'
    ],
    required: true
  },
  
  // Entidad afectada
  entityType: {
    type: String,
    enum: ['User', 'Card', 'Transaction', 'Auth', 'System', 'Cache'],
    required: true
  },
  
  entityId: String, // ID de la entidad afectada
  
  // Usuario que realizó la acción
  userId: String, // ID del usuario que hizo la acción
  userRole: String, // Rol del usuario (admin, standard)
  userEmail: String, // Email del usuario (para auditoría)
  userName: String, // Nombre del usuario
  
  // Información de la sesión
  sessionId: String, // ID de la sesión
  ipAddress: String, // IP del usuario
  userAgent: String, // User agent del navegador
  
  // Detalles del cambio
  action: {
    type: String,
    enum: ['created', 'updated', 'deleted', 'restored', 'viewed', 'authenticated', 'failed'],
    required: true
  },
  
  // Cambios específicos
  changes: [{
    field: String, // Campo modificado
    oldValue: mongoose.Schema.Types.Mixed, // Valor anterior
    newValue: mongoose.Schema.Types.Mixed, // Valor nuevo
    dataType: String // Tipo de dato (string, number, boolean, object, array)
  }],
  
  // Metadatos del evento
  metadata: {
    // Para transacciones
    transactionAmount: Number,
    transactionStatus: String,
    cardLast4: String,
    
    // Para tarjetas
    cardName: String,
    cardStatus: String,
    
    // Para usuarios
    userRole: String,
    userStatus: String,
    
    // Para sistema
    errorCode: String,
    errorMessage: String,
    responseTime: Number,
    cacheKey: String,
    
    // Para autenticación
    loginMethod: String, // 'card', 'email', 'username'
    loginAttempts: Number,
    lastLoginDate: Date
  },
  
  // Información de la request
  requestInfo: {
    method: String, // GET, POST, PUT, DELETE
    endpoint: String, // /api/cards/admin/all
    statusCode: Number, // 200, 404, 500
    responseTime: Number, // Tiempo de respuesta en ms
    requestSize: Number, // Tamaño del request en bytes
    responseSize: Number // Tamaño de la respuesta en bytes
  },
  
  // Severidad del evento
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
 // Categoría del evento
  category: {
    type: String,
    enum: ['authentication', 'authorization', 'data_operation', 'system', 'security', 'performance'],
    required: true
  },
  
  // Descripción legible del evento
  description: String, // "User updated transaction amount from $100 to $150"
  
  // Razón del cambio
  reason: String, // "Customer requested refund"
  
  // Timestamps
  timestamp: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Índices para optimizar consultas
historySchema.index({ eventType: 1, timestamp: -1 });
historySchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
historySchema.index({ userId: 1, timestamp: -1 });
historySchema.index({ category: 1, severity: 1, timestamp: -1 });
historySchema.index({ timestamp: -1 });

// Función para obtener el modelo después de la conexión
const getHistoryModel = () => {
  const { databases } = require('../config/database');
  return databases.history.connection.model('History', historySchema);
};

module.exports = { getHistoryModel };
