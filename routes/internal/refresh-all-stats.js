const express = require('express');
const router = express.Router();
const { getCardModel } = require('../../models/Card');
const StatsRefreshService = require('../../services/statsRefreshService');

// Middleware para verificar que el usuario sea admin (bypass de autenticación)
const requireAdmin = async (req, res, next) => {
  try {
    const user = {
      _id: 'admin-system',
      username: 'system-admin',
      email: 'admin@system.com',
      role: 'admin'
    };
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Access denied' });
  }
};

// 🔄 Endpoint para refrescar stats de TODAS las cards del sistema
router.post('/admin/refresh-all-stats', requireAdmin, async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Verificar que el usuario sea admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin role required.' 
      });
    }

    console.log('🚀 Starting global stats refresh for ALL cards...');
    
    // Obtener todas las cards del sistema
    const Card = getCardModel();
    const allCards = await Card.find({}).select('_id name supplier status');
    
    if (allCards.length === 0) {
      return res.json({
        success: true,
        message: 'No cards found in the system',
        totalCards: 0,
        processedCards: 0,
        responseTime: Date.now() - startTime
      });
    }

    console.log(`📊 Found ${allCards.length} cards to refresh`);
    
    // Procesar en lotes para evitar sobrecarga
    const batchSize = 10; // Procesar 10 cards a la vez
    const batches = [];
    for (let i = 0; i < allCards.length; i += batchSize) {
      batches.push(allCards.slice(i, i + batchSize));
    }
    
    let processedCards = 0;
    let successfulCards = 0;
    let failedCards = 0;
    const errors = [];
    
    console.log(`🔄 Processing ${batches.length} batches of ${batchSize} cards each...`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} cards)`);
      
      // Procesar batch en paralelo
      const batchPromises = batch.map(async (card) => {
        try {
          console.log(`   🔄 Refreshing stats for card: ${card.name} (${card._id})`);
          await StatsRefreshService.refreshCardStats(card._id);
          successfulCards++;
          console.log(`   ✅ Stats refreshed for: ${card.name}`);
        } catch (error) {
          failedCards++;
          const errorMsg = `Card ${card.name} (${card._id}): ${error.message}`;
          errors.push(errorMsg);
          console.error(`   ❌ Error refreshing stats for ${card.name}:`, error.message);
        }
        processedCards++;
      });
      
      // Esperar a que termine el batch actual
      await Promise.all(batchPromises);
      
      // Pequeña pausa entre batches para no sobrecargar
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    console.log(`\n✅ Global stats refresh completed!`);
    console.log(`📊 Total cards: ${allCards.length}`);
    console.log(`✅ Successful: ${successfulCards}`);
    console.log(`❌ Failed: ${failedCards}`);
    console.log(`⏱️  Total time: ${responseTime}ms`);
    
    res.json({
      success: true,
      message: 'Global stats refresh completed',
      totalCards: allCards.length,
      processedCards: processedCards,
      successfulCards: successfulCards,
      failedCards: failedCards,
      errors: errors.length > 0 ? errors : null,
      responseTime: responseTime,
      averageTimePerCard: Math.round(responseTime / allCards.length)
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('❌ Error in global stats refresh:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      responseTime: responseTime 
    });
  }
});

// 🔄 Endpoint para refrescar stats de cards por supplier
router.post('/admin/refresh-stats-by-supplier', requireAdmin, async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Verificar que el usuario sea admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin role required.' 
      });
    }

    const { supplier } = req.body;
    
    if (!supplier) {
      return res.status(400).json({
        success: false,
        error: 'Supplier parameter is required (cryptomate, mercury, or all)'
      });
    }

    console.log(`🚀 Starting stats refresh for ${supplier} cards...`);
    
    // Obtener cards por supplier
    const Card = getCardModel();
    let query = {};
    
    if (supplier !== 'all') {
      query.supplier = supplier;
    }
    
    const cards = await Card.find(query).select('_id name supplier status');
    
    if (cards.length === 0) {
      return res.json({
        success: true,
        message: `No cards found for supplier: ${supplier}`,
        totalCards: 0,
        processedCards: 0,
        responseTime: Date.now() - startTime
      });
    }

    console.log(`📊 Found ${cards.length} ${supplier} cards to refresh`);
    
    // Procesar en lotes
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < cards.length; i += batchSize) {
      batches.push(cards.slice(i, i + batchSize));
    }
    
    let processedCards = 0;
    let successfulCards = 0;
    let failedCards = 0;
    const errors = [];
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} cards)`);
      
      const batchPromises = batch.map(async (card) => {
        try {
          await StatsRefreshService.refreshCardStats(card._id);
          successfulCards++;
        } catch (error) {
          failedCards++;
          errors.push(`Card ${card.name} (${card._id}): ${error.message}`);
        }
        processedCards++;
      });
      
      await Promise.all(batchPromises);
      
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      success: true,
      message: `Stats refresh completed for ${supplier} cards`,
      supplier: supplier,
      totalCards: cards.length,
      processedCards: processedCards,
      successfulCards: successfulCards,
      failedCards: failedCards,
      errors: errors.length > 0 ? errors : null,
      responseTime: responseTime
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('❌ Error in supplier stats refresh:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      responseTime: responseTime 
    });
  }
});

module.exports = router;
