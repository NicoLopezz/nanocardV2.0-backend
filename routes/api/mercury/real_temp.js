const express = require('express');
const router = express.Router();
const mercuryService = require('../../../services/mercuryService');
const { getUserModel } = require('../../../models/User');
const { getCardModel } = require('../../../models/Card');
const { getTransactionModel } = require('../../../models/Transaction');
const { connectDatabases, closeDatabaseConnections } = require('../../../config/database');
const StatsRefreshService = require('../../../services/statsRefreshService');

// Endpoint para importar cards de Mercury - OPTIMIZADO
router.post('/import-real-data', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting OPTIMIZED Mercury cards import...');
    
    // Step 1: Get existing users and cards from DB (for deduplication)
    console.log('📊 Step 1: Getting existing users and cards from DB...');
    const User = getUserModel();
    const Card = getCardModel();
    
    const existingUsers = await User.find({}).lean();
    const existingCards = await Card.find({ supplier: 'mercury' }).lean();
    
    const existingUserIds = new Set(existingUsers.map(u => u._id));
    const existingCardIds = new Set(existingCards.map(c => c._id));
    
    console.log(`✅ Found ${existingUserIds.size} existing users and ${existingCardIds.size} existing Mercury cards in DB`);
    
    // Step 2: Fetch all Mercury cards
    console.log('📊 Step 2: Fetching all Mercury cards...');
    const mercuryCards = await mercuryService.getAllCards();
    console.log(`✅ Fetched ${mercuryCards.length} total Mercury cards`);
    
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
    
    // Step 3: Process cards in batches
    console.log('📊 Step 3: Processing cards in batches...');
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < mercuryCards.length; i += batchSize) {
      batches.push(mercuryCards.slice(i, i + batchSize));
    }
    
    let totalUsersImported = 0;
    let totalCardsImported = 0;
    let totalErrors = 0;
    const errors = [];
    
    // Process batches in parallel (max 2 concurrent batches)
    const maxConcurrentBatches = 2;
    for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
      const currentBatches = batches.slice(i, i + maxConcurrentBatches);
      
      const batchPromises = currentBatches.map(async (batch, batchIndex) => {
        const globalBatchIndex = i + batchIndex;
        console.log(`📦 Processing batch ${globalBatchIndex + 1}/${batches.length} (${batch.length} cards)...`);
        
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
                name: nanoCard.name,
                email: `${nanoCard.userId}@mercury.com`, // Email genérico para Mercury users
                role: 'user',
                isActive: true,
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
              console.log(`   📝 Adding new Mercury card: ${nanoCard._id} for user ${nanoCard.userId}`);
              batchResults.newCards.push(nanoCard);
            } else {
              console.log(`   ✅ Mercury card ${nanoCard._id} already exists, skipping`);
            }
            
          } catch (error) {
            console.error(`   ❌ Error processing card ${mercuryCard.cardId}:`, error.message);
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
        console.log(`📊 Bulk inserting ${allNewUsers.length} new users...`);
        try {
          await User.insertMany(allNewUsers, { ordered: false });
          totalUsersImported += allNewUsers.length;
          console.log(`✅ Successfully inserted ${allNewUsers.length} new users`);
        } catch (insertError) {
          console.error(`❌ Error bulk inserting users:`, insertError.message);
          totalErrors += allNewUsers.length;
        }
      }
      
      // Bulk insert new cards if any
      if (allNewCards.length > 0) {
        console.log(`📊 Bulk inserting ${allNewCards.length} new cards...`);
        try {
          await Card.insertMany(allNewCards, { ordered: false });
          totalCardsImported += allNewCards.length;
          console.log(`✅ Successfully inserted ${allNewCards.length} new cards`);
        } catch (insertError) {
          console.error(`❌ Error bulk inserting cards:`, insertError.message);
          totalErrors += allNewCards.length;
        }
      }
      
      // Collect errors
      errors.push(...allBatchErrors);
      totalErrors += allBatchErrors.length;
    }
    
    const totalTime = Date.now() - startTime;
    const timePerCard = (totalTime / mercuryCards.length).toFixed(2);
    
    console.log(`🎉 OPTIMIZED Mercury cards import completed:`);
    console.log(`   - Total cards processed: ${mercuryCards.length}`);
    console.log(`   - Users imported: ${totalUsersImported}`);
    console.log(`   - Cards imported: ${totalCardsImported}`);
    console.log(`   - Errors: ${totalErrors}`);
    console.log(`   - Total time: ${totalTime}ms`);
    console.log(`   - Time per card: ${timePerCard}ms`);
    
    res.json({
      success: true,
      message: 'OPTIMIZED Mercury cards import completed successfully',
      summary: {
        totalCards: mercuryCards.length,
        usersImported: totalUsersImported,
        cardsImported: totalCardsImported,
        errors: totalErrors,
        performance: {
          totalTime: totalTime,
          timePerCard: timePerCard
        }
      },
      errors: errors.slice(0, 5) // Mostrar solo los primeros 5 errores
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ Optimized Mercury cards import error (${totalTime}ms):`, error);
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
    console.log(`🚀 Starting OPTIMIZED Mercury transaction refresh for card: ${cardId}`);
    
    // Step 1: Get existing card and transactions from DB (in parallel)
    console.log('📊 Step 1: Getting existing card and transactions from DB...');
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
    console.log('📊 Step 2: Fetching all Mercury transactions...');
    const allMercuryTransactions = await mercuryService.getAllTransactions();
    console.log(`✅ Fetched ${allMercuryTransactions.length} total Mercury transactions`);
    
    // Step 3: Filter transactions for this specific card
    console.log('📊 Step 3: Filtering transactions for card...');
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
    console.log('📊 Step 4: Processing transactions in batches...');
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
        console.log(`📦 Processing batch ${globalBatchIndex + 1}/${batches.length} (${batch.length} transactions)...`);
        
        const batchResults = {
          newTransactions: [],
          transactionUpdates: [],
          batchErrors: []
        };
        
        for (const mercuryTransaction of batch) {
          try {
            // Convert Mercury transaction to Nano format (passing all transactions for chain lookup)
            const nanoTransaction = mercuryService.convertMercuryTransactionToNano(mercuryTransaction, allMercuryTransactions);
            
            // Only process transactions with valid cardId (now includes fees with resolved cardId)
            if (nanoTransaction.cardId === cardId) {
              if (!existingTransactionIds.has(nanoTransaction._id)) {
                // Nueva transacción
                console.log(`   📝 Adding new Mercury transaction: ${nanoTransaction._id} for card ${nanoTransaction.cardId}`);
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
            console.error(`   ❌ Error processing transaction ${mercuryTransaction.id}:`, error.message);
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
        console.log(`📊 Bulk inserting ${allNewTransactions.length} new transactions...`);
        try {
          await Transaction.insertMany(allNewTransactions, { ordered: false });
          totalImported += allNewTransactions.length;
          console.log(`✅ Successfully inserted ${allNewTransactions.length} new transactions`);
        } catch (insertError) {
          console.error(`❌ Error bulk inserting transactions:`, insertError.message);
          totalErrors += allNewTransactions.length;
        }
      }
      
      // Bulk update existing transactions if any
      if (allTransactionUpdates.length > 0) {
        console.log(`📊 Bulk updating ${allTransactionUpdates.length} existing transactions...`);
        try {
          await Transaction.bulkWrite(allTransactionUpdates, { ordered: false });
          totalUpdated += allTransactionUpdates.length;
          console.log(`✅ Successfully updated ${allTransactionUpdates.length} existing transactions`);
        } catch (updateError) {
          console.error(`❌ Error bulk updating transactions:`, updateError.message);
          totalErrors += allTransactionUpdates.length;
        }
      }
      
      // Collect errors
      errors.push(...allBatchErrors);
      totalErrors += allBatchErrors.length;
    }
    
    // Step 5: Update card stats using MongoDB aggregation
    console.log('📊 Step 5: Updating card stats...');
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
      console.log(`✅ Card stats updated for ${cardId}`);
      
    } catch (statsError) {
      console.error(`❌ Error updating card stats:`, statsError.message);
    }
    
    const totalTime = Date.now() - startTime;
    const timePerTransaction = (totalTime / cardTransactions.length).toFixed(2);
    
    console.log(`🎉 OPTIMIZED Mercury transaction refresh completed:`);
    console.log(`   - Card ID: ${cardId}`);
    console.log(`   - Total transactions processed: ${cardTransactions.length}`);
    console.log(`   - Transactions imported: ${totalImported}`);
    console.log(`   - Transactions updated: ${totalUpdated}`);
    console.log(`   - Errors: ${totalErrors}`);
    console.log(`   - Total time: ${totalTime}ms`);
    console.log(`   - Time per transaction: ${timePerTransaction}ms`);
    
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
    console.error(`❌ Optimized Mercury transaction refresh error (${totalTime}ms):`, error);
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
    console.log('🚀 Starting OPTIMIZED Mercury ALL transactions import...');
    
    // Step 1: Fetch all Mercury transactions
    console.log('📊 Step 1: Fetching all Mercury transactions...');
    const mercuryTransactions = await mercuryService.getAllTransactions();
    console.log(`✅ Fetched ${mercuryTransactions.length} total Mercury transactions`);
    
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
    console.log('📊 Step 2: Getting existing transactions from DB...');
    const Transaction = getTransactionModel();
    const existingTransactions = await Transaction.find({ supplier: 'mercury' }).lean();
    const existingTransactionIds = new Set(existingTransactions.map(t => t._id));
    console.log(`✅ Found ${existingTransactionIds.size} existing Mercury transactions in DB`);
    
    // Step 3: Process transactions in batches
    console.log('📊 Step 3: Processing transactions in batches...');
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
        console.log(`📦 Processing batch ${globalBatchIndex + 1}/${batches.length} (${batch.length} transactions)...`);
        
        const batchResults = {
          newTransactions: [],
          transactionUpdates: [],
          batchErrors: []
        };
        
        for (const mercuryTransaction of batch) {
          try {
            // Convert Mercury transaction to Nano format (passing all transactions for chain lookup)
            const nanoTransaction = mercuryService.convertMercuryTransactionToNano(mercuryTransaction, mercuryTransactions);
            
            // Only process transactions with valid cardId (now includes fees with resolved cardId)
            if (nanoTransaction.cardId) {
              if (!existingTransactionIds.has(nanoTransaction._id)) {
                // Nueva transacción
                console.log(`   📝 Adding new Mercury transaction: ${nanoTransaction._id} for card ${nanoTransaction.cardId}`);
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
            console.error(`   ❌ Error processing transaction ${mercuryTransaction.id}:`, error.message);
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
        console.log(`📊 Bulk inserting ${allNewTransactions.length} new transactions...`);
        try {
          await Transaction.insertMany(allNewTransactions, { ordered: false });
          totalImported += allNewTransactions.length;
          console.log(`✅ Successfully inserted ${allNewTransactions.length} new transactions`);
        } catch (insertError) {
          console.error(`❌ Error bulk inserting transactions:`, insertError.message);
          totalErrors += allNewTransactions.length;
        }
      }
      
      // Bulk update existing transactions if any
      if (allTransactionUpdates.length > 0) {
        console.log(`📊 Bulk updating ${allTransactionUpdates.length} existing transactions...`);
        try {
          await Transaction.bulkWrite(allTransactionUpdates, { ordered: false });
          totalUpdated += allTransactionUpdates.length;
          console.log(`✅ Successfully updated ${allTransactionUpdates.length} existing transactions`);
        } catch (updateError) {
          console.error(`❌ Error bulk updating transactions:`, updateError.message);
          totalErrors += allTransactionUpdates.length;
        }
      }
      
      // Collect errors
      errors.push(...allBatchErrors);
      totalErrors += allBatchErrors.length;
    }
    
    const totalTime = Date.now() - startTime;
    const timePerTransaction = (totalTime / mercuryTransactions.length).toFixed(2);
    
    console.log(`🎉 OPTIMIZED Mercury ALL transactions import completed:`);
    console.log(`   - Total transactions processed: ${mercuryTransactions.length}`);
    console.log(`   - Transactions imported: ${totalImported}`);
    console.log(`   - Transactions updated: ${totalUpdated}`);
    console.log(`   - Errors: ${totalErrors}`);
    console.log(`   - Total time: ${totalTime}ms`);
    console.log(`   - Time per transaction: ${timePerTransaction}ms`);
    
    res.json({
      success: true,
      message: 'OPTIMIZED Mercury ALL transactions import completed successfully',
      summary: {
        totalTransactions: mercuryTransactions.length,
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
    console.error(`❌ Optimized Mercury ALL transactions import error (${totalTime}ms):`, error);
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
    console.log('🚀 Starting Mercury ALL cards stats refresh...');
    
    // Step 1: Get all Mercury cards from DB
    console.log('📊 Step 1: Getting all Mercury cards from DB...');
    const Card = getCardModel();
    const mercuryCards = await Card.find({ supplier: 'mercury' }).lean();
    console.log(`✅ Found ${mercuryCards.length} Mercury cards in DB`);
    
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
    console.log('📊 Step 2: Processing cards in batches...');
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
      console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} cards)...`);
      
      const batchPromises = batch.map(async (card) => {
        try {
          console.log(`   🔄 Refreshing stats for card: ${card._id}`);
          await StatsRefreshService.refreshCardStats(card._id);
          console.log(`   ✅ Stats refreshed for card: ${card._id}`);
          return { cardId: card._id, success: true };
        } catch (error) {
          console.error(`   ❌ Error refreshing stats for card ${card._id}:`, error.message);
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
    
    console.log(`🎉 Mercury ALL cards stats refresh completed:`);
    console.log(`   - Total cards processed: ${mercuryCards.length}`);
    console.log(`   - Cards refreshed: ${totalRefreshed}`);
    console.log(`   - Errors: ${totalErrors}`);
    console.log(`   - Total time: ${totalTime}ms`);
    console.log(`   - Time per card: ${timePerCard}ms`);
    
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
    console.error(`❌ Mercury ALL cards stats refresh error (${totalTime}ms):`, error);
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

module.exports = router;