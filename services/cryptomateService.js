const { getUserModel } = require('../models/User');
const { getCardModel } = require('../models/Card');
const { getTransactionModel } = require('../models/Transaction');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Función para obtener la API key de CryptoMate
const getCryptoMateApiKey = () => {
  return process.env.MERCURY_API_KEY || 'your-mercury-api-key-here';
};

// Función para obtener el token de autenticación
const getCryptoMateAuthToken = () => {
  return process.env.MERCURY_AUTH_TOKEN || 'Bearer your-mercury-auth-token-here';
};

// Traer todas las tarjetas desde CryptoMate usando curl
const fetchCardsFromCryptoMate = async () => {
  try {
    const curlCommand = `curl --location 'https://api.cryptomate.me/cards/virtual-cards/list' --header 'x-api-key: ${getCryptoMateApiKey()}' --header 'Content-Type: application/json' --header 'Cookie: JSESSIONID=7216B94569B249C7E74CF7409C99C656'`;
    
    console.log('🚀 Fetching cards from CryptoMate via curl...');
    const { stdout, stderr } = await execAsync(curlCommand);
    
    if (stderr) {
      console.error('❌ Curl stderr:', stderr);
    }
    
    const data = JSON.parse(stdout);
    console.log('✅ Cards fetched from CryptoMate:', data.length || 0);
    return data;
  } catch (error) {
    console.error('❌ Error fetching cards from CryptoMate:', error);
    throw error;
  }
};

// Traer transacciones de una tarjeta específica desde CryptoMate usando curl
const fetchTransactionsFromCryptoMate = async (cardId) => {
  try {
    const curlCommand = `curl --location 'https://api.cryptomate.me/cards/virtual-cards/${cardId}/transactions' --header 'x-api-key: ${getCryptoMateApiKey()}' --header 'Content-Type: application/json' --header 'Cookie: JSESSIONID=7216B94569B249C7E74CF7409C99C656'`;
    
    console.log(`🚀 Fetching transactions for card ${cardId} via curl...`);
    const { stdout, stderr } = await execAsync(curlCommand);
    
    if (stderr) {
      console.error('❌ Curl stderr:', stderr);
    }
    
    const data = JSON.parse(stdout);
    return data;
  } catch (error) {
    console.error(`❌ Error fetching transactions for card ${cardId}:`, error);
    return [];
  }
};

// Convertir datos de CryptoMate a formato Nano
const convertCryptoMateCardToNano = (cryptoCard) => {
  return {
    _id: cryptoCard.id, // ID único de CryptoMate
    userId: cryptoCard.id, // Usar el ID de la tarjeta como userId (será el mismo que el _id)
    name: cryptoCard.card_holder_name, // Nombre del titular de la tarjeta
    supplier: 'cryptomate', // Proveedor
    last4: cryptoCard.last4, // Últimos 4 dígitos
    type: cryptoCard.type || 'Virtual', // Tipo de tarjeta
    
    // Estados financieros inicializados en 0 (se actualizarán con transacciones)
    deposited: 0,
    posted: 0,
    pending: 0,
    available: 0,
    
    // Configuraciones de CryptoMate
    status: cryptoCard.status, // ACTIVE, FROZEN, BLOCKED, etc.
    approval_method: cryptoCard.approval_method || 'TopUp',
    forwarded_3ds_type: cryptoCard.forwarded_3ds_type || 'sms',
    
    // Límites de CryptoMate
    limits: {
      daily: cryptoCard.daily_limit || null,
      weekly: cryptoCard.weekly_limit || null,
      monthly: cryptoCard.monthly_limit || null,
      perTransaction: null
    },
    
    // Metadatos de CryptoMate
    meta: {
      email: cryptoCard.meta?.email || '',
      otp_phone_number: {
        dial_code: cryptoCard.meta?.otp_phone_number?.dial_code || null,
        phone_number: cryptoCard.meta?.otp_phone_number?.phone_number || ''
      }
    }
  };
};

// Convertir transacciones de CryptoMate a formato Nano
const convertCryptoMateTransactionToNano = (cryptoTransaction, cardId, userId) => {
  const date = new Date(cryptoTransaction.date || cryptoTransaction.createdAt || Date.now());
  
  return {
    _id: cryptoTransaction.id || `crypto_${Date.now()}_${Math.random()}`,
    userId: userId,
    cardId: cardId,
    name: cryptoTransaction.name || cryptoTransaction.description || 'Transaction',
    amount: cryptoTransaction.amount || cryptoTransaction.MontoTransacction || 0,
    date: date.toLocaleDateString('en-GB'), // Formato DD/MM/YYYY
    time: date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    }),
    status: cryptoTransaction.status || 'TRANSACTION_APPROVED',
    city: cryptoTransaction.city || '',
    country: cryptoTransaction.country || '',
    mcc_category: cryptoTransaction.mcc_category || '',
    mercuryCategory: cryptoTransaction.mercuryCategory || '',
    credit: cryptoTransaction.credit || cryptoTransaction.type === 'credit',
    comentario: cryptoTransaction.comentario || cryptoTransaction.comment || '',
    version: 1,
    isDeleted: false,
    history: [{
      version: 1,
      action: 'created',
      timestamp: new Date(),
      modifiedBy: 'cryptomate_import',
      reason: 'Imported from CryptoMate API'
    }]
  };
};

