const express = require('express');
const router = express.Router();

// Importar modelos
const { getUserModel } = require('../../../models/User');
const { getCardModel } = require('../../../models/Card');
const { getTransactionModel } = require('../../../models/Transaction');

// Importar servicios
const mercuryService = require('../../../services/mercuryService');

// Endpoint para importar cards de Mercury - OPTIMIZADO
router.post('/import-real-data', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting OPTIMIZED Mercury cards import...');
    
    const User = getUserModel();
    const Card = getCardModel();
    
    // OPTIMIZACIÓN 1: Obtener datos existentes
    console.log('🔍 Step 1: Fetching existing data...');
    const [existingUsers, existingCards] = await Promise.all([
      User.find({}, '_id email').lean(),
      Card.find({}, '_id').lean()
    ]);
    
    const existingUserIds = new Set(existingUsers.map(u => u._id));
    const existingUserEmails = new Set(existingUsers.map(u => u.email));
    const existingCardIds = new Set(existingCards.map(c => c._id));
    
    console.log(`   ✅ Found ${existingUsers.length} existing users`);
    console.log(`   ✅ Found ${existingCards.length} existing cards`);
    
    // OPTIMIZACIÓN 2: Obtener cards de Mercury
    console.log('📥 Step 2: Fetching cards from Mercury...');
    const mercuryCards = await mercuryService.getAllCards();
    
    if (!mercuryCards || mercuryCards.length === 0) {
      return res.json({
        success: false,
        message: 'No cards found in Mercury'
      });
    }
    
    console.log(`   ✅ Found ${mercuryCards.length} cards from Mercury`);
    
    // OPTIMIZACIÓN 3: Procesar en lotes
    const batchSize = 20;
    const batches = [];
    for (let i = 0; i < mercuryCards.length; i += batchSize) {
      batches.push(mercuryCards.slice(i, i + batchSize));
    }
    
    console.log(`📦 Step 3: Processing ${batches.length} batches of ${batchSize} cards each...`);
    
    let importedUsers = 0;
    let importedCards = 0;
    const newUsers = [];
    const newCards = [];
    const errors = [];
    
    // OPTIMIZACIÓN 4: Procesar lotes en paralelo
    const processBatch = async (batch, batchIndex) => {
      const batchResults = {
        newUsers: [],
        newCards: [],
        errors: []
      };
      
      console.log(`   📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} cards)...`);
      
      for (const mercuryCard of batch) {
        try {
          const nanoCard = mercuryService.convertMercuryCardToNano(mercuryCard);
          
          // Crear usuario si no existe
          if (!existingUserIds.has(nanoCard.userId)) {
            let userEmail = `${nanoCard.userId}@mercury.xyz`;
            if (existingUserEmails.has(userEmail)) {
              userEmail = `${nanoCard.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@mercury.xyz`;
            }
            
            const newUser = {
              _id: nanoCard.userId,
              username: nanoCard.userId,
              email: userEmail,
              role: 'standard',
              profile: {
                firstName: nanoCard.name.split(' ')[0] || 'User',
                lastName: nanoCard.name.split(' ').slice(1).join(' ') || 'Card'
              },
              stats: {
                totalTransactions: 0,
                totalDeposited: 0,
                totalRefunded: 0,
                totalPosted: 0,
                totalPending: 0,
                totalAvailable: 0,
                lastLogin: new Date(),
                loginCount: 0
              },
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            batchResults.newUsers.push(newUser);
            existingUserIds.add(nanoCard.userId);
            existingUserEmails.add(userEmail);
          }
          
          // Crear card si no existe
          if (!existingCardIds.has(nanoCard._id)) {
            console.log(`   📝 Adding new Mercury card: ${nanoCard._id} (${nanoCard.name})`);
            batchResults.newCards.push(nanoCard);
            existingCardIds.add(nanoCard._id);
          } else {
            console.log(`   ⚠️ Mercury card already exists: ${nanoCard._id}`);
          }
          
        } catch (cardError) {
          console.error(`❌ Error processing Mercury card ${mercuryCard.cardId}:`, cardError);
          batchResults.errors.push({
            cardId: mercuryCard.cardId,
            error: cardError.message
          });
        }
      }
      
      return batchResults;
    };
    
    // Procesar lotes con control de concurrencia
    const maxConcurrent = 3;
    for (let i = 0; i < batches.length; i += maxConcurrent) {
      const currentBatches = batches.slice(i, i + maxConcurrent);
      const batchPromises = currentBatches.map((batch, index) => 
        processBatch(batch, i + index)
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // Consolidar resultados
      batchResults.forEach(result => {
        newUsers.push(...result.newUsers);
        newCards.push(...result.newCards);
        errors.push(...result.errors);
      });
    }
    
    console.log(`📊 Step 4: Consolidating results...`);
    console.log(`   - New users to create: ${newUsers.length}`);
    console.log(`   - New cards to create: ${newCards.length}`);
    console.log(`   - Errors: ${errors.length}`);
    
    // OPTIMIZACIÓN 5: Operaciones bulk en paralelo
    console.log(`💾 Step 5: Executing bulk operations...`);
    const bulkOperations = [];
    
    if (newUsers.length > 0) {
      bulkOperations.push(
        User.insertMany(newUsers, { ordered: false })
          .then(result => {
            importedUsers = result.length;
            console.log(`   ✅ Created ${importedUsers} users`);
          })
          .catch(err => {
            console.error(`   ❌ Error creating users:`, err.message);
            importedUsers = newUsers.length;
          })
      );
    }
    
    if (newCards.length > 0) {
      bulkOperations.push(
        Card.insertMany(newCards, { ordered: false })
          .then(result => {
            importedCards = result.length;
            console.log(`   ✅ Created ${importedCards} Mercury cards`);
            console.log(`   📋 Cards created:`, result.map(card => `${card._id} (${card.name})`));
          })
          .catch(err => {
            console.error(`   ❌ Error creating Mercury cards:`, err);
            console.error(`   📋 Error details:`, err.message);
            if (err.writeErrors) {
              console.error(`   📋 Write errors:`, err.writeErrors);
            }
            importedCards = 0;
          })
      );
    } else {
      console.log(`   ⚠️ No new cards to create`);
    }
    
    await Promise.all(bulkOperations);
    
    const totalTime = Date.now() - startTime;
    const timePerCard = (totalTime / mercuryCards.length).toFixed(2);
    
    console.log('🎉 OPTIMIZED Mercury cards import completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total cards processed: ${mercuryCards.length}`);
    console.log(`   - Users imported: ${importedUsers}`);
    console.log(`   - Cards imported: ${importedCards}`);
    console.log(`   - Errors: ${errors.length}`);
    console.log(`   - Total time: ${totalTime}ms`);
    console.log(`   - Time per card: ${timePerCard}ms`);
    
    res.json({
      success: true,
      message: 'OPTIMIZED Mercury cards import completed successfully',
      summary: {
        totalCards: mercuryCards.length,
        usersImported: importedUsers,
        cardsImported: importedCards,
        errors: errors.length,
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

// Endpoint para refrescar transacciones de Mercury - OPTIMIZADO
router.post('/refresh-transactions/:cardId', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cardId } = req.params;
    
    console.log(`🚀 Starting OPTIMIZED Mercury transaction refresh for card: ${cardId}`);
    
    const User = getUserModel();
    const Card = getCardModel();
    const Transaction = getTransactionModel();
    
    // OPTIMIZACIÓN 1: Obtener datos existentes
    console.log('🔍 Step 1: Fetching existing data...');
    const [card, existingTransactions] = await Promise.all([
      Card.findById(cardId).lean(),
      Transaction.find({ supplier: 'mercury' }, '_id').lean()
    ]);
    
    const existingTransactionIds = new Set(existingTransactions.map(t => t._id));
    const userId = card ? card.userId : cardId;
    
    console.log(`   ✅ Card: ${card ? 'FOUND' : 'NOT FOUND'} (${card?.name || 'N/A'})`);
    console.log(`   ✅ User ID: ${userId}`);
    console.log(`   ✅ Existing Mercury transactions: ${existingTransactionIds.size}`);
    
    // OPTIMIZACIÓN 2: Obtener TODAS las transacciones de Mercury
    console.log('📥 Step 2: Fetching ALL transactions from Mercury...');
    const allMercuryTransactions = await mercuryService.getAllTransactions();
    
    console.log(`   ✅ Total transactions fetched from Mercury: ${allMercuryTransactions.length}`);
    
    if (allMercuryTransactions.length === 0) {
      return res.json({
        success: true,
        message: `No transactions found in Mercury`,
        summary: {
          cardId: cardId,
          totalTransactions: 0,
          imported: 0,
          updated: 0
        }
      });
    }
    
    // OPTIMIZACIÓN 3: Procesar TODAS las transacciones en lotes
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < allMercuryTransactions.length; i += batchSize) {
      batches.push(allMercuryTransactions.slice(i, i + batchSize));
    }
    
    console.log(`📦 Step 3: Processing ${batches.length} batches of ${batchSize} transactions each...`);
    
    let importedTransactions = 0;
    let updatedTransactions = 0;
    const newTransactions = [];
    const transactionUpdates = [];
    const errors = [];
    
    // OPTIMIZACIÓN 4: Procesar lotes en paralelo
    const processBatch = async (batch, batchIndex) => {
      const batchResults = {
        newTransactions: [],
        transactionUpdates: [],
        errors: []
      };
      
      console.log(`   📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} transactions)...`);
      
      for (const mercuryTransaction of batch) {
        try {
          const nanoTransaction = mercuryService.convertMercuryTransactionToNano(mercuryTransaction);
          
          // Solo procesar si tiene cardId válido Y coincide con la card solicitada
          if (nanoTransaction.cardId && nanoTransaction.cardId === cardId) {
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
          } else if (!nanoTransaction.cardId) {
            console.log(`   ⚠️ Transaction ${mercuryTransaction.id} has no cardId, skipping`);
          } else {
            // Transaction para otra card, skip
            console.log(`   ⏭️ Transaction ${mercuryTransaction.id} is for card ${nanoTransaction.cardId}, not ${cardId}, skipping`);
          }
          
        } catch (transactionError) {
          console.error(`❌ Error processing Mercury transaction ${mercuryTransaction.id}:`, transactionError);
          batchResults.errors.push({
            transactionId: mercuryTransaction.id,
            error: transactionError.message
          });
        }
      }
      
      return batchResults;
    };
    
    // Procesar lotes con control de concurrencia
    const maxConcurrent = 2;
    for (let i = 0; i < batches.length; i += maxConcurrent) {
      const currentBatches = batches.slice(i, i + maxConcurrent);
      const batchPromises = currentBatches.map((batch, index) => 
        processBatch(batch, i + index)
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // Consolidar resultados
      batchResults.forEach(result => {
        newTransactions.push(...result.newTransactions);
        transactionUpdates.push(...result.transactionUpdates);
        errors.push(...result.errors);
      });
    }
    
    console.log(`📊 Step 4: Consolidating results...`);
    console.log(`   - New transactions to create: ${newTransactions.length}`);
    console.log(`   - Transactions to update: ${transactionUpdates.length}`);
    console.log(`   - Errors: ${errors.length}`);
    
    // OPTIMIZACIÓN 5: Operaciones bulk en paralelo
    console.log(`💾 Step 5: Executing bulk operations...`);
    const bulkOperations = [];
    
    if (newTransactions.length > 0) {
      bulkOperations.push(
        Transaction.insertMany(newTransactions, { ordered: false })
          .then(result => {
            importedTransactions = result.length;
            console.log(`   ✅ Created ${importedTransactions} transactions`);
          })
          .catch(err => {
            console.error(`   ❌ Error creating transactions:`, err.message);
            importedTransactions = newTransactions.length;
          })
      );
    }
    
    if (transactionUpdates.length > 0) {
      bulkOperations.push(
        Transaction.bulkWrite(transactionUpdates, { ordered: false })
          .then(result => {
            updatedTransactions = result.modifiedCount;
            console.log(`   ✅ Updated ${updatedTransactions} transactions`);
          })
          .catch(err => {
            console.error(`   ❌ Error updating transactions:`, err.message);
            updatedTransactions = transactionUpdates.length;
          })
      );
    }
    
    await Promise.all(bulkOperations);
    
    // OPTIMIZACIÓN 6: Actualizar stats de la card específica
    console.log(`📊 Step 6: Updating stats for card ${cardId}...`);
    try {
      if (card) {
        // Obtener todas las transacciones de Mercury para esta card
        const cardTransactions = await Transaction.find({ 
          cardId: cardId, 
          supplier: 'mercury' 
        });
        
        console.log(`   ✅ Found ${cardTransactions.length} Mercury transactions for card ${cardId}`);
        
        // Calcular stats con las operaciones de Mercury
        let money_in = 0;
        let refund = 0;
        let posted_approved = 0;
        let reversed = 0;
        let rejected = 0;
        let pending = 0;
        
        cardTransactions.forEach(transaction => {
          const amount = transaction.amount || 0;
          
          switch (transaction.operation) {
            case 'MERCURY_SENT':
            case 'MERCURY_PENDING':
              posted_approved += amount;
              break;
            case 'MERCURY_FAILED':
            case 'MERCURY_REJECTED':
              rejected += amount;
              break;
            case 'MERCURY_REVERSED':
              reversed += amount;
              break;
            case 'MERCURY_CANCELLED':
            case 'MERCURY_BLOCKED':
              pending += amount;
              break;
          }
        });
        
        // Actualizar stats de la card
        const updatedStats = {
          money_in: money_in,
          refund: refund,
          posted: posted_approved,
          reversed: reversed,
          rejected: rejected,
          pending: pending,
          available: money_in + refund + reversed - posted_approved - pending
        };
        
        await Card.updateOne(
          { _id: cardId },
          {
            $set: {
              'stats.money_in': updatedStats.money_in,
              'stats.refund': updatedStats.refund,
              'stats.posted': updatedStats.posted,
              'stats.reversed': updatedStats.reversed,
              'stats.rejected': updatedStats.rejected,
              'stats.pending': updatedStats.pending,
              'stats.available': updatedStats.available,
              'updatedAt': new Date()
            }
          }
        );
        
        console.log(`   ✅ Updated stats for Mercury card: ${cardId}`);
        console.log(`   - money_in: $${updatedStats.money_in}`);
        console.log(`   - refund: $${updatedStats.refund}`);
        console.log(`   - posted: $${updatedStats.posted}`);
        console.log(`   - reversed: $${updatedStats.reversed}`);
        console.log(`   - rejected: $${updatedStats.rejected}`);
        console.log(`   - pending: $${updatedStats.pending}`);
        console.log(`   - available: $${updatedStats.available}`);
      }
    } catch (statsError) {
      console.error(`❌ Error updating card stats:`, statsError);
    }
    
    const totalTime = Date.now() - startTime;
    const timePerTransaction = (totalTime / allMercuryTransactions.length).toFixed(2);
    
    console.log('🎉 OPTIMIZED Mercury transaction refresh completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total transactions processed: ${allMercuryTransactions.length}`);
    console.log(`   - Transactions imported: ${importedTransactions}`);
    console.log(`   - Transactions updated: ${updatedTransactions}`);
    console.log(`   - Total time: ${totalTime}ms`);
    console.log(`   - Time per transaction: ${timePerTransaction}ms`);
    
    res.json({
      success: true,
      message: 'OPTIMIZED Mercury transaction refresh completed successfully',
      summary: {
        cardId: cardId,
        totalTransactions: allMercuryTransactions.length,
        imported: importedTransactions,
        updated: updatedTransactions,
        errors: errors.length,
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
            // Convert Mercury transaction to Nano format
            const nanoTransaction = mercuryService.convertMercuryTransactionToNano(mercuryTransaction);
            
            // Only process transactions with valid cardId
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
      
      const batchResults = await Promise.all(batchPromises);
      
      // Consolidate results from all batches
      const allNewTransactions = [];
      const allTransactionUpdates = [];
      const allBatchErrors = [];
      
      batchResults.forEach(result => {
        allNewTransactions.push(...result.newTransactions);
        allTransactionUpdates.push(...result.transactionUpdates);
        allBatchErrors.push(...result.batchErrors);
      });
      
      // Execute bulk operations for this batch
      const bulkOperations = [];
      
      if (allNewTransactions.length > 0) {
        bulkOperations.push(
          Transaction.insertMany(allNewTransactions, { ordered: false })
            .then(result => {
              console.log(`   ✅ Created ${result.length} transactions`);
              totalImported += result.length;
            })
            .catch(err => {
              console.error(`   ❌ Error creating transactions:`, err.message);
              totalImported += allNewTransactions.length;
            })
        );
      }
      
      if (allTransactionUpdates.length > 0) {
        bulkOperations.push(
          Transaction.bulkWrite(allTransactionUpdates, { ordered: false })
            .then(result => {
              console.log(`   ✅ Updated ${result.modifiedCount} transactions`);
              totalUpdated += result.modifiedCount;
            })
            .catch(err => {
              console.error(`   ❌ Error updating transactions:`, err.message);
              totalUpdated += allTransactionUpdates.length;
            })
        );
      }
      
      await Promise.all(bulkOperations);
      
      // Add errors to total
      totalErrors += allBatchErrors.length;
      errors.push(...allBatchErrors);
    }
    
    const totalTime = Date.now() - startTime;
    const timePerTransaction = totalTime / mercuryTransactions.length;
    
    console.log('🎉 OPTIMIZED Mercury ALL transactions import completed!');
    console.log('📊 Summary:');
    console.log(`   - Total transactions processed: ${mercuryTransactions.length}`);
    console.log(`   - Transactions imported: ${totalImported}`);
    console.log(`   - Transactions updated: ${totalUpdated}`);
    console.log(`   - Total time: ${totalTime}ms`);
    console.log(`   - Time per transaction: ${timePerTransaction.toFixed(2)}ms`);
    
    res.json({
      success: true,
      message: 'OPTIMIZED Mercury ALL transactions import completed successfully',
      summary: {
        totalTransactions: mercuryTransactions.length,
        imported: totalImported,
        updated: totalUpdated,
        errors: totalErrors,
        performance: {
          totalTime,
          timePerTransaction: timePerTransaction.toFixed(2)
        }
      },
      errors: errors
    });
    
  } catch (error) {
    console.error('❌ Error in Mercury ALL transactions import:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error importing Mercury transactions'
    });
  }
});

module.exports = router;
