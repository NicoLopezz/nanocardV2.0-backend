require('dotenv').config();
const mongoose = require('mongoose');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const NEW_DB_URI = process.env.MONGODB_URI;

const importUltraFast = async () => {
  try {
    console.log('🚀 Starting ULTRA-FAST import with maximum optimizations...');
    console.log('⚡ 10 parallel + minimal date range + minimal pages');
    
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
    
    console.log(`📋 Processing ${cardsWithoutTransactions.length} cards with ULTRA-FAST method`);
    console.log(`✅ Already processed: ${cardsWithTransactions.length} cards`);
    console.log('🎯 Using MINIMAL date range: 2025-02-01 to 2025-02-28 (1 month only)');
    console.log('⚡ Parallel processing: 10 cards simultaneously');
    console.log('🔥 Max pages: 2 (only recent transactions)');
    console.log('='.repeat(60));
    
    if (cardsWithoutTransactions.length === 0) {
      console.log('🎉 All cards already have transactions imported!');
      return;
    }
    
    let totalProcessed = 0;
    let totalTransactionsImported = 0;
    let errors = [];
    const startTime = Date.now();
    
    // Procesar en lotes de 10 cards en paralelo
    const batchSize = 10;
    for (let i = 0; i < cardsWithoutTransactions.length; i += batchSize) {
      const batch = cardsWithoutTransactions.slice(i, i + batchSize);
      
      console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(cardsWithoutTransactions.length/batchSize)} (${batch.length} cards)`);
      
      // Procesar el lote en paralelo
      const batchPromises = batch.map(async (card, index) => {
        const cardStartTime = Date.now();
        
        try {
          console.log(`🔄 [${i + index + 1}] ${card.name.substring(0, 20)}...`);
          
          // ULTRA-OPTIMIZADO: Solo 1 mes + 2 páginas máximo
          const curlCommand = `curl -s -X POST http://localhost:3001/api/real-cryptomate/import-transactions/${card._id} -H "Content-Type: application/json" -d '{"fromDate": "2025-02-01", "toDate": "2025-02-28", "maxPages": 2, "operations": "TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE"}'`;
          
          const { stdout, stderr } = await execAsync(curlCommand);
          
          if (stderr) {
            throw new Error(`Curl error: ${stderr}`);
          }
          
          const result = JSON.parse(stdout);
          const cardTime = ((Date.now() - cardStartTime) / 1000).toFixed(1);
          
          if (result.success) {
            totalTransactionsImported += result.summary.totalTransactions;
            console.log(`   ✅ ${result.summary.totalTransactions} tx - ${cardTime}s`);
            return { success: true, transactions: result.summary.totalTransactions };
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
      
      // Contar resultados del lote
      const batchSuccesses = batchResults.filter(r => r.success).length;
      const batchErrors = batchResults.filter(r => !r.success).length;
      const batchTransactions = batchResults.reduce((sum, r) => sum + (r.transactions || 0), 0);
      
      totalProcessed += batch.length;
      
      console.log(`📊 Batch: ${batchSuccesses}✅ ${batchErrors}❌ ${batchTransactions}💰`);
      
      // Pausa mínima entre lotes
      if (i + batchSize < cardsWithoutTransactions.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Mostrar progreso cada 3 lotes
      if ((i + batchSize) % (batchSize * 3) === 0 || i + batchSize >= cardsWithoutTransactions.length) {
        const progressPercent = Math.round((totalProcessed / cardsWithoutTransactions.length) * 100);
        const elapsedTime = (Date.now() - startTime) / 1000;
        const avgTimePerCard = elapsedTime / totalProcessed;
        const remainingCards = cardsWithoutTransactions.length - totalProcessed;
        const estimatedTimeLeft = (remainingCards * avgTimePerCard) / 60;
        
        console.log(`\n📊 ${totalProcessed}/${cardsWithoutTransactions.length} (${progressPercent}%) | ${totalTransactionsImported} tx | ${estimatedTimeLeft.toFixed(1)}min left`);
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ULTRA-FAST IMPORT COMPLETED!');
    console.log('📊 Summary:');
    console.log(`   - Cards processed: ${totalProcessed}/${cardsWithoutTransactions.length}`);
    console.log(`   - Total transactions imported: ${totalTransactionsImported}`);
    console.log(`   - Total time: ${totalTime} minutes`);
    console.log(`   - Average per card: ${(parseFloat(totalTime) * 60 / totalProcessed).toFixed(1)} seconds`);
    console.log(`   - Success rate: ${Math.round(((totalProcessed - errors.length) / totalProcessed) * 100)}%`);
    console.log(`   - Errors: ${errors.length}`);
    
    if (totalTransactionsImported > 0) {
      console.log('\n🎉 SUCCESS! Ultra-fast import completed successfully');
      console.log('💡 Note: This import only covers February 2025 (1 month)');
      console.log('💡 For complete data, run with a wider date range later');
    }
    
    console.log('\n✅ Ultra-fast import process finished!');
    
  } catch (error) {
    console.error('❌ Ultra-fast import error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  importUltraFast();
}

module.exports = { importUltraFast };
