require('dotenv').config();

// Forzar entorno de producción
process.env.NODE_ENV = 'production';

const { databases, connectDatabases } = require('../config/database');

async function fixDecimalAmountsProd() {
  try {
    console.log('🔄 Connecting to PROD databases...');
    await connectDatabases();
    console.log('✅ Connected to PROD databases');
    
    const { transactionSchema } = require('../models/Transaction');
    const Transaction = databases.transactions.connection.model('Transaction', transactionSchema);
    
    // Encontrar todas las transacciones con decimales
    const allTransactions = await Transaction.find({});
    
    console.log(`📊 Found ${allTransactions.length} total transactions in PROD`);
    
    const decimalTransactions = allTransactions.filter(tx => tx.amount % 1 !== 0);
    console.log(`🔍 Found ${decimalTransactions.length} transactions with decimal amounts`);
    
    let fixedCount = 0;
    
    for (const transaction of decimalTransactions) {
      const originalAmount = transaction.amount;
      const roundedAmount = Math.round(transaction.amount);
      
      console.log(`  🔧 Fixing: ${originalAmount} → ${roundedAmount} (${transaction.operation})`);
      
      transaction.amount = roundedAmount;
      await transaction.save();
      
      fixedCount++;
    }
    
    console.log(`\n✅ Fixed ${fixedCount} transactions with decimal amounts`);
    
    // Verificar que no queden decimales
    const remainingDecimals = await Transaction.find({});
    const stillDecimal = remainingDecimals.filter(tx => tx.amount % 1 !== 0);
    
    console.log(`🔍 Remaining decimal transactions: ${stillDecimal.length}`);
    
    if (stillDecimal.length === 0) {
      console.log('🎉 All decimal amounts have been fixed in PROD!');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixDecimalAmountsProd();
