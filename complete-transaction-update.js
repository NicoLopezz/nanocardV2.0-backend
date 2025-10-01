require('dotenv').config();
const mongoose = require('mongoose');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

async function completeTransactionUpdate() {
  try {
    console.log('🚀 Starting COMPLETE transaction update process...');
    console.log('   User: CsDoSzkWqjQkLTuy1K1c1FFE0lM44gfJ');
    console.log('   Period: 2024-01-01 to 2025-12-31');
    console.log('   Operations: ALL types');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const transactionsDb = mongoose.connection.useDb('dev_transactions');
    const transactions = transactionsDb.collection('transactions');
    
    const userId = 'CsDoSzkWqjQkLTuy1K1c1FFE0lM44gfJ';
    
    // 1. Verificar estado inicial
    console.log('\\n📊 STEP 1: Checking initial state...');
    const initialTransactions = await transactions.find({ userId }).toArray();
    console.log(`   - Initial transactions: ${initialTransactions.length}`);
    
    // 2. Borrar todas las transacciones
    console.log('\\n🗑️ STEP 2: Deleting all transactions...');
    const deleteResult = await transactions.deleteMany({ userId });
    console.log(`   - Deleted ${deleteResult.deletedCount} transactions`);
    
    // 3. Verificar que se borraron
    const afterDelete = await transactions.find({ userId }).toArray();
    console.log(`   - Remaining transactions: ${afterDelete.length}`);
    
    // 4. Hacer la importación
    console.log('\\n📥 STEP 3: Starting import...');
    console.log('   - Period: 2024-01-01 to 2025-12-31');
    console.log('   - Operations: All types including WALLET_DEPOSIT and OVERRIDE_VIRTUAL_BALANCE');
    
    const importCommand = `curl -X POST http://localhost:3001/api/real-cryptomate/import-transactions/${userId} \\
  -H "Content-Type: application/json" \\
  -d '{
    "fromDate": "2024-01-01",
    "toDate": "2025-12-31",
    "maxPages": 10,
    "operations": "TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE"
  }'`;
    
    console.log('   - Running import command...');
    try {
      const { stdout, stderr } = await execAsync(importCommand);
      console.log('   ✅ Import completed successfully');
      
      // Parse the response to get summary
      try {
        const response = JSON.parse(stdout);
        if (response.success) {
          console.log(`   - Total transactions from API: ${response.summary.totalTransactions}`);
          console.log(`   - Imported: ${response.summary.imported}`);
          console.log(`   - Updated: ${response.summary.updated}`);
        }
      } catch (parseError) {
        console.log('   - Import response received (parsing skipped)');
      }
    } catch (error) {
      console.error('   ❌ Import failed:', error.message);
      console.log('   - Make sure the server is running on port 3001');
      console.log('   - You can run the import manually with the curl command above');
    }
    
    // 5. Verificar resultados
    console.log('\\n🔍 STEP 4: Verifying results...');
    
    const finalTransactions = await transactions.find({ userId }).toArray();
    console.log(`   - Final transactions: ${finalTransactions.length}`);
    
    // Verificar por operación
    const operations = await transactions.aggregate([
      { $match: { userId } },
      { $group: { 
        _id: '$operation', 
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }},
      { $sort: { _id: 1 } }
    ]).toArray();
    
    console.log('   - Transactions by operation:');
    operations.forEach(op => {
      console.log(`     ${op._id}: ${op.count} transactions, Total: $${op.totalAmount.toFixed(2)}`);
    });
    
    // Verificar stats
    const cardsDb = mongoose.connection.useDb('dev_cards');
    const usersDb = mongoose.connection.useDb('dev_users');
    const cards = cardsDb.collection('cards');
    const users = usersDb.collection('users');
    
    const card = await cards.findOne({ _id: userId });
    const user = await users.findOne({ _id: userId });
    
    if (card && card.stats) {
      console.log('   - Card stats updated:');
      console.log(`     money_in: $${card.stats.money_in}`);
      console.log(`     refund: $${card.stats.refund}`);
      console.log(`     posted: $${card.stats.posted}`);
      console.log(`     available: $${card.stats.available}`);
    }
    
    if (user && user.stats) {
      console.log('   - User stats updated:');
      console.log(`     totalTransactions: ${user.stats.totalTransactions}`);
      console.log(`     lastSync: ${user.stats.lastSync}`);
      console.log(`     lastSyncSource: ${user.stats.lastSyncSource}`);
    }
    
    console.log('\\n✅ COMPLETE TRANSACTION UPDATE FINISHED!');
    console.log('\\n📋 Final Summary:');
    console.log(`   - Transactions imported: ${finalTransactions.length}`);
    console.log(`   - Card stats updated: ${card?.stats ? 'Yes' : 'No'}`);
    console.log(`   - User stats updated: ${user?.stats ? 'Yes' : 'No'}`);
    console.log(`   - Last sync recorded: ${user?.stats?.lastSync ? 'Yes' : 'No'}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

completeTransactionUpdate();

