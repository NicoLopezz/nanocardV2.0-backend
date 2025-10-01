require('dotenv').config();
const { databases, connectDatabases } = require('../config/database');
const { transactionSchema } = require('../models/Transaction');

async function findAndRemoveAllDuplicates() {
  await connectDatabases();
  const Transaction = databases.transactions.connection.model('Transaction', transactionSchema);
  
  console.log('🔍 COMPREHENSIVE DUPLICATE SEARCH for user 3aHxD5fWTeNkmiTigQSD1K1nMRk1c6V7...');
  
  // Obtener TODAS las transacciones del usuario
  const allTransactions = await Transaction.find({ 
    cardId: '3aHxD5fWTeNkmiTigQSD1K1nMRk1c6V7'
  }).sort({ createdAt: 1 });
  
  console.log(`📊 Total transactions found: ${allTransactions.length}`);
  
  // Agrupar por monto y fecha para encontrar duplicados
  const transactionGroups = {};
  
  allTransactions.forEach(tx => {
    const date = new Date(tx.createdAt);
    const dateKey = date.toLocaleDateString('es-ES');
    const groupKey = `${tx.amount}_${dateKey}`;
    
    if (!transactionGroups[groupKey]) {
      transactionGroups[groupKey] = [];
    }
    transactionGroups[groupKey].push(tx);
  });
  
  console.log('\n🔍 Analyzing transaction groups for duplicates...');
  
  let totalDuplicatesFound = 0;
  const removedTransactions = [];
  
  for (const groupKey of Object.keys(transactionGroups)) {
    const transactions = transactionGroups[groupKey];
    
    if (transactions.length > 1) {
      console.log(`\n⚠️  DUPLICATE GROUP FOUND: ${groupKey}`);
      
      // Separar manual deposits de API transactions
      const manualDeposits = transactions.filter(tx => tx.comentario === 'Manual-Deposit');
      const apiTransactions = transactions.filter(tx => tx.comentario !== 'Manual-Deposit');
      
      console.log(`  Manual deposits: ${manualDeposits.length}`);
      console.log(`  API transactions: ${apiTransactions.length}`);
      
      // Mostrar detalles de cada transacción
      transactions.forEach((tx, index) => {
        const date = new Date(tx.createdAt);
        const formattedTime = date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        });
        const isManual = tx.comentario === 'Manual-Deposit';
        const type = isManual ? '🔧 MANUAL' : '🤖 API';
        console.log(`    ${index + 1}. ${type} $${tx.amount} | ${tx.date} ${formattedTime} | ${tx.operation} | ${tx.comentario || 'No comment'}`);
      });
      
      // Si hay API transactions, eliminar manual deposits
      if (apiTransactions.length > 0 && manualDeposits.length > 0) {
        console.log('\n🗑️  Removing manual deposits (prioritizing API transactions)...');
        
        for (const manualDeposit of manualDeposits) {
          await Transaction.findByIdAndDelete(manualDeposit._id);
          console.log(`  ✅ Removed: $${manualDeposit.amount} | ${manualDeposit.date} | ${manualDeposit.originalMovementId}`);
          totalDuplicatesFound++;
          removedTransactions.push({
            amount: manualDeposit.amount,
            date: manualDeposit.date,
            originalId: manualDeposit.originalMovementId,
            reason: 'Duplicate of API transaction'
          });
        }
      } else if (manualDeposits.length > 1) {
        // Si solo hay manual deposits duplicados, eliminar todos excepto el primero
        console.log('\n🗑️  Multiple manual deposits found, keeping only the first...');
        
        for (let i = 1; i < manualDeposits.length; i++) {
          const manualDeposit = manualDeposits[i];
          await Transaction.findByIdAndDelete(manualDeposit._id);
          console.log(`  ✅ Removed: $${manualDeposit.amount} | ${manualDeposit.date} | ${manualDeposit.originalMovementId}`);
          totalDuplicatesFound++;
          removedTransactions.push({
            amount: manualDeposit.amount,
            date: manualDeposit.date,
            originalId: manualDeposit.originalMovementId,
            reason: 'Duplicate manual deposit'
          });
        }
      }
    }
  }
  
  console.log('\n📊 DUPLICATE REMOVAL SUMMARY:');
  console.log(`🗑️  Total duplicates removed: ${totalDuplicatesFound}`);
  
  if (removedTransactions.length > 0) {
    console.log('\n📋 Removed transactions:');
    removedTransactions.forEach((tx, index) => {
      console.log(`  ${index + 1}. $${tx.amount} | ${tx.date} | ${tx.originalId} - ${tx.reason}`);
    });
  }
  
  // Verificación final
  const finalTransactions = await Transaction.find({ 
    cardId: '3aHxD5fWTeNkmiTigQSD1K1nMRk1c6V7'
  });
  
  const finalManualDeposits = finalTransactions.filter(tx => tx.comentario === 'Manual-Deposit');
  
  console.log(`\n📊 Final counts:`);
  console.log(`✅ Total transactions: ${finalTransactions.length}`);
  console.log(`✅ Manual deposits: ${finalManualDeposits.length}`);
  
  process.exit(0);
}

findAndRemoveAllDuplicates().catch(console.error);
