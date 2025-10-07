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
    
    // OPTIMIZACIÓN: Eliminar Step 4 - pull-movs-today trae todas las transacciones
    console.log(`⚡ OPTIMIZED: Skipping individual transaction import - pull-movs-today will handle all transactions`);
    let totalTransactionsImported = 0;
    let totalTransactionsUpdated = 0;
    const transactionErrors = [];
    
    // NUEVO PASO: Ejecutar pull-movs-today para traer todas las transacciones
    console.log(`📥 Step 5: Executing pull-movs-today to import all Mercury transactions...`);
    let pullMovsResult = null;
    const pullMovsErrors = [];
    
    try {
      console.log(`   🚀 Calling pull-movs-today OPTIMIZED endpoint...`);
      
      // OPTIMIZACIÓN: Usar endpoint optimizado con procesamiento en paralelo
      const pullMovsUrl = `http://localhost:3001/api/real-mercury/pull-movs-today-optimized`;
      const response = await fetch(pullMovsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        pullMovsResult = await response.json();
        console.log(`   ✅ pull-movs-today OPTIMIZED executed successfully`);
        console.log(`   📊 Total time: ${pullMovsResult.summary?.totalTime || 'N/A'}ms`);
        console.log(`   ⚡ OPTIMIZATION: Parallel processing enabled`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (pullMovsError) {
      console.error(`   ❌ Error executing pull-movs-today OPTIMIZED:`, pullMovsError.message);
      pullMovsErrors.push({
        step: 'pull-movs-today-optimized',
        error: pullMovsError.message
      });
    }
    
    // NUEVO PASO: Refresh stats para todas las cards procesadas (DESPUÉS de importar transacciones)
    console.log(`📊 Step 6: Refreshing stats for all processed Mercury cards...`);
    let statsRefreshed = 0;
    const statsErrors = [];
    
    // Obtener todas las cards Mercury que fueron procesadas
    const allMercuryCards = await Card.find({ supplier: 'mercury' }).select('_id');
    
    if (allMercuryCards.length > 0) {
      console.log(`   🔄 Refreshing stats for ${allMercuryCards.length} Mercury cards...`);
      
      // OPTIMIZACIÓN: Procesar stats en lotes más grandes para mejor rendimiento
      const statsBatchSize = 30;
      for (let i = 0; i < allMercuryCards.length; i += statsBatchSize) {
        const batch = allMercuryCards.slice(i, i + statsBatchSize);
        
        const batchPromises = batch.map(async (card) => {
          try {
            const cardId = card._id;
            
            // OPTIMIZACIÓN: Usar servicio directo en lugar de HTTP
            await StatsRefreshService.refreshCardStats(cardId);
            
            statsRefreshed++;
            console.log(`     ✅ Stats refreshed for card ${cardId}`);
          } catch (statsError) {
            console.error(`     ❌ Error refreshing stats for card ${card._id}:`, statsError.message);
            statsErrors.push({
              cardId: card._id,
              error: statsError.message
            });
          }
        });
        
        await Promise.all(batchPromises);
      }
      
      console.log(`   ✅ Stats refreshed for ${statsRefreshed} Mercury cards`);
      if (statsErrors.length > 0) {
        console.log(`   ⚠️ Stats errors: ${statsErrors.length}`);
      }
    } else {
      console.log(`   ⚡ No Mercury cards to refresh stats`);
    }
    
    const totalTime = Date.now() - startTime;
    const timePerCard = (totalTime / mercuryCards.length).toFixed(2);
    
    console.log(`🎉 OPTIMIZED Mercury cards import with transactions and stats completed:`);
    console.log(`   - Total cards processed: ${mercuryCards.length}`);
    console.log(`   - Users imported: ${totalUsersImported}`);
    console.log(`   - Cards imported: ${totalCardsImported}`);
    console.log(`   - Transactions imported: ${totalTransactionsImported}`);
    console.log(`   - Transactions updated: ${totalTransactionsUpdated}`);
    console.log(`   - Stats refreshed: ${statsRefreshed}`);
    console.log(`   - pull-movs-today executed: ${pullMovsResult ? 'Yes' : 'No'}`);
    console.log(`   - Card import errors: ${totalErrors}`);
    console.log(`   - Transaction errors: ${transactionErrors.length}`);
    console.log(`   - Stats errors: ${statsErrors.length}`);
    console.log(`   - pull-movs errors: ${pullMovsErrors.length}`);
    console.log(`   - Total time: ${totalTime}ms`);
    console.log(`   - Time per card: ${timePerCard}ms`);
    
    res.json({
      success: true,
      message: 'OPTIMIZED Mercury cards import with transactions and stats completed successfully',
      summary: {
        totalCards: mercuryCards.length,
        usersImported: totalUsersImported,
        cardsImported: totalCardsImported,
        transactionsImported: totalTransactionsImported,
        transactionsUpdated: totalTransactionsUpdated,
        statsRefreshed: statsRefreshed,
        pullMovsExecuted: pullMovsResult ? true : false,
        pullMovsTime: pullMovsResult?.summary?.totalTime || null,
        cardImportErrors: totalErrors,
        transactionErrors: transactionErrors.length,
        statsErrors: statsErrors.length,
        pullMovsErrors: pullMovsErrors.length,
        performance: {
          totalTime: totalTime,
          timePerCard: timePerCard
        }
      },
      pullMovsResult: pullMovsResult,
      errors: {
        cardImport: errors.slice(0, 5),
        transaction: transactionErrors.slice(0, 5),
        stats: statsErrors.slice(0, 5),
        pullMovs: pullMovsErrors.slice(0, 5)
      }
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
    
    // Obtener parámetros de fecha del body (opcionales)
    const { start, end } = req.body;
    
    // Construir opciones para el servicio Mercury
    const options = {};
    if (start) {
      options.startDate = start;
      console.log(`📅 Date range START: ${start}`);
    }
    if (end) {
      options.endDate = end;
      console.log(`📅 Date range END: ${end}`);
    }
    
    if (start || end) {
      console.log(`📊 Importing Mercury transactions for date range: ${start || 'beginning'} to ${end || 'now'}`);
    } else {
      console.log(`📊 Importing ALL Mercury transactions (no date filter)`);
    }
    
    // Step 1: Fetch Mercury transactions with date range
    console.log('📊 Step 1: Fetching Mercury transactions...');
    const mercuryTransactions = await mercuryService.getAllTransactions(options);
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
    
    // Esperar un momento para asegurar que la conexión esté establecida
    await new Promise(resolve => setTimeout(resolve, 1000));
    
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
            // Solo procesar transacciones que tengan cardId (directo o por relatedTransactions)
            const hasDirectCardId = mercuryTransaction.details?.debitCardInfo?.id;
            const hasRelatedTransactions = mercuryTransaction.relatedTransactions?.length > 0;
            
            if (!hasDirectCardId && !hasRelatedTransactions) {
              console.log(`   ⚠️ Transaction ${mercuryTransaction.id} has kind "${mercuryTransaction.kind}" but no cardId, skipping (not card-related)`);
              continue;
            }
            
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

// ENDPOINT ESPECÍFICO PARA DEVELOPMENT: Refrescar stats de Mercury cards sin timeout
router.post('/refresh-dev-stats', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting Mercury DEV cards stats refresh (no timeout)...');
    
    // Step 1: Get Mercury cards directly from Mercury API (not from DB to avoid timeout)
    console.log('📊 Step 1: Getting Mercury cards from API...');
    const mercuryCards = await mercuryService.getAllCards();
    console.log(`✅ Found ${mercuryCards.length} Mercury cards from API`);
    
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
    console.log('📊 Step 2: Processing cards individually...');
    
    let totalRefreshed = 0;
    let totalErrors = 0;
    const errors = [];
    const results = [];
    
    // Process cards sequentially with delays
    for (let i = 0; i < mercuryCards.length; i++) {
      const mercuryCard = mercuryCards[i];
      const cardId = mercuryCard.cardId;
      
      try {
        console.log(`🔄 [${i + 1}/${mercuryCards.length}] Refreshing stats for card: ${cardId}`);
        
        // Use the existing stats refresh service
        await StatsRefreshService.refreshCardStats(cardId);
        
        console.log(`✅ [${i + 1}/${mercuryCards.length}] Stats refreshed for card: ${cardId}`);
        results.push({ cardId: cardId, success: true });
        totalRefreshed++;
        
        // Small delay between cards to avoid overwhelming the system
        if (i < mercuryCards.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
        
      } catch (error) {
        console.error(`❌ [${i + 1}/${mercuryCards.length}] Error refreshing stats for card ${cardId}:`, error.message);
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
    
    console.log(`🎉 Mercury DEV cards stats refresh completed:`);
    console.log(`   - Total cards processed: ${mercuryCards.length}`);
    console.log(`   - Cards refreshed: ${totalRefreshed}`);
    console.log(`   - Errors: ${totalErrors}`);
    console.log(`   - Total time: ${totalTime}ms`);
    console.log(`   - Time per card: ${timePerCard}ms`);
    
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
    console.error(`❌ Mercury DEV cards stats refresh error (${totalTime}ms):`, error);
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
    console.log('🚀 Iniciando pull-movs-today endpoint...');
    
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
    console.error('❌ Error executing pull-movs-today:', error);
    
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
    console.log('🚀 Iniciando pull-movs-today OPTIMIZED endpoint...');
    console.log('⚡ OPTIMIZACIÓN: Procesamiento en paralelo habilitado');
    
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
    console.error('❌ Error executing pull-movs-today OPTIMIZED:', error);
    
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
    console.log('🚀 Iniciando refresh de stats para todas las cards Mercury...');
    
    // Conectar a la base de datos
    await connectDatabases();
    
    // Esperar un momento para asegurar que la conexión esté establecida
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Obtener todas las cards Mercury
    const Card = getCardModel();
    const mercuryCards = await Card.find({ supplier: 'mercury' }).lean();
    
    console.log(`📊 Encontradas ${mercuryCards.length} cards Mercury`);
    
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
      
      console.log(`📊 Procesando card ${i + 1}/${mercuryCards.length}: ${card._id}`);
      
      try {
        // Hacer petición al endpoint de refresh stats
        const refreshUrl = `http://localhost:3001/api/stats/cards/${card._id}/refresh`;
        
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
    
    console.log('=' .repeat(60));
    console.log('🎉 REFRESH DE STATS COMPLETADO');
    console.log('=' .repeat(60));
    console.log(`📊 Resumen:`);
    console.log(`   📈 Total cards: ${mercuryCards.length}`);
    console.log(`   ✅ Procesadas: ${processed}`);
    console.log(`   ❌ Errores: ${errors}`);
    console.log(`   ⏱️ Tiempo total: ${(totalTime / 1000).toFixed(2)}s`);
    
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
    console.error('❌ Error executing refresh-all-mercury-stats:', error);
    
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

module.exports = router;