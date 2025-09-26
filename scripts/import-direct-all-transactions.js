require('dotenv').config();
const mongoose = require('mongoose');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const NEW_DB_URI = process.env.MONGODB_URI;

// Configuración de CryptoMate API
const CRYPTOMATE_API_KEY = 'api-45f14849-914c-420e-a788-2e969d92bd5d';
const CRYPTOMATE_COOKIE = 'JSESSIONID=97A7964CFD65CCA327AF0AA1AB798D42';

const fetchAllTransactionsForCard = async (cardId) => {
  try {
    const operations = 'TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE';
    const fromDate = '2024-01-01';
    const toDate = '2025-12-31';
    
    // Hacer el call directo a CryptoMate API
    const curlCommand = `curl -s "https://api.cryptomate.me/cards/transactions/${cardId}/search?from_date=${fromDate}&to_date=${toDate}&operations=${operations.split(',').map(op => `operations=${op}`).join('&')}&size=100&page_number=1" -H "x-api-key: ${CRYPTOMATE_API_KEY}" -H "Content-Type: application/json" -H "Cookie: ${CRYPTOMATE_COOKIE}"`;
    
    const { stdout, stderr } = await execAsync(curlCommand);
    
    if (stderr) {
      throw new Error(`CryptoMate API error: ${stderr}`);
    }
    
    const data = JSON.parse(stdout);
    return data.movements || [];
    
  } catch (error) {
    console.error(`❌ Error fetching transactions for card ${cardId}:`, error.message);
    return [];
  }
};

const convertCryptoMateTransactionToNano = (cryptoTransaction, cardId, cardName, userName) => {
  const date = new Date(cryptoTransaction.datetime || Date.now());
  
  return {
    _id: cryptoTransaction.id,
    userId: cardId, // Usar cardId como userId
    cardId: cardId,
    userName: userName || 'Unknown User',
    cardName: cardName || 'Unknown Card',
    name: cryptoTransaction.operation === 'OVERRIDE_VIRTUAL_BALANCE' 
      ? 'DEPOSIT' 
      : cryptoTransaction.merchant_name || 'Unknown Transaction',
    amount: cryptoTransaction.operation === 'OVERRIDE_VIRTUAL_BALANCE' 
      ? cryptoTransaction.new_balance || 0 
      : cryptoTransaction.bill_amount || cryptoTransaction.transaction_amount || 0,
    date: date.toLocaleDateString('es-AR'),
    time: date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    status: cryptoTransaction.status || 'Completed',
    operation: cryptoTransaction.operation === 'OVERRIDE_VIRTUAL_BALANCE' 
      ? 'WALLET_DEPOSIT' 
      : cryptoTransaction.operation,
    city: cryptoTransaction.city,
    country: cryptoTransaction.country,
    mcc_category: cryptoTransaction.mcc_category,
    mercuryCategory: cryptoTransaction.mercuryCategory,
    credit: cryptoTransaction.operation === 'WALLET_DEPOSIT' || 
            cryptoTransaction.operation === 'TRANSACTION_REFUND' || 
            cryptoTransaction.operation === 'OVERRIDE_VIRTUAL_BALANCE',
    comentario: '',
    version: 1,
    history: [{
      version: 1,
      action: 'created',
      timestamp: new Date(),
      modifiedBy: cardId,
      reason: 'Direct import from CryptoMate API'
    }]
  };
};

