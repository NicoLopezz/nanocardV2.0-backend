const express = require('express');
const router = express.Router();
const { importAllCardsFromCryptoMate, fetchCardsFromCryptoMate } = require('../../../services/cryptomateService');

// Importar todas las tarjetas desde CryptoMate
router.post('/import', async (req, res) => {
  try {
    console.log('🚀 Starting import from CryptoMate...');
    const result = await importAllCardsFromCryptoMate();
    res.json(result);
  } catch (error) {
    console.error('❌ Import error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Import failed', 
      message: error.message 
    });
  }
});

// Obtener tarjetas desde CryptoMate (sin importar)
router.get('/cards', async (req, res) => {
  try {
    const cards = await fetchCardsFromCryptoMate();
    res.json({ 
      success: true, 
      cards: cards,
      count: cards.length 
    });
  } catch (error) {
    console.error('❌ Fetch cards error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch cards', 
      message: error.message 
    });
  }
});

// Health check específico para CryptoMate
router.get('/health', async (req, res) => {
  try {
    // Intentar hacer una petición simple a CryptoMate para verificar conectividad
    const cards = await fetchCardsFromCryptoMate();
    res.json({ 
      success: true, 
      message: 'CryptoMate connection OK',
      cardsCount: cards.length 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'CryptoMate connection failed',
      error: error.message 
    });
  }
});

// Debug endpoint para verificar credenciales
router.get('/debug', async (req, res) => {
  try {
    const apiKey = process.env.MERCURY_API_KEY || 'your-mercury-api-key-here';
    const authToken = process.env.MERCURY_AUTH_TOKEN || 'Bearer your-mercury-auth-token-here';
    
    // Probar diferentes formatos de headers
    const testConfigs = [
      {
        name: "Original format",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "Authorization": authToken,
        }
      },
      {
        name: "Only API Key",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        }
      },
      {
        name: "Only Authorization",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authToken,
        }
      },
      {
        name: "API Key as Authorization",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        }
      }
    ];
    
    const results = [];
    
    for (const config of testConfigs) {
      try {
        const response = await fetch(
          "https://api.cryptomate.me/cards/virtual-cards/list",
          {
            method: "GET",
            headers: config.headers,
          }
        );
        
        results.push({
          config: config.name,
          status: response.status,
          statusText: response.statusText,
          success: response.status === 200
        });
      } catch (error) {
        results.push({
          config: config.name,
          error: error.message,
          success: false
        });
      }
    }
    
    res.json({
      success: true,
      debug: {
        apiKey: apiKey.substring(0, 20) + '...',
        authToken: authToken.substring(0, 20) + '...',
        tests: results
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Debug failed',
      error: error.message 
    });
  }
});

module.exports = router;
