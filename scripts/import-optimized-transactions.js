require('dotenv').config();
const mongoose = require('mongoose');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const NEW_DB_URI = process.env.MONGODB_URI;

const importOptimizedTransactions = async () => {
  try {
    console.log('🚀 Starting OPTIMIZED import for remaining cards...');
    console.log('⚡ Using reduced date range and faster processing');
    
    // Conectar a la DB
    const connection = await mongoose.connect(NEW_DB_URI);
    console.log('✅ Connected to database');
    
    // Obtener todas las cards
    const cardsDb = connection.connection.useDb('dev_cards');
    const transactionsDb = connection.connection.useDb('dev_transactions');
    
    // Obtener cards que ya tienen transacciones
    const cardsWithTransactions = await transactionsDb.collection('transactions').aggregate([
      { $group: { _id: '$cardId' } }
    ]).toArray();
    
    const cardsWithTransactionsIds = cardsWithTransactions.map(c => c._id);
    
    // Obtener cards sin transacciones
    const cardsWithoutTransactions = await cardsDb.collection('cards').find({
      _id: { $nin: cardsWithTransactionsIds }
    }).toArray();
    
    console.log(`📋 Found ${cardsWithoutTransactions.length} cards remaining to process`);
    console.log(`✅ Already processed: ${cardsWithTransactions.length} cards`);
    console.log('🎯 Using optimized date range: 2025-01-01 to 2025-09-30');
    console.log('⚡ Reduced timeout and faster processing');
    console.log('='.repeat(60));
    
    if (cardsWithoutTransactions.length === 0) {
      console.log('🎉 All cards already have transactions imported!');
      return;
    }
    
    let totalProcessed = 0;
    let totalTransactionsImported = 0;
    let errors = [];
    const startTime = Date.now();
    
    for (const card of cardsWithoutTransactions) {
      const cardStartTime = Date.now();
      
      try {
        console.log(`\n🔄 Processing card ${totalProcessed + 1}/${cardsWithoutTransactions.length}: ${card.name.substring(0, 25)}...`);
        
        // OPTIMIZED: Rango de fechas más pequeño y timeout más corto
        const curlCommand = `timeout 30 curl -s -X POST http://localhost:3001/api/real-cryptomate/import-transactions/${card._id} -H "Content-Type: application/json" -d '{"fromDate": "2025-01-01", "toDate": "2025-09-30", "maxPages": 5, "operations": "TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE"}'`;
        
        const { stdout, stderr } = await execAsync(curlCommand);
        
        if (stderr && stderr.includes('timeout')) {
          throw new Error('Request timeout after 30 seconds');
        }
        
        if (stderr && !stderr.includes('timeout')) {
          throw new Error(`Curl error: ${stderr}`);
        }
        
        const result = JSON.parse(stdout);
        
        const cardTime = ((Date.now() - cardStartTime) / 1000).toFixed(1);
        
        if (result.success) {
          totalTransactionsImported += result.summary.totalTransactions;
          console.log(`   ✅ ${result.summary.totalTransactions} tx (${result.summary.imported} new) - ${cardTime}s`);
        } else {
          console.log(`   ❌ Failed: ${result.message || 'Unknown error'} - ${cardTime}s`);
          errors.push({
            cardId: card._id,
            cardName: card.name,
            error: result.message || 'Unknown error'
          });
        }
        
        totalProcessed++;
        
        // Sin pausa - ir lo más rápido posible
        
      } catch (error) {
        const cardTime = ((Date.now() - cardStartTime) / 1000).toFixed(1);
        console.log(`   ❌ Error: ${error.message} - ${cardTime}s`);
        errors.push({
          cardId: card._id,
          cardName: card.name,
          error: error.message
        });
        totalProcessed++;
      }
      
      // Mostrar progreso cada 10 cards con tiempo estimado
      if (totalProcessed % 10 === 0 || totalProcessed === cardsWithoutTransactions.length) {
        const progressPercent = Math.round((totalProcessed / cardsWithoutTransactions.length) * 100);
        const elapsedTime = (Date.now() - startTime) / 1000;
        const avgTimePerCard = elapsedTime / totalProcessed;
        const remainingCards = cardsWithoutTransactions.length - totalProcessed;
        const estimatedTimeLeft = (remainingCards * avgTimePerCard) / 60;
        
        console.log(`\n📊 Progress: ${totalProcessed}/${cardsWithoutTransactions.length} (${progressPercent}%)`);
        console.log(`💰 Transactions imported: ${totalTransactionsImported}`);
        console.log(`⏱️  Average: ${avgTimePerCard.toFixed(1)}s per card`);
        console.log(`🕐 Estimated time left: ${estimatedTimeLeft.toFixed(1)} minutes`);
        console.log(`❌ Errors: ${errors.length}`);
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 OPTIMIZED IMPORT COMPLETED!');
    console.log('📊 Summary:');
    console.log(`   - Cards processed: ${totalProcessed}/${cardsWithoutTransactions.length}`);
    console.log(`   - Total transactions imported: ${totalTransactionsImported}`);
    console.log(`   - Total time: ${totalTime} minutes`);
    console.log(`   - Average per card: ${(parseFloat(totalTime) * 60 / totalProcessed).toFixed(1)} seconds`);
    console.log(`   - Errors: ${errors.length}`);
    
    if (errors.length > 0 && errors.length < 20) {
      console.log('\n❌ Errors encountered:');
      errors.forEach((err, index) => {
        console.log(`   ${index + 1}. ${err.cardName}: ${err.error}`);
      });
    } else if (errors.length >= 20) {
      console.log(`\n❌ Too many errors (${errors.length}) - showing first 10:`);
      errors.slice(0, 10).forEach((err, index) => {
        console.log(`   ${index + 1}. ${err.cardName}: ${err.error}`);
      });
    }
    
    console.log('\n✅ Optimized import process finished!');
    
  } catch (error) {
    console.error('❌ Import error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  importOptimizedTransactions();
}

module.exports = { importOptimizedTransactions };
