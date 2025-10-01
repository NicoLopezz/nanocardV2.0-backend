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
    const curlCommand = `curl --location 'https://api.cryptomate.me/cards/virtual-cards/list' --header 'x-api-key: api-45f14849-914c-420e-a788-2e969d92bd5d' --header 'Content-Type: application/json' --header 'Cookie: JSESSIONID=97A7964CFD65CCA327AF0AA1AB798D42'`;
    
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
    
    console.log(`🚀 Fetching transactions for card ${cardId} (page ${page}) with operations: ${operations}...`);
    console.log(`🔗 URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': 'api-45f14849-914c-420e-a788-2e969d92bd5d',
        'Content-Type': 'application/json',
        'Cookie': 'JSESSIONID=73355FE2A8BEFFDFA7E8913C7A1590DE'
      }
    });

    const data = await response.json();
    console.log(`✅ Fetched ${data.movements?.length || 0} transactions for card ${cardId}`);
    console.log(`📊 API Response:`, JSON.stringify(data, null, 2));
    
    // Log cookies for debugging
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      console.log(`🍪 New cookies: ${setCookie}`);
    }
    
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

// Endpoint para importar transacciones de una tarjeta específica (ACTUALIZADO CON NOMBRES DESCRIPTIVOS)
router.post('/import-transactions/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    const { 
      fromDate = '2024-01-01', 
      toDate = '2025-09-25', 
      maxPages = 10,
      operations = 'TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE'
    } = req.body;
    
    console.log(`🚀 Starting transaction import for card: ${cardId}`);
    console.log(`📋 Operations to fetch: ${operations}`);
    
    const User = getUserModel();
    const Card = getCardModel();
    const Transaction = getTransactionModel();
    
    // Verificar que la tarjeta existe (TEMPORALMENTE DESHABILITADO PARA IMPORTAR DESDE CRYPTOMATE)
    console.log(`🔍 Looking for card with ID: ${cardId}`);
    const card = await Card.findById(cardId);
    console.log(`🔍 Card found result:`, card ? 'FOUND' : 'NOT FOUND');
    if (card) {
      console.log(`✅ Card details: name=${card.name}, userId=${card.userId}`);
    }
    if (!card) {
      console.log(`⚠️ Card ${cardId} not found in local DB, but continuing with CryptoMate import...`);
      // return res.status(404).json({
      //   success: false,
      //   message: `Card ${cardId} not found`
      // });
    }
    
    // Ya no necesitamos crear depósito artificial - usamos OVERRIDE_VIRTUAL_BALANCE de CryptoMate
    console.log(`💰 Using real deposit from CryptoMate OVERRIDE_VIRTUAL_BALANCE`);
    
    let totalTransactions = 0;
    let importedTransactions = 0;
    let updatedTransactions = 0;
    let currentPage = 1;
    const results = [];
    
    // Importar transacciones página por página
    while (currentPage <= maxPages) {
      try {
        console.log(`📄 Processing page ${currentPage}...`);
        
        const cryptoTransactions = await fetchTransactionsFromCard(cardId, fromDate, toDate, currentPage, operations);
        
        if (!cryptoTransactions || cryptoTransactions.length === 0) {
          console.log(`📄 No more transactions on page ${currentPage}`);
          break;
        }
        
        totalTransactions += cryptoTransactions.length;
        
        for (const cryptoTransaction of cryptoTransactions) {
          try {
            const userId = card ? card.userId : cardId; // Usar cardId como userId si no se encuentra la tarjeta
            console.log(`🔍 Using userId: ${userId} for transaction ${cryptoTransaction.id}`);
            
            // Asegurar que userId no sea undefined
            if (!userId) {
              console.error(`❌ userId is undefined for card ${cardId}`);
              continue;
            }
            
            const nanoTransaction = await convertCryptoMateTransactionToNano(
              cryptoTransaction, 
              cardId, 
              userId
            );
            
            // Verificar si la transacción ya existe
            let existingTransaction = await Transaction.findById(nanoTransaction._id);
            if (!existingTransaction) {
              existingTransaction = new Transaction(nanoTransaction);
              await existingTransaction.save();
              importedTransactions++;
              console.log(`✅ Imported transaction: ${nanoTransaction._id} - ${nanoTransaction.name} (${nanoTransaction.operation}) by ${nanoTransaction.userName}`);
            } else {
              // Actualizar transacción existente con todos los campos nuevos
              await Transaction.findByIdAndUpdate(nanoTransaction._id, nanoTransaction, { 
                new: true, 
                upsert: false,
                runValidators: true
              });
              updatedTransactions++;
              console.log(`🔄 Updated transaction: ${nanoTransaction._id} - ${nanoTransaction.name} (${nanoTransaction.operation}) by ${nanoTransaction.userName}`);
            }
            
            results.push({
              cryptoTransaction: {
                id: cryptoTransaction.id,
                description: cryptoTransaction.description,
                amount: cryptoTransaction.amount,
                status: cryptoTransaction.status,
                operation: cryptoTransaction.operation
              },
              nanoTransaction: {
                _id: nanoTransaction._id,
                name: nanoTransaction.name,
                amount: nanoTransaction.amount,
                status: nanoTransaction.status,
                operation: nanoTransaction.operation,
                userName: nanoTransaction.userName,
                cardName: nanoTransaction.cardName,
                credit: nanoTransaction.credit
              },
              success: true
            });
            
          } catch (transactionError) {
            console.error(`❌ Error processing transaction ${cryptoTransaction.id}:`, transactionError);
            results.push({
              cryptoTransaction: {
                id: cryptoTransaction.id,
                description: cryptoTransaction.description
              },
              error: transactionError.message,
              success: false
            });
          }
        }
        
        currentPage++;
        
        // Pequeña pausa entre páginas para no sobrecargar la API
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (pageError) {
        console.error(`❌ Error processing page ${currentPage}:`, pageError);
        break;
      }
    }
    
    // Actualizar KPIs del usuario Y stats de la tarjeta
    try {
      const userId = card ? card.userId : cardId; // Usar cardId como userId si no se encuentra la tarjeta
      const user = await User.findById(userId);
      if (user) {
        // Recalcular KPIs basándose en las transacciones
        const userTransactions = await Transaction.find({ userId: userId });
        
        user.stats.totalTransactions = userTransactions.length;
        user.stats.totalDeposited = userTransactions
          .filter(t => t.operation === 'WALLET_DEPOSIT' || t.operation === 'OVERRIDE_VIRTUAL_BALANCE')
          .reduce((sum, t) => sum + t.amount, 0);
        user.stats.totalRefunded = userTransactions
          .filter(t => t.operation === 'TRANSACTION_REFUND')
          .reduce((sum, t) => sum + t.amount, 0);
        user.stats.totalPosted = userTransactions
          .filter(t => t.operation === 'TRANSACTION_APPROVED')
          .reduce((sum, t) => sum + t.amount, 0);
        user.stats.totalReversed = userTransactions
          .filter(t => t.operation === 'TRANSACTION_REVERSED')
          .reduce((sum, t) => sum + t.amount, 0);
        user.stats.totalPending = userTransactions
          .filter(t => t.operation === 'TRANSACTION_PENDING')
          .reduce((sum, t) => sum + t.amount, 0);
        user.stats.totalAvailable = user.stats.totalDeposited + user.stats.totalRefunded + user.stats.totalReversed - user.stats.totalPosted - user.stats.totalPending;
        
        // Registrar última actualización del usuario
        user.updatedAt = new Date();
        user.stats.lastSync = new Date();
        user.stats.lastSyncSource = 'api';
        
        await user.save();
        console.log(`✅ Updated KPIs for user: ${card.userId}`);
        console.log(`   - Last updated: ${user.updatedAt}`);
        console.log(`   - Last sync: ${user.stats.lastSync}`);
        console.log(`   - Sync source: ${user.stats.lastSyncSource}`);
      }
      
      // Actualizar stats de la tarjeta específica usando la nueva estructura
      if (card) {
        const cardTransactions = await Transaction.find({ cardId: cardId });
        
        // Calcular stats con la fórmula correcta
        let money_in = 0;
        let refund = 0;
        let posted_approved = 0;
        let reversed = 0;
        let rejected = 0;
        let pending = 0;
        
        cardTransactions.forEach(transaction => {
          const amount = transaction.amount || 0;
          
          switch (transaction.operation) {
            case 'WALLET_DEPOSIT':
            case 'OVERRIDE_VIRTUAL_BALANCE':
              money_in += amount;
              break;
            case 'TRANSACTION_REFUND':
              refund += amount;
              break;
            case 'TRANSACTION_APPROVED':
              posted_approved += amount;
              break;
            case 'TRANSACTION_REVERSED':
              reversed += amount;
              break;
            case 'TRANSACTION_REJECTED':
              rejected += amount;
              break;
            case 'TRANSACTION_PENDING':
              pending += amount;
              break;
          }
        });
        
        // Actualizar el campo stats de la card con la nueva estructura
        card.stats = {
          money_in: money_in,
          refund: refund,
          posted: posted_approved, // Solo TRANSACTION_APPROVED (sin restar reversed)
          reversed: reversed,
          rejected: rejected,
          pending: pending,
          available: money_in + refund + reversed - posted_approved - pending // Fórmula correcta
        };
        
        // Registrar última actualización de la card
        card.updatedAt = new Date();
        
        await card.save();
        console.log(`✅ Updated stats for card: ${cardId}`);
        console.log(`   - money_in: $${card.stats.money_in}`);
        console.log(`   - refund: $${card.stats.refund}`);
        console.log(`   - posted: $${card.stats.posted}`);
        console.log(`   - reversed: $${card.stats.reversed}`);
        console.log(`   - rejected: $${card.stats.rejected}`);
        console.log(`   - pending: $${card.stats.pending}`);
        console.log(`   - available: $${card.stats.available}`);
        console.log(`   - Last updated: ${card.updatedAt}`);
      }
      
    } catch (kpiError) {
      console.error(`❌ Error updating user KPIs and card stats:`, kpiError);
    }
    
    // Sincronizar balance con CryptoMate
    try {
      console.log(`🔄 Syncing balance with CryptoMate...`);
      const cryptoMateBalance = await fetchCardBalanceFromCryptoMate(cardId);
      
      card.cryptoMateBalance = {
        available_credit: cryptoMateBalance.available_credit,
        lastUpdated: new Date(),
        source: 'cryptomate_api'
      };
      
      await card.save();
      
      const difference = card.available - cryptoMateBalance.available_credit;
      console.log(`✅ CryptoMate balance synced: $${cryptoMateBalance.available_credit}`);
      console.log(`   - Difference from Nano: $${difference}`);
      
    } catch (balanceError) {
      console.error(`❌ Error syncing CryptoMate balance:`, balanceError);
    }
    
    console.log('🎉 Transaction import completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total transactions processed: ${totalTransactions}`);
    console.log(`   - Transactions imported: ${importedTransactions}`);
    console.log(`   - Transactions updated: ${updatedTransactions}`);
    console.log(`   - Pages processed: ${currentPage - 1}`);
    console.log(`   - Operations fetched: ${operations}`);
    
    res.json({
      success: true,
      message: 'Transaction import completed successfully',
      summary: {
        cardId: cardId,
        totalTransactions: totalTransactions,
        imported: importedTransactions,
        updated: updatedTransactions,
        pagesProcessed: currentPage - 1,
        operations: operations
      },
      results: results.slice(0, 10) // Solo mostrar las primeras 10 para no sobrecargar la respuesta
    });
    
  } catch (error) {
    console.error('❌ Transaction import error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Transaction import failed', 
      message: error.message 
    });
  }
});

