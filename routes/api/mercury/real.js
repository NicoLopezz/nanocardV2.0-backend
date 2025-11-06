const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const StatsRefreshService = require('../../../services/statsRefreshService');
const mercuryService = require('../../../services/mercuryService');
const { getUserModel } = require('../../../models/User');
const { getCardModel } = require('../../../models/Card');
const { getTransactionModel } = require('../../../models/Transaction');
const { connectDatabases, closeDatabaseConnections } = require('../../../config/database');

// Endpoint para importar cards de Mercury - OPTIMIZADO
router.post('/import-mercury-cards', async (req, res) => {
  const startTime = Date.now();
  
  try {
    
    
    const User = getUserModel();
    const Card = getCardModel();
    
    const existingUsers = await User.find({}).lean();
    const existingCards = await Card.find({ supplier: 'mercury' }).lean();
    
    const existingUserIds = new Set(existingUsers.map(u => u._id));
    const existingCardIds = new Set(existingCards.map(c => c._id));
    
    const mercuryCards = await mercuryService.getAllCards();
    
    if (mercuryCards.length === 0) {
      return res.json({
        success: true,
        message: 'No Mercury cards found to import',
        summary: {
          totalCards: 0,
          usersImported: 0,
          cardsImported: 0,
          errors: 0,
          performance: {
            totalTime: Date.now() - startTime,
            timePerCard: 0
          }
        }
      });
    }
    
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < mercuryCards.length; i += batchSize) {
      batches.push(mercuryCards.slice(i, i + batchSize));
    }
    
    let totalUsersImported = 0;
    let totalCardsImported = 0;
    let totalErrors = 0;
    const errors = [];
    const importedUsers = [];
    const importedCards = [];
    
    const maxConcurrentBatches = 2;
    for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
      const currentBatches = batches.slice(i, i + maxConcurrentBatches);
      
      const batchPromises = currentBatches.map(async (batch, batchIndex) => {
        const globalBatchIndex = i + batchIndex;
        
        const batchResults = {
          newUsers: [],
          newCards: [],
          batchErrors: []
        };
        
        for (const mercuryCard of batch) {
          try {
            // Convert Mercury card to Nano format
            const nanoCard = mercuryService.convertMercuryCardToNano(mercuryCard);
            
            // Check if user exists, if not create it
            if (!existingUserIds.has(nanoCard.userId)) {
              const newUser = {
                _id: nanoCard.userId,
                username: `${nanoCard.name}_${nanoCard.userId}`.replace(/\s+/g, '_').toLowerCase(),
                email: `${nanoCard.userId}@mercury.com`, // Email genérico para Mercury users
                role: 'standard', // ✅ FIXED: Use 'standard' instead of 'user'
                stats: {
                  totalTransactions: 0,
                  totalDeposited: 0,
                  totalRefunded: 0,
                  totalPosted: 0,
                  totalPending: 0,
                  totalAvailable: 0
                },
                createdAt: new Date(),
                updatedAt: new Date()
              };
              batchResults.newUsers.push(newUser);
              existingUserIds.add(nanoCard.userId); // Add to set to avoid duplicates in same batch
            }
            
            // Check if card exists, if not create it
            if (!existingCardIds.has(nanoCard._id)) {
              batchResults.newCards.push(nanoCard);
            }
            
          } catch (error) {
            batchResults.batchErrors.push({
              cardId: mercuryCard.cardId,
              error: error.message
            });
          }
        }
        
        return batchResults;
      });
      
      // Wait for all batches to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Collect results from all batches
      const allNewUsers = [];
      const allNewCards = [];
      const allBatchErrors = [];
      
      batchResults.forEach(result => {
        allNewUsers.push(...result.newUsers);
        allNewCards.push(...result.newCards);
        allBatchErrors.push(...result.batchErrors);
      });
      
      // Bulk insert new users if any
      if (allNewUsers.length > 0) {
        try {
          const insertResult = await User.insertMany(allNewUsers, { ordered: false });
          totalUsersImported += allNewUsers.length;
          
          // ✅ Track imported users with details
          allNewUsers.forEach(user => {
            importedUsers.push({
              id: user._id,
              username: user.username,
              email: user.email,
              role: user.role
            });
          });
          
        } catch (insertError) {
          totalErrors += allNewUsers.length;
        }
      }
      
      if (allNewCards.length > 0) {
        try {
          await Card.insertMany(allNewCards, { ordered: false });
          totalCardsImported += allNewCards.length;
          
          allNewCards.forEach(card => {
            importedCards.push({
              id: card._id,
              userId: card.userId,
              name: card.name,
              supplier: card.supplier,
              last4: card.last4
            });
          });
          
        } catch (insertError) {
          totalErrors += allNewCards.length;
        }
      }
      
      // Collect errors
      errors.push(...allBatchErrors);
      totalErrors += allBatchErrors.length;
    }
    
    
    const totalTime = Date.now() - startTime;
    const timePerCard = (totalTime / mercuryCards.length).toFixed(2);
    
    console.log(`✅ Mercury import completed: ${totalUsersImported} users, ${totalCardsImported} cards imported (${totalTime}ms)`);
    
    res.json({
      success: true,
      message: 'Mercury cards import completed successfully',
      summary: {
        totalCards: mercuryCards.length,
        usersImported: totalUsersImported,
        cardsImported: totalCardsImported,
        cardsUpdated: mercuryCards.length - totalCardsImported,
        errors: totalErrors,
        performance: {
          totalTime: totalTime,
          timePerCard: timePerCard
        }
      },
      errors: errors.slice(0, 5)
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    res.status(500).json({
      success: false,
      error: 'Optimized Mercury cards import failed',
      message: error.message,
      performance: {
        totalTime: totalTime
      }
    });
  }
});

