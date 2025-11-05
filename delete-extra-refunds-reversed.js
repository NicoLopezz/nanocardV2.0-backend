require('dotenv').config();
process.env.NODE_ENV = 'development';

const { databases, connectDatabases } = require('./config/database');

async function deleteExtraTransactions() {
  try {
    await connectDatabases();
    console.log('✅ Connected to databases\n');
    
    const CARD_ID = '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2';
    
    const Transaction = require('./models/Transaction').getTransactionModel();
    
    console.log('🔍 Finding REFUND and REVERSED transactions to delete...\n');
    
    const refunds = await Transaction.find({
      cardId: CARD_ID,
      operation: 'TRANSACTION_REFUND',
      isDeleted: { $ne: true }
    });
    
    const reversed = await Transaction.find({
      cardId: CARD_ID,
      operation: 'TRANSACTION_REVERSED',
      isDeleted: { $ne: true }
    });
    
    console.log(`Found ${refunds.length} REFUND transactions:`);
    refunds.forEach((ref, i) => {
      console.log(`   ${i + 1}. $${ref.amount} - ${ref.date} - ID: ${ref._id}`);
    });
    
    console.log(`\nFound ${reversed.length} REVERSED transactions:`);
    reversed.forEach((rev, i) => {
      console.log(`   ${i + 1}. $${rev.amount} - ${rev.date} - ID: ${rev._id}`);
    });
    
    const totalToDelete = refunds.length + reversed.length;
    
    if (totalToDelete > 0) {
      console.log(`\n⚠️  Ready to delete ${totalToDelete} transactions`);
      console.log('   Press Ctrl+C to cancel, or wait 3 seconds...\n');
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      let deletedCount = 0;
      
      for (const tx of [...refunds, ...reversed]) {
        const result = await Transaction.deleteOne({ _id: tx._id });
        if (result.deletedCount > 0) {
          deletedCount++;
          console.log(`   ✅ Deleted ${tx.operation}: $${tx.amount} (${tx._id})`);
        }
      }
      
      console.log(`\n✅ Deleted ${deletedCount} transactions`);
    } else {
      console.log('\n✅ No transactions to delete');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deleteExtraTransactions();
