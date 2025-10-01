require('dotenv').config();
const mongoose = require('mongoose');

async function updateUserTransactions() {
  try {
    console.log('🚀 Starting complete transaction update process...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const transactionsDb = mongoose.connection.useDb('dev_transactions');
    const cardsDb = mongoose.connection.useDb('dev_cards');
    const usersDb = mongoose.connection.useDb('dev_users');
    
    const transactions = transactionsDb.collection('transactions');
    const cards = cardsDb.collection('cards');
    const users = usersDb.collection('users');
    
    const userId = 'CsDoSzkWqjQkLTuy1K1c1FFE0lM44gfJ';
    
    // 1. Verificar estado inicial
    console.log('\\n📊 STEP 1: Checking initial state...');
    const initialTransactions = await transactions.find({ userId }).toArray();
    const initialCard = await cards.findOne({ _id: userId });
    const initialUser = await users.findOne({ _id: userId });
    
    console.log(`   - Initial transactions: ${initialTransactions.length}`);
    console.log(`   - Card stats:`, initialCard?.stats);
    console.log(`   - User lastSync: ${initialUser?.stats?.lastSync}`);
    
    // 2. Borrar todas las transacciones
    console.log('\\n🗑️ STEP 2: Deleting all transactions...');
    const deleteResult = await transactions.deleteMany({ userId });
    console.log(`   - Deleted ${deleteResult.deletedCount} transactions`);
    
    // 3. Verificar que se borraron
    const afterDelete = await transactions.find({ userId }).toArray();
    console.log(`   - Remaining transactions: ${afterDelete.length}`);
    
    // 4. Mostrar comando de importación
    console.log('\\n📥 STEP 3: Import command ready...');
    console.log('   - Period: 2024-01-01 to 2025-12-31 (ALL YEARS 2024 AND 2025)');
    console.log('   - Operations: All types including WALLET_DEPOSIT and OVERRIDE_VIRTUAL_BALANCE');
    
    console.log('\\n⚠️  IMPORTANT: Run this curl command to import all transactions:');
    console.log(`curl -X POST http://localhost:3001/api/real-cryptomate/import-transactions/${userId} \\\\`);
    console.log(`  -H "Content-Type: application/json" \\\\`);
    console.log(`  -d '{`);
    console.log(`    "fromDate": "2024-01-01",`);
    console.log(`    "toDate": "2025-12-31",`);
    console.log(`    "maxPages": 10,`);
    console.log(`    "operations": "TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE"`);
    console.log(`  }'`);
    
    console.log('\\n📝 After running the import, run this script again to verify results');
    console.log('\\n✅ What the import will do:');
    console.log('   - Import ALL transactions from 2024-01-01 to 2025-12-31');
    console.log('   - Apply correct WALLET_DEPOSIT logic (0.3% commission)');
    console.log('   - Apply correct OVERRIDE_VIRTUAL_BALANCE logic (balance difference)');
    console.log('   - Update card.stats with new structure');
    console.log('   - Update user.stats and register lastSync');
    console.log('   - Handle decline_reason objects correctly');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateUserTransactions();

