const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const router = express.Router();

// Endpoint para probar CryptoMate usando curl directamente
router.get('/test-curl', async (req, res) => {
  try {
    const curlCommand = `curl --location 'https://api.cryptomate.me/cards/virtual-cards/list' --header 'x-api-key: api-45f14849-914c-420e-a788-2e969d92bd5d' --header 'Content-Type: application/json' --header 'Cookie: JSESSIONID=7216B94569B249C7E74CF7409C99C656'`;
    
    console.log('🚀 Executing curl command...');
    const { stdout, stderr } = await execAsync(curlCommand);
    
    if (stderr) {
      console.error('❌ Curl stderr:', stderr);
    }
    
    try {
      const data = JSON.parse(stdout);
      res.json({
        success: true,
        message: 'CryptoMate connection successful via curl',
        cardsCount: data.length,
        sampleCard: data[0] || null
      });
    } catch (parseError) {
      res.json({
        success: false,
        error: 'Failed to parse response',
        rawOutput: stdout.substring(0, 500) + '...',
        parseError: parseError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Curl execution error:', error);
    res.status(500).json({
      success: false,
      error: 'Curl execution failed',
      message: error.message
    });
  }
});

module.exports = router;

