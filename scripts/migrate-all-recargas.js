require('dotenv').config();
const { databases, connectDatabases } = require('../config/database');
const { transactionSchema } = require('../models/Transaction');
const { v4: uuidv4 } = require('uuid');

// Recargas del JSON que me proporcionaste
const recargasFromJSON = [
  { id: "deposit_2", monto: 240, fecha: "2024-12-16T06:46:00.000Z" },
  { id: "3a4159fd-dbd8-4e9b-9bc6-deeec03c11c3", monto: 1001, fecha: "2025-01-02T08:58:00.000Z" },
  { id: "629621ec-5654-4660-89a3-264d6029ba93", monto: 4989, fecha: "2024-12-23T11:21:00.000Z" },
  { id: "transaction_1758912756449", monto: 50, fecha: "2024-12-05T03:52:00.000Z" },
  { id: "transaction_1758912784566", monto: 50, fecha: "2024-12-13T03:52:00.000Z" },
  { id: "transaction_1758913382589", monto: 1500, fecha: "2025-02-26T04:02:00.000Z" },
  { id: "transaction_1758913723758", monto: 999, fecha: "2025-04-04T04:08:00.000Z" },
  { id: "transaction_1758913746488", monto: 1283, fecha: "2025-04-04T04:08:00.000Z" },
  { id: "transaction_1758913848597", monto: 95, fecha: "2025-05-16T04:10:00.000Z" },
  { id: "transaction_1758913895444", monto: 973, fecha: "2025-06-13T04:11:00.000Z" },
  { id: "transaction_1758913945867", monto: 626, fecha: "2025-06-17T04:12:00.000Z" },
  { id: "transaction_1758913969902", monto: 450, fecha: "2025-06-23T04:12:00.000Z" },
  { id: "transaction_1758914009618", monto: 1547, fecha: "2025-07-03T04:13:00.000Z" },
  { id: "transaction_1758914553411", monto: 552, fecha: "2025-07-04T04:22:00.000Z" },
  { id: "transaction_1758914662032", monto: 1003, fecha: "2025-07-31T04:24:00.000Z" },
  { id: "transaction_1758914678559", monto: 300, fecha: "2025-07-31T04:24:00.000Z" },
  { id: "transaction_1758914759624", monto: 5784, fecha: "2025-08-09T04:25:00.000Z" },
  { id: "transaction_1758914780903", monto: 2586, fecha: "2025-08-11T04:26:00.000Z" },
  { id: "transaction_1758914868441", monto: 995, fecha: "2025-08-21T04:27:00.000Z" },
  { id: "transaction_1758914904148", monto: 748, fecha: "2025-09-03T04:28:00.000Z" },
  { id: "transaction_1758919727002", monto: 369, fecha: "2025-09-06T05:48:00.000Z" },
  { id: "transaction_1758919742317", monto: 90, fecha: "2025-09-05T05:48:00.000Z" },
  { id: "transaction_1758919856312", monto: 189, fecha: "2025-09-15T05:50:00.000Z" },
  { id: "transaction_1758919881953", monto: 557, fecha: "2025-09-17T05:51:00.000Z" },
  { id: "transaction_1758920044759", monto: 306, fecha: "2025-05-13T05:53:00.000Z" }
];

async function checkForDuplicate(amount, date, Transaction) {
  const startDate = new Date(date);
  startDate.setDate(startDate.getDate() - 1);
  
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 1);
  
  const existingTransaction = await Transaction.findOne({
    cardId: '3aHxD5fWTeNkmiTigQSD1K1nMRk1c6V7',
    amount: { $gte: amount - 10, $lte: amount + 10 },
    createdAt: { $gte: startDate, $lte: endDate },
    comentario: 'Manual-Deposit'
  });
  
  return existingTransaction;
}

async function createManualDepositTransaction(recarga, Transaction) {
  const { transactionSchema } = require('../models/Transaction');
  
  const transactionDate = new Date(recarga.fecha);
  const formattedDate = transactionDate.toLocaleDateString('es-ES');
  const formattedTime = transactionDate.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });
  
  const newTransaction = new Transaction({
    _id: uuidv4(),
    userId: '3aHxD5fWTeNkmiTigQSD1K1nMRk1c6V7',
    cardId: '3aHxD5fWTeNkmiTigQSD1K1nMRk1c6V7',
    userName: 'Nano Pfeiffer',
    cardName: 'Nano Pfeiffer',
    name: 'Deposit',
    amount: Math.round(recarga.monto),
    date: formattedDate,
    time: formattedTime,
    status: 'SUCCESS',
    operation: 'WALLET_DEPOSIT',
    credit: true,
    comentario: 'Manual-Deposit',
    originalMovementId: recarga.id,
    version: 1,
    isDeleted: false,
    reconciled: false,
    createdAt: transactionDate,
    updatedAt: transactionDate,
    history: []
  });
  
  return newTransaction;
}

async function migrateAllRecargas() {
  console.log('🚀 Starting migration of ALL recargas from JSON...');
  
  await connectDatabases();
  const Transaction = databases.transactions.connection.model('Transaction', transactionSchema);
  
  let totalFound = 0;
  let totalMigrated = 0;
  let totalSkipped = 0;
  const skippedReasons = [];
  
  console.log(`📊 Processing ${recargasFromJSON.length} recargas from JSON...`);
  
  for (const recarga of recargasFromJSON) {
    totalFound++;
    
    console.log(`\n🔍 Processing: $${recarga.monto} | ${recarga.id}`);
    
    // Check for duplicates
    const duplicate = await checkForDuplicate(recarga.monto, recarga.fecha, Transaction);
    
    if (duplicate) {
      console.log(`⏭️  Skipped - Duplicate found: ${duplicate._id}`);
      totalSkipped++;
      skippedReasons.push(`Duplicate: $${recarga.monto} | ${recarga.id} (existing: ${duplicate._id})`);
      continue;
    }
    
    try {
      const newTransaction = await createManualDepositTransaction(recarga, Transaction);
      await newTransaction.save();
      
      console.log(`✅ Migrated: $${recarga.monto} | ${recarga.id} -> ${newTransaction._id}`);
      totalMigrated++;
      
    } catch (error) {
      console.log(`❌ Error migrating $${recarga.monto} | ${recarga.id}: ${error.message}`);
      totalSkipped++;
      skippedReasons.push(`Error: $${recarga.monto} | ${recarga.id} - ${error.message}`);
    }
  }
  
  console.log('\n📊 MIGRATION REPORT:');
  console.log(`📊 Total found: ${totalFound}`);
  console.log(`✅ Total migrated: ${totalMigrated}`);
  console.log(`⏭️  Total skipped: ${totalSkipped}`);
  
  if (skippedReasons.length > 0) {
    console.log('\n📋 Skipped reasons:');
    skippedReasons.forEach((reason, index) => {
      console.log(`  ${index + 1}. ${reason}`);
    });
  }
  
  process.exit(0);
}

migrateAllRecargas().catch(console.error);