const importDirectAllTransactions = async () => {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting COMPLETE RE-IMPORT from CryptoMate API...');
    console.log('📅 Using EXTENDED date range: 2024-01-01 to 2025-12-31');
    console.log('🔄 RE-PROCESSING ALL 174 cards (may find additional 2024 transactions)');
    console.log('⚡ This will be 10-20x faster than the previous method!');
    
    // Conectar a la DB
    const connection = await mongoose.connect(NEW_DB_URI);
    console.log('✅ Connected to database');
    
    const cardsDb = connection.connection.useDb('dev_cards');
    const transactionsDb = connection.connection.useDb('dev_transactions');
    
    // Obtener TODAS las cards
    console.log('📋 Fetching all cards from database...');
    const allCards = await cardsDb.collection('cards').find({}).toArray();
    console.log(`📦 Found ${allCards.length} total cards`);
    
    // RE-PROCESAR TODAS LAS CARDS (incluidas las que ya tienen transacciones)
    const cardsToProcess = allCards;
    
    console.log(`🔄 RE-PROCESSING ALL CARDS with extended 2024-2025 range`);
    console.log(`🎯 Cards to process: ${cardsToProcess.length}`);
    console.log('='.repeat(70));
    
    if (cardsToProcess.length === 0) {
      console.log('🎉 All cards already have transactions imported!');
      return;
    }
    
    let totalTransactionsProcessed = 0;
    let totalCardsProcessed = 0;
    let allTransactionsToInsert = [];
    let cardUpdates = [];
    
    // FASE 1: Recolectar TODAS las transacciones de TODAS las cards
    console.log('\n📥 FASE 1: Fetching all transactions from CryptoMate API...');
    console.log('='.repeat(70));
    
    for (let i = 0; i < cardsToProcess.length; i++) {
      const card = cardsToProcess[i];
      const progressPercent = Math.round(((i + 1) / cardsToProcess.length) * 100);
      
      try {
        console.log(`🔄 [${i + 1}/${cardsToProcess.length}] (${progressPercent}%) ${card.name.substring(0, 35)}...`);
        
        // Fetch transacciones directamente de CryptoMate
        const cryptoTransactions = await fetchAllTransactionsForCard(card._id);
        
        if (cryptoTransactions.length > 0) {
          console.log(`   ✅ Found ${cryptoTransactions.length} transactions`);
          
          // Convertir a formato Nano
          for (const cryptoTx of cryptoTransactions) {
            const nanoTx = convertCryptoMateTransactionToNano(
              cryptoTx, 
              card._id, 
              card.name, 
              card.name // Usar nombre de la card como userName
            );
            allTransactionsToInsert.push(nanoTx);
          }
          
          // Preparar actualización de balances de la card
          const deposits = cryptoTransactions
            .filter(tx => tx.operation === 'WALLET_DEPOSIT' || tx.operation === 'TRANSACTION_REFUND' || tx.operation === 'OVERRIDE_VIRTUAL_BALANCE')
            .reduce((sum, tx) => sum + (tx.operation === 'OVERRIDE_VIRTUAL_BALANCE' ? tx.new_balance || 0 : tx.bill_amount || tx.transaction_amount || 0), 0);
          
          const expenses = cryptoTransactions
            .filter(tx => tx.operation === 'TRANSACTION_APPROVED')
            .reduce((sum, tx) => sum + (tx.bill_amount || tx.transaction_amount || 0), 0);
          
          cardUpdates.push({
            updateOne: {
              filter: { _id: card._id },
              update: {
                $set: {
                  deposited: deposits,
                  posted: expenses,
                  pending: 0,
                  available: deposits - expenses,
                  updatedAt: new Date()
                }
              }
            }
          });
          
          totalTransactionsProcessed += cryptoTransactions.length;
        } else {
          console.log(`   ⭕ No transactions found`);
        }
        
        totalCardsProcessed++;
        
        // Mostrar progreso cada 25 cards
        if ((i + 1) % 25 === 0) {
          const elapsedMinutes = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
          const avgPerCard = ((Date.now() - startTime) / 1000) / (i + 1);
          const remainingCards = cardsToProcess.length - (i + 1);
          const etaMinutes = (remainingCards * avgPerCard / 60).toFixed(1);
          
          console.log(`\n📊 Progress: ${i + 1}/${cardsToProcess.length} cards (${progressPercent}%)`);
          console.log(`💰 Transactions collected: ${totalTransactionsProcessed}`);
          console.log(`⏱️  Elapsed: ${elapsedMinutes}min | ETA: ${etaMinutes}min | Avg: ${avgPerCard.toFixed(1)}s/card`);
          console.log('');
        }
        
        // Pequeña pausa para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message.substring(0, 60)}...`);
        totalCardsProcessed++;
      }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('📥 FASE 1 COMPLETED - All transactions collected!');
    console.log(`📊 Summary: ${totalTransactionsProcessed} transactions from ${totalCardsProcessed} cards`);
    
      // FASE 2: Insertar TODAS las transacciones en lotes masivos (ignorando duplicados)
    if (allTransactionsToInsert.length > 0) {
      console.log('\n💾 FASE 2: Mass inserting all transactions...');
      console.log('⚠️  Note: Will skip duplicate transactions automatically');
      console.log('='.repeat(70));
      
      const batchSize = 1000;
      const totalBatches = Math.ceil(allTransactionsToInsert.length / batchSize);
      let totalInserted = 0;
      let totalSkipped = 0;
      
      for (let i = 0; i < totalBatches; i++) {
        const startIdx = i * batchSize;
        const endIdx = Math.min(startIdx + batchSize, allTransactionsToInsert.length);
        const batch = allTransactionsToInsert.slice(startIdx, endIdx);
        
        try {
          const result = await transactionsDb.collection('transactions').insertMany(batch, { ordered: false });
          totalInserted += result.insertedCount;
          console.log(`✅ Batch ${i + 1}/${totalBatches}: Inserted ${result.insertedCount} new transactions`);
        } catch (error) {
          // Manejar duplicados
          const insertedCount = error.result?.insertedCount || 0;
          const skippedCount = batch.length - insertedCount;
          totalInserted += insertedCount;
          totalSkipped += skippedCount;
          console.log(`⚠️ Batch ${i + 1}/${totalBatches}: Inserted ${insertedCount} new, skipped ${skippedCount} duplicates`);
        }
      }
      
      console.log(`✅ All transactions processed! New: ${totalInserted}, Skipped duplicates: ${totalSkipped}`);
    }
    
    // FASE 3: Actualizar balances de cards en lotes masivos
    if (cardUpdates.length > 0) {
      console.log('\n🔄 FASE 3: Updating card balances...');
      console.log('='.repeat(70));
      
      const result = await cardsDb.collection('cards').bulkWrite(cardUpdates);
      console.log(`✅ Updated balances for ${result.modifiedCount} cards`);
    }
    
    const totalTimeMinutes = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n' + '='.repeat(70));
    console.log('🎉 DIRECT MASS IMPORT COMPLETED SUCCESSFULLY!');
    console.log('📊 FINAL SUMMARY:');
    console.log(`   🏁 Total time: ${totalTimeMinutes} minutes`);
    console.log(`   💳 Cards processed: ${totalCardsProcessed}`);
    console.log(`   💰 Transactions imported: ${totalTransactionsProcessed}`);
    console.log(`   ⚡ Average: ${(parseFloat(totalTimeMinutes) * 60 / totalCardsProcessed).toFixed(1)} seconds per card`);
    console.log(`   🚀 Speed: ${Math.round(totalTransactionsProcessed / parseFloat(totalTimeMinutes))} transactions/minute`);
    
    console.log('\n🏆 IMPORT COMPLETED! This was much faster than the previous method!');
    
  } catch (error) {
    console.error('❌ Mass import error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  importDirectAllTransactions();
}

module.exports = { importDirectAllTransactions };
