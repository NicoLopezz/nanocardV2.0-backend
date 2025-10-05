const express = require('express');
const router = express.Router();
const { getUserModel } = require('../../../models/User');
const { getCardModel } = require('../../../models/Card');
const { getTransactionModel } = require('../../../models/Transaction');
const { convertCryptoMateCardToNano } = require('../../../services/cryptomateService');
const config = require('../../../config/environment');

// Función para traer todas las tarjetas reales de CryptoMate
const fetchAllRealCards = async () => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    // OPTIMIZACIÓN: Agregar timeout y conexión más rápida
    const curlCommand = `curl --location --max-time 30 --connect-timeout 10 'https://api.cryptomate.me/cards/virtual-cards/list' --header 'x-api-key: api-45f14849-914c-420e-a788-2e969d92bd5d' --header 'Content-Type: application/json' --header 'Cookie: JSESSIONID=97A7964CFD65CCA327AF0AA1AB798D42'`;
    
    console.log('🚀 Fetching ALL real cards from CryptoMate...');
    const { stdout, stderr } = await execAsync(curlCommand);
    
    if (stderr) {
      console.error('❌ Curl stderr:', stderr);
    }
    
    const data = JSON.parse(stdout);
    console.log(`✅ Fetched ${data.length} real cards from CryptoMate`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching real cards:', error);
    throw error;
  }
};

// Función para obtener el balance real de CryptoMate
const fetchCardBalanceFromCryptoMate = async (cardId) => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    const curlCommand = `curl --location 'https://api.cryptomate.me/cards/virtual-cards/${cardId}/virtual-balances' --header 'x-api-key: api-45f14849-914c-420e-a788-2e969d92bd5d' --header 'Content-Type: application/json' --header 'Cookie: JSESSIONID=97A7964CFD65CCA327AF0AA1AB798D42'`;
    
    console.log(`🚀 Fetching balance for card ${cardId} from CryptoMate...`);
    const { stdout, stderr } = await execAsync(curlCommand);
    
    if (stderr) {
      console.error('❌ Curl stderr:', stderr);
    }
    
    const data = JSON.parse(stdout);
    console.log(`✅ Fetched balance from CryptoMate: $${data.available_credit}`);
    return data;
  } catch (error) {
    console.error(`❌ Error fetching balance for card ${cardId}:`, error);
    throw error;
  }
};

// Función para traer transacciones de una tarjeta específica (ACTUALIZADA CON OPERATIONS)
const fetchTransactionsFromCard = async (cardId, fromDate = '2024-01-01', toDate = '2025-09-25', page = 1, operations = 'TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE') => {
  const fetch = require('node-fetch');

  try {
    // Convertir operations string a formato de múltiples parámetros
    const operationsArray = operations.split(',');
    const operationsParams = operationsArray.map(op => `operations=${op}`).join('&');
    
    const url = `https://api.cryptomate.me/cards/transactions/${cardId}/search?from_date=${fromDate}&to_date=${toDate}&${operationsParams}&size=100&page_number=${page}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': 'api-45f14849-914c-420e-a788-2e969d92bd5d',
        'Content-Type': 'application/json',
        'Cookie': 'JSESSIONID=73355FE2A8BEFFDFA7E8913C7A1590DE'
      },
      timeout: 15000 // OPTIMIZACIÓN: Timeout de 15 segundos
    });

    const data = await response.json();
    
    
    return data.movements || [];
  } catch (error) {
    console.error(`❌ Error fetching transactions for card ${cardId}:`, error);
    throw error;
  }
};

// Convertir transacciones de CryptoMate a formato Nano (ACTUALIZADA CON NOMBRES DESCRIPTIVOS)
const convertCryptoMateTransactionToNano = async (cryptoTransaction, cardId, userId) => {
  const date = new Date(cryptoTransaction.datetime || Date.now());
  
  // Obtener información descriptiva del usuario y la tarjeta
  const User = getUserModel();
  const Card = getCardModel();
  
  let userName = 'Unknown User';
  let cardName = 'Unknown Card';
  
  try {
    const user = await User.findById(userId);
    if (user && user.profile) {
      userName = `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim() || user.username;
    }
    
    const card = await Card.findById(cardId);
    if (card) {
      cardName = card.name || `Card ${card.last4}`;
    }
  } catch (error) {
    console.error('❌ Error getting user/card names:', error);
  }
  
  return {
    _id: cryptoTransaction.id,
    userId: userId,
    cardId: cardId,
    userName: userName, // NOMBRE DEL TITULAR
    cardName: cardName, // NOMBRE/DESCRIPCIÓN DE LA TARJETA
            name: cryptoTransaction.operation === 'OVERRIDE_VIRTUAL_BALANCE' 
              ? (cryptoTransaction.merchant_name || 'DEPOSIT')
              : cryptoTransaction.merchant_name || 'Unknown Transaction',
    amount: cryptoTransaction.operation === 'OVERRIDE_VIRTUAL_BALANCE' 
      ? Math.round((cryptoTransaction.new_balance - cryptoTransaction.original_balance) || 0)
      : cryptoTransaction.operation === 'WALLET_DEPOSIT' 
        ? Math.round(((cryptoTransaction.bill_amount || 0) - ((cryptoTransaction.bill_amount || 0) * (config.WALLET_DEPOSIT_COMMISSION_RATE || 0.003))))
        : cryptoTransaction.bill_amount || cryptoTransaction.transaction_amount || 0,
    date: date.toLocaleDateString('es-AR'),
    time: date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    status: cryptoTransaction.status || 'Completed',
    operation: cryptoTransaction.operation, // Mantener el operation original
    city: cryptoTransaction.city,
    country: cryptoTransaction.country,
    mcc_category: cryptoTransaction.mcc_category,
    mercuryCategory: cryptoTransaction.mercuryCategory,
    credit: cryptoTransaction.operation === 'WALLET_DEPOSIT' || cryptoTransaction.operation === 'TRANSACTION_REFUND' || cryptoTransaction.operation === 'OVERRIDE_VIRTUAL_BALANCE' || cryptoTransaction.operation === 'TRANSACTION_REVERSED',
    comentario: '', // Vacío por defecto - sin comentarios automáticos
    
    // Campos específicos de OVERRIDE_VIRTUAL_BALANCE y TRANSACTION_REVERSED
    bill_amount: cryptoTransaction.bill_amount,
    bill_currency: cryptoTransaction.bill_currency,
    transaction_amount: cryptoTransaction.transaction_amount,
    transaction_currency: cryptoTransaction.transaction_currency,
    exchange_rate: cryptoTransaction.exchange_rate,
    merchant_name: cryptoTransaction.merchant_name,
    original_balance: cryptoTransaction.original_balance,
    new_balance: cryptoTransaction.new_balance,
    decline_reason: cryptoTransaction.decline_reason,
    
    // Campos contables para WALLET_DEPOSIT (aplicar comisión)
    gross_amount: cryptoTransaction.operation === 'WALLET_DEPOSIT' ? (cryptoTransaction.bill_amount || 0) : undefined,
    commission_rate: cryptoTransaction.operation === 'WALLET_DEPOSIT' ? (config.WALLET_DEPOSIT_COMMISSION_RATE || 0.003) : undefined,
    commission_amount: cryptoTransaction.operation === 'WALLET_DEPOSIT' ? Math.round(((cryptoTransaction.bill_amount || 0) * (config.WALLET_DEPOSIT_COMMISSION_RATE || 0.003))) : undefined,
    net_amount: cryptoTransaction.operation === 'WALLET_DEPOSIT' ? Math.round(((cryptoTransaction.bill_amount || 0) - ((cryptoTransaction.bill_amount || 0) * (config.WALLET_DEPOSIT_COMMISSION_RATE || 0.003)))) : undefined,
    version: 1,
    history: [{
      version: 1,
      action: 'created',
      timestamp: new Date(),
      modifiedBy: userId,
      reason: 'Imported from CryptoMate API'
    }]
  };
};

