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

// NUEVO ENDPOINT: Refresh con últimos 2 meses
router.post('/refresh-all-cards-stats-2months', async (req, res) => {
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
    
    // Calcular fechas para últimos 2 meses
    const now = new Date();
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 días = ~2 meses
    
    const fromDate = twoMonthsAgo.toISOString().split('T')[0];
    const toDate = now.toISOString().split('T')[0];
    
    console.log(`🚀 Starting 2-month refresh from ${fromDate} to ${toDate}`);
    
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
    
    // CryptoMate Refresh (usando refresh-all-transactions-full con fechas)
    try {
      const cryptoRefreshResponse = await fetch(`${BASE_URL}/api/real-cryptomate/refresh-all-transactions-full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromDate: fromDate,
          toDate: toDate,
          maxPages: 15 // Más páginas para 2 meses
        })
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
    
    // Mercury Refresh (usando import-all-transactions con fechas)
    try {
      const mercuryRefreshResponse = await fetch(`${BASE_URL}/api/real-mercury/import-all-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: fromDate,
          end: toDate
        })
      });
      
      if (mercuryRefreshResponse.ok) {
        results.mercury.refresh = await mercuryRefreshResponse.json();
      } else {
        results.mercury.refresh = { success: false, error: `HTTP ${mercuryRefreshResponse.status}` };
      }
    } catch (error) {
      results.mercury.refresh = { success: false, error: error.message };
    }
    
    console.log('✅ All 2-month operations completed');
    
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
    
    const totalNewTransactions = (results.cryptomate.refresh?.summary?.transactionsCreatedOrRestored || 0) + 
                                  (results.mercury.refresh?.summary?.imported || 0);
    
    const allSuccess = cryptoImportSuccess && cryptoRefreshSuccess && mercuryImportSuccess && mercuryRefreshSuccess;
    
    // Guardar registro completo en la nueva colección
    try {
      const { getHistoryConnection } = require('../config/database');
      const historyConnection = getHistoryConnection();
      
      const executionRecord = {
        _id: new Date().toISOString().replace(/[:.]/g, '-') + '-refresh-all-cards-stats-2months',
        executionType: 'refresh-all-cards-stats-2months',
        timestamp: new Date(),
        dateRange: {
          from: fromDate,
          to: toDate,
          period: '2 months'
        },
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
      
      const historyCollection = historyConnection.db.collection('refresh-all-cards-stats-2months');
      await historyCollection.insertOne(executionRecord);
      
    } catch (historyError) {
      console.error(`❌ Error saving execution history:`, historyError.message);
    }
    
    res.json({
      success: allSuccess,
      timestamp: new Date().toISOString(),
      dateRange: {
        from: fromDate,
        to: toDate,
        period: '2 months'
      },
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
      error: 'refresh-all-cards-stats-2months failed',
      message: error.message,
      performance: {
        totalTime: totalTime
      }
    });
  }
});

