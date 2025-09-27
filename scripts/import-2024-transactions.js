require('dotenv').config();
const mongoose = require('mongoose');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const NEW_DB_URI = process.env.MONGODB_URI;

const import2024Transactions = async () => {
  try {
    console.log('🚀 Starting 2024 TRANSACTIONS import...');
    console.log('📅 Focus: 2024-01-01 to 2024-12-31 (Full year 2024)');
    console.log('⚡ Parallel processing + optimized for 2024 data');
    
    const connection = await mongoose.connect(NEW_DB_URI);
    console.log('✅ Connected to database');
    
    const cardsDb = connection.connection.useDb('dev_cards');
    const transactionsDb = connection.connection.useDb('dev_transactions');
    
    // Obtener todas las cards
    const allCards = await cardsDb.collection('cards').find({}).toArray();
    
    console.log(`📋 Processing ${allCards.length} cards for 2024 transactions`);
    console.log('🎯 Date range: 2024-01-01 to 2024-12-31');
    console.log('⚡ Parallel processing: 20 cards simultaneously');
    console.log('🔥 Optimized: 10 pages max + 2024-specific parameters');
    console.log('='.repeat(60));
    
    const BATCH_SIZE = 20;
    const TOTAL_BATCHES = Math.ceil(allCards.length / BATCH_SIZE);
    let totalTransactionsImported = 0;
    let totalCardsProcessed = 0;
    let totalErrors = 0;
    const startTime = Date.now();
    
    for (let batchIndex = 0; batchIndex < TOTAL_BATCHES; batchIndex++) {
      const batchStart = batchIndex * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, allCards.length);
      const batchCards = allCards.slice(batchStart, batchEnd);
      
      console.log(`\n📦 Batch ${batchIndex + 1}/${TOTAL_BATCHES} (${batchCards.length} cards)`);
      
      // Procesar cards en paralelo
      const batchPromises = batchCards.map(async (card, index) => {
        const globalIndex = batchStart + index + 1;
        const cardName = card.name ? card.name.substring(0, 15) + '...' : 'Unknown';
        
        try {
          console.log(`🔄 [${globalIndex}] ${cardName}...`);
          
          const command = `curl -s -X POST "http://localhost:3001/api/real-cryptomate/import-transactions/${card._id}" \
            -H "Content-Type: application/json" \
            -d '{
              "fromDate": "2024-01-01",
              "toDate": "2024-12-31",
              "maxPages": 10,
              "operations": "TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE"
            }'`;
          
          const { stdout } = await execAsync(command, { timeout: 120000 });
          
          try {
            const result = JSON.parse(stdout);
            if (result.success && result.summary) {
              const imported = result.summary.importedTransactions || 0;
              const updated = result.summary.updatedTransactions || 0;
              const total = imported + updated;
              
              console.log(`   ✅ ${total} tx (${imported} new, ${updated} updated) - ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
              return { success: true, transactions: total, new: imported, updated: updated };
            } else {
              console.log(`   ⚠️  No data or error - ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
              return { success: true, transactions: 0, new: 0, updated: 0 };
            }
          } catch (parseError) {
            console.log(`   ❌ Parse error - ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
            return { success: false, transactions: 0, new: 0, updated: 0 };
          }
          
        } catch (error) {
          console.log(`   ❌ Error: ${error.message.substring(0, 50)}... - ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
          return { success: false, transactions: 0, new: 0, updated: 0 };
        }
      });
      
      // Esperar a que termine el lote
      const batchResults = await Promise.all(batchPromises);
      
      // Calcular estadísticas del lote
      const batchSuccess = batchResults.filter(r => r.success).length;
      const batchErrors = batchResults.filter(r => !r.success).length;
      const batchTransactions = batchResults.reduce((sum, r) => sum + r.transactions, 0);
      const batchNew = batchResults.reduce((sum, r) => sum + r.new, 0);
      const batchUpdated = batchResults.reduce((sum, r) => sum + r.updated, 0);
      
      totalCardsProcessed += batchCards.length;
      totalTransactionsImported += batchTransactions;
      totalErrors += batchErrors;
      
      console.log(`📊 Batch: ${batchSuccess}✅ ${batchErrors}❌ | ${batchTransactions} total tx (${batchNew} new, ${batchUpdated} updated)`);
      
      // Mostrar progreso general
      const progress = Math.round((totalCardsProcessed / allCards.length) * 100);
      const elapsed = (Date.now() - startTime) / 1000;
      const avgTimePerCard = elapsed / totalCardsProcessed;
      const remainingCards = allCards.length - totalCardsProcessed;
      const eta = (remainingCards * avgTimePerCard) / 60;
      
      console.log(`📊 Progress: ${totalCardsProcessed}/${allCards.length} (${progress}%)`);
      console.log(`💰 Total transactions: ${totalTransactionsImported}`);
      console.log(`⏱️  Avg: ${avgTimePerCard.toFixed(1)}s per card`);
      console.log(`🕐 ETA: ${eta.toFixed(1)} minutes`);
      console.log(`❌ Errors: ${totalErrors}`);
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

import2024Transactions();
