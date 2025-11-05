require('dotenv').config();
process.env.NODE_ENV = 'development';

const { databases, connectDatabases } = require('./config/database');

async function analyzeTransactions() {
  try {
    await connectDatabases();
    console.log('✅ Connected to databases\n');
    
    const CARD_ID = '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2';
    
    const Transaction = require('./models/Transaction').getTransactionModel();
    
    const allTransactions = await Transaction.find({
      cardId: CARD_ID,
      isDeleted: { $ne: true }
    }).sort({ createdAt: 1 });
    
    console.log(`Total transactions: ${allTransactions.length}\n`);
    
    let totalPosted = 0;
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    
    const postedTransactions = [];
    const depositTransactions = [];
    const withdrawalTransactions = [];
    
    allTransactions.forEach(tx => {
      const amount = tx.amount || 0;
      
      if (tx.operation === 'TRANSACTION_APPROVED') {
        totalPosted += amount;
        postedTransactions.push(tx);
      } else if (tx.operation === 'WALLET_DEPOSIT') {
        totalDeposits += amount;
        depositTransactions.push(tx);
      } else if (tx.operation === 'WITHDRAWAL') {
        totalWithdrawals += amount;
        withdrawalTransactions.push(tx);
      }
    });
    
    console.log('📊 TRANSACTION BREAKDOWN:');
    console.log('='.repeat(60));
    console.log(`TOTAL APPROVED: $${totalPosted.toFixed(2)} (${postedTransactions.length} transactions)`);
    console.log(`TOTAL DEPOSITS: $${totalDeposits.toFixed(2)} (${depositTransactions.length} transactions)`);
    console.log(`TOTAL WITHDRAWALS: $${totalWithdrawals.toFixed(2)} (${withdrawalTransactions.length} transactions)`);
    console.log('='.repeat(60));
    
    if (postedTransactions.length > 0) {
      console.log('\n📋 First 10 TRANSACTION_APPROVED:');
      postedTransactions.slice(0, 10).forEach((tx, i) => {
        console.log(`   ${i + 1}. $${tx.amount.toFixed(2)} - ${tx.date} - "${tx.name}"`);
        console.log(`      status: ${tx.status}, credit: ${tx.credit}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

analyzeTransactions();
