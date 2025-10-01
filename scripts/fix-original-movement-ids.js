require('dotenv').config();
const { databases, connectDatabases } = require('../config/database');
const { transactionSchema } = require('../models/Transaction');

// Mapeo de depósitos existentes con sus originalMovementId
const depositMappings = [
  // Depósitos originales de movimientos
  { amount: 90, date: '16/12/2024', originalId: 'deposit_1' },
  { amount: 241, date: '16/12/2024', originalId: 'deposit_2' },
  { amount: 4984, date: '23/12/2024', originalId: '7d005550-c16b-11ef-a432-05f7f322eeb0' },
  { amount: 4740, date: '24/12/2024', originalId: 'deposit_3' },
  { amount: 4653, date: '24/12/2024', originalId: 'deposit_4' },
  { amount: 341, date: '24/12/2024', originalId: 'deposit_5' },
  { amount: 1000, date: '2/1/2025', originalId: 'deposit_6' },
  { amount: 10, date: '10/3/2025', originalId: 'deposit_0' },
  
  // Depósitos nuevos de recargas
  { amount: 50, date: '5/12/2024', originalId: 'transaction_1758912756449' },
  { amount: 50, date: '13/12/2024', originalId: 'transaction_1758912784566' },
  { amount: 1500, date: '26/2/2025', originalId: 'transaction_1758913382589' },
  { amount: 999, date: '4/4/2025', originalId: 'transaction_1758913723758' },
  { amount: 1283, date: '4/4/2025', originalId: 'transaction_1758913746488' },
  { amount: 306, date: '13/5/2025', originalId: 'transaction_1758920044759' },
  { amount: 95, date: '16/5/2025', originalId: 'transaction_1758913848597' },
  { amount: 973, date: '13/6/2025', originalId: 'transaction_1758913895444' },
  { amount: 626, date: '17/6/2025', originalId: 'transaction_1758913945867' },
  { amount: 450, date: '23/6/2025', originalId: 'transaction_1758913969902' },
  { amount: 1547, date: '3/7/2025', originalId: 'transaction_1758914009618' },
  { amount: 552, date: '4/7/2025', originalId: 'transaction_1758914553411' },
  { amount: 1003, date: '31/7/2025', originalId: 'transaction_1758914662032' },
  { amount: 300, date: '31/7/2025', originalId: 'transaction_1758914678559' },
  { amount: 5784, date: '9/8/2025', originalId: 'transaction_1758914759624' },
  { amount: 2586, date: '11/8/2025', originalId: 'transaction_1758914780903' },
  { amount: 995, date: '21/8/2025', originalId: 'transaction_1758914868441' },
  { amount: 748, date: '3/9/2025', originalId: 'transaction_1758914904148' },
  { amount: 90, date: '5/9/2025', originalId: 'transaction_1758919742317' },
  { amount: 369, date: '6/9/2025', originalId: 'transaction_1758919727002' },
  { amount: 189, date: '15/9/2025', originalId: 'transaction_1758919856312' },
  { amount: 557, date: '17/9/2025', originalId: 'transaction_1758919881953' }
];

async function fixOriginalMovementIds() {
  console.log('🔧 Fixing originalMovementId for all manual deposits...');
  
  await connectDatabases();
  const Transaction = databases.transactions.connection.model('Transaction', transactionSchema);
  
  let totalUpdated = 0;
  let totalSkipped = 0;
  
  for (const mapping of depositMappings) {
    console.log(`\n🔍 Looking for: $${mapping.amount} | ${mapping.date}`);
    
    // Buscar depósito por monto y fecha
    const deposit = await Transaction.findOne({
      cardId: '3aHxD5fWTeNkmiTigQSD1K1nMRk1c6V7',
      comentario: 'Manual-Deposit',
      amount: mapping.amount,
      date: mapping.date
    });
    
    if (deposit) {
      if (deposit.originalMovementId) {
        console.log(`⏭️  Already has originalMovementId: ${deposit.originalMovementId}`);
        totalSkipped++;
      } else {
        deposit.originalMovementId = mapping.originalId;
        await deposit.save();
        console.log(`✅ Updated: $${mapping.amount} | ${mapping.date} -> ${mapping.originalId}`);
        totalUpdated++;
      }
    } else {
      console.log(`❌ Not found: $${mapping.amount} | ${mapping.date}`);
      totalSkipped++;
    }
  }
  
  console.log('\n📊 UPDATE REPORT:');
  console.log(`✅ Total updated: ${totalUpdated}`);
  console.log(`⏭️  Total skipped: ${totalSkipped}`);
  
  // Verificar resultado final
  const allDeposits = await Transaction.find({ 
    cardId: '3aHxD5fWTeNkmiTigQSD1K1nMRk1c6V7',
    comentario: 'Manual-Deposit'
  }).sort({ createdAt: 1 });
  
  const withOriginalId = allDeposits.filter(dep => dep.originalMovementId);
  const withoutOriginalId = allDeposits.filter(dep => !dep.originalMovementId);
  
  console.log(`\n📊 Final verification:`);
  console.log(`✅ With originalMovementId: ${withOriginalId.length}`);
  console.log(`❌ Without originalMovementId: ${withoutOriginalId.length}`);
  
  if (withoutOriginalId.length > 0) {
    console.log('\n❌ Deposits still without originalMovementId:');
    withoutOriginalId.forEach(dep => {
      console.log(`  - $${dep.amount} | ${dep.date} | ${dep._id}`);
    });
  }
  
  process.exit(0);
}

fixOriginalMovementIds().catch(console.error);
