require('dotenv').config();
const mongoose = require('mongoose');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const NEW_DB_URI = process.env.MONGODB_URI;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const import2024FromLocal = async () => {
  try {
    console.log('🚀 Starting 2024 IMPORT from LOCAL cards...');
    console.log('📅 Strategy: Use local cards + import only 2024 transactions');
    console.log('🎯 Step 1: Get cards from local database');
    console.log('🎯 Step 2: Import only 2024 transactions from those cards');
    
    const connection = await mongoose.connect(NEW_DB_URI);
    console.log('✅ Connected to database');
    
    const cardsDb = connection.connection.useDb('dev_cards');
    const transactionsDb = connection.connection.useDb('dev_transactions');
    
    console.log('\n📋 STEP 1: Getting cards from local database...');
    
    // Obtener todas las cards de la base de datos local
    const localCards = await cardsDb.collection('cards').find({}).toArray();
    console.log(`✅ Found ${localCards.length} cards in local database`);
    
    // Verificar cuántas transacciones de 2024 ya tenemos
    const existing2024Transactions = await transactionsDb.collection('transactions').countDocuments({
      createdAt: {
        $gte: new Date('2024-01-01'),
        $lt: new Date('2025-01-01')
      }
    });
    console.log(`📊 Existing 2024 transactions in DB: ${existing2024Transactions}`);
    
    console.log(`\n📋 STEP 2: Importing 2024 transactions from ${localCards.length} cards...`);
    console.log('🎯 Date range: 2024-01-01 to 2024-12-31');
    console.log('🐌 Sequential processing with 2-second delays');
    console.log('🔥 Optimized: 5 pages max + smart filtering');
    console.log('='.repeat(60));
    
    let totalTransactionsImported = 0;
    let totalCardsProcessed = 0;
    let totalErrors = 0;
    let cardsWithTransactions = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < localCards.length; i++) {
      const card = localCards[i];
      const cardName = card.name ? card.name.substring(0, 15) + '...' : 'Unknown';
      
      try {
        console.log(`🔄 [${i + 1}/${localCards.length}] ${cardName}...`);
        
        const command = `curl -s -X POST "http://localhost:3001/api/real-cryptomate/import-transactions/${card._id}" \
          -H "Content-Type: application/json" \
          -d '{
            "fromDate": "2024-01-01",
            "toDate": "2024-12-31",
            "maxPages": 5,
            "operations": "TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE"
          }'`;
        
        const { stdout } = await execAsync(command, { timeout: 60000 });
        
        try {
          const result = JSON.parse(stdout);
          if (result.success && result.summary) {
            const imported = result.summary.importedTransactions || 0;
            const updated = result.summary.updatedTransactions || 0;
            const total = imported + updated;
            
            if (total > 0) {
              console.log(`   ✅ ${total} tx (${imported} new, ${updated} updated) - ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
              cardsWithTransactions++;
            } else {
              console.log(`   ⚪ No 2024 transactions - ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
            }
            
            totalTransactionsImported += total;
          } else if (result.message && result.message.includes('Too many requests')) {
            console.log(`   ⚠️  Rate limited, waiting 10 seconds...`);
            await sleep(10000);
            i--; // Retry this card
            continue;
          } else {
            console.log(`   ⚠️  No data - ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
          }
        } catch (parseError) {
          if (stdout.includes('Too many requests')) {
            console.log(`   ⚠️  Rate limited, waiting 10 seconds...`);
            await sleep(10000);
            i--; // Retry this card
            continue;
          } else if (stdout.includes('Access denied')) {
            console.log(`   🔒 Access denied for this card - ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
            totalErrors++;
          } else {
            console.log(`   ❌ Parse error: ${stdout.substring(0, 80)}...`);
            totalErrors++;
          }
        }
        
        totalCardsProcessed++;
        
        // Mostrar progreso cada 20 cards
        if ((i + 1) % 20 === 0 || i === localCards.length - 1) {
          const progress = Math.round(((i + 1) / localCards.length) * 100);
          const elapsed = (Date.now() - startTime) / 1000;
          const avgTimePerCard = elapsed / (i + 1);
          const remainingCards = localCards.length - (i + 1);
          const eta = (remainingCards * avgTimePerCard) / 60;
          
          console.log(`📊 Progress: ${i + 1}/${localCards.length} (${progress}%)`);
          console.log(`💰 Total transactions: ${totalTransactionsImported}`);
          console.log(`💳 Cards with 2024 data: ${cardsWithTransactions}`);
          console.log(`⏱️  Avg: ${avgTimePerCard.toFixed(1)}s per card`);
          console.log(`🕐 ETA: ${eta.toFixed(1)} minutes`);
          console.log(`❌ Errors: ${totalErrors}`);
          console.log('');
        }
        
        // Delay entre requests para evitar rate limiting
        await sleep(2000);
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message.substring(0, 50)}... - ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
        totalErrors++;
        
        // Si es rate limiting, esperar más tiempo
        if (error.message.includes('Too many requests')) {
          console.log(`   ⏳ Waiting 15 seconds for rate limit reset...`);
          await sleep(15000);
        }
      }
    }
    
    // Verificar el total final de transacciones de 2024
    const final2024Transactions = await transactionsDb.collection('transactions').countDocuments({
      createdAt: {
        $gte: new Date('2024-01-01'),
        $lt: new Date('2025-01-01')
      }
    });
    
    const totalTime = (Date.now() - startTime) / 1000 / 60;
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 2024 IMPORT FROM LOCAL CARDS COMPLETED!');
    console.log('📊 Final Summary:');
    console.log(`   - Cards processed: ${totalCardsProcessed}/${localCards.length}`);
    console.log(`   - Cards with 2024 activity: ${cardsWithTransactions}`);
    console.log(`   - New 2024 transactions imported: ${totalTransactionsImported}`);
    console.log(`   - Total 2024 transactions in DB: ${final2024Transactions}`);
    console.log(`   - Total time: ${totalTime.toFixed(1)} minutes`);
    console.log(`   - Average per card: ${(totalTime * 60 / totalCardsProcessed).toFixed(1)} seconds`);
    console.log(`   - Success rate: ${Math.round(((totalCardsProcessed - totalErrors) / totalCardsProcessed) * 100)}%`);
    console.log(`   - Errors: ${totalErrors}`);
    
    if (totalTransactionsImported > 0) {
      console.log('\n🎉 SUCCESS! 2024 transactions imported successfully');
      console.log('📈 This import focused on 2024 data only');
      console.log('💡 All 2024 transaction data is now available in dev database');
    } else if (final2024Transactions > 0) {
      console.log('\n✅ 2024 transactions already exist in database');
      console.log('📈 No new transactions were imported (they may already be there)');
    } else {
      console.log('\n⚠️  No 2024 transactions found');
      console.log('💡 This could mean:');
      console.log('   - No cards had activity in 2024');
      console.log('   - Rate limiting prevented successful imports');
      console.log('   - API access issues');
    }
    
    console.log('\n✅ 2024 import from local cards finished!');
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
};

import2024FromLocal();
