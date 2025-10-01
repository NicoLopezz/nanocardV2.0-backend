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
    
    // Verificar credenciales con información de request
    const requestInfo = {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      origin: req.get('Origin')
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