// Endpoint para refrescar transacciones de una tarjeta específica - OPTIMIZADO
router.post('/refresh-transactions/:cardId', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cardId } = req.params;
    const Card = getCardModel();
    const Transaction = getTransactionModel();
    
    const [card, existingTransactions] = await Promise.all([
      Card.findById(cardId),
      Transaction.find({ cardId: cardId, supplier: 'mercury' }).lean()
    ]);
    
    if (!card) {
      return res.status(404).json({
        success: false,
        message: `Card ${cardId} not found`
      });
    }
    
    const existingTransactionIds = new Set(existingTransactions.map(t => t._id));
    console.log(`✅ Found card ${cardId} and ${existingTransactionIds.size} existing Mercury transactions`);
    
    // Step 2: Fetch all Mercury transactions (not filtered by cardId yet)
    const allMercuryTransactions = await mercuryService.getAllTransactions();
    console.log(`✅ Fetched ${allMercuryTransactions.length} total Mercury transactions`);
    
    // Step 3: Filter transactions for this specific card
    const cardTransactions = allMercuryTransactions.filter(mercuryTransaction => {
      // Check direct cardId
      if (mercuryTransaction.details?.debitCardInfo?.id === cardId) {
        return true;
      }
      
      // Check related transactions for fees
      if (mercuryTransaction.relatedTransactions?.length > 0) {
        const relatedTransaction = allMercuryTransactions.find(t => 
          t.id === mercuryTransaction.relatedTransactions[0].id &&
          t.details?.debitCardInfo?.id === cardId
        );
        return !!relatedTransaction;
      }
      
      return false;
    });
    
    console.log(`✅ Found ${cardTransactions.length} transactions for card ${cardId}`);
    
    if (cardTransactions.length === 0) {
      return res.json({
        success: true,
        message: 'No Mercury transactions found for this card',
        summary: {
          cardId: cardId,
          totalTransactions: 0,
          imported: 0,
          updated: 0,
          errors: 0,
          performance: {
            totalTime: Date.now() - startTime,
            timePerTransaction: 0
          }
        }
      });
    }
    
    // Step 4: Process transactions in batches
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < cardTransactions.length; i += batchSize) {
      batches.push(cardTransactions.slice(i, i + batchSize));
    }
    
    let totalImported = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    const errors = [];
    
    // Process batches in parallel (max 2 concurrent batches)
    const maxConcurrentBatches = 2;
    for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
      const currentBatches = batches.slice(i, i + maxConcurrentBatches);
      
      const batchPromises = currentBatches.map(async (batch, batchIndex) => {
        const globalBatchIndex = i + batchIndex;
        
        const batchResults = {
          newTransactions: [],
          transactionUpdates: [],
          batchErrors: []
        };
        
        for (const mercuryTransaction of batch) {
          try {
            // Get real names from database
            const card = await Card.findById(cardId);
            const user = await User.findById(cardId);
            
            // Convert Mercury transaction to Nano format (passing all transactions for chain lookup)
            const nanoTransaction = mercuryService.convertMercuryTransactionToNano(
              mercuryTransaction, 
              allMercuryTransactions, 
              card ? card.name : null,
              user ? user.username : null
            );
            
            // Only process transactions with valid cardId (now includes fees with resolved cardId)
            if (nanoTransaction.cardId === cardId) {
              if (!existingTransactionIds.has(nanoTransaction._id)) {
                // Nueva transacción
                batchResults.newTransactions.push(nanoTransaction);
              } else {
                // Actualizar transacción existente
                batchResults.transactionUpdates.push({
                  updateOne: {
                    filter: { _id: nanoTransaction._id },
                    update: {
                      $set: {
                        ...nanoTransaction,
                        updatedAt: new Date()
                      }
                    }
                  }
                });
              }
            } else {
              console.log(`   ⚠️ Transaction ${mercuryTransaction.id} filtered out (cardId: ${nanoTransaction.cardId} != ${cardId})`);
            }
          } catch (error) {
            batchResults.batchErrors.push({
              transactionId: mercuryTransaction.id,
              error: error.message
            });
          }
        }
        
        return batchResults;
      });
      
      // Wait for all batches to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Collect results from all batches
      const allNewTransactions = [];
      const allTransactionUpdates = [];
      const allBatchErrors = [];
      
      batchResults.forEach(result => {
        allNewTransactions.push(...result.newTransactions);
        allTransactionUpdates.push(...result.transactionUpdates);
        allBatchErrors.push(...result.batchErrors);
      });
      
      // Bulk insert new transactions if any
      if (allNewTransactions.length > 0) {
        try {
          await Transaction.insertMany(allNewTransactions, { ordered: false });
          totalImported += allNewTransactions.length;
          console.log(`✅ Successfully inserted ${allNewTransactions.length} new transactions`);
        } catch (insertError) {
          totalErrors += allNewTransactions.length;
        }
      }
      
      // Bulk update existing transactions if any
      if (allTransactionUpdates.length > 0) {
        try {
          await Transaction.bulkWrite(allTransactionUpdates, { ordered: false });
          totalUpdated += allTransactionUpdates.length;
        } catch (updateError) {
          totalErrors += allTransactionUpdates.length;
        }
      }
      
      // Collect errors
      errors.push(...allBatchErrors);
      totalErrors += allBatchErrors.length;
    }
    
    // Step 5: Update card stats using MongoDB aggregation
    try {
      const cardStatsPipeline = [
        { $match: { cardId: cardId, supplier: 'mercury' } },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalDeposited: {
              $sum: {
                $cond: [
                  { $in: ['$operation', ['WALLET_DEPOSIT', 'OVERRIDE_VIRTUAL_BALANCE']] },
                  '$amount',
                  0
                ]
              }
            },
            totalRefunded: {
              $sum: {
                $cond: [
                  { $eq: ['$operation', 'TRANSACTION_REFUND'] },
                  '$amount',
                  0
                ]
              }
            },
            totalPosted: {
              $sum: {
                $cond: [
                  { $eq: ['$operation', 'TRANSACTION_APPROVED'] },
                  '$amount',
                  0
                ]
              }
            },
            totalPending: {
              $sum: {
                $cond: [
                  { $eq: ['$operation', 'TRANSACTION_PENDING'] },
                  '$amount',
                  0
                ]
              }
            },
            totalReversed: {
              $sum: {
                $cond: [
                  { $eq: ['$operation', 'TRANSACTION_REVERSED'] },
                  '$amount',
                  0
                ]
              }
            },
            totalRejected: {
              $sum: {
                $cond: [
                  { $eq: ['$operation', 'TRANSACTION_REJECTED'] },
                  '$amount',
                  0
                ]
              }
            }
          }
        }
      ];
      
      const statsResult = await Transaction.aggregate(cardStatsPipeline);
      const stats = statsResult[0] || {
        totalTransactions: 0,
        totalDeposited: 0,
        totalRefunded: 0,
        totalPosted: 0,
        totalPending: 0,
        totalReversed: 0,
        totalRejected: 0
      };
      
      // Update card with new stats
      card.deposited = stats.totalDeposited;
      card.refunded = stats.totalRefunded;
      card.posted = stats.totalPosted;
      card.pending = stats.totalPending;
      card.available = stats.totalDeposited + stats.totalRefunded - stats.totalPosted - stats.totalPending;
      
      card.stats = {
        money_in: stats.totalDeposited,
        refund: stats.totalRefunded,
        posted: stats.totalPosted,
        reversed: stats.totalReversed,
        rejected: stats.totalRejected,
        pending: stats.totalPending,
        available: card.available,
        total_all_transactions: stats.totalTransactions
      };
      
      await card.save();
      
      
    } catch (statsError) {
      // Error updating card stats
    }
    
    const totalTime = Date.now() - startTime;
    const timePerTransaction = (totalTime / cardTransactions.length).toFixed(2);
  
    res.json({
      success: true,
      message: 'OPTIMIZED Mercury transaction refresh completed successfully',
      summary: {
        cardId: cardId,
        totalTransactions: cardTransactions.length,
        imported: totalImported,
        updated: totalUpdated,
        errors: totalErrors,
        performance: {
          totalTime: totalTime,
          timePerTransaction: timePerTransaction
        }
      },
      errors: errors.slice(0, 5) // Mostrar solo los primeros 5 errores
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    res.status(500).json({
      success: false,
      error: 'Optimized Mercury transaction refresh failed',
      message: error.message,
      performance: {
        totalTime: totalTime
      }
    });
  }
});

