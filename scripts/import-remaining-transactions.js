require('dotenv').config();
const mongoose = require('mongoose');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const NEW_DB_URI = process.env.MONGODB_URI;

const importRemainingTransactions = async () => {
  try {
    console.log('🚀 Starting import for remaining cards...');
    
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
    console.log('='.repeat(60));
    
    if (cardsWithoutTransactions.length === 0) {
      console.log('🎉 All cards already have transactions imported!');
      return;
    }
    
    let totalProcessed = 0;
    let totalTransactionsImported = 0;
    let errors = [];
    
    for (const card of cardsWithoutTransactions) {
      try {
        console.log(`\n🔄 Processing card ${totalProcessed + 1}/${cardsWithoutTransactions.length}: ${card.name} (${card._id})`);
        
        // Hacer la llamada al endpoint usando curl con timeout
        const curlCommand = `timeout 60 curl -s -X POST http://localhost:3001/api/real-cryptomate/import-transactions/${card._id} -H "Content-Type: application/json" -d '{"fromDate": "2024-01-01", "toDate": "2025-09-25", "maxPages": 10, "operations": "TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE"}'`;
        
        const { stdout, stderr } = await execAsync(curlCommand);
        
        if (stderr && stderr.includes('timeout')) {
          throw new Error('Request timeout after 60 seconds');
        }
        
        if (stderr && !stderr.includes('timeout')) {
          throw new Error(`Curl error: ${stderr}`);
        }
        
        const result = JSON.parse(stdout);
        
        if (result.success) {
          totalTransactionsImported += result.summary.totalTransactions;
          console.log(`   ✅ Imported ${result.summary.totalTransactions} transactions (${result.summary.imported} new, ${result.summary.updated} updated)`);
        } else {
          console.log(`   ❌ Failed: ${result.message || 'Unknown error'}`);
          errors.push({
            cardId: card._id,
            cardName: card.name,
            error: result.message || 'Unknown error'
          });
        }
        
        totalProcessed++;
        
        // Pausa entre requests (reducida para ir más rápido)
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.log(`   ❌ Error processing ${card.name}: ${error.message}`);
        errors.push({
          cardId: card._id,
          cardName: card.name,
          error: error.message
        });
        totalProcessed++;
        
        // Pausa más larga en caso de error
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Mostrar progreso cada 10 cards
      if (totalProcessed % 10 === 0) {
        const progressPercent = Math.round((totalProcessed / cardsWithoutTransactions.length) * 100);
        console.log(`\n📊 Progress: ${totalProcessed}/${cardsWithoutTransactions.length} (${progressPercent}%)`);
        console.log(`💰 Total transactions imported: ${totalTransactionsImported}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 REMAINING IMPORT COMPLETED!');
    console.log('📊 Summary:');
    console.log(`   - Cards processed: ${totalProcessed}/${cardsWithoutTransactions.length}`);
    console.log(`   - Total transactions imported: ${totalTransactionsImported}`);
    console.log(`   - Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach((err, index) => {
        console.log(`   ${index + 1}. ${err.cardName} (${err.cardId}): ${err.error}`);
      });
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
  importRemainingTransactions();
}

module.exports = { importRemainingTransactions };
