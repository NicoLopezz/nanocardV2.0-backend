require('dotenv').config();
const { databases, connectDatabases } = require('../config/database');
const { transactionSchema } = require('../models/Transaction');

async function removeAllDuplicatesByAmount() {
  await connectDatabases();
  const Transaction = databases.transactions.connection.model('Transaction', transactionSchema);
  
  console.log('🔍 REMOVING ALL DUPLICATES BY AMOUNT - Prioritizing API transactions...');
  
  // Obtener TODOS los depósitos (manuales y de API)
  const allDeposits = await Transaction.find({
    cardId: '3aHxD5fWTeNkmiTigQSD1K1nMRk1c6V7',
    $or: [
      { comentario: 'Manual-Deposit' },
      { operation: 'WALLET_DEPOSIT' },
      { operation: 'OVERRIDE_VIRTUAL_BALANCE' }
    ]
  }).sort({ createdAt: 1 });
  
  console.log(`📊 Total deposits found: ${allDeposits.length}`);
  
  // Agrupar por monto
  const depositsByAmount = {};
  
  allDeposits.forEach(deposit => {
    if (!depositsByAmount[deposit.amount]) {
      depositsByAmount[deposit.amount] = [];
    }
    depositsByAmount[deposit.amount].push(deposit);
  });
  
  console.log('\n🔍 Analyzing deposits by amount...');
  
  let totalDuplicatesFound = 0;
  const duplicatesToRemove = [];
  
  // Revisar cada monto
  for (const amount of Object.keys(depositsByAmount)) {
    const deposits = depositsByAmount[amount];
    
    if (deposits.length > 1) {
      console.log(`\n⚠️  DUPLICATE AMOUNT FOUND: $${amount} (${deposits.length} transactions)`);
      
      // Separar manuales de API
      const manualDeposits = deposits.filter(dep => dep.comentario === 'Manual-Deposit');
      const apiDeposits = deposits.filter(dep => dep.comentario !== 'Manual-Deposit');
      
      console.log(`  Manual deposits: ${manualDeposits.length}`);
      console.log(`  API deposits: ${apiDeposits.length}`);
      
      // Mostrar todas las transacciones
      deposits.forEach((dep, index) => {
        const date = new Date(dep.createdAt);
        const formattedDate = date.toLocaleDateString('es-ES');
        const formattedTime = date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        });
        const isManual = dep.comentario === 'Manual-Deposit';
        const type = isManual ? '🔧 MANUAL' : '🤖 API';
        console.log(`    ${index + 1}. ${type} $${dep.amount} | ${formattedDate} ${formattedTime} | ${dep.operation} | ${dep.comentario || 'No comment'}`);
      });
      
      // Si hay API deposits, eliminar TODOS los manuales
      if (apiDeposits.length > 0 && manualDeposits.length > 0) {
        console.log(`\n  🗑️  Removing ${manualDeposits.length} manual deposit(s) (keeping ${apiDeposits.length} API deposit(s))`);
        
        for (const manualDep of manualDeposits) {
          duplicatesToRemove.push(manualDep);
          totalDuplicatesFound++;
        }
      } else if (manualDeposits.length > 1) {
        // Si solo hay manuales duplicados, eliminar todos excepto el primero
        console.log(`\n  🗑️  Multiple manual deposits, keeping only the first`);
        
        for (let i = 1; i < manualDeposits.length; i++) {
          duplicatesToRemove.push(manualDeposits[i]);
          totalDuplicatesFound++;
        }
      }
    }
  }
  
  console.log(`\n📊 DUPLICATE ANALYSIS COMPLETE:`);
  console.log(`🗑️  Total duplicates to remove: ${totalDuplicatesFound}`);
  
  if (duplicatesToRemove.length > 0) {
    console.log('\n📋 Duplicates to remove:');
    duplicatesToRemove.forEach((dep, index) => {
      const date = new Date(dep.createdAt);
      const formattedDate = date.toLocaleDateString('es-ES');
      console.log(`  ${index + 1}. $${dep.amount} | ${formattedDate} | ${dep.originalMovementId || 'No ID'} | ${dep._id}`);
    });
    
    // Eliminar duplicados
    console.log('\n🗑️  Removing duplicates...');
    for (const duplicate of duplicatesToRemove) {
      await Transaction.findByIdAndDelete(duplicate._id);
      console.log(`  ✅ Removed: $${duplicate.amount} | ${duplicate.originalMovementId || 'No ID'}`);
    }
  } else {
    console.log('\n✅ No duplicates found!');
  }
  
  // Verificación final
  const finalDeposits = await Transaction.find({
    cardId: '3aHxD5fWTeNkmiTigQSD1K1nMRk1c6V7',
    $or: [
      { comentario: 'Manual-Deposit' },
      { operation: 'WALLET_DEPOSIT' },
      { operation: 'OVERRIDE_VIRTUAL_BALANCE' }
    ]
  });
  
  const finalManualDeposits = finalDeposits.filter(dep => dep.comentario === 'Manual-Deposit');
  
  console.log(`\n📊 FINAL SUMMARY:`);
  console.log(`✅ Total deposits: ${finalDeposits.length}`);
  console.log(`✅ Manual deposits: ${finalManualDeposits.length}`);
  console.log(`✅ Duplicates removed: ${totalDuplicatesFound}`);
  
  process.exit(0);
}

removeAllDuplicatesByAmount().catch(console.error);
