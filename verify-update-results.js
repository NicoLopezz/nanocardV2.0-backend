require('dotenv').config();
const mongoose = require('mongoose');

async function verifyUpdateResults() {
  try {
    console.log('🔍 Verifying update results for user: CsDoSzkWqjQkLTuy1K1c1FFE0lM44gfJ');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const transactionsDb = mongoose.connection.useDb('dev_transactions');
    const cardsDb = mongoose.connection.useDb('dev_cards');
    const usersDb = mongoose.connection.useDb('dev_users');
    
    const transactions = transactionsDb.collection('transactions');
    const cards = cardsDb.collection('cards');
    const users = usersDb.collection('users');
    
    const userId = 'CsDoSzkWqjQkLTuy1K1c1FFE0lM44gfJ';
    
    // 1. Verificar transacciones importadas
    console.log('\\n📊 STEP 1: Checking imported transactions...');
    const allTransactions = await transactions.find({ userId }).toArray();
    console.log(`   - Total transactions: ${allTransactions.length}`);
    
    // 2. Verificar por operación
    console.log('\\n📋 STEP 2: Transactions by operation...');
    const operations = await transactions.aggregate([
      { $match: { userId } },
      { $group: { 
        _id: '$operation', 
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }},
      { $sort: { _id: 1 } }
    ]).toArray();
    
    operations.forEach(op => {
      console.log(`   ${op._id}: ${op.count} transactions, Total: $${op.totalAmount.toFixed(2)}`);
    });
    
    // 3. Verificar WALLET_DEPOSIT (si las hay)
    const walletDeposits = await transactions.find({ 
      userId, 
      operation: 'WALLET_DEPOSIT' 
    }).toArray();
    
    if (walletDeposits.length > 0) {
      console.log(`\\n💰 WALLET_DEPOSIT transactions (${walletDeposits.length}):`);
      walletDeposits.forEach((tx, index) => {
        console.log(`   ${index + 1}. Amount: $${tx.amount}`);
        console.log(`      Bill Amount: $${tx.bill_amount}`);
        console.log(`      Commission: $${tx.commission_amount} (${(tx.commission_rate * 100).toFixed(1)}%)`);
        console.log(`      Net Amount: $${tx.net_amount}`);
        
        // Verificar lógica del 0.3%
        const expectedCommission = tx.bill_amount * 0.003;
        const expectedNet = tx.bill_amount - expectedCommission;
        const commissionCorrect = Math.abs(tx.commission_amount - expectedCommission) < 0.01;
        const netCorrect = Math.abs(tx.net_amount - expectedNet) < 0.01;
        const amountCorrect = Math.abs(tx.amount - expectedNet) < 0.01;
        
        console.log(`      ✅ Commission correct: ${commissionCorrect}`);
        console.log(`      ✅ Net amount correct: ${netCorrect}`);
        console.log(`      ✅ Amount correct: ${amountCorrect}`);
        console.log('');
      });
    } else {
      console.log('\\n💰 WALLET_DEPOSIT transactions: None found');
    }
    
    // 4. Verificar OVERRIDE_VIRTUAL_BALANCE
    const overrides = await transactions.find({ 
      userId, 
      operation: 'OVERRIDE_VIRTUAL_BALANCE' 
    }).toArray();
    
    if (overrides.length > 0) {
      console.log(`\\n🔄 OVERRIDE_VIRTUAL_BALANCE transactions (${overrides.length}):`);
      overrides.forEach((tx, index) => {
        console.log(`   ${index + 1}. Amount: $${tx.amount}`);
        console.log(`      Original Balance: $${tx.original_balance}`);
        console.log(`      New Balance: $${tx.new_balance}`);
        console.log(`      Difference: $${tx.new_balance - tx.original_balance}`);
        
        // Verificar lógica de diferencia
        const expectedAmount = tx.new_balance - tx.original_balance;
        const amountCorrect = Math.abs(tx.amount - expectedAmount) < 0.01;
        console.log(`      ✅ Amount correct: ${amountCorrect}`);
        console.log('');
      });
    }
    
    // 5. Verificar stats de la card
    console.log('\\n📊 STEP 3: Checking card stats...');
    const card = await cards.findOne({ _id: userId });
    if (card && card.stats) {
      console.log('   Card stats:');
      console.log(`   - money_in: $${card.stats.money_in}`);
      console.log(`   - refund: $${card.stats.refund}`);
      console.log(`   - posted: $${card.stats.posted}`);
      console.log(`   - reversed: $${card.stats.reversed}`);
      console.log(`   - rejected: $${card.stats.rejected}`);
      console.log(`   - pending: $${card.stats.pending}`);
      console.log(`   - available: $${card.stats.available}`);
      console.log(`   - Last updated: ${card.updatedAt}`);
      
      // Verificar fórmula de available
      const expectedAvailable = card.stats.money_in + card.stats.refund + card.stats.reversed - card.stats.posted - card.stats.pending;
      const availableCorrect = Math.abs(card.stats.available - expectedAvailable) < 0.01;
      console.log(`   ✅ Available formula correct: ${availableCorrect}`);
    }
    
    // 6. Verificar stats del usuario
    console.log('\\n👤 STEP 4: Checking user stats...');
    const user = await users.findOne({ _id: userId });
    if (user && user.stats) {
      console.log('   User stats:');
      console.log(`   - totalTransactions: ${user.stats.totalTransactions}`);
      console.log(`   - totalDeposited: $${user.stats.totalDeposited}`);
      console.log(`   - totalRefunded: $${user.stats.totalRefunded}`);
      console.log(`   - totalPosted: $${user.stats.totalPosted}`);
      console.log(`   - totalReversed: $${user.stats.totalReversed}`);
      console.log(`   - totalPending: $${user.stats.totalPending}`);
      console.log(`   - totalAvailable: $${user.stats.totalAvailable}`);
      console.log(`   - lastSync: ${user.stats.lastSync}`);
      console.log(`   - lastSyncSource: ${user.stats.lastSyncSource}`);
    }
    
    // 7. Verificar transacciones con decline_reason complejo
    console.log('\\n❌ STEP 5: Checking transactions with complex decline_reason...');
    const complexDecline = await transactions.find({
      userId,
      decline_reason: { $type: 'object' }
    }).toArray();
    
    console.log(`   - Transactions with complex decline_reason: ${complexDecline.length}`);
    if (complexDecline.length > 0) {
      console.log('   ✅ Complex decline_reason objects imported successfully!');
    }
    
    console.log('\\n✅ Verification completed!');
    console.log('\\n📋 Summary:');
    console.log(`   - Total transactions: ${allTransactions.length}`);
    console.log(`   - Card stats updated: ${card?.stats ? 'Yes' : 'No'}`);
    console.log(`   - User stats updated: ${user?.stats ? 'Yes' : 'No'}`);
    console.log(`   - Last sync recorded: ${user?.stats?.lastSync ? 'Yes' : 'No'}`);
    console.log(`   - Complex decline_reason handled: ${complexDecline.length > 0 ? 'Yes' : 'N/A'}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyUpdateResults();