// ENDPOINT INTELIGENTE: Smart Sync con lógica optimizada
router.post('/refresh-smart-sync', async (req, res) => {
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
        refresh: null,
        pending: null
      }
    };
    
    // Calcular fechas para últimas 2 horas
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    
    const fromDate = twoHoursAgo.toISOString().split('T')[0];
    const toDate = now.toISOString().split('T')[0];
    
    console.log(`🚀 Starting SMART SYNC from ${fromDate} to ${toDate}`);
    
    // ========================================
    // CRYPTOMATE: Últimas 2 horas
    // ========================================
    
    // CryptoMate Import (solo si es necesario)
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
    
    // CryptoMate Refresh (últimas 2 horas)
    try {
      const cryptoRefreshResponse = await fetch(`${BASE_URL}/api/real-cryptomate/refresh-all-transactions-full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromDate: fromDate,
          toDate: toDate,
          maxPages: 5 // Menos páginas para 2 horas
        })
      });
      
      if (cryptoRefreshResponse.ok) {
        results.cryptomate.refresh = await cryptoRefreshResponse.json();
      } else {
        results.cryptomate.refresh = { success: false, error: `HTTP ${cryptoRefreshResponse.status}` };
      }
    } catch (error) {
      results.cryptomate.refresh = { success: false, error: error.message };
    }
    
    // ========================================
    // MERCURY: Últimas 2 horas + PENDING individuales
    // ========================================
    
    // Mercury Import (solo si es necesario)
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
    
    // Mercury Refresh (últimas 2 horas)
    try {
      const mercuryRefreshResponse = await fetch(`${BASE_URL}/api/real-mercury/import-all-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: fromDate,
          end: toDate
        })
      });
      
      if (mercuryRefreshResponse.ok) {
        results.mercury.refresh = await mercuryRefreshResponse.json();
      } else {
        results.mercury.refresh = { success: false, error: `HTTP ${mercuryRefreshResponse.status}` };
      }
    } catch (error) {
      results.mercury.refresh = { success: false, error: error.message };
    }
    
    // Mercury PENDING individuales (nueva funcionalidad)
    try {
      console.log('🔄 Checking Mercury PENDING transactions individually...');
      
      // Obtener transacciones PENDING de la DB
      const { getTransactionModel } = require('../models/Transaction');
      const Transaction = getTransactionModel();
      
      const pendingTransactions = await Transaction.find({ 
        supplier: 'mercury',
        status: 'pending'
      }).select('_id cardId').lean();
      
      console.log(`📊 Found ${pendingTransactions.length} PENDING Mercury transactions`);
      
      let pendingUpdated = 0;
      let pendingErrors = 0;
      const pendingResults = [];
      
      // Procesar cada transacción PENDING individualmente
      for (const tx of pendingTransactions) {
        try {
          // Hacer consulta individual a Mercury API
          const mercuryApiUrl = `https://api.mercury.com/api/v1/account/${tx.cardId}/transaction/${tx._id}`;
          
          const mercuryApiResponse = await fetch(mercuryApiUrl, {
            method: 'GET',
            headers: {
              'accept': 'application/json;charset=utf-8',
              'Authorization': `Bearer ${process.env.MERCURY_AUTH_TOKEN}`
            }
          });
          
          if (mercuryApiResponse.ok) {
            const transactionData = await mercuryApiResponse.json();
            
            // Verificar si el estado cambió
            if (transactionData.status && transactionData.status !== 'pending') {
              // Actualizar en la DB
              await Transaction.findByIdAndUpdate(tx._id, {
                status: transactionData.status,
                updatedAt: new Date()
              });
              
              pendingUpdated++;
              pendingResults.push({
                transactionId: tx._id,
                oldStatus: 'pending',
                newStatus: transactionData.status,
                success: true
              });
              
              console.log(`✅ Updated transaction ${tx._id}: pending → ${transactionData.status}`);
            } else {
              pendingResults.push({
                transactionId: tx._id,
                status: 'still_pending',
                success: true
              });
            }
          } else {
            pendingErrors++;
            pendingResults.push({
              transactionId: tx._id,
              success: false,
              error: `HTTP ${mercuryApiResponse.status}`
            });
          }
          
          // Pequeña pausa para no sobrecargar la API
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          pendingErrors++;
          pendingResults.push({
            transactionId: tx._id,
            success: false,
            error: error.message
          });
        }
      }
      
      results.mercury.pending = {
        success: true,
        summary: {
          totalChecked: pendingTransactions.length,
          updated: pendingUpdated,
          errors: pendingErrors
        },
        results: pendingResults.slice(0, 10) // Limitar resultados para respuesta
      };
      
      console.log(`✅ Mercury PENDING check completed: ${pendingUpdated} updated, ${pendingErrors} errors`);
      
    } catch (error) {
      results.mercury.pending = { 
        success: false, 
        error: error.message 
      };
    }
    
    console.log('✅ All SMART SYNC operations completed');
    
    const totalTime = Date.now() - startTime;
    
    const cryptoImportSuccess = results.cryptomate.import?.success || false;
    const cryptoRefreshSuccess = results.cryptomate.refresh?.success || false;
    const mercuryImportSuccess = results.mercury.import?.success || false;
    const mercuryRefreshSuccess = results.mercury.refresh?.success || false;
    const mercuryPendingSuccess = results.mercury.pending?.success || false;
    
    const cryptomateCardsTotal = (results.cryptomate.import?.summary?.cardsImported || 0) + (results.cryptomate.import?.summary?.cardsUpdated || 0);
    const mercuryCardsTotal = (results.mercury.import?.summary?.cardsImported || 0) + (results.mercury.import?.summary?.cardsUpdated || 0);
    
    const cryptomateNewUsers = results.cryptomate.import?.summary?.usersImported || 0;
    const mercuryNewUsers = results.mercury.import?.summary?.usersImported || 0;
    
    const cryptomateNewTransactions = results.cryptomate.refresh?.cardsWithNewTransactions || [];
    const mercuryNewTransactions = results.mercury.refresh?.cardsWithNewTransactions || [];
    
    const totalNewTransactions = (results.cryptomate.refresh?.summary?.transactionsCreatedOrRestored || 0) + 
                                  (results.mercury.refresh?.summary?.imported || 0);
    
    const pendingUpdated = results.mercury.pending?.summary?.updated || 0;
    
    const allSuccess = cryptoImportSuccess && cryptoRefreshSuccess && mercuryImportSuccess && mercuryRefreshSuccess && mercuryPendingSuccess;
    
    // Guardar registro completo en la nueva colección
    try {
      const { getHistoryConnection } = require('../config/database');
      const historyConnection = getHistoryConnection();
      
      const executionRecord = {
        _id: new Date().toISOString().replace(/[:.]/g, '-') + '-refresh-smart-sync',
        executionType: 'refresh-smart-sync',
        timestamp: new Date(),
        dateRange: {
          from: fromDate,
          to: toDate,
          period: '24 hours'
        },
        summary: {
          totalNewTransactions: totalNewTransactions,
          pendingUpdated: pendingUpdated,
          cryptomateCards: cryptomateCardsTotal,
          mercuryCards: mercuryCardsTotal,
          cryptomateNewUsers: cryptomateNewUsers,
          mercuryNewUsers: mercuryNewUsers,
          performance: { 
            totalTime: totalTime,
            successRate: `${[cryptoImportSuccess, cryptoRefreshSuccess, mercuryImportSuccess, mercuryRefreshSuccess, mercuryPendingSuccess].filter(Boolean).length}/5`
          }
        },
        cryptomate: {
          import: results.cryptomate.import,
          refresh: results.cryptomate.refresh
        },
        mercury: {
          import: results.mercury.import,
          refresh: results.mercury.refresh,
          pending: results.mercury.pending
        },
        execution: {
          steps: {
            cryptomateImport: cryptoImportSuccess ? 'OK' : 'FAILED',
            cryptomateRefresh: cryptoRefreshSuccess ? 'OK' : 'FAILED',
            mercuryImport: mercuryImportSuccess ? 'OK' : 'FAILED',
            mercuryRefresh: mercuryRefreshSuccess ? 'OK' : 'FAILED',
            mercuryPending: mercuryPendingSuccess ? 'OK' : 'FAILED'
          },
          totalTime: totalTime,
          successRate: `${[cryptoImportSuccess, cryptoRefreshSuccess, mercuryImportSuccess, mercuryRefreshSuccess, mercuryPendingSuccess].filter(Boolean).length}/5`
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const historyCollection = historyConnection.db.collection('refresh-smart-sync');
      await historyCollection.insertOne(executionRecord);
      
    } catch (historyError) {
      console.error(`❌ Error saving execution history:`, historyError.message);
    }
    
    res.json({
      success: allSuccess,
      timestamp: new Date().toISOString(),
      dateRange: {
        from: fromDate,
        to: toDate,
        period: '2 hours'
      },
      cryptomate: {
        totalCards: cryptomateCardsTotal,
        newUsers: cryptomateNewUsers,
        newTransactions: cryptomateNewTransactions
      },
      mercury: {
        totalCards: mercuryCardsTotal,
        newUsers: mercuryNewUsers,
        newTransactions: mercuryNewTransactions,
        pendingUpdated: pendingUpdated
      },
      execution: {
        steps: {
          cryptomateImport: cryptoImportSuccess ? 'OK' : 'FAILED',
          cryptomateRefresh: cryptoRefreshSuccess ? 'OK' : 'FAILED',
          mercuryImport: mercuryImportSuccess ? 'OK' : 'FAILED',
          mercuryRefresh: mercuryRefreshSuccess ? 'OK' : 'FAILED',
          mercuryPending: mercuryPendingSuccess ? 'OK' : 'FAILED'
        },
        totalTime: totalTime,
        successRate: `${[cryptoImportSuccess, cryptoRefreshSuccess, mercuryImportSuccess, mercuryRefreshSuccess, mercuryPendingSuccess].filter(Boolean).length}/5`
      }
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: 'refresh-smart-sync failed',
      message: error.message,
      performance: {
        totalTime: totalTime
      }
    });
  }
});

