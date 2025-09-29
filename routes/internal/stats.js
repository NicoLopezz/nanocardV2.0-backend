const express = require('express');
const router = express.Router();
const StatsRefreshService = require('../../services/statsRefreshService');
const { recalculateCardStats, getCardStats } = require('../../services/cardStatsService');

// Refrescar stats de un usuario específico
router.post('/users/:userId/refresh', async (req, res) => {
  try {
    const { userId } = req.params;
    const { cardId, transactionData, action } = req.body;
    
    if (cardId && transactionData && action) {
      await StatsRefreshService.refreshAllStats(userId, cardId, transactionData, action);
    } else {
      await StatsRefreshService.recalculateUserStats(userId);
    }
    
    res.json({ 
      success: true, 
      message: `Stats refreshed for user ${userId}` 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refrescar stats de una tarjeta específica
router.post('/cards/:cardId/refresh', async (req, res) => {
  try {
    const { cardId } = req.params;
    await StatsRefreshService.refreshCardStats(cardId);
    
    res.json({ 
      success: true, 
      message: `Stats refreshed for card ${cardId}` 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recalcular stats completas de un usuario
router.post('/users/:userId/recalculate', async (req, res) => {
  try {
    const { userId } = req.params;
    await StatsRefreshService.recalculateUserStats(userId);
    
    res.json({ 
      success: true, 
      message: `User stats recalculated for user ${userId}` 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recalcular stats de todas las tarjetas de un usuario
router.post('/users/:userId/cards/recalculate', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await StatsRefreshService.recalculateUserCardsStats(userId);
    
    res.json({ 
      success: true, 
      message: `User cards stats recalculated for user ${userId}`,
      result 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recalcular stats de una tarjeta específica
router.post('/cards/:cardId/recalculate', async (req, res) => {
  try {
    const { cardId } = req.params;
    const result = await StatsRefreshService.recalculateCardStats(cardId);
    
    res.json({ 
      success: true, 
      message: `Card stats recalculated for card ${cardId}`,
      result 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener stats de una tarjeta
router.get('/cards/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    const result = await getCardStats(cardId);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refrescar stats de múltiples usuarios (batch)
router.post('/users/batch/refresh', async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!Array.isArray(userIds)) {
      return res.status(400).json({ error: 'userIds must be an array' });
    }
    
    const results = [];
    
    for (const userId of userIds) {
      try {
        await StatsRefreshService.recalculateUserStats(userId);
        results.push({ userId, success: true });
      } catch (error) {
        results.push({ userId, success: false, error: error.message });
      }
    }
    
    res.json({ 
      success: true, 
      message: `Batch stats refresh completed`,
      results 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refrescar stats de múltiples tarjetas (batch)
router.post('/cards/batch/refresh', async (req, res) => {
  try {
    const { cardIds } = req.body;
    
    if (!Array.isArray(cardIds)) {
      return res.status(400).json({ error: 'cardIds must be an array' });
    }
    
    const results = [];
    
    for (const cardId of cardIds) {
      try {
        await StatsRefreshService.refreshCardStats(cardId);
        results.push({ cardId, success: true });
      } catch (error) {
        results.push({ cardId, success: false, error: error.message });
      }
    }
    
    res.json({ 
      success: true, 
      message: `Batch card stats refresh completed`,
      results 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
