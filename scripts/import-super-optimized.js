require('dotenv').config();
const mongoose = require('mongoose');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const NEW_DB_URI = process.env.MONGODB_URI;

const importSuperOptimized = async () => {
  try {
    console.log('🚀 Starting SUPER-OPTIMIZED import...');
    console.log('⚡ MAXIMUM parallelization + full date range + optimized parameters');
    
    const connection = await mongoose.connect(NEW_DB_URI);
    console.log('✅ Connected to database');
    
    const cardsDb = connection.connection.useDb('dev_cards');
    const transactionsDb = connection.connection.useDb('dev_transactions');
    
    // Obtener cards que ya tienen transacciones
    const cardsWithTransactions = await transactionsDb.collection('transactions').aggregate([
      { $group: { _id: '$cardId' } }
    ]).toArray();
    
    const cardsWithTransactionsIds = cardsWithTransactions.map(c => c._id);
    
    // Obtener todas las cards sin transacciones
    const cardsWithoutTransactions = await cardsDb.collection('cards').find({
      _id: { $nin: cardsWithTransactionsIds }
    }).toArray();
    
    console.log(`📋 Processing ${cardsWithoutTransactions.length} cards with SUPER-OPTIMIZED method`);
    console.log(`✅ Already processed: ${cardsWithTransactions.length} cards`);
    console.log('🎯 Using FULL date range: 2024-01-01 to 2025-12-31 (2 years)');
    console.log('⚡ Parallel processing: 15 cards simultaneously');
    console.log('🔥 Optimized: 5 pages max + smart error handling');
    console.log('⚡ No delays between batches');
    console.log('='.repeat(60));
    
    if (cardsWithoutTransactions.length === 0) {
      console.log('🎉 All cards already have transactions imported!');
      return;
    }
    
    let totalProcessed = 0;
    let totalTransactionsImported = 0;
    let errors = [];
    const startTime = Date.now();
    
    // Procesar en lotes de 15 cards en paralelo (máxima paralelización)
    const batchSize = 15;
    for (let i = 0; i < cardsWithoutTransactions.length; i += batchSize) {
      const batch = cardsWithoutTransactions.slice(i, i + batchSize);
      
      console.log(`\n📦 Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(cardsWithoutTransactions.length/batchSize)} (${batch.length} cards)`);
      
      // Procesar el lote en paralelo con manejo de errores robusto
      const batchPromises = batch.map(async (card, index) => {
        const cardStartTime = Date.now();
        
        try {
          console.log(`🔄 [${i + index + 1}] ${card.name.substring(0, 18)}...`);
          
          // SUPER-OPTIMIZADO: Rango completo + 5 páginas + operaciones específicas
          const curlCommand = `curl -s -X POST http://localhost:3001/api/real-cryptomate/import-transactions/${card._id} -H "Content-Type: application/json" -d '{"fromDate": "2024-01-01", "toDate": "2025-12-31", "maxPages": 5, "operations": "TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE"}'`;
          
          const { stdout, stderr } = await execAsync(curlCommand);
          
          if (stderr && !stderr.includes('timeout')) {
            throw new Error(`Curl error: ${stderr}`);
          }
          
          const result = JSON.parse(stdout);
          const cardTime = ((Date.now() - cardStartTime) / 1000).toFixed(1);
          
          if (result.success) {
            totalTransactionsImported += result.summary.totalTransactions;
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
          console.log(`   ❌ Error: ${error.message.substring(0, 35)}... - ${cardTime}s`);
          return { success: false, error: error.message };
        }
      });
      
      // Esperar a que termine el lote completo
      const batchResults = await Promise.all(batchPromises);
      
      // Analizar resultados del lote
      const batchSuccesses = batchResults.filter(r => r.success).length;
      const batchErrors = batchResults.filter(r => !r.success).length;
      const batchTransactions = batchResults.reduce((sum, r) => sum + (r.transactions || 0), 0);
      const batchImported = batchResults.reduce((sum, r) => sum + (r.imported || 0), 0);
      const batchUpdated = batchResults.reduce((sum, r) => sum + (r.updated || 0), 0);
      
      totalProcessed += batch.length;
      
      console.log(`📊 Batch: ${batchSuccesses}✅ ${batchErrors}❌ | ${batchTransactions} total tx (${batchImported} new, ${batchUpdated} updated)`);
      
      // SIN PAUSA entre lotes para máxima velocidad
      
      // Mostrar progreso cada 2 lotes para no saturar el output
      if ((i + batchSize) % (batchSize * 2) === 0 || i + batchSize >= cardsWithoutTransactions.length) {
        const progressPercent = Math.round((totalProcessed / cardsWithoutTransactions.length) * 100);
        const elapsedTime = (Date.now() - startTime) / 1000;
        const avgTimePerCard = elapsedTime / totalProcessed;
        const remainingCards = cardsWithoutTransactions.length - totalProcessed;
        const estimatedTimeLeft = (remainingCards * avgTimePerCard) / 60;
        
        console.log(`\n📊 Progress: ${totalProcessed}/${cardsWithoutTransactions.length} (${progressPercent}%)`);
        console.log(`💰 Total transactions: ${totalTransactionsImported}`);
        console.log(`⏱️  Avg: ${avgTimePerCard.toFixed(1)}s per card`);
        console.log(`🕐 ETA: ${estimatedTimeLeft.toFixed(1)} minutes`);
        console.log(`❌ Errors: ${errors.length}`);
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SUPER-OPTIMIZED IMPORT COMPLETED!');
    console.log('📊 Final Summary:');
    console.log(`   - Cards processed: ${totalProcessed}/${cardsWithoutTransactions.length}`);
    console.log(`   - Total transactions imported: ${totalTransactionsImported}`);
    console.log(`   - Total time: ${totalTime} minutes`);
    console.log(`   - Average per card: ${(parseFloat(totalTime) * 60 / totalProcessed).toFixed(1)} seconds`);
    console.log(`   - Success rate: ${Math.round(((totalProcessed - errors.length) / totalProcessed) * 100)}%`);
    console.log(`   - Errors: ${errors.length}`);
    
    if (errors.length > 0 && errors.length < 15) {
      console.log('\n❌ Errors encountered:');
      errors.forEach((err, index) => {
        console.log(`   ${index + 1}. ${err.cardName?.substring(0, 25) || 'Unknown'}: ${err.error}`);
      });
    } else if (errors.length >= 15) {
      console.log(`\n❌ Too many errors (${errors.length}) - showing first 10:`);
      errors.slice(0, 10).forEach((err, index) => {
        console.log(`   ${index + 1}. ${err.cardName?.substring(0, 25) || 'Unknown'}: ${err.error}`);
      });
    }
    
    if (totalTransactionsImported > 0) {
      console.log('\n🎉 SUCCESS! Super-optimized import completed successfully');
      console.log('📈 This import covers the full date range (2024-2025)');
      console.log('💡 For future updates, you can use daily incremental imports');
    }
    
    console.log('\n✅ Super-optimized import process finished!');
    
  } catch (error) {
    console.error('❌ Super-optimized import error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  importSuperOptimized();
}

module.exports = { importSuperOptimized };
