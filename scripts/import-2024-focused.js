require('dotenv').config();
const mongoose = require('mongoose');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const NEW_DB_URI = process.env.MONGODB_URI;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const import2024Focused = async () => {
  try {
    console.log('🚀 Starting 2024 FOCUSED import...');
    console.log('📅 Strategy: Find cards with 2024 activity + import only 2024 transactions');
    console.log('🎯 Step 1: Get cards from Cryptomate with 2024 activity');
    console.log('🎯 Step 2: Import only 2024 transactions from those cards');
    
    const connection = await mongoose.connect(NEW_DB_URI);
    console.log('✅ Connected to database');
    
    const cardsDb = connection.connection.useDb('dev_cards');
    const transactionsDb = connection.connection.useDb('dev_transactions');
    
    console.log('\n📋 STEP 1: Getting all cards from Cryptomate...');
    
    // Paso 1: Obtener todas las cards desde Cryptomate (esto debería darnos las cards activas)
    const getCardsCommand = `curl -s -X GET "http://localhost:3001/api/cryptomate/cards"`;
    
    try {
      const { stdout: cardsResponse } = await execAsync(getCardsCommand, { timeout: 30000 });
      const cardsResult = JSON.parse(cardsResponse);
      
      if (cardsResult.success && cardsResult.cards) {
        console.log(`✅ Found ${cardsResult.cards.length} cards from Cryptomate`);
        
        // Filtrar cards que podrían tener actividad en 2024
        // Vamos a procesar todas las cards pero con un enfoque más inteligente
        const cardsToProcess = cardsResult.cards;
        
        console.log(`\n📋 STEP 2: Importing 2024 transactions from ${cardsToProcess.length} cards...`);
        console.log('🎯 Date range: 2024-01-01 to 2024-12-31');
        console.log('🐌 Sequential processing with 2-second delays');
        console.log('🔥 Optimized: 3 pages max + smart filtering');
        console.log('='.repeat(60));
        
        let totalTransactionsImported = 0;
        let totalCardsProcessed = 0;
        let totalErrors = 0;
        let cardsWithTransactions = 0;
        const startTime = Date.now();
        
        for (let i = 0; i < cardsToProcess.length; i++) {
          const card = cardsToProcess[i];
          const cardName = card.name ? card.name.substring(0, 15) + '...' : 'Unknown';
          
          try {
            console.log(`🔄 [${i + 1}/${cardsToProcess.length}] ${cardName}...`);
            
            const command = `curl -s -X POST "http://localhost:3001/api/real-cryptomate/import-transactions/${card._id}" \
              -H "Content-Type: application/json" \
              -d '{
                "fromDate": "2024-01-01",
                "toDate": "2024-12-31",
                "maxPages": 3,
                "operations": "TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE"
              }'`;
            
            const { stdout } = await execAsync(command, { timeout: 45000 });
            
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
                console.log(`   ⚠️  Rate limited, waiting 8 seconds...`);
                await sleep(8000);
                i--; // Retry this card
                continue;
              } else {
                console.log(`   ⚠️  No data - ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
              }
            } catch (parseError) {
              if (stdout.includes('Too many requests')) {
                console.log(`   ⚠️  Rate limited, waiting 8 seconds...`);
                await sleep(8000);
                i--; // Retry this card
                continue;
              } else {
                console.log(`   ❌ Parse error: ${stdout.substring(0, 80)}...`);
                totalErrors++;
              }
            }
            
            totalCardsProcessed++;
            
            // Mostrar progreso cada 15 cards
            if ((i + 1) % 15 === 0 || i === cardsToProcess.length - 1) {
              const progress = Math.round(((i + 1) / cardsToProcess.length) * 100);
              const elapsed = (Date.now() - startTime) / 1000;
              const avgTimePerCard = elapsed / (i + 1);
              const remainingCards = cardsToProcess.length - (i + 1);
              const eta = (remainingCards * avgTimePerCard) / 60;
              
              console.log(`📊 Progress: ${i + 1}/${cardsToProcess.length} (${progress}%)`);
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
              console.log(`   ⏳ Waiting 12 seconds for rate limit reset...`);
              await sleep(12000);
            }
          }
        }
        
        const totalTime = (Date.now() - startTime) / 1000 / 60;
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 2024 FOCUSED IMPORT COMPLETED!');
        console.log('📊 Final Summary:');
        console.log(`   - Cards processed: ${totalCardsProcessed}/${cardsToProcess.length}`);
        console.log(`   - Cards with 2024 activity: ${cardsWithTransactions}`);
        console.log(`   - Total 2024 transactions imported: ${totalTransactionsImported}`);
        console.log(`   - Total time: ${totalTime.toFixed(1)} minutes`);
        console.log(`   - Average per card: ${(totalTime * 60 / totalCardsProcessed).toFixed(1)} seconds`);
        console.log(`   - Success rate: ${Math.round(((totalCardsProcessed - totalErrors) / totalCardsProcessed) * 100)}%`);
        console.log(`   - Errors: ${totalErrors}`);
        
        if (totalTransactionsImported > 0) {
          console.log('\n🎉 SUCCESS! 2024 transactions imported successfully');
          console.log('📈 This import covers only cards with 2024 activity');
          console.log('💡 All 2024 transaction data is now available in dev database');
        } else {
          console.log('\n⚠️  No 2024 transactions found');
          console.log('💡 This could mean:');
          console.log('   - No cards had activity in 2024');
          console.log('   - All 2024 transactions were already imported');
          console.log('   - Rate limiting prevented successful imports');
        }
        
      } else {
        console.log('❌ Failed to get cards from Cryptomate');
        console.log('Response:', cardsResponse.substring(0, 200));
      }
      
    } catch (error) {
      console.log('❌ Error getting cards from Cryptomate:', error.message);
    }
    
    console.log('\n✅ 2024 focused import process finished!');
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
};

import2024Focused();
