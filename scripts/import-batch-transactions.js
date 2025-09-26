require('dotenv').config();
const mongoose = require('mongoose');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const NEW_DB_URI = process.env.MONGODB_URI;

const importBatchTransactions = async () => {
  try {
    console.log('🚀 Starting BATCH import (10 cards at a time)...');
    console.log('⚡ Using optimized date range 2025-01-01 to 2025-09-30');
    
    const connection = await mongoose.connect(NEW_DB_URI);
    console.log('✅ Connected to database');
    
    const cardsDb = connection.connection.useDb('dev_cards');
    const transactionsDb = connection.connection.useDb('dev_transactions');
    
    let batchNumber = 1;
    let totalCardsProcessed = 0;
    let totalTransactionsImported = 0;
    let totalErrors = 0;
    const globalStartTime = Date.now();
    
    while (true) {
      // Obtener cards que ya tienen transacciones
      const cardsWithTransactions = await transactionsDb.collection('transactions').aggregate([
        { $group: { _id: '$cardId' } }
      ]).toArray();
      
      const cardsWithTransactionsIds = cardsWithTransactions.map(c => c._id);
      
      // Obtener siguiente lote de 10 cards sin transacciones
      const cardsWithoutTransactions = await cardsDb.collection('cards').find({
        _id: { $nin: cardsWithTransactionsIds }
      }).limit(10).toArray();
      
      if (cardsWithoutTransactions.length === 0) {
        console.log('\n🎉 ALL CARDS COMPLETED! No more cards to process');
        break;
      }
      
      console.log(`\n📦 BATCH ${batchNumber} - Processing ${cardsWithoutTransactions.length} cards`);
      console.log(`📊 Progress: ${cardsWithTransactions.length} cards done, ${cardsWithoutTransactions.length} in this batch`);
      console.log('='.repeat(60));
      
      let batchProcessed = 0;
      let batchTransactions = 0;
      let batchErrors = 0;
      const batchStartTime = Date.now();
      
      for (const card of cardsWithoutTransactions) {
        const cardStartTime = Date.now();
        
        try {
          console.log(`🔄 [${batchProcessed + 1}/10] ${card.name.substring(0, 35)}...`);
          
          const curlCommand = `curl -s -X POST http://localhost:3001/api/real-cryptomate/import-transactions/${card._id} -H "Content-Type: application/json" -d '{"fromDate": "2025-01-01", "toDate": "2025-09-30", "maxPages": 3, "operations": "TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE"}'`;
          
          const { stdout, stderr } = await execAsync(curlCommand);
          
          if (stderr) {
            throw new Error(`Curl error: ${stderr}`);
          }
          
          const result = JSON.parse(stdout);
          const cardTime = ((Date.now() - cardStartTime) / 1000).toFixed(1);
          
          if (result.success) {
            batchTransactions += result.summary.totalTransactions;
            console.log(`   ✅ ${result.summary.totalTransactions} tx (${result.summary.imported} new) - ${cardTime}s`);
          } else {
            console.log(`   ❌ Failed: ${result.message || result.error || 'Unknown error'} - ${cardTime}s`);
            batchErrors++;
          }
          
          batchProcessed++;
          
          // Pausa pequeña entre cards
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          const cardTime = ((Date.now() - cardStartTime) / 1000).toFixed(1);
          console.log(`   ❌ Error: ${error.message.substring(0, 50)}... - ${cardTime}s`);
          batchErrors++;
          batchProcessed++;
        }
      }
      
      const batchTime = ((Date.now() - batchStartTime) / 1000 / 60).toFixed(1);
      const successRate = Math.round(((batchProcessed - batchErrors) / batchProcessed) * 100);
      
      console.log(`\n📊 BATCH ${batchNumber} COMPLETED:`);
      console.log(`   ✅ Cards: ${batchProcessed} processed`);
      console.log(`   💰 Transactions: ${batchTransactions} imported`);
      console.log(`   ⏱️  Time: ${batchTime} minutes`);
      console.log(`   📈 Success: ${successRate}%`);
      console.log(`   ❌ Errors: ${batchErrors}`);
      
      // Actualizar totales
      totalCardsProcessed += batchProcessed;
      totalTransactionsImported += batchTransactions;
      totalErrors += batchErrors;
      batchNumber++;
      
      // Mostrar progreso global
      const totalCards = await cardsDb.collection('cards').countDocuments();
      const cardsWithTransactionsNow = await transactionsDb.collection('transactions').aggregate([
        { $group: { _id: '$cardId' } }
      ]).toArray();
      const globalProgress = Math.round((cardsWithTransactionsNow.length / totalCards) * 100);
      
      console.log(`\n🌍 GLOBAL PROGRESS: ${cardsWithTransactionsNow.length}/${totalCards} cards (${globalProgress}%)`);
      console.log(`💎 Total transactions imported: ${totalTransactionsImported}`);
      
      // Pausa entre lotes (30 segundos)
      console.log(`\n⏳ Waiting 30 seconds before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
    
    const totalTime = ((Date.now() - globalStartTime) / 1000 / 60).toFixed(1);
    const overallSuccessRate = Math.round(((totalCardsProcessed - totalErrors) / totalCardsProcessed) * 100);
    
    console.log('\n' + '='.repeat(70));
    console.log('🎉 ALL BATCHES COMPLETED SUCCESSFULLY!');
    console.log('📊 FINAL SUMMARY:');
    console.log(`   📦 Batches processed: ${batchNumber - 1}`);
    console.log(`   💳 Total cards processed: ${totalCardsProcessed}`);
    console.log(`   💰 Total transactions imported: ${totalTransactionsImported}`);
    console.log(`   ⏱️  Total time: ${totalTime} minutes`);
    console.log(`   📈 Overall success rate: ${overallSuccessRate}%`);
    console.log(`   ❌ Total errors: ${totalErrors}`);
    console.log(`   ⚡ Average per card: ${(parseFloat(totalTime) * 60 / totalCardsProcessed).toFixed(1)} seconds`);
    
    if (totalTransactionsImported > 0) {
      console.log('\n🏆 IMPORT COMPLETED SUCCESSFULLY!');
      console.log('✅ All cards now have their transactions imported');
    }
    
  } catch (error) {
    console.error('❌ Global import error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  importBatchTransactions();
}

module.exports = { importBatchTransactions };
