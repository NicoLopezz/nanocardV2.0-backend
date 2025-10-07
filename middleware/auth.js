const { verifyToken } = require('../services/authService');
const { getUserModel } = require('../models/User');

// Middleware para verificar autenticación
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }
    
    const result = await verifyToken(token);
    
    if (!result.success) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token',
        error: result.message
      });
    }
    
    // Obtener información completa del usuario de la base de datos (optimizado)
    const User = getUserModel();
    const user = await User.findById(result.decoded.userId).lean().maxTimeMS(15000);
    
    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Agregar información completa del usuario a la request
    req.user = {
      userId: result.decoded.userId,
      cardId: result.decoded.cardId,
      role: user.role,
      username: user.username,
      email: user.email,
      profile: user.profile
    };
    
    next();
    
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message
    });
  }
};

// Middleware opcional (no requiere autenticación pero la usa si está presente)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      const result = await verifyToken(token);
      if (result.success) {
        req.user = {
          userId: result.decoded.userId,
          cardId: result.decoded.cardId
        };
      }
    }
    
    next();
    
  } catch (error) {
    // En caso de error, continuar sin autenticación
    next();
  }
};

module.exports = {
  authenticateToken,
  optionalAuth
};
