const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

router.post('/refresh-all-cards-stats', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const BASE_URL = 'http://localhost:3001';
    const results = {
      cryptomate: {
        import: null,
        refresh: null
      },
      mercury: {
        import: null,
        refresh: null
      }
    };
    
    // CryptoMate Import
    try {
      const cryptoImportResponse = await fetch(`${BASE_URL}/api/cryptomate/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (cryptoImportResponse.ok) {
        results.cryptomate.import = await cryptoImportResponse.json();
      } else {
        results.cryptomate.import = { success: false, error: `HTTP ${cryptoImportResponse.status}` };
      }
    } catch (error) {
      results.cryptomate.import = { success: false, error: error.message };
    }
    
    // CryptoMate Refresh
    try {
      const cryptoRefreshResponse = await fetch(`${BASE_URL}/api/real-cryptomate/refresh-all-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (cryptoRefreshResponse.ok) {
        results.cryptomate.refresh = await cryptoRefreshResponse.json();
      } else {
        results.cryptomate.refresh = { success: false, error: `HTTP ${cryptoRefreshResponse.status}` };
      }
    } catch (error) {
      results.cryptomate.refresh = { success: false, error: error.message };
    }
    
    // Mercury Import
    try {
      const mercuryImportResponse = await fetch(`${BASE_URL}/api/real-mercury/import-mercury-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (mercuryImportResponse.ok) {
        results.mercury.import = await mercuryImportResponse.json();
      } else {
        results.mercury.import = { success: false, error: `HTTP ${mercuryImportResponse.status}` };
      }
    } catch (error) {
      results.mercury.import = { success: false, error: error.message };
    }
    
    // Mercury Refresh
    try {
      const mercuryRefreshResponse = await fetch(`${BASE_URL}/api/real-mercury/refresh-all-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (mercuryRefreshResponse.ok) {
        results.mercury.refresh = await mercuryRefreshResponse.json();
      } else {
        results.mercury.refresh = { success: false, error: `HTTP ${mercuryRefreshResponse.status}` };
      }
    } catch (error) {
      results.mercury.refresh = { success: false, error: error.message };
    }
    
    console.log('✅ All operations completed');
    
    const totalTime = Date.now() - startTime;
    
    const cryptoImportSuccess = results.cryptomate.import?.success || false;
    const cryptoRefreshSuccess = results.cryptomate.refresh?.success || false;
    const mercuryImportSuccess = results.mercury.import?.success || false;
    const mercuryRefreshSuccess = results.mercury.refresh?.success || false;
    
    const cryptomateCardsTotal = (results.cryptomate.import?.summary?.cardsImported || 0) + (results.cryptomate.import?.summary?.cardsUpdated || 0);
    const mercuryCardsTotal = (results.mercury.import?.summary?.cardsImported || 0) + (results.mercury.import?.summary?.cardsUpdated || 0);
    
    const cryptomateNewUsers = results.cryptomate.import?.summary?.usersImported || 0;
    const mercuryNewUsers = results.mercury.import?.summary?.usersImported || 0;
    
    const cryptomateNewTransactions = results.cryptomate.refresh?.cardsWithNewTransactions || [];
    const mercuryNewTransactions = results.mercury.refresh?.cardsWithNewTransactions || [];
    
    const totalNewTransactions = (results.cryptomate.refresh?.summary?.newTransactionsCreated || 0) + 
                                  (results.mercury.refresh?.summary?.newTransactionsCreated || 0);
    
    const allSuccess = cryptoImportSuccess && cryptoRefreshSuccess && mercuryImportSuccess && mercuryRefreshSuccess;
    
    // Guardar registro completo en la nueva colección
    try {
      const { getHistoryConnection } = require('../config/database');
      const historyConnection = getHistoryConnection();
      
      const executionRecord = {
        _id: new Date().toISOString().replace(/[:.]/g, '-') + '-refresh-all-cards-stats',
        executionType: 'refresh-all-cards-stats',
        timestamp: new Date(),
        summary: {
          totalNewTransactions: totalNewTransactions,
          cryptomateCards: cryptomateCardsTotal,
          mercuryCards: mercuryCardsTotal,
          cryptomateNewUsers: cryptomateNewUsers,
          mercuryNewUsers: mercuryNewUsers,
          performance: { 
            totalTime: totalTime,
            successRate: `${[cryptoImportSuccess, cryptoRefreshSuccess, mercuryImportSuccess, mercuryRefreshSuccess].filter(Boolean).length}/4`
          }
        },
        cryptomate: {
          import: results.cryptomate.import,
          refresh: results.cryptomate.refresh
        },
        mercury: {
          import: results.mercury.import,
          refresh: results.mercury.refresh
        },
        execution: {
          steps: {
            cryptomateImport: cryptoImportSuccess ? 'OK' : 'FAILED',
            cryptomateRefresh: cryptoRefreshSuccess ? 'OK' : 'FAILED',
            mercuryImport: mercuryImportSuccess ? 'OK' : 'FAILED',
            mercuryRefresh: mercuryRefreshSuccess ? 'OK' : 'FAILED'
          },
          totalTime: totalTime,
          successRate: `${[cryptoImportSuccess, cryptoRefreshSuccess, mercuryImportSuccess, mercuryRefreshSuccess].filter(Boolean).length}/4`
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const historyCollection = historyConnection.db.collection('refresh-all-cards-stats');
      await historyCollection.insertOne(executionRecord);
      
    } catch (historyError) {
      console.error(`❌ Error saving execution history:`, historyError.message);
    }
    
    res.json({
      success: allSuccess,
      timestamp: new Date().toISOString(),
      cryptomate: {
        totalCards: cryptomateCardsTotal,
        newUsers: cryptomateNewUsers,
        newTransactions: cryptomateNewTransactions
      },
      mercury: {
        totalCards: mercuryCardsTotal,
        newUsers: mercuryNewUsers,
        newTransactions: mercuryNewTransactions
      },
      execution: {
        steps: {
          cryptomateImport: cryptoImportSuccess ? 'OK' : 'FAILED',
          cryptomateRefresh: cryptoRefreshSuccess ? 'OK' : 'FAILED',
          mercuryImport: mercuryImportSuccess ? 'OK' : 'FAILED',
          mercuryRefresh: mercuryRefreshSuccess ? 'OK' : 'FAILED'
        },
        totalTime: totalTime,
        successRate: `${[cryptoImportSuccess, cryptoRefreshSuccess, mercuryImportSuccess, mercuryRefreshSuccess].filter(Boolean).length}/4`
      }
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: 'refresh-all-cards-stats failed',
      message: error.message,
      performance: {
        totalTime: totalTime
      }
    });
  }
});

module.exports = router;

