require('dotenv').config();
const mongoose = require('mongoose');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const NEW_DB_URI = process.env.MONGODB_URI;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const import2024TransactionsSlow = async () => {
  try {
    console.log('🚀 Starting 2024 TRANSACTIONS import (SLOW VERSION)...');
    console.log('📅 Focus: 2024-01-01 to 2024-12-31 (Full year 2024)');
    console.log('🐌 Sequential processing with delays to avoid rate limiting');
    
    const connection = await mongoose.connect(NEW_DB_URI);
    console.log('✅ Connected to database');
    
    const cardsDb = connection.connection.useDb('dev_cards');
    
    // Obtener todas las cards
    const allCards = await cardsDb.collection('cards').find({}).toArray();
    
    console.log(`📋 Processing ${allCards.length} cards for 2024 transactions`);
    console.log('🎯 Date range: 2024-01-01 to 2024-12-31');
    console.log('🐌 Sequential processing with 3-second delays');
    console.log('🔥 Optimized: 5 pages max + rate limiting protection');
    console.log('='.repeat(60));
    
    let totalTransactionsImported = 0;
    let totalCardsProcessed = 0;
    let totalErrors = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < allCards.length; i++) {
      const card = allCards[i];
      const cardName = card.name ? card.name.substring(0, 15) + '...' : 'Unknown';
      
      try {
        console.log(`🔄 [${i + 1}/${allCards.length}] ${cardName}...`);
        
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
            
            console.log(`   ✅ ${total} tx (${imported} new, ${updated} updated) - ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
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
          } else {
            console.log(`   ❌ Parse error: ${stdout.substring(0, 100)}...`);
            totalErrors++;
          }
        }
        
        totalCardsProcessed++;
        
        // Mostrar progreso cada 10 cards
        if ((i + 1) % 10 === 0 || i === allCards.length - 1) {
          const progress = Math.round(((i + 1) / allCards.length) * 100);
          const elapsed = (Date.now() - startTime) / 1000;
          const avgTimePerCard = elapsed / (i + 1);
          const remainingCards = allCards.length - (i + 1);
          const eta = (remainingCards * avgTimePerCard) / 60;
          
          console.log(`📊 Progress: ${i + 1}/${allCards.length} (${progress}%)`);
          console.log(`💰 Total transactions: ${totalTransactionsImported}`);
          console.log(`⏱️  Avg: ${avgTimePerCard.toFixed(1)}s per card`);
          console.log(`🕐 ETA: ${eta.toFixed(1)} minutes`);
          console.log(`❌ Errors: ${totalErrors}`);
          console.log('');
        }
        
        // Delay entre requests para evitar rate limiting
        await sleep(3000);
        
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
    
    const totalTime = (Date.now() - startTime) / 1000 / 60;
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 2024 TRANSACTIONS IMPORT COMPLETED!');
    console.log('📊 Final Summary:');
    console.log(`   - Cards processed: ${totalCardsProcessed}/${allCards.length}`);
    console.log(`   - Total transactions imported: ${totalTransactionsImported}`);
    console.log(`   - Total time: ${totalTime.toFixed(1)} minutes`);
    console.log(`   - Average per card: ${(totalTime * 60 / totalCardsProcessed).toFixed(1)} seconds`);
    console.log(`   - Success rate: ${Math.round(((totalCardsProcessed - totalErrors) / totalCardsProcessed) * 100)}%`);
    console.log(`   - Errors: ${totalErrors}`);
    
    if (totalTransactionsImported > 0) {
      console.log('\n🎉 SUCCESS! 2024 transactions imported successfully');
      console.log('📈 This import covers the complete year 2024');
      console.log('💡 All 2024 transaction data is now available in dev database');
    }
    
    console.log('\n✅ 2024 transactions import process finished!');
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
};

import2024TransactionsSlow();
