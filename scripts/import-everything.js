require('dotenv').config();
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const importEverything = async () => {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting COMPLETE import from Cryptomate...');
    console.log('📋 Step 1: Importing all cards and users');
    console.log('💳 Step 2: Importing all transactions');
    console.log('='.repeat(60));
    
    // Verificar que el servidor esté corriendo
    console.log('\n🔍 Checking server status...');
    try {
      const healthCommand = `curl -s http://localhost:3001/api/health`;
      const { stdout: healthResult } = await execAsync(healthCommand);
      const healthResponse = JSON.parse(healthResult);
      
      if (healthResponse.success) {
        console.log('✅ Server is running and ready');
      } else {
        throw new Error('Server health check failed');
      }
    } catch (error) {
      console.error('❌ Server is not running or not accessible');
      console.error('💡 Please start the server with: npm start');
      process.exit(1);
    }
    
    // Paso 1: Importar cards y usuarios
    console.log('\n📋 STEP 1: Importing cards and users from Cryptomate...');
    const cardsCommand = `curl -s -X POST http://localhost:3001/api/real-cryptomate/import-real-data`;
    
    const cardsStartTime = Date.now();
    const { stdout: cardsResult, stderr: cardsError } = await execAsync(cardsCommand);
    const cardsTime = ((Date.now() - cardsStartTime) / 1000).toFixed(1);
    
    if (cardsError) {
      console.error('❌ Cards import error:', cardsError);
      throw new Error(`Cards import failed: ${cardsError}`);
    }
    
    const cardsResponse = JSON.parse(cardsResult);
    
    if (cardsResponse.success) {
      console.log(`✅ Cards import completed in ${cardsTime}s`);
      console.log(`   📋 Cards imported: ${cardsResponse.summary?.cardsImported || 0}`);
      console.log(`   👥 Users created: ${cardsResponse.summary?.users || 0}`);
      console.log(`   🔄 Cards updated: ${cardsResponse.summary?.cardsUpdated || 0}`);
    } else {
      console.error('❌ Cards import failed:', cardsResponse.message || cardsResponse.error);
      throw new Error(`Cards import failed: ${cardsResponse.message || cardsResponse.error}`);
    }
    
    // Esperar un momento para que se procesen las cards
    console.log('\n⏳ Waiting 5 seconds for cards to be processed...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Paso 2: Importar transacciones
    console.log('\n💳 STEP 2: Importing transactions from Cryptomate...');
    console.log('⚡ This may take several minutes depending on the number of cards...');
    
    const transactionsCommand = `node scripts/import-optimized-transactions.js`;
    
    const transactionsStartTime = Date.now();
    const { stdout: transactionsResult, stderr: transactionsError } = await execAsync(transactionsCommand);
    const transactionsTime = ((Date.now() - transactionsStartTime) / 1000 / 60).toFixed(1);
    
    if (transactionsError) {
      console.error('❌ Transactions import error:', transactionsError);
      console.log('⚠️  Some transactions may have been imported successfully');
    } else {
      console.log(`✅ Transactions import completed in ${transactionsTime} minutes`);
    }
    
    // Mostrar resumen final
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 COMPLETE IMPORT FINISHED!');
    console.log('📊 Final Summary:');
    console.log(`   📋 Cards imported: ${cardsResponse.summary?.cardsImported || 0}`);
    console.log(`   👥 Users created: ${cardsResponse.summary?.users || 0}`);
    console.log(`   🔄 Cards updated: ${cardsResponse.summary?.cardsUpdated || 0}`);
    console.log(`   💳 Transactions: Check output above for details`);
    console.log(`   ⏱️  Total time: ${totalTime} minutes`);
    console.log(`   📈 Cards import: ${cardsTime}s`);
    console.log(`   📈 Transactions import: ${transactionsTime} minutes`);
    
    console.log('\n✅ Your dev database is now fully populated with Cryptomate data!');
    console.log('🔍 You can verify the import by checking:');
    console.log('   - GET /api/cards/admin/all (to see all cards)');
    console.log('   - GET /api/cards/admin/stats (to see statistics)');
    console.log('   - GET /api/cards/card/{cardId}/transactions (to see transactions)');
    
  } catch (error) {
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.error('\n❌ Complete import failed after', totalTime, 'minutes');
    console.error('❌ Error:', error.message);
    console.error('\n💡 Troubleshooting tips:');
    console.error('   1. Make sure the server is running: npm start');
    console.error('   2. Check your .env file has correct database credentials');
    console.error('   3. Verify Cryptomate API credentials are valid');
    console.error('   4. Check server logs for more details');
    process.exit(1);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  importEverything();
}

module.exports = { importEverything };
