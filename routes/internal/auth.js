const express = require('express');
const router = express.Router();
const { verifyLogin, refreshToken } = require('../../services/authService');
const { authenticateToken } = require('../../middleware/auth');

// Endpoint de login
router.post('/login', async (req, res) => {
  try {
    const { loginName, last4 } = req.body;
    
    // Validar datos de entrada
    if (!loginName || !last4) {
      return res.status(400).json({
        success: false,
        message: 'Login name and last4 are required'
      });
    }
    
    // Capturar toda la información posible del request
    const clientIp = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 
                     (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 
                     req.headers['x-real-ip'] || 'Unknown';
    
    const requestInfo = {
      method: req.method,
      endpoint: req.path,
      userAgent: req.get('User-Agent') || 'Unknown',
      ip: clientIp,
      origin: req.get('Origin') || 'Unknown',
      referer: req.get('Referer') || req.get('Referrer') || 'Unknown',
      acceptLanguage: req.get('Accept-Language') || 'Unknown',
      acceptEncoding: req.get('Accept-Encoding') || 'Unknown',
      accept: req.get('Accept') || 'Unknown',
      connection: req.get('Connection') || 'Unknown',
      host: req.get('Host') || 'Unknown',
      xForwardedFor: req.get('X-Forwarded-For') || null,
      xRealIp: req.get('X-Real-Ip') || null,
      xForwardedProto: req.get('X-Forwarded-Proto') || null,
      secFetchSite: req.get('Sec-Fetch-Site') || null,
      secFetchMode: req.get('Sec-Fetch-Mode') || null,
      secFetchUser: req.get('Sec-Fetch-User') || null,
      secChUa: req.get('Sec-Ch-Ua') || null,
      secChUaPlatform: req.get('Sec-Ch-Ua-Platform') || null,
      secChUaMobile: req.get('Sec-Ch-Ua-Mobile') || null
    };
    
    const result = await verifyLogin(loginName, last4, requestInfo);
    
    if (!result.success) {
      return res.status(401).json(result);
    }
    
    // Login exitoso
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        card: result.card,
        tokens: result.tokens
      }
    });
    
  } catch (error) {
    console.error('❌ Login endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// Endpoint para refrescar token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }
    
    const result = await refreshToken(token);
    
    if (!result.success) {
      return res.status(401).json(result);
    }
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        tokens: result.tokens
      }
    });
    
  } catch (error) {
    console.error('❌ Refresh token endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Token refresh failed',
      error: error.message
    });
  }
});

// Endpoint para verificar token (protegido)
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        userId: req.user.userId,
        cardId: req.user.cardId
      }
    });
  } catch (error) {
    console.error('❌ Verify token endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Token verification failed',
      error: error.message
    });
  }
});

// Endpoint de logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // En una implementación completa, aquí invalidarías el refresh token
    // Por ahora, solo confirmamos el logout
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('❌ Logout endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: error.message
    });
  }
});

module.exports = router;

