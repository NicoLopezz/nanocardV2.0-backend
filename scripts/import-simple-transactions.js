require('dotenv').config();
const mongoose = require('mongoose');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const NEW_DB_URI = process.env.MONGODB_URI;

const importSimpleTransactions = async () => {
  try {
    console.log('🚀 Starting SIMPLE import for remaining cards...');
    console.log('⚡ Using optimized date range 2025-01-01 to 2025-09-30');
    
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
    
    // Obtener todas las cards sin transacciones
    const cardsWithoutTransactions = await cardsDb.collection('cards').find({
      _id: { $nin: cardsWithTransactionsIds }
    }).toArray();
    
    console.log(`📋 Processing ${cardsWithoutTransactions.length} cards`);
    console.log(`✅ Already processed: ${cardsWithTransactions.length} cards`);
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
        console.log(`\n🔄 [${totalProcessed + 1}/${cardsWithoutTransactions.length}] ${card.name.substring(0, 30)}...`);
        
        // SIN TIMEOUT - comando curl simple
        const curlCommand = `curl -s -X POST http://localhost:3001/api/real-cryptomate/import-transactions/${card._id} -H "Content-Type: application/json" -d '{"fromDate": "2025-01-01", "toDate": "2025-09-30", "maxPages": 3, "operations": "TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE"}'`;
        
        const { stdout, stderr } = await execAsync(curlCommand);
        
        if (stderr) {
          throw new Error(`Curl error: ${stderr}`);
        }
        
        const result = JSON.parse(stdout);
        
        const cardTime = ((Date.now() - cardStartTime) / 1000).toFixed(1);
        
        if (result.success) {
          totalTransactionsImported += result.summary.totalTransactions;
          console.log(`   ✅ ${result.summary.totalTransactions} tx (${result.summary.imported} new, ${result.summary.updated} updated) - ${cardTime}s`);
        } else {
          console.log(`   ❌ Failed: ${result.message || result.error || 'Unknown error'} - ${cardTime}s`);
          errors.push({
            cardId: card._id,
            cardName: card.name,
            error: result.message || result.error || 'Unknown error'
          });
        }
        
        totalProcessed++;
        
        // Pausa pequeña
        await new Promise(resolve => setTimeout(resolve, 100));
        
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
    }
    
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 IMPORT COMPLETED!');
    console.log('📊 Summary:');
    console.log(`   - Cards processed: ${totalProcessed}/${cardsWithoutTransactions.length}`);
    console.log(`   - Total transactions imported: ${totalTransactionsImported}`);
    console.log(`   - Total time: ${totalTime} minutes`);
    console.log(`   - Average per card: ${(parseFloat(totalTime) * 60 / totalProcessed).toFixed(1)} seconds`);
    console.log(`   - Success rate: ${Math.round(((totalProcessed - errors.length) / totalProcessed) * 100)}%`);
    console.log(`   - Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach((err, index) => {
        console.log(`   ${index + 1}. ${err.cardName.substring(0, 25)}: ${err.error}`);
      });
    }
    
    if (totalTransactionsImported > 0) {
      console.log('\n🎉 SUCCESS! All transactions imported successfully');
    }
    
    console.log('\n✅ Import process finished!');
    
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
  importSimpleTransactions();
}

module.exports = { importSimpleTransactions };