// Endpoint para importar TODAS las transacciones de Mercury (sin filtrar por cardId)
router.post('/import-all-transactions', async (req, res) => {
  const startTime = Date.now();
  
  try {
    
    
    // Obtener parámetros de fecha del body (opcionales)
    const { start, end } = req.body;
    
    // Construir opciones para el servicio Mercury
    const options = {};
    if (start) {
      options.startDate = start;
      
    }
    if (end) {
      options.endDate = end;
      
    }
    
    if (start || end) {
      
    } else {
      
    }
    
    // Step 1: Fetch Mercury transactions with date range
    
    const mercuryTransactions = await mercuryService.getAllTransactions(options);
    
    
    if (mercuryTransactions.length === 0) {
      return res.json({
        success: true,
        message: 'No Mercury transactions found to import',
        summary: {
          totalTransactions: 0,
          imported: 0,
          updated: 0,
          errors: 0,
          performance: {
            totalTime: Date.now() - startTime,
            timePerTransaction: 0
          }
        }
      });
    }
    
    // Step 2: Get existing transactions from DB (for deduplication)
    
    // Esperar un momento para asegurar que la conexión esté establecida
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const Transaction = getTransactionModel();
    const Card = getCardModel();
    const User = getUserModel();
    const existingTransactions = await Transaction.find({ supplier: 'mercury' }).lean();
    const existingTransactionIds = new Set(existingTransactions.map(t => t._id));
    
    
    // Step 3: Process transactions in batches
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < mercuryTransactions.length; i += batchSize) {
      batches.push(mercuryTransactions.slice(i, i + batchSize));
    }
    
    let totalImported = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    const errors = [];
    
    // Process batches in parallel (max 2 concurrent batches)
    const maxConcurrentBatches = 2;
    for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
      const currentBatches = batches.slice(i, i + maxConcurrentBatches);
      
      const batchPromises = currentBatches.map(async (batch, batchIndex) => {
        const globalBatchIndex = i + batchIndex;
        
        const batchResults = {
          newTransactions: [],
          transactionUpdates: [],
          batchErrors: []
        };
        
        for (const mercuryTransaction of batch) {
          try {
            // Solo procesar transacciones que tengan cardId (directo o por relatedTransactions)
            const hasDirectCardId = mercuryTransaction.details?.debitCardInfo?.id;
            const hasRelatedTransactions = mercuryTransaction.relatedTransactions?.length > 0;
            
            if (!hasDirectCardId && !hasRelatedTransactions) {
              console.log(`   ⚠️ Transaction ${mercuryTransaction.id} has kind "${mercuryTransaction.kind}" but no cardId, skipping (not card-related)`);
              continue;
            }
            
            // Get real names from database for this transaction's card
            const { cardId: transactionCardId } = mercuryService.getCardIdFromTransaction(mercuryTransaction, mercuryTransactions);
            const card = transactionCardId ? await Card.findById(transactionCardId) : null;
            const user = transactionCardId ? await User.findById(transactionCardId) : null;
            
            // Convert Mercury transaction to Nano format (passing all transactions for chain lookup)
            const nanoTransaction = mercuryService.convertMercuryTransactionToNano(
              mercuryTransaction, 
              mercuryTransactions,
              card ? card.name : null,
              user ? user.username : null
            );
            
            // Only process transactions with valid cardId (now includes fees with resolved cardId)
            if (nanoTransaction.cardId) {
              if (!existingTransactionIds.has(nanoTransaction._id)) {
                // Nueva transacción
                batchResults.newTransactions.push(nanoTransaction);
              } else {
                // Actualizar transacción existente
                batchResults.transactionUpdates.push({
                  updateOne: {
                    filter: { _id: nanoTransaction._id },
                    update: {
                      $set: {
                        ...nanoTransaction,
                        updatedAt: new Date()
                      }
                    }
                  }
                });
              }
            } else {
              console.log(`   ⚠️ Transaction ${mercuryTransaction.id} has no cardId, skipping`);
            }
          } catch (error) {
            batchResults.batchErrors.push({
              transactionId: mercuryTransaction.id,
              error: error.message
            });
          }
        }
        
        return batchResults;
      });
      
      // Wait for all batches to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Collect results from all batches
      const allNewTransactions = [];
      const allTransactionUpdates = [];
      const allBatchErrors = [];
      
      batchResults.forEach(result => {
        allNewTransactions.push(...result.newTransactions);
        allTransactionUpdates.push(...result.transactionUpdates);
        allBatchErrors.push(...result.batchErrors);
      });
      
      // Bulk insert new transactions if any
      if (allNewTransactions.length > 0) {
        try {
          await Transaction.insertMany(allNewTransactions, { ordered: false });
          totalImported += allNewTransactions.length;
          
        } catch (insertError) {
          totalErrors += allNewTransactions.length;
        }
      }
      
      // Bulk update existing transactions if any
      if (allTransactionUpdates.length > 0) {
        try {
          await Transaction.bulkWrite(allTransactionUpdates, { ordered: false });
          totalUpdated += allTransactionUpdates.length;
        } catch (updateError) {
          totalErrors += allTransactionUpdates.length;
        }
      }
      
      // Collect errors
      errors.push(...allBatchErrors);
      totalErrors += allBatchErrors.length;
    }
    
    const totalTime = Date.now() - startTime;
    const timePerTransaction = (totalTime / mercuryTransactions.length).toFixed(2);
    
    const dateRangeInfo = start || end ? ` for date range ${start || 'beginning'} to ${end || 'now'}` : '';
    
    res.json({
      success: true,
      message: `OPTIMIZED Mercury ALL transactions import completed successfully${dateRangeInfo}`,
      summary: {
        totalTransactions: mercuryTransactions.length,
        imported: totalImported,
        updated: totalUpdated,
        errors: totalErrors,
        dateRange: {
          start: start || null,
          end: end || null
        },
        performance: {
          totalTime: totalTime,
          timePerTransaction: timePerTransaction
        }
      },
      errors: errors.slice(0, 5) // Mostrar solo los primeros 5 errores
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    res.status(500).json({
      success: false,
      error: 'Optimized Mercury ALL transactions import failed',
      message: error.message,
      performance: {
        totalTime: totalTime
      }
    });
  }
});

