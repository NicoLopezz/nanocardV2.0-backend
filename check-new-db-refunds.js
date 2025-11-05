require('dotenv').config();
process.env.NODE_ENV = 'development';

const { databases, connectDatabases } = require('./config/database');

async function checkNewDBRefunds() {
  try {
    await connectDatabases();
    console.log('✅ Connected to databases\n');
    
    const CARD_ID = '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2';
    
    const Transaction = require('./models/Transaction').getTransactionModel();
    
    const transactions = await Transaction.find({
      cardId: CARD_ID,
      isDeleted: { $ne: true },
      status: { $ne: 'DELETED' }
    });
    
    console.log('📊 Analyzing Santiago Romano transactions in NEW DB:\n');
    
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let totalApproved = 0;
    let totalPending = 0;
    let totalRefunds = 0;
    let totalReversed = 0;
    
    const refunds = [];
    const reversed = [];
    
    transactions.forEach(tx => {
      const amount = tx.amount || 0;
      
      switch(tx.operation) {
        case 'WALLET_DEPOSIT':
        case 'OVERRIDE_VIRTUAL_BALANCE':
          totalDeposits += amount;
          break;
        case 'WITHDRAWAL':
          totalWithdrawals += amount;
          break;
        case 'TRANSACTION_APPROVED':
          totalApproved += amount;
          break;
        case 'TRANSACTION_PENDING':
          totalPending += amount;
          break;
        case 'TRANSACTION_REFUND':
          totalRefunds += amount;
          refunds.push(tx);
          break;
        case 'TRANSACTION_REVERSED':
          totalReversed += amount;
          reversed.push(tx);
          break;
      }
    });
    
    console.log(`Total transactions: ${transactions.length}\n`);
    
    console.log('💰 DEPOSITS:');
    console.log(`   Total: $${totalDeposits.toFixed(2)}`);
    
    console.log('\n💸 WITHDRAWALS:');
    console.log(`   Total: $${totalWithdrawals.toFixed(2)}`);
    
    console.log('\n💳 APPROVED:');
    console.log(`   Total: $${totalApproved.toFixed(2)}`);
    
    console.log('\n⏳ PENDING:');
    console.log(`   Total: $${totalPending.toFixed(2)}`);
    
    console.log('\n🔄 REFUNDS:');
    console.log(`   Total: $${totalRefunds.toFixed(2)}`);
    console.log(`   Count: ${refunds.length}`);
    if (refunds.length > 0) {
      refunds.forEach((ref, i) => {
        console.log(`   ${i + 1}. $${ref.amount} - ${ref.date} - "${ref.comentario || 'No comment'}"`);
      });
    }
    
    console.log('\n↩️ REVERSED:');
    console.log(`   Total: $${totalReversed.toFixed(2)}`);
    console.log(`   Count: ${reversed.length}`);
    if (reversed.length > 0) {
      reversed.forEach((rev, i) => {
        console.log(`   ${i + 1}. $${rev.amount} - ${rev.date} - "${rev.comentario || 'No comment'}"`);
      });
    }
    
    const money_in = totalDeposits - totalWithdrawals;
    const available = money_in + totalRefunds - totalApproved - totalPending;
    
    console.log('\n📊 CALCULATED VALUES:');
    console.log('='.repeat(60));
    console.log(`money_in:  $${money_in.toFixed(2)}`);
    console.log(`refund:    $${totalRefunds.toFixed(2)}`);
    console.log(`posted:    $${totalApproved.toFixed(2)}`);
    console.log(`pending:   $${totalPending.toFixed(2)}`);
    console.log('-'.repeat(60));
    console.log(`available: $${available.toFixed(2)}`);
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkNewDBRefunds();
