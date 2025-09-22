const express = require('express');
const router = express.Router();
const { getUserModel } = require('../models/User');
const { getCardModel } = require('../models/Card');
const { getTransactionModel } = require('../models/Transaction');
const { convertCryptoMateCardToNano } = require('../services/cryptomateService');

// Función para traer todas las tarjetas reales de CryptoMate
const fetchAllRealCards = async () => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    const curlCommand = `curl --location 'https://api.cryptomate.me/cards/virtual-cards/list' --header 'x-api-key: api-45f14849-914c-420e-a788-2e969d92bd5d' --header 'Content-Type: application/json' --header 'Cookie: JSESSIONID=7216B94569B249C7E74CF7409C99C656'`;
    
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
    const curlCommand = `curl --location 'https://api.cryptomate.me/cards/virtual-cards/${cardId}/virtual-balances' --header 'x-api-key: api-45f14849-914c-420e-a788-2e969d92bd5d' --header 'Content-Type: application/json' --header 'Cookie: JSESSIONID=7216B94569B249C7E74CF7409C99C656'`;
    
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
const fetchTransactionsFromCard = async (cardId, fromDate = '2024-01-01', toDate = '2025-01-25', page = 1, operations = 'TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE') => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    const curlCommand = `curl --location 'https://api.cryptomate.me/cards/transactions/${cardId}/search?from_date=${fromDate}&to_date=${toDate}&operations=${operations}&size=100&page_number=${page}' --header 'x-api-key: api-45f14849-914c-420e-a788-2e969d92bd5d' --header 'Content-Type: application/json' --header 'Cookie: JSESSIONID=7216B94569B249C7E74CF7409C99C656'`;
    
    console.log(`🚀 Fetching transactions for card ${cardId} (page ${page}) with operations: ${operations}...`);
    const { stdout, stderr } = await execAsync(curlCommand);
    
    if (stderr) {
      console.error('❌ Curl stderr:', stderr);
    }
    
    const data = JSON.parse(stdout);
    console.log(`✅ Fetched ${data.movements?.length || 0} transactions for card ${cardId}`);
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
    name: cryptoTransaction.merchant_name || 'Unknown Transaction', // NOMBRE DEL COMERCIO
    amount: cryptoTransaction.transaction_amount || cryptoTransaction.bill_amount || 0,
    date: date.toLocaleDateString('es-AR'),
    time: date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    status: cryptoTransaction.status || 'Completed',
    operation: cryptoTransaction.operation, // NUEVO CAMPO IMPORTANTE
    city: cryptoTransaction.city,
    country: cryptoTransaction.country,
    mcc_category: cryptoTransaction.mcc_category,
    mercuryCategory: cryptoTransaction.mercuryCategory,
    credit: cryptoTransaction.operation === 'WALLET_DEPOSIT' || cryptoTransaction.operation === 'TRANSACTION_REFUND' || cryptoTransaction.operation === 'OVERRIDE_VIRTUAL_BALANCE',
    comentario: `${cryptoTransaction.operation} - ${cryptoTransaction.merchant_name}`,
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

// Endpoint para importar transacciones de una tarjeta específica (ACTUALIZADO CON NOMBRES DESCRIPTIVOS)
router.post('/import-transactions/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    const { 
      fromDate = '2024-01-01', 
      toDate = '2025-01-25', 
      maxPages = 5,
      operations = 'TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE'
    } = req.body;
    
    console.log(`🚀 Starting transaction import for card: ${cardId}`);
    console.log(`📋 Operations to fetch: ${operations}`);
    
    const User = getUserModel();
    const Card = getCardModel();
    const Transaction = getTransactionModel();
    
    // Verificar que la tarjeta existe
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({
        success: false,
        message: `Card ${cardId} not found`
      });
    }
    
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
            const nanoTransaction = await convertCryptoMateTransactionToNano(
              cryptoTransaction, 
              cardId, 
              card.userId
            );
            
            // Verificar si la transacción ya existe
            let existingTransaction = await Transaction.findById(nanoTransaction._id);
            if (!existingTransaction) {
              existingTransaction = new Transaction(nanoTransaction);
              await existingTransaction.save();
              importedTransactions++;
              console.log(`✅ Imported transaction: ${nanoTransaction._id} - ${nanoTransaction.name} (${nanoTransaction.operation}) by ${nanoTransaction.userName}`);
            } else {
              // Actualizar transacción existente
              Object.assign(existingTransaction, nanoTransaction);
              await existingTransaction.save();
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
    
    // Actualizar KPIs del usuario Y campos financieros de la tarjeta
    try {
      const user = await User.findById(card.userId);
      if (user) {
        // Recalcular KPIs basándose en las transacciones
        const userTransactions = await Transaction.find({ userId: card.userId });
        
        user.stats.totalTransactions = userTransactions.length;
        user.stats.totalDeposited = userTransactions
          .filter(t => t.credit)
          .reduce((sum, t) => sum + t.amount, 0);
        user.stats.totalPosted = userTransactions
          .filter(t => !t.credit)
          .reduce((sum, t) => sum + t.amount, 0);
        user.stats.totalAvailable = user.stats.totalDeposited - user.stats.totalPosted;
        
        await user.save();
        console.log(`✅ Updated KPIs for user: ${card.userId}`);
      }
      
      // Actualizar campos financieros de la tarjeta específica
      const cardTransactions = await Transaction.find({ cardId: cardId });
      
      card.deposited = cardTransactions
        .filter(t => t.credit)
        .reduce((sum, t) => sum + t.amount, 0);
      card.posted = cardTransactions
        .filter(t => !t.credit)
        .reduce((sum, t) => sum + t.amount, 0);
      card.pending = 0; // Por ahora 0, se puede calcular si hay transacciones pendientes
      card.available = card.deposited - card.posted;
      
      await card.save();
      console.log(`✅ Updated financial fields for card: ${cardId}`);
      console.log(`   - Deposited: $${card.deposited}`);
      console.log(`   - Posted: $${card.posted}`);
      console.log(`   - Available: $${card.available}`);
      
    } catch (kpiError) {
      console.error(`❌ Error updating user KPIs and card balances:`, kpiError);
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

module.exports = router;