// Endpoint para importar usando datos reales de CryptoMate
router.post('/import-real-data', async (req, res) => {
  try {
    console.log('🚀 Starting real CryptoMate import...');
    
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
    
    let importedUsers = 0;
    let importedCards = 0;
    let updatedCards = 0;
    const results = [];
    
    console.log(`📋 Processing ${realCryptoMateData.length} cards from CryptoMate...`);
    
    for (const cryptoCard of realCryptoMateData) {
      try {
        // Convertir datos de CryptoMate a formato Nano
        const nanoCard = convertCryptoMateCardToNano(cryptoCard);
        
        // Crear o actualizar usuario
        let user = await User.findById(nanoCard.userId);
        if (!user) {
          // Usar email de CryptoMate o crear uno único
          let userEmail = nanoCard.meta?.email || `${nanoCard.userId}@nanocard.xyz`;
          
          // Verificar si el email ya existe
          let existingUserWithEmail = await User.findOne({ email: userEmail });
          if (existingUserWithEmail) {
            // Si el email ya existe, crear uno único
            userEmail = `${nanoCard.userId}_${Date.now()}@nanocard.xyz`;
          }
          
          user = new User({
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
            }
          });
          await user.save();
          importedUsers++;
          console.log(`✅ Created user: ${nanoCard.userId} with email: ${userEmail}`);
        }
        
        // Crear o actualizar tarjeta
        let existingCard = await Card.findById(nanoCard._id);
        if (!existingCard) {
          existingCard = new Card(nanoCard);
          await existingCard.save();
          importedCards++;
          console.log(`✅ Created card: ${nanoCard._id} - ${nanoCard.name}`);
        } else {
          // Actualizar tarjeta existente
          Object.assign(existingCard, nanoCard);
          await existingCard.save();
          updatedCards++;
          console.log(`🔄 Updated card: ${nanoCard._id} - ${nanoCard.name}`);
        }
        
        results.push({
          cryptoCard: {
            id: cryptoCard.id,
            card_holder_name: cryptoCard.card_holder_name,
            last4: cryptoCard.last4,
            status: cryptoCard.status,
            monthly_limit: cryptoCard.monthly_limit
          },
          nanoCard: {
            _id: nanoCard._id,
            name: nanoCard.name,
            last4: nanoCard.last4,
            status: nanoCard.status,
            limits: nanoCard.limits,
            meta: nanoCard.meta
          },
          success: true
        });
        
      } catch (cardError) {
        console.error(`❌ Error processing card ${cryptoCard.id}:`, cardError);
        results.push({
          cryptoCard: {
            id: cryptoCard.id,
            card_holder_name: cryptoCard.card_holder_name
          },
          error: cardError.message,
          success: false
        });
      }
    }
    
    console.log('🎉 Real CryptoMate import completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total cards processed: ${realCryptoMateData.length}`);
    console.log(`   - Users imported: ${importedUsers}`);
    console.log(`   - Cards imported: ${importedCards}`);
    console.log(`   - Cards updated: ${updatedCards}`);
    
    res.json({
      success: true,
      message: 'Real CryptoMate import completed successfully',
      summary: {
        totalCards: realCryptoMateData.length,
        users: importedUsers,
        cardsImported: importedCards,
        cardsUpdated: updatedCards
      },
      results: results.slice(0, 10) // Solo mostrar las primeras 10 para no sobrecargar la respuesta
    });
    
  } catch (error) {
    console.error('❌ Real import error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Real import failed', 
      message: error.message 
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