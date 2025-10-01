require('dotenv').config();
const { databases, connectDatabases } = require('../config/database');
const { transactionSchema } = require('../models/Transaction');

async function removeDuplicateManualDeposits() {
  console.log('🔍 Finding and removing duplicate manual deposits (prioritizing API transactions)...');
  
  await connectDatabases();
  const Transaction = databases.transactions.connection.model('Transaction', transactionSchema);
  
  // Obtener todos los depósitos manuales
  const manualDeposits = await Transaction.find({ 
    cardId: '3aHxD5fWTeNkmiTigQSD1K1nMRk1c6V7',
    comentario: 'Manual-Deposit'
  }).sort({ createdAt: 1 });
  
  console.log(`📊 Found ${manualDeposits.length} manual deposits`);
  
  let totalRemoved = 0;
  const removedDeposits = [];
  
  for (const manualDeposit of manualDeposits) {
    console.log(`\n🔍 Checking manual deposit: $${manualDeposit.amount} | ${manualDeposit.date} | ${manualDeposit.originalMovementId}`);
    
    // Buscar transacciones de la API con el mismo monto y fecha (±1 día)
    const startDate = new Date(manualDeposit.createdAt);
    startDate.setDate(startDate.getDate() - 1);
    
    const endDate = new Date(manualDeposit.createdAt);
    endDate.setDate(endDate.getDate() + 1);
    
    const apiTransactions = await Transaction.find({
      cardId: '3aHxD5fWTeNkmiTigQSD1K1nMRk1c6V7',
      amount: { $gte: manualDeposit.amount - 10, $lte: manualDeposit.amount + 10 },
      createdAt: { $gte: startDate, $lte: endDate },
      comentario: { $ne: 'Manual-Deposit' }, // Excluir manual deposits
      $or: [
        { operation: 'WALLET_DEPOSIT' },
        { operation: 'OVERRIDE_VIRTUAL_BALANCE' }
      ]
    });
    
    if (apiTransactions.length > 0) {
      console.log(`⚠️  Found ${apiTransactions.length} API transaction(s) that match this manual deposit:`);
      apiTransactions.forEach(apiTx => {
        const date = new Date(apiTx.createdAt);
        const formattedDate = date.toLocaleDateString('es-ES');
        console.log(`  - $${apiTx.amount} | ${formattedDate} | ${apiTx.operation} | ${apiTx.comentario || 'No comment'}`);
      });
      
      // Eliminar el depósito manual duplicado
      await Transaction.findByIdAndDelete(manualDeposit._id);
      console.log(`🗑️  REMOVED manual deposit: $${manualDeposit.amount} | ${manualDeposit.date} | ${manualDeposit.originalMovementId}`);
      
      totalRemoved++;
      removedDeposits.push({
        amount: manualDeposit.amount,
        date: manualDeposit.date,
        originalId: manualDeposit.originalMovementId,
        reason: `Duplicate of API transaction(s): ${apiTransactions.map(tx => tx.operation).join(', ')}`
      });
    } else {
      console.log(`✅ No duplicates found - keeping manual deposit`);
    }
  }
  
  console.log('\n📊 DUPLICATE REMOVAL REPORT:');
  console.log(`🗑️  Total manual deposits removed: ${totalRemoved}`);
  console.log(`✅ Total manual deposits remaining: ${manualDeposits.length - totalRemoved}`);
  
  if (removedDeposits.length > 0) {
    console.log('\n📋 Removed deposits:');
    removedDeposits.forEach((dep, index) => {
      console.log(`  ${index + 1}. $${dep.amount} | ${dep.date} | ${dep.originalId} - ${dep.reason}`);
    });
  }
  
  // Verificación final
  const remainingManualDeposits = await Transaction.find({ 
    cardId: '3aHxD5fWTeNkmiTigQSD1K1nMRk1c6V7',
    comentario: 'Manual-Deposit'
  });
  
  console.log(`\n📊 Final count: ${remainingManualDeposits.length} manual deposits remaining`);
  
  process.exit(0);
}

removeDuplicateManualDeposits().catch(console.error);
