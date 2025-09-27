require('dotenv').config();
const mongoose = require('mongoose');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const NEW_DB_URI = process.env.MONGODB_URI;

const importDailyUpdate = async () => {
  try {
    console.log('🚀 Starting DAILY UPDATE import...');
    console.log('⚡ Optimized for daily incremental updates');
    
    const connection = await mongoose.connect(NEW_DB_URI);
    console.log('✅ Connected to database');
    
    const cardsDb = connection.connection.useDb('dev_cards');
    
    // Obtener todas las cards (para actualizaciones diarias)
    const allCards = await cardsDb.collection('cards').find({}).toArray();
    
    console.log(`📋 Processing ${allCards.length} cards for daily update`);
    console.log('🎯 Using YESTERDAY date range: last 24 hours only');
    console.log('⚡ Parallel processing: 20 cards simultaneously');
    console.log('🔥 Optimized: 1 page max + minimal data');
    console.log('='.repeat(60));
    
    if (allCards.length === 0) {
      console.log('❌ No cards found in database');
      return;
    }
    
    let totalProcessed = 0;
    let totalTransactionsImported = 0;
    let totalCardsUpdated = 0;
    let errors = [];
    const startTime = Date.now();
    
    // Calcular fecha de ayer
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    
    console.log(`📅 Date range: ${yesterdayStr} to ${todayStr}`);
    
    // Procesar en lotes de 20 cards en paralelo (máxima velocidad para updates)
    const batchSize = 20;
    for (let i = 0; i < allCards.length; i += batchSize) {
      const batch = allCards.slice(i, i + batchSize);
      
      console.log(`\n📦 Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allCards.length/batchSize)} (${batch.length} cards)`);
      
      // Procesar el lote en paralelo
      const batchPromises = batch.map(async (card, index) => {
        const cardStartTime = Date.now();
        
        try {
          console.log(`🔄 [${i + index + 1}] ${card.name.substring(0, 15)}...`);
          
          // DAILY UPDATE: Solo el día anterior + 1 página máximo
          const curlCommand = `curl -s -X POST http://localhost:3001/api/real-cryptomate/import-transactions/${card._id} -H "Content-Type: application/json" -d '{"fromDate": "${yesterdayStr}", "toDate": "${todayStr}", "maxPages": 1, "operations": "TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE"}'`;
          
          const { stdout, stderr } = await execAsync(curlCommand);
          
          if (stderr && !stderr.includes('timeout')) {
            throw new Error(`Curl error: ${stderr}`);
          }
          
          const result = JSON.parse(stdout);
          const cardTime = ((Date.now() - cardStartTime) / 1000).toFixed(1);
          
          if (result.success) {
            totalTransactionsImported += result.summary.totalTransactions;
            if (result.summary.totalTransactions > 0) {
              totalCardsUpdated++;
            }
            console.log(`   ✅ ${result.summary.totalTransactions} tx (${result.summary.imported} new) - ${cardTime}s`);
            return { 
              success: true, 
              transactions: result.summary.totalTransactions,
              imported: result.summary.imported,
              updated: result.summary.updated
            };
          } else {
            console.log(`   ❌ Failed: ${result.message || result.error || 'Unknown error'} - ${cardTime}s`);
            return { success: false, error: result.message || result.error };
          }
          
        } catch (error) {
          const cardTime = ((Date.now() - cardStartTime) / 1000).toFixed(1);
          console.log(`   ❌ Error: ${error.message.substring(0, 30)}... - ${cardTime}s`);
          return { success: false, error: error.message };
        }
      });
      
      // Esperar a que termine el lote
      const batchResults = await Promise.all(batchPromises);
      
      // Analizar resultados del lote
      const batchSuccesses = batchResults.filter(r => r.success).length;
      const batchErrors = batchResults.filter(r => !r.success).length;
      const batchTransactions = batchResults.reduce((sum, r) => sum + (r.transactions || 0), 0);
      const batchImported = batchResults.reduce((sum, r) => sum + (r.imported || 0), 0);
      
      totalProcessed += batch.length;
      
      console.log(`📊 Batch: ${batchSuccesses}✅ ${batchErrors}❌ | ${batchTransactions} new tx (${batchImported} imported)`);
      
      // Pausa mínima entre lotes (1 segundo)
      if (i + batchSize < allCards.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Mostrar progreso cada 3 lotes
      if ((i + batchSize) % (batchSize * 3) === 0 || i + batchSize >= allCards.length) {
        const progressPercent = Math.round((totalProcessed / allCards.length) * 100);
        const elapsedTime = (Date.now() - startTime) / 1000;
        const avgTimePerCard = elapsedTime / totalProcessed;
        const remainingCards = allCards.length - totalProcessed;
        const estimatedTimeLeft = (remainingCards * avgTimePerCard) / 60;
        
        console.log(`\n📊 ${totalProcessed}/${allCards.length} (${progressPercent}%) | ${totalTransactionsImported} new tx | ${estimatedTimeLeft.toFixed(1)}min left`);
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 DAILY UPDATE COMPLETED!');
    console.log('📊 Summary:');
    console.log(`   - Cards processed: ${totalProcessed}/${allCards.length}`);
    console.log(`   - Cards with new transactions: ${totalCardsUpdated}`);
    console.log(`   - New transactions imported: ${totalTransactionsImported}`);
    console.log(`   - Total time: ${totalTime} minutes`);
    console.log(`   - Average per card: ${(parseFloat(totalTime) * 60 / totalProcessed).toFixed(1)} seconds`);
    console.log(`   - Success rate: ${Math.round(((totalProcessed - errors.length) / totalProcessed) * 100)}%`);
    console.log(`   - Errors: ${errors.length}`);
    
    if (totalTransactionsImported > 0) {
      console.log('\n🎉 SUCCESS! Daily update completed successfully');
      console.log(`📈 Found new transactions for ${totalCardsUpdated} cards`);
    } else {
      console.log('\n📊 No new transactions found for any cards');
      console.log('💡 This is normal if no transactions occurred yesterday');
    }
    
    console.log('\n✅ Daily update process finished!');
    
  } catch (error) {
    console.error('❌ Daily update error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  importDailyUpdate();
}

module.exports = { importDailyUpdate };
