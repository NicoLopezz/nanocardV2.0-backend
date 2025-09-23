const express = require('express');
const router = express.Router();
const historyService = require('../services/historyService');
const { authenticateToken } = require('../middleware/auth');

// Endpoint para obtener historial por entidad
router.get('/entity/:entityType/:entityId', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { entityType, entityId } = req.params;
    const { limit = 50 } = req.query;
    
    const history = await historyService.getHistoryByEntity(entityType, entityId, parseInt(limit));
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ History fetched for ${entityType}:${entityId} in ${responseTime}ms`);
    
    res.json({
      success: true,
      entityType,
      entityId,
      history,
      count: history.length,
      responseTime: responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching entity history (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

// Endpoint para obtener historial por usuario
router.get('/user/:userId', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;
    
    // Verificar permisos: admin puede ver cualquier usuario, usuario estándar solo su propio historial
    if (req.user.role !== 'admin' && req.user.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. You can only view your own history.' 
      });
    }
    
    const history = await historyService.getHistoryByUser(userId, parseInt(limit));
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ User history fetched for ${userId} in ${responseTime}ms`);
    
    res.json({
      success: true,
      userId,
      history,
      count: history.length,
      responseTime: responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching user history (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

// Endpoint para obtener historial por categoría
router.get('/category/:category', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { category } = req.params;
    const { limit = 50 } = req.query;
    
    // Solo admin puede ver historial por categoría
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin role required.' 
      });
    }
    
    const history = await historyService.getHistoryByCategory(category, parseInt(limit));
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ Category history fetched for ${category} in ${responseTime}ms`);
    
    res.json({
      success: true,
      category,
      history,
      count: history.length,
      responseTime: responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching category history (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

// Endpoint para obtener estadísticas del historial
router.get('/stats', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Solo admin puede ver estadísticas
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin role required.' 
      });
    }
    
    const { timeRange = '24h' } = req.query;
    const stats = await historyService.getHistoryStats(timeRange);
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ History stats fetched in ${responseTime}ms`);
    
    res.json({
      success: true,
      timeRange,
      stats,
      responseTime: responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching history stats (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

// Endpoint para obtener historial reciente (últimas 24h)
router.get('/recent', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { limit = 100 } = req.query;
    
    // Solo admin puede ver historial reciente
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin role required.' 
      });
    }
    
    const { getHistoryModel } = require('../models/History');
    const History = getHistoryModel();
    
    const history = await History.find({})
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ Recent history fetched in ${responseTime}ms`);
    
    res.json({
      success: true,
      history,
      count: history.length,
      responseTime: responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching recent history (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

module.exports = router;