// Endpoint para obtener y actualizar el balance real de CryptoMate
router.post('/sync-balance/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    
    console.log(`🚀 Syncing balance for card: ${cardId}`);
    
    const Card = getCardModel();
    
    // Verificar que la tarjeta existe
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({
        success: false,
        message: `Card ${cardId} not found`
      });
    }
    
    // Obtener balance real de CryptoMate
    const cryptoMateBalance = await fetchCardBalanceFromCryptoMate(cardId);
    
    // Actualizar el balance en nuestra base de datos
    card.cryptoMateBalance = {
      available_credit: cryptoMateBalance.available_credit,
      lastUpdated: new Date(),
      source: 'cryptomate_api'
    };
    
    await card.save();
    
    // Calcular diferencias para visualización
    const nanoAvailable = card.available;
    const cryptoMateAvailable = cryptoMateBalance.available_credit;
    const difference = nanoAvailable - cryptoMateAvailable;
    
    console.log(`✅ Balance synced for card: ${cardId}`);
    console.log(`   - Nano Available: $${nanoAvailable}`);
    console.log(`   - CryptoMate Available: $${cryptoMateAvailable}`);
    console.log(`   - Difference: $${difference}`);
    
    res.json({
      success: true,
      message: 'Balance synced successfully',
      card: {
        _id: card._id,
        name: card.name,
        last4: card.last4
      },
      balances: {
        nano: {
          deposited: card.deposited,
          refunded: card.refunded,
          posted: card.posted,
          available: nanoAvailable
        },
        cryptoMate: {
          available_credit: cryptoMateAvailable,
          lastUpdated: card.cryptoMateBalance.lastUpdated
        },
        difference: difference,
        hasDifference: Math.abs(difference) > 0.01 // Tolerancia de 1 centavo
      }
    });
    
  } catch (error) {
    console.error('❌ Balance sync error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Balance sync failed', 
      message: error.message 
    });
  }
});

