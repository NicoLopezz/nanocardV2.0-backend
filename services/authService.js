const jwt = require('jsonwebtoken');
const { getAuthModel } = require('../models/Auth');
const { getCardModel } = require('../models/Card');
const { getUserModel } = require('../models/User');
const config = require('../config/environment');
const historyService = require('./historyService');

// Función para normalizar nombres (ignorar mayúsculas, espacios al inicio/final)
const normalizeName = (name) => {
  if (!name) return '';
  return name.trim().toLowerCase();
};

// Función para generar tokens JWT
const generateTokens = (userId, cardId) => {
  const payload = {
    userId,
    cardId,
    iat: Math.floor(Date.now() / 1000)
  };
  
  const accessToken = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRE || '24h'
  });
  
  const refreshToken = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: '7d'
  });
  
  return { accessToken, refreshToken };
};

// Función para verificar login - OPTIMIZADA
const verifyLogin = async (loginName, last4, requestInfo = {}) => {
  const startTime = Date.now();
  
  try {
    const Card = getCardModel();
    const User = getUserModel();
    const Auth = getAuthModel();
    
    // Normalizar el nombre de login
    const normalizedLoginName = normalizeName(loginName);
    
    console.log(`🔐 Attempting login with: "${loginName}" -> "${normalizedLoginName}" and last4: "${last4}"`);
    
    // OPTIMIZACIÓN: Buscar tarjeta con lean() para mejor rendimiento
    const card = await Card.findOne({ last4: last4 }).lean();
    
    if (!card) {
      console.log(`❌ Card not found with last4: ${last4}`);
      
      // Log login failed
      await historyService.logLoginFailed(loginName, last4, 'Card not found', {
        method: 'POST',
        endpoint: '/api/auth/login',
        statusCode: 401,
        responseTime: Date.now() - startTime,
        ...requestInfo
      });
      
      return { success: false, message: 'Invalid credentials' };
    }
    
    // Normalizar el nombre de la tarjeta
    const normalizedCardName = normalizeName(card.name);
    
    console.log(`🔍 Found card: "${card.name}" -> "${normalizedCardName}"`);
    
    // Verificar si los nombres coinciden (normalizados)
    if (normalizedCardName !== normalizedLoginName) {
      console.log(`❌ Name mismatch: "${normalizedLoginName}" != "${normalizedCardName}"`);
      
      // Log login failed
      await historyService.logLoginFailed(loginName, last4, 'Name mismatch', {
        method: 'POST',
        endpoint: '/api/auth/login',
        statusCode: 401,
        responseTime: Date.now() - startTime,
        ...requestInfo
      });
      
      return { success: false, message: 'Invalid credentials' };
    }
    
    // Obtener usuario con lean() para mejor rendimiento
    const user = await User.findById(card.userId).lean();
    if (!user) {
      console.log(`❌ User not found for card: ${card._id}`);
      return { success: false, message: 'User not found' };
    }
    
    // Crear o actualizar registro de autenticación
    let authRecord = await Auth.findById(card.userId);
    if (!authRecord) {
      authRecord = new Auth({
        _id: card.userId,
        userId: card.userId,
        cardId: card._id,
        loginName: normalizedLoginName,
        last4: last4
      });
    } else {
      authRecord.lastLogin = new Date();
      authRecord.loginCount += 1;
      authRecord.loginName = normalizedLoginName;
      authRecord.last4 = last4;
    }
    
    await authRecord.save();
    
    // Generar tokens
    const { accessToken, refreshToken } = generateTokens(card.userId, card._id);
    
    // Guardar refresh token
    authRecord.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
    });
    
    // Limpiar tokens expirados (mantener solo los últimos 5)
    authRecord.refreshTokens = authRecord.refreshTokens
      .filter(token => token.expiresAt > new Date())
      .slice(-5);
    
    await authRecord.save();
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ Login successful for user: ${card.userId} (${card.name}) in ${responseTime}ms`);
    
    // Log login success
    await historyService.logLoginSuccess(user, card, {
      method: 'POST',
      endpoint: '/api/auth/login',
      statusCode: 200,
      responseTime: responseTime,
      ...requestInfo
    });
    
    return {
      success: true,
      message: 'Login successful',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile: user.profile
      },
      card: {
        _id: card._id,
        name: card.name,
        last4: card.last4,
        status: card.status,
        deposited: card.deposited,
        refunded: card.refunded,
        posted: card.posted,
        available: card.available
      },
      tokens: {
        accessToken,
        refreshToken
      },
      responseTime: responseTime
    };
    
  } catch (error) {
    console.error('❌ Login error:', error);
    return { success: false, message: 'Login failed', error: error.message };
  }
};

// Función para verificar token JWT
const verifyToken = async (token) => {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    return { success: true, decoded };
  } catch (error) {
    return { success: false, message: 'Invalid token', error: error.message };
  }
};

// Función para refrescar token
const refreshToken = async (refreshToken) => {
  try {
    const Auth = getAuthModel();
    
    // Verificar si el refresh token existe y no ha expirado
    const authRecord = await Auth.findOne({
      'refreshTokens.token': refreshToken,
      'refreshTokens.expiresAt': { $gt: new Date() }
    });
    
    if (!authRecord) {
      return { success: false, message: 'Invalid refresh token' };
    }
    
    // Generar nuevos tokens
    const { accessToken, newRefreshToken } = generateTokens(authRecord.userId, authRecord.cardId);
    
    // Actualizar refresh token
    authRecord.refreshTokens = authRecord.refreshTokens.map(token => 
      token.token === refreshToken 
        ? { ...token, token: newRefreshToken, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
        : token
    );
    
    await authRecord.save();
    
    return {
      success: true,
      tokens: {
        accessToken,
        refreshToken: newRefreshToken
      }
    };
    
  } catch (error) {
    console.error('❌ Refresh token error:', error);
    return { success: false, message: 'Token refresh failed', error: error.message };
  }
};

module.exports = {
  verifyLogin,
  verifyToken,
  refreshToken,
  normalizeName
};
