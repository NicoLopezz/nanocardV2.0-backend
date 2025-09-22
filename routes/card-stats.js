const express = require('express');
const router = express.Router();
const { recalculateCardStats, getCardStats, recalculateAllCardStats } = require('../services/cardStatsService');

// Recalcular estadísticas de una tarjeta específica
router.post('/recalculate/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    const result = await recalculateCardStats(cardId);
    res.json(result);
  } catch (error) {
    console.error('❌ Error in /api/card-stats/recalculate:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to recalculate card stats', 
      message: error.message 
    });
  }
});

// Obtener estadísticas de una tarjeta específica
router.get('/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    const result = await getCardStats(cardId);
    res.json(result);
  } catch (error) {
    console.error('❌ Error in /api/card-stats/:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get card stats', 
      message: error.message 
    });
  }
});

// Recalcular estadísticas de todas las tarjetas
router.post('/recalculate-all', async (req, res) => {
  try {
    const result = await recalculateAllCardStats();
    res.json(result);
  } catch (error) {
    console.error('❌ Error in /api/card-stats/recalculate-all:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to recalculate all card stats', 
      message: error.message 
    });
  }
});

module.exports = router;