// ENDPOINT OPTIMIZADO: Smart Sync con mejoras de performance
router.post('/refresh-smart-sync-optimized', async (req, res) => {
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
        refresh: null,
        pending: null
      }
    };
    
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const fromDate = threeDaysAgo.toISOString();
    const toDate = now.toISOString();
    
    console.log(`🚀 Starting OPTIMIZED SMART SYNC from ${fromDate} to ${toDate}`);
    
    // ========================================
    // CRYPTOMATE: Últimas 24 horas (OPTIMIZADO)
    // ========================================
    
    // CryptoMate Import (solo si es necesario) - OPTIMIZADO
    try {
      const cryptoImportResponse = await fetch(`${BASE_URL}/api/cryptomate/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
        // Sin timeout - CryptoMate puede tardar lo que necesite
      });
      
      if (cryptoImportResponse.ok) {
        results.cryptomate.import = await cryptoImportResponse.json();
      } else {
        results.cryptomate.import = { success: false, error: `HTTP ${cryptoImportResponse.status}` };
      }
    } catch (error) {
      results.cryptomate.import = { success: false, error: error.message };
    }
    
    // CryptoMate Refresh (últimas 24 horas - OPTIMIZADO)
    try {
      const cryptoRefreshResponse = await fetch(`${BASE_URL}/api/real-cryptomate/refresh-all-transactions-full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromDate: fromDate.split('T')[0], // Solo fecha para CryptoMate
          toDate: toDate.split('T')[0],     // Solo fecha para CryptoMate
          maxPages: 3 // Aumentado para 24 horas
        }),
        timeout: 30000 // 30 segundos timeout para 24 horas
      });
      
      if (cryptoRefreshResponse.ok) {
        results.cryptomate.refresh = await cryptoRefreshResponse.json();
      } else {
        results.cryptomate.refresh = { success: false, error: `HTTP ${cryptoRefreshResponse.status}` };
      }
    } catch (error) {
      results.cryptomate.refresh = { success: false, error: error.message };
    }
    
    // ========================================
    // MERCURY: Últimas 24 horas + PENDING paralelo
    // ========================================
    
    // Mercury Import (solo si es necesario)
    try {
      const mercuryImportResponse = await fetch(`${BASE_URL}/api/real-mercury/import-mercury-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000 // 10 segundos timeout
      });
      
      if (mercuryImportResponse.ok) {
        results.mercury.import = await mercuryImportResponse.json();
      } else {
        results.mercury.import = { success: false, error: `HTTP ${mercuryImportResponse.status}` };
      }
    } catch (error) {
      results.mercury.import = { success: false, error: error.message };
    }
    
    // Mercury Refresh (últimas 24 horas - OPTIMIZADO)
    try {
      const mercuryRefreshResponse = await fetch(`${BASE_URL}/api/real-mercury/import-all-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: fromDate.split('T')[0], // Solo fecha para Mercury (compatible con API)
          end: toDate.split('T')[0]     // Solo fecha para Mercury (compatible con API)
        }),
        timeout: 20000 // 20 segundos timeout para 24 horas
      });
      
      if (mercuryRefreshResponse.ok) {
        results.mercury.refresh = await mercuryRefreshResponse.json();
      } else {
        results.mercury.refresh = { success: false, error: `HTTP ${mercuryRefreshResponse.status}` };
      }
    } catch (error) {
      results.mercury.refresh = { success: false, error: error.message };
    }
    
    // Mercury PENDING individuales (OPTIMIZADO - PARALELO)
    try {
      console.log('🔄 Checking Mercury PENDING transactions in parallel...');
      
      // Obtener transacciones PENDING de la DB (solo últimos 7 días)
      const { getTransactionModel } = require('../models/Transaction');
      const Transaction = getTransactionModel();
      
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const pendingTransactions = await Transaction.find({ 
        supplier: 'mercury',
        status: 'pending',
        createdAt: { $gte: sevenDaysAgo } // Solo PENDING de últimos 7 días
      }).select('_id cardId').lean();
      
      console.log(`📊 Found ${pendingTransactions.length} PENDING Mercury transactions (last 7 days)`);
      
      let pendingUpdated = 0;
      let pendingErrors = 0;
      const pendingResults = [];
      
      // OPTIMIZACIÓN: Procesar en batches paralelos
      const BATCH_SIZE = 5;
      const batches = [];
      for (let i = 0; i < pendingTransactions.length; i += BATCH_SIZE) {
        batches.push(pendingTransactions.slice(i, i + BATCH_SIZE));
      }
      
      // Procesar batches en paralelo
      for (const batch of batches) {
        const batchPromises = batch.map(async (tx) => {
          try {
            // Hacer consulta individual a Mercury API con timeout
            const mercuryApiUrl = `https://api.mercury.com/api/v1/account/${tx.cardId}/transaction/${tx._id}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos timeout
            
            const mercuryApiResponse = await fetch(mercuryApiUrl, {
              method: 'GET',
              headers: {
                'accept': 'application/json;charset=utf-8',
                'Authorization': `Bearer ${process.env.MERCURY_API_TOKEN}`
              },
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (mercuryApiResponse.ok) {
              const transactionData = await mercuryApiResponse.json();
              
              // Verificar si el estado cambió
              if (transactionData.status && transactionData.status !== 'pending') {
                // Actualizar en la DB
                await Transaction.findByIdAndUpdate(tx._id, {
                  status: transactionData.status,
                  updatedAt: new Date()
                });
                
                return {
                  transactionId: tx._id,
                  oldStatus: 'pending',
                  newStatus: transactionData.status,
                  success: true
                };
              } else {
                return {
                  transactionId: tx._id,
                  status: 'still_pending',
                  success: true
                };
              }
            } else {
              return {
                transactionId: tx._id,
                success: false,
                error: `HTTP ${mercuryApiResponse.status}`
              };
            }
            
          } catch (error) {
            return {
              transactionId: tx._id,
              success: false,
              error: error.message
            };
          }
        });
        
        // Esperar que termine el batch actual
        const batchResults = await Promise.all(batchPromises);
        pendingResults.push(...batchResults);
        
        // Contar resultados
        batchResults.forEach(result => {
          if (result.success && result.newStatus) {
            pendingUpdated++;
          } else if (!result.success) {
            pendingErrors++;
          }
        });
        
        // Pequeña pausa entre batches
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      results.mercury.pending = {
        success: true,
        summary: {
          totalChecked: pendingTransactions.length,
          updated: pendingUpdated,
          errors: pendingErrors
        },
        results: pendingResults.slice(0, 10) // Limitar resultados para respuesta
      };
      
      console.log(`✅ Mercury PENDING check completed: ${pendingUpdated} updated, ${pendingErrors} errors`);
      
    } catch (error) {
      results.mercury.pending = { 
        success: false, 
        error: error.message 
      };
    }
    
    console.log('✅ All OPTIMIZED SMART SYNC operations completed');
    
    const totalTime = Date.now() - startTime;
    
    const cryptoImportSuccess = results.cryptomate.import?.success || false;
    const cryptoRefreshSuccess = results.cryptomate.refresh?.success || false;
    const mercuryImportSuccess = results.mercury.import?.success || false;
    const mercuryRefreshSuccess = results.mercury.refresh?.success || false;
    const mercuryPendingSuccess = results.mercury.pending?.success || false;
    
    const cryptomateCardsTotal = (results.cryptomate.import?.summary?.cardsImported || 0) + (results.cryptomate.import?.summary?.cardsUpdated || 0);
    const mercuryCardsTotal = (results.mercury.import?.summary?.cardsImported || 0) + (results.mercury.import?.summary?.cardsUpdated || 0);
    
    const cryptomateNewUsers = results.cryptomate.import?.summary?.usersImported || 0;
    const mercuryNewUsers = results.mercury.import?.summary?.usersImported || 0;
    
    const cryptomateNewTransactions = results.cryptomate.refresh?.cardsWithNewTransactions || [];
    const mercuryNewTransactions = results.mercury.refresh?.cardsWithNewTransactions || [];
    
    const totalNewTransactions = (results.cryptomate.refresh?.summary?.transactionsCreatedOrRestored || 0) + 
                                  (results.mercury.refresh?.summary?.imported || 0);
    
    const pendingUpdated = results.mercury.pending?.summary?.updated || 0;
    
    const allSuccess = cryptoImportSuccess && cryptoRefreshSuccess && mercuryImportSuccess && mercuryRefreshSuccess && mercuryPendingSuccess;
    
    // Guardar registro completo en la nueva colección
    try {
      const { getHistoryConnection } = require('../config/database');
      const historyConnection = getHistoryConnection();
      
      const executionRecord = {
        _id: new Date().toISOString().replace(/[:.]/g, '-') + '-refresh-smart-sync-optimized',
        executionType: 'refresh-smart-sync-optimized',
        timestamp: new Date(),
        dateRange: {
          from: fromDate,
          to: toDate,
          period: '3 days'
        },
        summary: {
          totalNewTransactions: totalNewTransactions,
          pendingUpdated: pendingUpdated,
          cryptomateCards: cryptomateCardsTotal,
          mercuryCards: mercuryCardsTotal,
          cryptomateNewUsers: cryptomateNewUsers,
          mercuryNewUsers: mercuryNewUsers,
          performance: { 
            totalTime: totalTime,
            successRate: `${[cryptoImportSuccess, cryptoRefreshSuccess, mercuryImportSuccess, mercuryRefreshSuccess, mercuryPendingSuccess].filter(Boolean).length}/5`
          }
        },
        cryptomate: {
          import: results.cryptomate.import,
          refresh: results.cryptomate.refresh
        },
        mercury: {
          import: results.mercury.import,
          refresh: results.mercury.refresh,
          pending: results.mercury.pending
        },
        execution: {
          steps: {
            cryptomateImport: cryptoImportSuccess ? 'OK' : 'FAILED',
            cryptomateRefresh: cryptoRefreshSuccess ? 'OK' : 'FAILED',
            mercuryImport: mercuryImportSuccess ? 'OK' : 'FAILED',
            mercuryRefresh: mercuryRefreshSuccess ? 'OK' : 'FAILED',
            mercuryPending: mercuryPendingSuccess ? 'OK' : 'FAILED'
          },
          totalTime: totalTime,
          successRate: `${[cryptoImportSuccess, cryptoRefreshSuccess, mercuryImportSuccess, mercuryRefreshSuccess, mercuryPendingSuccess].filter(Boolean).length}/5`
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const historyCollection = historyConnection.db.collection('refresh-smart-sync-optimized');
      await historyCollection.insertOne(executionRecord);
      
    } catch (historyError) {
      console.error(`❌ Error saving execution history:`, historyError.message);
    }
    
    res.json({
      success: allSuccess,
      timestamp: new Date().toISOString(),
      dateRange: {
        from: fromDate,
        to: toDate,
        period: '3 days'
      },
      cryptomate: {
        totalCards: cryptomateCardsTotal,
        newUsers: cryptomateNewUsers,
        newTransactions: cryptomateNewTransactions
      },
      mercury: {
        totalCards: mercuryCardsTotal,
        newUsers: mercuryNewUsers,
        newTransactions: mercuryNewTransactions,
        pendingUpdated: pendingUpdated
      },
      execution: {
        steps: {
          cryptomateImport: cryptoImportSuccess ? 'OK' : 'FAILED',
          cryptomateRefresh: cryptoRefreshSuccess ? 'OK' : 'FAILED',
          mercuryImport: mercuryImportSuccess ? 'OK' : 'FAILED',
          mercuryRefresh: mercuryRefreshSuccess ? 'OK' : 'FAILED',
          mercuryPending: mercuryPendingSuccess ? 'OK' : 'FAILED'
        },
        totalTime: totalTime,
        successRate: `${[cryptoImportSuccess, cryptoRefreshSuccess, mercuryImportSuccess, mercuryRefreshSuccess, mercuryPendingSuccess].filter(Boolean).length}/5`
      }
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: 'refresh-smart-sync-optimized failed',
      message: error.message,
      performance: {
        totalTime: totalTime
      }
    });
  }
});

module.exports = router;