// Importar todas las tarjetas desde CryptoMate
const importAllCardsFromCryptoMate = async () => {
  try {
    console.log('🚀 Starting import from CryptoMate...');
    
    // Obtener modelos
    const User = getUserModel();
    const Card = getCardModel();
    const Transaction = getTransactionModel();
    
    // Traer todas las tarjetas desde CryptoMate
    const cryptoCards = await fetchCardsFromCryptoMate();
    
    // Verificar si la respuesta es un error
    if (cryptoCards && cryptoCards.code === 'DENIED') {
      console.log('⚠️ API Key does not have permission to access cards');
      return { success: false, message: 'API Key does not have permission to access cards', error: cryptoCards.message };
    }
    
    if (!cryptoCards || !Array.isArray(cryptoCards) || cryptoCards.length === 0) {
      console.log('⚠️ No cards found in CryptoMate');
      return { success: true, message: 'No cards to import', imported: 0 };
    }
    
    let importedUsers = 0;
    let importedCards = 0;
    let importedTransactions = 0;
    
    for (const cryptoCard of cryptoCards) {
      try {
        // Convertir tarjeta de CryptoMate a formato Nano
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
              firstName: nanoCard.name.split(' ')[0] || '',
              lastName: nanoCard.name.split(' ').slice(1).join(' ') || ''
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
          console.log(`✅ Created card: ${nanoCard._id}`);
        } else {
          // Actualizar tarjeta existente
          Object.assign(existingCard, nanoCard);
          await existingCard.save();
          console.log(`🔄 Updated card: ${nanoCard._id}`);
        }
        
        // Traer transacciones de esta tarjeta (comentado temporalmente por permisos de API)
        /*
        try {
          const cryptoTransactions = await fetchTransactionsFromCryptoMate(nanoCard._id);
          
          for (const cryptoTransaction of cryptoTransactions) {
            try {
              const nanoTransaction = convertCryptoMateTransactionToNano(
                cryptoTransaction, 
                nanoCard._id, 
                nanoCard.userId
              );
              
              // Verificar si la transacción ya existe
              const existingTransaction = await Transaction.findById(nanoTransaction._id);
              if (!existingTransaction) {
                const transaction = new Transaction(nanoTransaction);
                await transaction.save();
                importedTransactions++;
                
                // Actualizar KPIs del usuario
                if (nanoTransaction.credit) {
                  user.stats.totalDeposited += nanoTransaction.amount;
                } else {
                  user.stats.totalPosted += nanoTransaction.amount;
                }
                user.stats.totalTransactions += 1;
              }
            } catch (transactionError) {
              console.error(`❌ Error importing transaction ${cryptoTransaction.id}:`, transactionError);
            }
          }
          
          // Actualizar KPIs finales del usuario
          user.stats.totalAvailable = user.stats.totalDeposited - user.stats.totalPosted;
          await user.save();
          
        } catch (transactionError) {
          console.error(`❌ Error fetching transactions for card ${nanoCard._id}:`, transactionError);
        }
        */
        
      } catch (cardError) {
        console.error(`❌ Error importing card ${cryptoCard.id}:`, cardError);
      }
    }
    
    console.log('🎉 Import completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Users imported: ${importedUsers}`);
    console.log(`   - Cards imported: ${importedCards}`);
    console.log(`   - Transactions imported: ${importedTransactions}`);
    
    return {
      success: true,
      message: 'Import completed successfully',
      imported: {
        users: importedUsers,
        cards: importedCards,
        transactions: importedTransactions
      }
    };
    
  } catch (error) {
    console.error('❌ Error during import:', error);
    throw error;
  }
};

// Obtener todas las cards (alias para fetchCardsFromCryptoMate)
const getAllCards = async () => {
  return await fetchCardsFromCryptoMate();
};

// Obtener todas las transacciones de todas las cards
const getAllTransactions = async () => {
  try {
    console.log('🚀 Fetching all transactions from all cards...');
    
    const cards = await fetchCardsFromCryptoMate();
    if (!cards || !Array.isArray(cards)) {
      return [];
    }
    
    const allTransactions = [];
    
    for (const card of cards) {
      try {
        const cardTransactions = await fetchTransactionsFromCryptoMate(card.id);
        if (Array.isArray(cardTransactions)) {
          allTransactions.push(...cardTransactions);
        }
      } catch (error) {
        console.error(`❌ Error fetching transactions for card ${card.id}:`, error.message);
      }
    }
    
    console.log(`✅ Fetched ${allTransactions.length} total transactions from ${cards.length} cards`);
    return allTransactions;
  } catch (error) {
    console.error('❌ Error fetching all transactions:', error);
    return [];
  }
};

module.exports = {
  fetchCardsFromCryptoMate,
  fetchTransactionsFromCryptoMate,
  importAllCardsFromCryptoMate,
  convertCryptoMateCardToNano,
  convertCryptoMateTransactionToNano,
  getAllCards,
  getAllTransactions
};
