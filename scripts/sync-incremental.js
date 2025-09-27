const { connectDatabases } = require('../config/database');
const SyncService = require('../services/syncService');

const main = async () => {
  try {
    console.log('🚀 Starting Nano Backend Incremental Sync');
    console.log('=' .repeat(50));
    
    await connectDatabases();
    console.log('✅ Databases connected successfully');
    
    // Initialize sync service after databases are connected
    SyncService.initialize();
    console.log('✅ Sync service initialized');
    
    const args = process.argv.slice(2);
    const options = {
      fullSync: args.includes('--full'),
      fromDate: args.find(arg => arg.startsWith('--from='))?.split('=')[1]
    };
    
    if (options.fullSync) {
      console.log('🔄 Full sync mode enabled');
    }
    
    if (options.fromDate) {
      console.log(`📅 Sync from date: ${options.fromDate}`);
    }
    
    console.log('=' .repeat(50));
    
    const result = await SyncService.performIncrementalSync(options);
    
    console.log('=' .repeat(50));
    console.log('✅ Sync completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Cards imported: ${result.executionStats.cardsImported}`);
    console.log(`   - Transactions imported: ${result.executionStats.transactionsImported}`);
    console.log(`   - Execution time: ${result.executionTime}`);
    console.log(`   - Status: ${result.status}`);
    
    if (result.errors.length > 0) {
      console.log(`⚠️  Errors encountered: ${result.errors.length}`);
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    console.log('=' .repeat(50));
    
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

module.exports = { main };