// NUEVO ENDPOINT: Refrescar stats de TODAS las Mercury cards
router.post('/refresh-all-stats', async (req, res) => {
  const startTime = Date.now();
  
  try {
    
    
    // Step 1: Get all Mercury cards from DB
    const Card = getCardModel();
    const mercuryCards = await Card.find({ supplier: 'mercury' }).lean();
    
    
    if (mercuryCards.length === 0) {
      return res.json({
        success: true,
        message: 'No Mercury cards found to refresh stats',
        summary: {
          totalCards: 0,
          refreshed: 0,
          errors: 0,
          performance: {
            totalTime: Date.now() - startTime,
            timePerCard: 0
          }
        }
      });
    }
    
    // Step 2: Process cards in batches (to avoid overwhelming the system)
    
    const batchSize = 3; // Smaller batches for stats refresh
    const batches = [];
    for (let i = 0; i < mercuryCards.length; i += batchSize) {
      batches.push(mercuryCards.slice(i, i + batchSize));
    }
    
    let totalRefreshed = 0;
    let totalErrors = 0;
    const errors = [];
    const results = [];
    
    // Process batches sequentially (to avoid overwhelming the database)
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      const batchPromises = batch.map(async (card) => {
        try {
          await StatsRefreshService.refreshCardStats(card._id);
          return { cardId: card._id, success: true };
        } catch (error) {
          return { cardId: card._id, success: false, error: error.message };
        }
      });
      
      // Wait for all cards in this batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Process results
      batchResults.forEach(result => {
        results.push(result);
        if (result.success) {
          totalRefreshed++;
        } else {
          totalErrors++;
          errors.push({
            cardId: result.cardId,
            error: result.error
          });
        }
      });
      
      // Small delay between batches to avoid overwhelming the system
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
      }
    }
    
    const totalTime = Date.now() - startTime;
    const timePerCard = (totalTime / mercuryCards.length).toFixed(2);

    
    res.json({
      success: true,
      message: 'Mercury ALL cards stats refresh completed successfully',
      summary: {
        totalCards: mercuryCards.length,
        refreshed: totalRefreshed,
        errors: totalErrors,
        performance: {
          totalTime: totalTime,
          timePerCard: timePerCard
        }
      },
      results: results,
      errors: errors.slice(0, 5) // Mostrar solo los primeros 5 errores
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    res.status(500).json({
      success: false,
      error: 'Mercury ALL cards stats refresh failed',
      message: error.message,
      performance: {
        totalTime: totalTime
      }
    });
  }
});