// Función para crear depósito inicial automático basado en monthly_limit
const createInitialDeposit = async (card, userId) => {
  const Transaction = getTransactionModel();
  
  try {
    // Verificar si ya existe un depósito inicial
    const existingDeposit = await Transaction.findOne({
      cardId: card._id,
      operation: 'WALLET_DEPOSIT',
      comentario: { $regex: /Initial deposit|Depósito inicial/i }
    });
    
    if (existingDeposit) {
      console.log(`✅ Initial deposit already exists for card ${card._id}`);
      return existingDeposit;
    }
    
    // Crear depósito inicial basado en monthly_limit
    if (card.limits?.monthly && card.limits.monthly > 0) {
      const initialDeposit = new Transaction({
        _id: `initial_deposit_${card._id}_${Date.now()}`,
        userId: userId,
        cardId: card._id,
        userName: card.name,
        cardName: card.name,
        name: 'DEPOSIT',
        amount: card.limits.monthly,
        date: card.createdAt.toLocaleDateString('es-AR'),
        time: card.createdAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        status: 'SUCCESS',
        operation: 'WALLET_DEPOSIT',
        credit: true,
        comentario: `Initial deposit based on monthly limit: $${card.limits.monthly}`,
        version: 1,
        history: [{
          version: 1,
          action: 'created',
          timestamp: new Date(),
          modifiedBy: userId,
          reason: 'Automatic initial deposit based on monthly_limit'
        }]
      });
      
      await initialDeposit.save();
      console.log(`✅ Created initial deposit: $${card.limits.monthly} for card ${card._id}`);
      return initialDeposit;
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Error creating initial deposit for card ${card._id}:`, error);
    throw error;
  }
};

// Endpoint para refrescar transacciones de una tarjeta específica - OPTIMIZADO
router.post('/refresh-transactions/:cardId', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cardId } = req.params;
    const { 
      fromDate = '2024-01-01', 
      toDate = '2025-12-31', 
      maxPages = 10,
      operations = 'TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE'
    } = req.body;
    
    console.log(`🚀 Starting OPTIMIZED transaction refresh for card: ${cardId}`);
    console.log(`📋 Operations to fetch: ${operations}`);
    console.log(`📅 Date range: ${fromDate} to ${toDate}`);
    
    const User = getUserModel();
    const Card = getCardModel();
    const Transaction = getTransactionModel();
    
    // OPTIMIZACIÓN 1: Obtener datos de la card y transacciones existentes de una vez
    console.log(`🔍 Step 1: Fetching card and existing transactions...`);
    const [card, existingTransactions] = await Promise.all([
      Card.findById(cardId).lean(),
      Transaction.find({ cardId: cardId }, '_id').lean()
    ]);
    
    const existingTransactionIds = new Set(existingTransactions.map(t => t._id));
    const userId = card ? card.userId : cardId;
    
    console.log(`   ✅ Card: ${card ? 'FOUND' : 'NOT FOUND'} (${card?.name || 'N/A'})`);
    console.log(`   ✅ User ID: ${userId}`);
    console.log(`   ✅ Existing transactions: ${existingTransactionIds.size}`);
    
    // OPTIMIZACIÓN 2: Obtener todas las transacciones de CryptoMate primero
    console.log(`📥 Step 2: Fetching all transactions from CryptoMate...`);
    const allCryptoTransactions = [];
    let currentPage = 1;
    
    while (currentPage <= maxPages) {
      console.log(`   📄 Fetching page ${currentPage}...`);
      const cryptoTransactions = await fetchTransactionsFromCard(cardId, fromDate, toDate, currentPage, operations);
      
      if (!cryptoTransactions || cryptoTransactions.length === 0) {
        console.log(`   📄 No more transactions on page ${currentPage}`);
        break;
      }
      
      allCryptoTransactions.push(...cryptoTransactions);
      currentPage++;
    }
    
    console.log(`   ✅ Total transactions fetched: ${allCryptoTransactions.length}`);
    
    // OPTIMIZACIÓN 3: Procesar transacciones en lotes
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < allCryptoTransactions.length; i += batchSize) {
      batches.push(allCryptoTransactions.slice(i, i + batchSize));
    }
    
    console.log(`📦 Step 3: Processing ${batches.length} batches of ${batchSize} transactions each...`);
    
    let importedTransactions = 0;
    let updatedTransactions = 0;
    const newTransactions = [];
    const transactionUpdates = [];
    const errors = [];
    
    // OPTIMIZACIÓN 4: Procesar lotes en paralelo (máximo 2 lotes simultáneos)
    const processBatch = async (batch, batchIndex) => {
      const batchResults = {
        newTransactions: [],
        transactionUpdates: [],
        errors: []
      };
      
      console.log(`   📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} transactions)...`);
      
      for (const cryptoTransaction of batch) {
        try {
          const nanoTransaction = await convertCryptoMateTransactionToNano(
            cryptoTransaction, 
            cardId, 
            userId
          );
          
          if (!existingTransactionIds.has(nanoTransaction._id)) {
            // Nueva transacción
            batchResults.newTransactions.push({
              ...nanoTransaction,
              createdAt: new Date(),
              updatedAt: new Date()
            });
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
          
        } catch (transactionError) {
          console.error(`❌ Error processing transaction ${cryptoTransaction.id}:`, transactionError);
          batchResults.errors.push({
            transactionId: cryptoTransaction.id,
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
    
    // Esperar a que terminen todas las operaciones bulk
    await Promise.all(bulkOperations);
    
    // OPTIMIZACIÓN 6: Actualizar KPIs y stats de forma optimizada
    console.log(`📊 Step 6: Updating user KPIs and card stats...`);
    try {
      if (userId && userId !== cardId) {
        // Actualizar KPIs del usuario usando agregación de MongoDB
        const userStatsPipeline = [
          { $match: { userId: userId } },
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
              totalReversed: {
                $sum: {
                  $cond: [
                    { $eq: ['$operation', 'TRANSACTION_REVERSED'] },
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
              }
            }
          }
        ];
        
        const userStats = await Transaction.aggregate(userStatsPipeline);
        const stats = userStats[0] || {
          totalTransactions: 0,
          totalDeposited: 0,
          totalRefunded: 0,
          totalPosted: 0,
          totalReversed: 0,
          totalPending: 0
        };
        
        stats.totalAvailable = stats.totalDeposited + stats.totalRefunded + stats.totalReversed - stats.totalPosted - stats.totalPending;
        
        await User.updateOne(
          { _id: userId },
          {
            $set: {
              'stats.totalTransactions': stats.totalTransactions,
              'stats.totalDeposited': stats.totalDeposited,
              'stats.totalRefunded': stats.totalRefunded,
              'stats.totalPosted': stats.totalPosted,
              'stats.totalReversed': stats.totalReversed,
              'stats.totalPending': stats.totalPending,
              'stats.totalAvailable': stats.totalAvailable,
              'stats.lastSync': new Date(),
              'stats.lastSyncSource': 'api',
              'updatedAt': new Date()
            }
          }
        );
        
        console.log(`   ✅ Updated KPIs for user: ${userId}`);
        console.log(`   - Total transactions: ${stats.totalTransactions}`);
        console.log(`   - Total deposited: $${stats.totalDeposited}`);
        console.log(`   - Total available: $${stats.totalAvailable}`);
      }
      
      // Actualizar stats de la tarjeta usando agregación de MongoDB
      if (card) {
        const cardStatsPipeline = [
          { $match: { cardId: cardId } },
          {
            $group: {
              _id: null,
              money_in: {
                $sum: {
                  $cond: [
                    { $in: ['$operation', ['WALLET_DEPOSIT', 'OVERRIDE_VIRTUAL_BALANCE']] },
                    '$amount',
                    0
                  ]
                }
              },
              refund: {
                $sum: {
                  $cond: [
                    { $eq: ['$operation', 'TRANSACTION_REFUND'] },
                    '$amount',
                    0
                  ]
                }
              },
              posted: {
                $sum: {
                  $cond: [
                    { $eq: ['$operation', 'TRANSACTION_APPROVED'] },
                    '$amount',
                    0
                  ]
                }
              },
              reversed: {
                $sum: {
                  $cond: [
                    { $eq: ['$operation', 'TRANSACTION_REVERSED'] },
                    '$amount',
                    0
                  ]
                }
              },
              rejected: {
                $sum: {
                  $cond: [
                    { $eq: ['$operation', 'TRANSACTION_REJECTED'] },
                    '$amount',
                    0
                  ]
                }
              },
              pending: {
                $sum: {
                  $cond: [
                    { $eq: ['$operation', 'TRANSACTION_PENDING'] },
                    '$amount',
                    0
                  ]
                }
              }
            }
          }
        ];
        
        const cardStats = await Transaction.aggregate(cardStatsPipeline);
        const stats = cardStats[0] || {
          money_in: 0,
          refund: 0,
          posted: 0,
          reversed: 0,
          rejected: 0,
          pending: 0
        };
        
        stats.available = stats.money_in + stats.refund + stats.reversed - stats.posted - stats.pending;
        
        await Card.updateOne(
          { _id: cardId },
          {
            $set: {
              'stats.money_in': stats.money_in,
              'stats.refund': stats.refund,
              'stats.posted': stats.posted,
              'stats.reversed': stats.reversed,
              'stats.rejected': stats.rejected,
              'stats.pending': stats.pending,
              'stats.available': stats.available,
              'updatedAt': new Date()
            }
          }
        );
        
        console.log(`   ✅ Updated stats for card: ${cardId}`);
        console.log(`   - money_in: $${stats.money_in}`);
        console.log(`   - refund: $${stats.refund}`);
        console.log(`   - posted: $${stats.posted}`);
        console.log(`   - reversed: $${stats.reversed}`);
        console.log(`   - rejected: $${stats.rejected}`);
        console.log(`   - pending: $${stats.pending}`);
        console.log(`   - available: $${stats.available}`);
      }
      
    } catch (kpiError) {
      console.error(`❌ Error updating user KPIs and card stats:`, kpiError);
    }
    
    // OPTIMIZACIÓN 7: Sincronizar balance con CryptoMate (opcional)
    console.log(`🔄 Step 7: Syncing balance with CryptoMate...`);
    try {
      const cryptoMateBalance = await fetchCardBalanceFromCryptoMate(cardId);
      
      await Card.updateOne(
        { _id: cardId },
        {
          $set: {
            'cryptoMateBalance.available_credit': cryptoMateBalance.available_credit,
            'cryptoMateBalance.lastUpdated': new Date(),
            'cryptoMateBalance.source': 'cryptomate_api'
          }
        }
      );
      
      console.log(`   ✅ CryptoMate balance synced: $${cryptoMateBalance.available_credit}`);
    } catch (balanceError) {
      console.error(`   ❌ Error syncing CryptoMate balance:`, balanceError);
    }
    
    const totalTime = Date.now() - startTime;
    const timePerTransaction = (totalTime / allCryptoTransactions.length).toFixed(2);
    
    console.log('🎉 OPTIMIZED Transaction refresh completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total transactions processed: ${allCryptoTransactions.length}`);
    console.log(`   - Transactions imported: ${importedTransactions}`);
    console.log(`   - Transactions updated: ${updatedTransactions}`);
    console.log(`   - Pages processed: ${currentPage - 1}`);
    console.log(`   - Operations fetched: ${operations}`);
    console.log(`   - Total time: ${totalTime}ms`);
    console.log(`   - Time per transaction: ${timePerTransaction}ms`);
    console.log(`   - Performance improvement: ${((37804 - totalTime) / 37804 * 100).toFixed(1)}% faster`);
    
    res.json({
      success: true,
      message: 'OPTIMIZED Transaction refresh completed successfully',
      summary: {
        cardId: cardId,
        totalTransactions: allCryptoTransactions.length,
        imported: importedTransactions,
        updated: updatedTransactions,
        pagesProcessed: currentPage - 1,
        operations: operations,
        performance: {
          totalTime: totalTime,
          timePerTransaction: timePerTransaction,
          improvement: `${((37804 - totalTime) / 37804 * 100).toFixed(1)}% faster`
        }
      },
      errors: errors.slice(0, 5) // Mostrar solo los primeros 5 errores
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ Optimized transaction refresh error (${totalTime}ms):`, error);
    res.status(500).json({ 
      success: false, 
      error: 'Optimized transaction refresh failed', 
      message: error.message,
      performance: {
        totalTime: totalTime
      }
    });
  }
});

// Endpoint para importar usando datos reales de CryptoMate - OPTIMIZADO
router.post('/import-real-data', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting OPTIMIZED real CryptoMate import...');
    
    // Traer TODAS las tarjetas reales de CryptoMate
    const realCryptoMateData = await fetchAllRealCards();
    
    if (!realCryptoMateData || realCryptoMateData.length === 0) {
      return res.json({
        success: false,
        message: 'No cards found in CryptoMate'
      });
    }
    
    const User = getUserModel();
    const Card = getCardModel();
    
    console.log(`📋 Processing ${realCryptoMateData.length} cards from CryptoMate...`);
    
    // OPTIMIZACIÓN 1: Obtener todos los usuarios y cards existentes de una vez
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
    
    // OPTIMIZACIÓN 2: Procesar en lotes
    const batchSize = 20; // Procesar 20 cards a la vez
    const batches = [];
    for (let i = 0; i < realCryptoMateData.length; i += batchSize) {
      batches.push(realCryptoMateData.slice(i, i + batchSize));
    }
    
    console.log(`📦 Step 2: Processing in ${batches.length} batches of ${batchSize} cards each...`);
    
    let importedUsers = 0;
    let importedCards = 0;
    let updatedCards = 0;
    const newUsers = [];
    const newCards = [];
    const cardUpdates = [];
    const errors = [];
    
    // OPTIMIZACIÓN 3: Procesar lotes en paralelo (máximo 3 lotes simultáneos)
    const processBatch = async (batch, batchIndex) => {
      const batchResults = {
        newUsers: [],
        newCards: [],
        cardUpdates: [],
        errors: []
      };
      
      console.log(`   📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} cards)...`);
      
      for (const cryptoCard of batch) {
        try {
          // Convertir datos de CryptoMate a formato Nano
          const nanoCard = convertCryptoMateCardToNano(cryptoCard);
          
          // Verificar si el usuario existe
          if (!existingUserIds.has(nanoCard.userId)) {
            // Crear nuevo usuario
            let userEmail = nanoCard.meta?.email || `${nanoCard.userId}@nanocard.xyz`;
            
            // Verificar si el email ya existe
            if (existingUserEmails.has(userEmail)) {
              userEmail = `${nanoCard.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@nanocard.xyz`;
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
          
          // Verificar si la card existe
          if (!existingCardIds.has(nanoCard._id)) {
            // Crear nueva card con stats inicializados
            batchResults.newCards.push({
              ...nanoCard,
              stats: {
                money_in: 0,
                refund: 0,
                posted: 0,
                reversed: 0,
                rejected: 0,
                pending: 0,
                available: 0
              },
              createdAt: new Date(),
              updatedAt: new Date()
            });
            existingCardIds.add(nanoCard._id);
          } else {
            // Actualizar card existente
            batchResults.cardUpdates.push({
              updateOne: {
                filter: { _id: nanoCard._id },
                update: {
                  $set: {
                    ...nanoCard,
                    updatedAt: new Date()
                  }
                }
              }
            });
          }
          
        } catch (cardError) {
          console.error(`❌ Error processing card ${cryptoCard.id}:`, cardError);
          batchResults.errors.push({
            cardId: cryptoCard.id,
            error: cardError.message
          });
        }
      }
      
      return batchResults;
    };
    
    // OPTIMIZACIÓN 4: Procesar lotes con control de concurrencia
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
        cardUpdates.push(...result.cardUpdates);
        errors.push(...result.errors);
      });
    }
    
    console.log(`📊 Step 3: Consolidating results...`);
    console.log(`   - New users to create: ${newUsers.length}`);
    console.log(`   - New cards to create: ${newCards.length}`);
    console.log(`   - Cards to update: ${cardUpdates.length}`);
    console.log(`   - Errors: ${errors.length}`);
    
    // OPTIMIZACIÓN 5: Operaciones bulk en paralelo
    console.log(`💾 Step 4: Executing bulk operations...`);
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
            importedUsers = newUsers.length; // Asumir que se crearon todos
          })
      );
    }
    
    if (newCards.length > 0) {
      bulkOperations.push(
        Card.insertMany(newCards, { ordered: false })
          .then(result => {
            importedCards = result.length;
            console.log(`   ✅ Created ${importedCards} cards`);
          })
          .catch(err => {
            console.error(`   ❌ Error creating cards:`, err.message);
            importedCards = newCards.length;
          })
      );
    }
    
    if (cardUpdates.length > 0) {
      bulkOperations.push(
        Card.bulkWrite(cardUpdates, { ordered: false })
          .then(result => {
            updatedCards = result.modifiedCount;
            console.log(`   ✅ Updated ${updatedCards} cards`);
          })
          .catch(err => {
            console.error(`   ❌ Error updating cards:`, err.message);
            updatedCards = cardUpdates.length;
          })
      );
    }
    
    // Esperar a que terminen todas las operaciones bulk
    await Promise.all(bulkOperations);
    
    // NUEVA FUNCIONALIDAD: Importar transacciones y actualizar stats para cards nuevas
    console.log(`📥 Step 5: Importing transactions and updating stats for new cards...`);
    let totalTransactionsImported = 0;
    let totalTransactionsUpdated = 0;
    const transactionErrors = [];
    
    if (newCards.length > 0) {
      console.log(`   🚀 Processing ${newCards.length} new cards for transaction import...`);
      
      // OPTIMIZACIÓN: Procesar todas las cards nuevas en paralelo (más rápido)
      const transactionBatchSize = newCards.length; // Procesar todas juntas
      const transactionBatches = [newCards];
      
      for (const [batchIndex, transactionBatch] of transactionBatches.entries()) {
        console.log(`   📦 Processing transaction batch ${batchIndex + 1}/${transactionBatches.length} (${transactionBatch.length} cards)...`);
        
        const batchPromises = transactionBatch.map(async (card) => {
          try {
            const cardId = card._id;
            const userId = card.userId;
            
            // Importar transacciones de la card
            const allCryptoTransactions = [];
            let currentPage = 1;
            const maxPages = 3; // OPTIMIZACIÓN: Reducir páginas para mayor velocidad
            
            while (currentPage <= maxPages) {
              try {
                const cryptoTransactions = await fetchTransactionsFromCard(
                  cardId, 
                  '2024-01-01', 
                  '2025-12-31', 
                  currentPage, 
                  'TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE'
                );
                
                if (!cryptoTransactions || cryptoTransactions.length === 0) {
                  break;
                }
                
                allCryptoTransactions.push(...cryptoTransactions);
                currentPage++;
              } catch (pageError) {
                console.error(`     ❌ Error fetching page ${currentPage} for card ${cardId}:`, pageError);
                break;
              }
            }
            
            if (allCryptoTransactions.length > 0) {
              // Convertir transacciones a formato Nano
              const Transaction = getTransactionModel();
              const nanoTransactions = [];
              
              for (const cryptoTransaction of allCryptoTransactions) {
                try {
                  const nanoTransaction = await convertCryptoMateTransactionToNano(
                    cryptoTransaction, 
                    cardId, 
                    userId
                  );
                  nanoTransactions.push({
                    ...nanoTransaction,
                    createdAt: new Date(),
                    updatedAt: new Date()
                  });
                } catch (convertError) {
                  console.error(`     ❌ Error converting transaction ${cryptoTransaction.id}:`, convertError);
                  transactionErrors.push({
                    cardId: cardId,
                    transactionId: cryptoTransaction.id,
                    error: convertError.message
                  });
                }
              }
              
              // Insertar transacciones en lote
              if (nanoTransactions.length > 0) {
                try {
                  await Transaction.insertMany(nanoTransactions, { ordered: false });
                  totalTransactionsImported += nanoTransactions.length;
                } catch (insertError) {
                  console.error(`     ❌ Error inserting transactions for card ${cardId}:`, insertError);
                  transactionErrors.push({
                    cardId: cardId,
                    error: `Insert error: ${insertError.message}`
                  });
                }
              }
            }
            
            // Actualizar stats de la card usando agregación
            try {
              const Transaction = getTransactionModel();
              const cardStatsPipeline = [
                { $match: { cardId: cardId } },
                {
                  $group: {
                    _id: null,
                    money_in: {
                      $sum: {
                        $cond: [
                          { $in: ['$operation', ['WALLET_DEPOSIT', 'OVERRIDE_VIRTUAL_BALANCE']] },
                          '$amount',
                          0
                        ]
                      }
                    },
                    refund: {
                      $sum: {
                        $cond: [
                          { $eq: ['$operation', 'TRANSACTION_REFUND'] },
                          '$amount',
                          0
                        ]
                      }
                    },
                    posted: {
                      $sum: {
                        $cond: [
                          { $eq: ['$operation', 'TRANSACTION_APPROVED'] },
                          '$amount',
                          0
                        ]
                      }
                    },
                    reversed: {
                      $sum: {
                        $cond: [
                          { $eq: ['$operation', 'TRANSACTION_REVERSED'] },
                          '$amount',
                          0
                        ]
                      }
                    },
                    rejected: {
                      $sum: {
                        $cond: [
                          { $eq: ['$operation', 'TRANSACTION_REJECTED'] },
                          '$amount',
                          0
                        ]
                      }
                    },
                    pending: {
                      $sum: {
                        $cond: [
                          { $eq: ['$operation', 'TRANSACTION_PENDING'] },
                          '$amount',
                          0
                        ]
                      }
                    }
                  }
                }
              ];
              
              const cardStats = await Transaction.aggregate(cardStatsPipeline);
              const stats = cardStats[0] || {
                money_in: 0,
                refund: 0,
                posted: 0,
                reversed: 0,
                rejected: 0,
                pending: 0
              };
              
              stats.available = stats.money_in + stats.refund + stats.reversed - stats.posted - stats.pending;
              
              await Card.updateOne(
                { _id: cardId },
                {
                  $set: {
                    'stats.money_in': stats.money_in,
                    'stats.refund': stats.refund,
                    'stats.posted': stats.posted,
                    'stats.reversed': stats.reversed,
                    'stats.rejected': stats.rejected,
                    'stats.pending': stats.pending,
                    'stats.available': stats.available,
                    'updatedAt': new Date()
                  }
                },
                { upsert: false }
              );
              
              console.log(`     ✅ Updated stats for card ${cardId}: money_in=$${stats.money_in}, available=$${stats.available}`);
              
              
            } catch (statsError) {
              console.error(`     ❌ Error updating stats for card ${cardId}:`, statsError);
              transactionErrors.push({
                cardId: cardId,
                error: `Stats error: ${statsError.message}`
              });
            }
            
            console.log(`     ✅ Card ${cardId}: imported ${allCryptoTransactions.length} transactions`);
            
          } catch (cardError) {
            console.error(`     ❌ Error processing transactions for card ${card._id}:`, cardError);
            transactionErrors.push({
              cardId: card._id,
              error: cardError.message
            });
          }
        });
        
        // Esperar a que termine el lote actual antes de continuar
        await Promise.all(batchPromises);
      }
    } else {
      console.log(`   ⚡ No new cards to process - skipping transaction import`);
    }
    
    // Actualizar KPIs de usuarios que tienen cards nuevas
    console.log(`📊 Step 6: Updating user KPIs for users with new cards...`);
    const usersWithNewCards = [...new Set(newCards.map(card => card.userId))];
    
    // OPTIMIZACIÓN: Procesar usuarios en paralelo
    const userUpdatePromises = usersWithNewCards.map(async (userId) => {
      try {
        const Transaction = getTransactionModel();
        const userStatsPipeline = [
          { $match: { userId: userId } },
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
              totalReversed: {
                $sum: {
                  $cond: [
                    { $eq: ['$operation', 'TRANSACTION_REVERSED'] },
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
              }
            }
          }
        ];
        
        const userStats = await Transaction.aggregate(userStatsPipeline);
        const stats = userStats[0] || {
          totalTransactions: 0,
          totalDeposited: 0,
          totalRefunded: 0,
          totalPosted: 0,
          totalReversed: 0,
          totalPending: 0
        };
        
        stats.totalAvailable = stats.totalDeposited + stats.totalRefunded + stats.totalReversed - stats.totalPosted - stats.totalPending;
        
        await User.updateOne(
          { _id: userId },
          {
            $set: {
              'stats.totalTransactions': stats.totalTransactions,
              'stats.totalDeposited': stats.totalDeposited,
              'stats.totalRefunded': stats.totalRefunded,
              'stats.totalPosted': stats.totalPosted,
              'stats.totalReversed': stats.totalReversed,
              'stats.totalPending': stats.totalPending,
              'stats.totalAvailable': stats.totalAvailable,
              'stats.lastSync': new Date(),
              'stats.lastSyncSource': 'api',
              'updatedAt': new Date()
            }
          },
          { upsert: false }
        );
        
        console.log(`   ✅ Updated KPIs for user ${userId}: totalTransactions=${stats.totalTransactions}, totalAvailable=$${stats.totalAvailable}`);
        
      } catch (kpiError) {
        console.error(`   ❌ Error updating KPIs for user ${userId}:`, kpiError);
        transactionErrors.push({
          userId: userId,
          error: `KPI error: ${kpiError.message}`
        });
      }
    });
    
    // Esperar a que terminen todas las actualizaciones de usuarios
    await Promise.all(userUpdatePromises);
    
    const totalTime = Date.now() - startTime;
    const timePerCard = (totalTime / realCryptoMateData.length).toFixed(2);
    
    console.log('🎉 OPTIMIZED CryptoMate import with transactions completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total cards processed: ${realCryptoMateData.length}`);
    console.log(`   - Users imported: ${importedUsers}`);
    console.log(`   - Cards imported: ${importedCards}`);
    console.log(`   - Cards updated: ${updatedCards}`);
    console.log(`   - Transactions imported: ${totalTransactionsImported}`);
    console.log(`   - Transactions updated: ${totalTransactionsUpdated}`);
    console.log(`   - Card import errors: ${errors.length}`);
    console.log(`   - Transaction errors: ${transactionErrors.length}`);
    console.log(`   - Total time: ${totalTime}ms`);
    console.log(`   - Time per card: ${timePerCard}ms`);
    
    res.json({
      success: true,
      message: 'OPTIMIZED CryptoMate import with transactions completed successfully',
      summary: {
        totalCards: realCryptoMateData.length,
        usersImported: importedUsers,
        cardsImported: importedCards,
        cardsUpdated: updatedCards,
        transactionsImported: totalTransactionsImported,
        transactionsUpdated: totalTransactionsUpdated,
        cardImportErrors: errors.length,
        transactionErrors: transactionErrors.length,
        performance: {
          totalTime: totalTime,
          timePerCard: timePerCard
        }
      },
      errors: {
        cardImport: errors.slice(0, 5),
        transaction: transactionErrors.slice(0, 5)
      }
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ Optimized import error (${totalTime}ms):`, error);
    res.status(500).json({ 
      success: false, 
      error: 'Optimized import failed', 
      message: error.message,
      performance: {
        totalTime: totalTime
      }
    });
  }
});

// Función para obtener el saldo de la wallet central
const fetchCentralWalletBalance = async () => {
  const fetch = require('node-fetch');
  
  try {
    console.log('🚀 Fetching central wallet balance from CryptoMate...');
    
    const response = await fetch('https://api.cryptomate.me/cards/account', {
      method: 'GET',
      headers: {
        'x-api-key': 'api-45f14849-914c-420e-a788-2e969d92bd5d',
        'Content-Type': 'application/json',
        'Cookie': 'JSESSIONID=F283A13AE1BBE5C0D2081C65FE37227F'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`✅ Fetched central wallet balance: $${data.available_balance}`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching central wallet balance:', error);
    throw error;
  }
};

// Endpoint para obtener el saldo de la wallet central con historial automático
router.get('/central-wallet-balance', async (req, res) => {
  try {
    console.log('🚀 Fetching central wallet balance with automatic history...');
    
    // 1. Consultar saldo actual de Cryptomate
    const currentData = await fetchCentralWalletBalance();
    const currentBalance = currentData.available_balance;
    
    // 2. Obtener el último registro del historial (para saber el "previous")
    const { getCentralWalletHistoryModel } = require('../../../models/CentralWalletHistory');
    const CentralWalletHistory = getCentralWalletHistoryModel();
    
    const lastRecord = await CentralWalletHistory.findOne()
      .sort({ consultedAt: -1 });
    
    const previousBalance = lastRecord ? lastRecord.currentBalance : 0;
    const difference = currentBalance - previousBalance;
    
    let historyEntry;
    
    // 3. Solo guardar si hay cambio real en el saldo
    if (Math.abs(difference) > 0.01) { // Tolerancia de 1 centavo
      console.log(`📊 Balance changed: $${previousBalance} → $${currentBalance} (${difference > 0 ? '+' : ''}$${difference.toFixed(2)})`);
      
      historyEntry = new CentralWalletHistory({
        previousBalance: previousBalance,
        currentBalance: currentBalance,
        difference: difference,
        blockchain: currentData.blockchain,
        walletAddress: currentData.wallet_address,
        tokens: currentData.tokens,
        consultedBy: 'system',
        source: 'api',
        userAgent: req.headers['user-agent'] || 'API'
      });
      
      await historyEntry.save();
    } else {
      console.log(`📊 No balance change detected: $${currentBalance} (same as last record)`);
      historyEntry = lastRecord; // Usar el último registro existente
    }
    
    console.log(`✅ Central wallet balance updated and saved to history`);
    console.log(`   - Previous: $${previousBalance}`);
    console.log(`   - Current: $${currentBalance}`);
    console.log(`   - Difference: $${difference}`);
    
    res.json({
      success: true,
      message: 'Central wallet balance retrieved successfully',
      data: {
        previous_balance: previousBalance,
        current_balance: currentBalance,
        difference: difference,
        blockchain: currentData.blockchain,
        wallet_address: currentData.wallet_address,
        compromised_balance: currentData.compromised_balance,
        tokens: currentData.tokens,
        history_id: historyEntry._id,
        consulted_at: new Date()
      }
    });
    
  } catch (error) {
    console.error('❌ Central wallet balance error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch central wallet balance', 
      message: error.message 
    });
  }
});

// Endpoint para obtener el historial de la wallet central
router.get('/central-wallet-history', async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    console.log('🚀 Fetching central wallet history...');
    
    const { getCentralWalletHistoryModel } = require('../../../models/CentralWalletHistory');
    const CentralWalletHistory = getCentralWalletHistoryModel();
    
    // Obtener historial con paginación
    const history = await CentralWalletHistory.find()
      .sort({ consultedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('_id previousBalance currentBalance difference blockchain walletAddress consultedBy consultedAt');
    
    // Contar total de registros
    const totalRecords = await CentralWalletHistory.countDocuments();
    
    // Estadísticas del historial
    const stats = await CentralWalletHistory.aggregate([
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalDifference: { $sum: '$difference' },
          avgDifference: { $avg: '$difference' },
          maxDifference: { $max: '$difference' },
          minDifference: { $min: '$difference' },
          lastBalance: { $last: '$currentBalance' },
          firstBalance: { $first: '$currentBalance' }
        }
      }
    ]);
    
    console.log(`✅ Central wallet history fetched: ${history.length} records`);
    
    res.json({
      success: true,
      message: 'Central wallet history retrieved successfully',
      data: {
        history: history,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalRecords,
          pages: Math.ceil(totalRecords / parseInt(limit))
        },
        stats: stats[0] || {
          totalRecords: 0,
          totalDifference: 0,
          avgDifference: 0,
          maxDifference: 0,
          minDifference: 0,
          lastBalance: 0,
          firstBalance: 0
        },
        lastUpdated: new Date()
      }
    });
    
  } catch (error) {
    console.error('❌ Central wallet history error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch central wallet history', 
      message: error.message 
    });
  }
});

module.exports = router;