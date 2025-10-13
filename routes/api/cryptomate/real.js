const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const StatsRefreshService = require('../../../services/statsRefreshService');
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
    
    const { stdout } = await execAsync(curlCommand);
    const data = JSON.parse(stdout);
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
    
    const { stdout } = await execAsync(curlCommand);
    const data = JSON.parse(stdout);
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
    status: cryptoTransaction.status || 'SUCCESS',
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
    
    console.log(`🚀 Starting transaction refresh for card: ${cardId}`);
    
    const User = getUserModel();
    const Card = getCardModel();
    const Transaction = getTransactionModel();
    
    // OPTIMIZACIÓN 1: Obtener datos de la card y transacciones existentes de una vez
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
    const allCryptoTransactions = [];
    let currentPage = 1;
    
    while (currentPage <= maxPages) {
        const cryptoTransactions = await fetchTransactionsFromCard(cardId, fromDate, toDate, currentPage, operations);
        
        if (!cryptoTransactions || cryptoTransactions.length === 0) {
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
    
    
    // OPTIMIZACIÓN 5: Operaciones bulk en paralelo
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
    
    console.log(`✅ Transaction refresh completed: ${importedTransactions} imported, ${updatedTransactions} updated (${totalTime}ms)`);
    
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

// Endpoint para importar cards de CryptoMate - OPTIMIZADO
router.post('/import-cryptomate-cards', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting CryptoMate cards import...');
    
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
    
    const [existingUsers, existingCards] = await Promise.all([
      User.find({}, '_id email').lean(),
      Card.find({}, '_id').lean()
    ]);
    
    const existingUserIds = new Set(existingUsers.map(u => u._id));
    const existingUserEmails = new Set(existingUsers.map(u => u.email));
    const existingCardIds = new Set(existingCards.map(c => c._id));
    
    // OPTIMIZACIÓN 2: Procesar en lotes
    const batchSize = 20; // Procesar 20 cards a la vez
    const batches = [];
    for (let i = 0; i < realCryptoMateData.length; i += batchSize) {
      batches.push(realCryptoMateData.slice(i, i + batchSize));
    }
    
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
            username: `${nanoCard.name}_${nanoCard.userId}`.replace(/\s+/g, '_').toLowerCase(),
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
    
    
    // OPTIMIZACIÓN 5: Operaciones bulk en paralelo
    const bulkOperations = [];
    
    if (newUsers.length > 0) {
      bulkOperations.push(
        User.insertMany(newUsers, { ordered: false })
          .then(result => {
            importedUsers = result.length;
          })
          .catch(err => {
            console.error(`❌ Error creating users:`, err.message);
            importedUsers = newUsers.length;
          })
      );
    }
    
    if (newCards.length > 0) {
      bulkOperations.push(
        Card.insertMany(newCards, { ordered: false })
          .then(result => {
            importedCards = result.length;
          })
          .catch(err => {
            console.error(`❌ Error creating cards:`, err.message);
            importedCards = newCards.length;
          })
      );
    }
    
    if (cardUpdates.length > 0) {
      bulkOperations.push(
        Card.bulkWrite(cardUpdates, { ordered: false })
          .then(result => {
            updatedCards = result.modifiedCount;
          })
          .catch(err => {
            console.error(`❌ Error updating cards:`, err.message);
            updatedCards = cardUpdates.length;
          })
      );
    }
    
    await Promise.all(bulkOperations);
    
    const totalTime = Date.now() - startTime;
    const timePerCard = (totalTime / realCryptoMateData.length).toFixed(2);
    
    console.log(`✅ CryptoMate import completed: ${importedUsers} users, ${importedCards} cards imported, ${updatedCards} updated (${totalTime}ms)`);
    
    res.json({
      success: true,
      message: 'CryptoMate cards import completed successfully',
      summary: {
        totalCards: realCryptoMateData.length,
        usersImported: importedUsers,
        cardsImported: importedCards,
        cardsUpdated: updatedCards,
        errors: errors.length,
        performance: {
          totalTime: totalTime,
          timePerCard: timePerCard
        }
      },
      errors: errors.slice(0, 5)
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

// Endpoint OPTIMIZADO para refrescar transacciones de TODAS las cards CryptoMate
router.post('/refresh-all-transactions', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting CryptoMate refresh (last 24 hours)...');
    
    const Card = getCardModel();
    const cryptoMateCards = await Card.find({ supplier: 'cryptomate' }).select('_id name userId');
    
    if (cryptoMateCards.length === 0) {
      return res.json({
        success: true,
        message: 'No CryptoMate cards found',
        summary: {
          totalCards: 0,
          transactionsRefreshed: 0,
          statsUpdated: 0,
          totalTime: Date.now() - startTime
        }
      });
    }
    
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < cryptoMateCards.length; i += BATCH_SIZE) {
      batches.push(cryptoMateCards.slice(i, i + BATCH_SIZE));
    }
    
    // Estadísticas
    let totalTransactionsRefreshed = 0;
    let totalStatsUpdated = 0;
    let totalErrors = 0;
    const errors = [];
    const debugInfo = []; // Para almacenar información detallada
    
    const MAX_CONCURRENT_BATCHES = 2;
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += MAX_CONCURRENT_BATCHES) {
      const currentBatches = batches.slice(batchIndex, batchIndex + MAX_CONCURRENT_BATCHES);
      
      const batchPromises = currentBatches.map(async (batch, batchNum) => {
        const batchResults = {
          transactionsRefreshed: 0,
          statsUpdated: 0,
          errors: []
        };
        
        // Procesar cards del lote en paralelo usando la misma lógica que funciona
        const cardPromises = batch.map(async (card) => {
          try {
            const Transaction = getTransactionModel();
            
            const existingTransactions = await Transaction.find({ cardId: card._id }, '_id').lean();
            const existingTransactionIds = new Set(existingTransactions.map(t => t._id));
            const userId = card.userId || card._id;
            
            const now = new Date();
            const lastDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            
            const fromDate = lastDay.toISOString().split('T')[0];
            const toDate = now.toISOString().split('T')[0];
            
            const allCryptoTransactions = [];
            let currentPage = 1;
            const maxPages = 2;
            
            while (currentPage <= maxPages) {
              const cryptoTransactions = await fetchTransactionsFromCard(
                card._id, 
                fromDate,
                toDate,
                currentPage, 
                'TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE'
              );
              
              if (!cryptoTransactions || cryptoTransactions.length === 0) {
                break;
              }
              
              allCryptoTransactions.push(...cryptoTransactions);
              currentPage++;
            }
            
            if (allCryptoTransactions.length > 0) {
              
              const cardDebugInfo = {
                cardId: card._id,
                cardName: card.name,
                newTransactionsList: []
              };
              
              let cardTransactionsRefreshed = 0;
              const newTransactions = [];
              
              for (const cryptoTransaction of allCryptoTransactions) {
                try {
                  const nanoTransaction = await convertCryptoMateTransactionToNano(
                    cryptoTransaction, 
                    card._id, 
                    userId
                  );
                  
                  const isNew = !existingTransactionIds.has(nanoTransaction._id);
                  
                  if (isNew) {
                    newTransactions.push({
                      ...nanoTransaction,
                      createdAt: new Date(),
                      updatedAt: new Date()
                    });
                    
                    cardDebugInfo.newTransactionsList.push({
                      transactionId: nanoTransaction._id,
                      operation: cryptoTransaction.operation,
                      amount: nanoTransaction.amount,
                      date: nanoTransaction.date,
                      name: nanoTransaction.name,
                      status: cryptoTransaction.status
                    });
                  }
                  
                } catch (convertError) {
                  batchResults.errors.push({
                    cardId: card._id,
                    error: convertError.message
                  });
                }
              }
              
              if (newTransactions.length > 0) {
                try {
                  const result = await Transaction.insertMany(newTransactions, { ordered: false, rawResult: true });
                  
                  if (result.mongoose?.validationErrors && result.mongoose.validationErrors.length > 0) {
                    console.error(`❌ Validation errors: ${result.mongoose.validationErrors.length}`);
                  }
                  
                  const insertedCount = result.insertedCount || (Array.isArray(result) ? result.length : 0);
                  cardTransactionsRefreshed += insertedCount;
                  
                  if (insertedCount === 0 && newTransactions.length > 0) {
                    console.error(`⚠️ Warning: Tried to insert ${newTransactions.length} but 0 were created`);
                  }
                } catch (insertError) {
                  console.error(`❌ Error creating transactions: ${insertError.message}`);
                  if (insertError.insertedDocs && insertError.insertedDocs.length > 0) {
                    cardTransactionsRefreshed += insertError.insertedDocs.length;
                  }
                  
                  batchResults.errors.push({
                    cardId: card._id,
                    error: `Insert error: ${insertError.message}`,
                    transactionCount: newTransactions.length
                  });
                }
              }
              
              if (cardTransactionsRefreshed > 0) {
                debugInfo.push(cardDebugInfo);
              }
              
              batchResults.transactionsRefreshed += cardTransactionsRefreshed;
              
              if (cardTransactionsRefreshed > 0) {
                try {
                  await StatsRefreshService.refreshCardStats(card._id);
                  batchResults.statsUpdated++;
                } catch (statsError) {
                  batchResults.errors.push({
                    cardId: card._id,
                    error: `Stats error: ${statsError.message}`
                  });
                }
              }
            }
            
          } catch (cardError) {
            batchResults.errors.push({
              cardId: card._id,
              error: cardError.message
            });
          }
        });
        
        // Esperar a que terminen todas las cards del lote
        await Promise.all(cardPromises);
        
        return batchResults;
      });
      
      // Esperar a que terminen los lotes actuales
      const batchResults = await Promise.all(batchPromises);
      
      // Consolidar resultados
      batchResults.forEach(result => {
        totalTransactionsRefreshed += result.transactionsRefreshed;
        totalStatsUpdated += result.statsUpdated;
        totalErrors += result.errors.length;
        errors.push(...result.errors);
      });
      
    }
    
    const totalTime = Date.now() - startTime;
    const timePerCard = (totalTime / cryptoMateCards.length).toFixed(2);
    
    console.log(`✅ CryptoMate refresh completed: ${totalTransactionsRefreshed} new transactions (${totalTime}ms)`);
    
    
    res.json({
      success: true,
      message: 'OPTIMIZED CryptoMate transactions refresh completed successfully',
      summary: {
        totalCards: cryptoMateCards.length,
        cardsWithNewTransactions: debugInfo.length,
        newTransactionsCreated: totalTransactionsRefreshed,
        statsUpdated: totalStatsUpdated,
        errors: totalErrors,
        performance: {
          totalTime: totalTime,
          timePerCard: timePerCard,
          optimization: 'NEW transactions only from last 24 hours + stats only if changes (for fast execution)'
        }
      },
      cardsWithNewTransactions: debugInfo.map(card => ({
        cardId: card.cardId,
        cardName: card.cardName,
        newTransactions: card.newTransactionsList
      })),
      errors: errors.slice(0, 10) // Mostrar solo los primeros 10 errores
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ OPTIMIZED CryptoMate transactions refresh error (${totalTime}ms):`, error);
    
    res.status(500).json({
      success: false,
      error: 'OPTIMIZED CryptoMate transactions refresh failed',
      message: error.message,
      performance: {
        totalTime: totalTime
      }
    });
  }
});

router.post('/refresh-all-transactions-full', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      fromDate = '2024-01-01', 
      toDate = '2025-12-31',
      maxPages = 10
    } = req.body;
    
    console.log('🚀 Starting full CryptoMate transactions refresh...');
    
    const Card = getCardModel();
    const cryptoMateCards = await Card.find({ supplier: 'cryptomate' }).select('_id name userId');
    
    if (cryptoMateCards.length === 0) {
      return res.json({
        success: true,
        message: 'No CryptoMate cards found',
        summary: {
          totalCards: 0,
          transactionsRefreshed: 0,
          statsUpdated: 0,
          totalTime: Date.now() - startTime
        }
      });
    }
    
    console.log(`✅ Found ${cryptoMateCards.length} CryptoMate cards`);
    
    console.log('⚡ Processing cards in OPTIMIZED batches...');
    const BATCH_SIZE = 5;
    const batches = [];
    for (let i = 0; i < cryptoMateCards.length; i += BATCH_SIZE) {
      batches.push(cryptoMateCards.slice(i, i + BATCH_SIZE));
    }
    
    
    let totalTransactionsRefreshed = 0;
    let totalStatsUpdated = 0;
    let totalErrors = 0;
    const errors = [];
    const debugInfo = [];
    
    const MAX_CONCURRENT_BATCHES = 2;
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += MAX_CONCURRENT_BATCHES) {
      const currentBatches = batches.slice(batchIndex, batchIndex + MAX_CONCURRENT_BATCHES);
      
      console.log(`🔄 Processing batches ${batchIndex + 1}-${Math.min(batchIndex + MAX_CONCURRENT_BATCHES, batches.length)} in parallel...`);
      
      const batchPromises = currentBatches.map(async (batch, batchNum) => {
        const batchResults = {
          transactionsRefreshed: 0,
          statsUpdated: 0,
          errors: []
        };
        
        const cardPromises = batch.map(async (card) => {
          try {
            console.log(`   🔄 Full refresh for card: ${card._id} (${card.name})`);
            
            const Transaction = getTransactionModel();
            
            const existingTransactions = await Transaction.find({ cardId: card._id }, '_id').lean();
            const existingTransactionIds = new Set(existingTransactions.map(t => t._id));
            const userId = card.userId || card._id;
            
            
            const allCryptoTransactions = [];
            let currentPage = 1;
            
            while (currentPage <= maxPages) {
              const cryptoTransactions = await fetchTransactionsFromCard(
                card._id, 
                fromDate,
                toDate,
                currentPage, 
                'TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE'
              );
              
              if (!cryptoTransactions || cryptoTransactions.length === 0) {
                break;
              }
              
              allCryptoTransactions.push(...cryptoTransactions);
              currentPage++;
            }
            
            console.log(`     ✅ Total transactions fetched from CryptoMate: ${allCryptoTransactions.length}`);
            
            if (allCryptoTransactions.length > 0) {
              const transactionBatchSize = 50;
              const transactionBatches = [];
              for (let i = 0; i < allCryptoTransactions.length; i += transactionBatchSize) {
                transactionBatches.push(allCryptoTransactions.slice(i, i + transactionBatchSize));
              }
              
              let cardTransactionsRefreshed = 0;
              const newTransactions = [];
              const transactionUpdates = [];
              const restoredTransactions = [];
              
              for (const transactionBatch of transactionBatches) {
                for (const cryptoTransaction of transactionBatch) {
                  try {
                    const nanoTransaction = await convertCryptoMateTransactionToNano(
                      cryptoTransaction, 
                      card._id, 
                      userId
                    );
                    
                    const isNew = !existingTransactionIds.has(nanoTransaction._id);
                    
                    if (isNew) {
                      console.log(`     ✅ NEW/RESTORED: ${nanoTransaction._id} (${cryptoTransaction.operation}) - $${nanoTransaction.amount}`);
                      newTransactions.push({
                        ...nanoTransaction,
                        createdAt: new Date(),
                        updatedAt: new Date()
                      });
                      restoredTransactions.push({
                        id: nanoTransaction._id,
                        operation: cryptoTransaction.operation,
                        amount: nanoTransaction.amount,
                        date: nanoTransaction.date
                      });
                    }
                    
                  } catch (convertError) {
                    console.error(`     ❌ Error converting transaction ${cryptoTransaction.id}:`, convertError.message);
                    batchResults.errors.push({
                      cardId: card._id,
                      error: convertError.message
                    });
                  }
                }
              }
              
              if (newTransactions.length > 0) {
                try {
                  await Transaction.insertMany(newTransactions, { ordered: false });
                  cardTransactionsRefreshed += newTransactions.length;
                  console.log(`     ✅ Created/Restored ${newTransactions.length} transactions`);
                } catch (insertError) {
                  console.error(`     ❌ Error creating transactions:`, insertError.message);
                }
              } else {
                console.log(`     ⚡ All transactions already exist for card ${card._id}`);
              }
              
              
              if (restoredTransactions.length > 0) {
                debugInfo.push({
                  cardId: card._id,
                  cardName: card.name,
                  transactionsInCryptoMate: allCryptoTransactions.length,
                  transactionsInDbBefore: existingTransactionIds.size,
                  newTransactions: newTransactions.length,
                  restoredTransactions: restoredTransactions
                });
              }
              
              batchResults.transactionsRefreshed += cardTransactionsRefreshed;
              
              if (cardTransactionsRefreshed > 0) {
                try {
                  await StatsRefreshService.refreshCardStats(card._id);
                  batchResults.statsUpdated++;
                } catch (statsError) {
                  console.error(`     ❌ Error updating stats for card ${card._id}:`, statsError.message);
                  batchResults.errors.push({
                    cardId: card._id,
                    error: `Stats error: ${statsError.message}`
                  });
                }
              }
              
            } else {
              console.log(`     ⚠️ No transactions found for card ${card._id} in date range`);
            }
            
          } catch (cardError) {
            console.error(`   ❌ Error processing card ${card._id}:`, cardError.message);
            batchResults.errors.push({
              cardId: card._id,
              error: cardError.message
            });
          }
        });
        
        await Promise.all(cardPromises);
        
        return batchResults;
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(result => {
        totalTransactionsRefreshed += result.transactionsRefreshed;
        totalStatsUpdated += result.statsUpdated;
        totalErrors += result.errors.length;
        errors.push(...result.errors);
      });
      
    }
    
    const totalTime = Date.now() - startTime;
    const timePerCard = (totalTime / cryptoMateCards.length).toFixed(2);
    
    console.log(`✅ Full CryptoMate refresh completed: ${totalTransactionsRefreshed} transactions (${totalTime}ms)`);
    
    
    res.json({
      success: true,
      message: 'FULL CryptoMate transactions refresh completed successfully',
      summary: {
        totalCards: cryptoMateCards.length,
        transactionsCreatedOrRestored: totalTransactionsRefreshed,
        statsUpdated: totalStatsUpdated,
        errors: totalErrors,
        dateRange: {
          from: fromDate,
          to: toDate
        },
        performance: {
          totalTime: totalTime,
          timePerCard: timePerCard
        }
      },
      debug: {
        cardsWithChanges: debugInfo.length,
        cardsModified: debugInfo.map(card => ({
          cardId: card.cardId,
          cardName: card.cardName,
          transactionsInCryptoMate: card.transactionsInCryptoMate,
          transactionsInDbBefore: card.transactionsInDbBefore,
          newTransactions: card.newTransactions,
          restoredTransactionsCount: card.restoredTransactions.length,
          restoredTransactions: card.restoredTransactions.slice(0, 10)
        }))
      },
      errors: errors.slice(0, 10)
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ FULL CryptoMate transactions refresh error (${totalTime}ms):`, error);
    
    res.status(500).json({
      success: false,
      error: 'FULL CryptoMate transactions refresh failed',
      message: error.message,
      performance: {
        totalTime: totalTime
      }
    });
  }
});

module.exports = router;