// ENDPOINT ESPECÍFICO PARA DEVELOPMENT: Refrescar stats de Mercury cards sin timeout
router.post('/refresh-dev-stats', async (req, res) => {
  const startTime = Date.now();
  
  try {
    
    
    // Step 1: Get Mercury cards directly from Mercury API (not from DB to avoid timeout)
    
    const mercuryCards = await mercuryService.getAllCards();
    
    
    if (mercuryCards.length === 0) {
      return res.json({
        success: true,
        message: 'No Mercury cards found in API',
        summary: {
          totalCards: 0,
          refreshed: 0,
          errors: 0,
          performance: {
            totalTime: Date.now() - startTime,
            timePerCard: 0
          }
        }
      });
    }
    
    // Step 2: Process cards one by one (to avoid overwhelming the system)
    
    
    let totalRefreshed = 0;
    let totalErrors = 0;
    const errors = [];
    const results = [];
    
    // Process cards sequentially with delays
    for (let i = 0; i < mercuryCards.length; i++) {
      const mercuryCard = mercuryCards[i];
      const cardId = mercuryCard.cardId;
      
      try {
        
        
        // Use the existing stats refresh service
        await StatsRefreshService.refreshCardStats(cardId);
        
        
        results.push({ cardId: cardId, success: true });
        totalRefreshed++;
        
        // Small delay between cards to avoid overwhelming the system
        if (i < mercuryCards.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
        
      } catch (error) {
        results.push({ cardId: cardId, success: false, error: error.message });
        totalErrors++;
        errors.push({
          cardId: cardId,
          error: error.message
        });
        
        // Continue with next card even if this one fails
        await new Promise(resolve => setTimeout(resolve, 500)); // Shorter delay on error
      }
    }
    
    const totalTime = Date.now() - startTime;
    const timePerCard = (totalTime / mercuryCards.length).toFixed(2);
    
    res.json({
      success: true,
      message: 'Mercury DEV cards stats refresh completed successfully',
      summary: {
        totalCards: mercuryCards.length,
        refreshed: totalRefreshed,
        errors: totalErrors,
        performance: {
          totalTime: totalTime,
          timePerCard: timePerCard
        }
      },
      results: results,
      errors: errors.slice(0, 10) // Mostrar hasta 10 errores
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    res.status(500).json({
      success: false,
      error: 'Mercury DEV cards stats refresh failed',
      message: error.message,
      performance: {
        totalTime: totalTime
      }
    });
  }
});

// Endpoint para ejecutar el script pull-movs-today
router.post('/pull-movs-today', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Importar el script
    const { pullMovsToday } = require('../../../scripts/pull-movs-today');
    
    // Ejecutar el script
    await pullMovsToday();
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    res.json({
      success: true,
      message: 'pull-movs-today executed successfully',
      summary: {
        totalTime: totalTime,
        executedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    res.status(500).json({
      success: false,
      error: error.message,
      summary: {
        totalTime: totalTime,
        executedAt: new Date().toISOString()
      }
    });
  }
});

// Endpoint OPTIMIZADO para ejecutar el script pull-movs-today con procesamiento en paralelo
router.post('/pull-movs-today-optimized', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting pull-movs-today endpoint...');
    
    // Importar el script optimizado
    const { pullMovsTodayOptimized } = require('../../../scripts/pull-movs-today-optimized');
    
    // Ejecutar el script optimizado
    await pullMovsTodayOptimized();
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    res.json({
      success: true,
      message: 'pull-movs-today OPTIMIZED executed successfully',
      summary: {
        totalTime: totalTime,
        executedAt: new Date().toISOString(),
        optimization: 'Parallel processing enabled'
      }
    });
    
  } catch (error) {
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    res.status(500).json({
      success: false,
      error: error.message,
      summary: {
        totalTime: totalTime,
        executedAt: new Date().toISOString(),
        optimization: 'Parallel processing failed'
      }
    });
  }
});

// Endpoint para refrescar stats de todas las cards Mercury
router.post('/refresh-all-mercury-stats', async (req, res) => {
  const startTime = Date.now();
  
  try {
    
    
    // Conectar a la base de datos
    await connectDatabases();
    
    // Esperar un momento para asegurar que la conexión esté establecida
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Obtener todas las cards Mercury
    const Card = getCardModel();
    const mercuryCards = await Card.find({ supplier: 'mercury' }).lean();
    
    
    if (mercuryCards.length === 0) {
      return res.json({
        success: true,
        message: 'No Mercury cards found',
        summary: {
          totalCards: 0,
          processed: 0,
          errors: 0,
          totalTime: Date.now() - startTime
        }
      });
    }
    
    // Estadísticas
    let processed = 0;
    let errors = 0;
    const results = [];
    
    // Procesar cada card
    for (let i = 0; i < mercuryCards.length; i++) {
      const card = mercuryCards[i];
      
      
      
      try {
        // Hacer petición al endpoint de refresh stats
        const config = require('../../../config/environment');
        const refreshUrl = `${config.BACKEND_URL}/api/stats/cards/${card._id}/refresh`;
        
        const response = await fetch(refreshUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const responseData = await response.json();
        
        if (response.ok && responseData.success) {
          console.log(`   ✅ Stats actualizados para ${card._id}`);
          processed++;
          
          results.push({
            cardId: card._id,
            cardName: card.name,
            status: 'success',
            message: 'Stats refreshed successfully'
          });
        } else {
          console.log(`   ❌ Error actualizando stats para ${card._id}: ${responseData.error || 'Unknown error'}`);
          errors++;
          
          results.push({
            cardId: card._id,
            cardName: card.name,
            status: 'error',
            message: responseData.error || 'Unknown error'
          });
        }
        
      } catch (error) {
        console.log(`   ❌ Error de conexión para ${card._id}: ${error.message}`);
        errors++;
        
        results.push({
          cardId: card._id,
          cardName: card.name,
          status: 'error',
          message: error.message
        });
      }
      
      // Pausa entre cards para evitar sobrecargar el servidor
      if (i < mercuryCards.length - 1) {
        console.log('   ⏳ Pausa de 1 segundo...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    
    res.json({
      success: true,
      message: 'Mercury cards stats refresh completed',
      summary: {
        totalCards: mercuryCards.length,
        processed: processed,
        errors: errors,
        totalTime: totalTime,
        executedAt: new Date().toISOString()
      },
      results: results
    });
    
  } catch (error) {
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    res.status(500).json({
      success: false,
      error: error.message,
      summary: {
        totalTime: totalTime,
        executedAt: new Date().toISOString()
      }
    });
  } finally {
    await closeDatabaseConnections();
  }
});

// Endpoint OPTIMIZADO para refrescar transacciones de TODAS las cards Mercury
router.post('/refresh-all-transactions', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const Card = getCardModel();
    const mercuryCards = await Card.find({ supplier: 'mercury' }).select('_id name userId');
    
    if (mercuryCards.length === 0) {
      return res.json({
        success: true,
        message: 'No Mercury cards found',
        summary: {
          totalCards: 0,
          transactionsRefreshed: 0,
          statsUpdated: 0,
          totalTime: Date.now() - startTime
        }
      });
    }
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0];
    const toDate = now.toISOString().split('T')[0];
    
    const Transaction = getTransactionModel();
    
    const existingTransactions = await Transaction.find({ 
      cardId: { $in: mercuryCards.map(card => card._id) },
      createdAt: { 
        $gte: thirtyDaysAgo,
        $lte: now
      }
    }, '_id cardId createdAt').lean();
    
    const existingTransactionIds = new Set(existingTransactions.map(t => t._id));
    
    const existingByCard = new Map();
    existingTransactions.forEach(tx => {
      if (!existingByCard.has(tx.cardId)) {
        existingByCard.set(tx.cardId, []);
      }
      existingByCard.get(tx.cardId).push(tx._id);
    });
    
    let totalTransactionsRefreshed = 0;
    let totalStatsUpdated = 0;
    let totalErrors = 0;
    const errors = [];
    
    const allMercuryTransactions = await mercuryService.getAllTransactions();
    
    // Filtrar transacciones de los últimos 30 días y por cards Mercury
    const recentTransactions = allMercuryTransactions.filter(tx => {
      const txDate = new Date(tx.datetime || tx.createdAt);
      const isRecent = txDate >= thirtyDaysAgo && txDate <= now;
      const hasMercuryCard = mercuryCards.some(card => 
        tx.details?.debitCardInfo?.id === card._id
      );
      return isRecent && hasMercuryCard;
    });
    
    const User = getUserModel();
    const cardDetailsMap = new Map();
    
    for (const card of mercuryCards) {
      const existingCount = existingByCard.get(card._id)?.length || 0;
      cardDetailsMap.set(card._id, {
        cardId: card._id,
        cardName: card.name,
        userId: card.userId,
        userName: 'Unknown',
        transactionsFound: 0,
        newTransactions: 0,
        newTransactionsList: [],
        existingInDb: existingCount
      });
      
      try {
        const user = await User.findById(card.userId);
        if (user && user.profile) {
          const userName = `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim() || user.username;
          cardDetailsMap.get(card._id).userName = userName;
        }
      } catch (userError) {
      }
    }
    
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < recentTransactions.length; i += BATCH_SIZE) {
      batches.push(recentTransactions.slice(i, i + BATCH_SIZE));
    }
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      for (const mercuryTransaction of batch) {
        try {
          const associatedCard = mercuryCards.find(card => 
            mercuryTransaction.details?.debitCardInfo?.id === card._id
          );
          
          if (!associatedCard) {
            continue;
          }
          
          const cardDetails = cardDetailsMap.get(associatedCard._id);
          if (cardDetails) {
            cardDetails.transactionsFound++;
          }
          
          const nanoTransaction = mercuryService.convertMercuryTransactionToNano(
            mercuryTransaction,
            allMercuryTransactions,
            associatedCard.name,
            associatedCard.name // Usar el nombre de la card como userName para Mercury
          );
          
          const isNew = !existingTransactionIds.has(nanoTransaction._id);
          
          if (isNew) {
            try {
              const newTransaction = new Transaction({
                ...nanoTransaction,
                createdAt: new Date(),
                updatedAt: new Date()
              });
              await newTransaction.save();
              
              totalTransactionsRefreshed++;
              
              if (cardDetails) {
                cardDetails.newTransactions++;
                cardDetails.newTransactionsList.push({
                  id: nanoTransaction._id,
                  operation: mercuryTransaction.operation,
                  amount: nanoTransaction.amount,
                  date: nanoTransaction.date,
                  name: nanoTransaction.name
                });
              }
              
              try {
                await StatsRefreshService.refreshCardStats(associatedCard._id);
                totalStatsUpdated++;
              } catch (statsError) {
                errors.push({
                  cardId: associatedCard._id,
                  error: `Stats error: ${statsError.message}`
                });
              }
              
            } catch (saveError) {
              errors.push({
                transactionId: nanoTransaction._id,
                error: saveError.message
              });
            }
          }
          
        } catch (transactionError) {
          errors.push({
            transactionId: mercuryTransaction.id,
            error: transactionError.message
          });
        }
      }
    }
    
    const debugInfo = Array.from(cardDetailsMap.values()).filter(card => card.newTransactions > 0 || card.transactionsFound > 0);
    
    const totalTime = Date.now() - startTime;
    const timePerCard = (totalTime / mercuryCards.length).toFixed(2);
    
    console.log(`✅ Mercury refresh completed: ${totalTransactionsRefreshed} new transactions (${totalTime}ms)`);
    
    
    res.json({
      success: true,
      message: 'OPTIMIZED Mercury transactions refresh completed successfully',
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        transactionsDb: require('../../../config/environment').TRANSACTIONS_DB_URI
      },
      summary: {
        totalCards: mercuryCards.length,
        cardsWithNewTransactions: debugInfo.filter(c => c.newTransactions > 0).length,
        newTransactionsCreated: totalTransactionsRefreshed,
        statsUpdated: totalStatsUpdated,
        errors: totalErrors,
        performance: {
          totalTime: totalTime,
          timePerCard: timePerCard,
          optimization: 'NEW transactions only from last 30 days + stats only if changes (for 10-minute execution)'
        }
      },
      dateRange: {
        from: fromDate,
        to: toDate,
        days: 30
      },
      cardsWithNewTransactions: debugInfo.filter(c => c.newTransactions > 0).map(card => ({
        cardId: card.cardId,
        cardName: card.cardName,
        userId: card.userId,
        userName: card.userName,
        newTransactions: card.newTransactionsList.map(tx => ({
          transactionId: tx.id,
          amount: tx.amount,
          date: tx.date,
          name: tx.name
        }))
      })),
      errors: errors.slice(0, 10)
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ OPTIMIZED Mercury transactions refresh error (${totalTime}ms):`, error);
    
    res.status(500).json({
      success: false,
      error: 'OPTIMIZED Mercury transactions refresh failed',
      message: error.message,
      performance: {
        totalTime: totalTime
      }
    });
  }
});

module.exports = router;