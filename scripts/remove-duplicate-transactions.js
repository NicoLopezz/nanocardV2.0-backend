const { getTransactionModel } = require('../models/Transaction');
const { connectDatabases, closeDatabaseConnections } = require('../config/database');
const StatsRefreshService = require('../services/statsRefreshService');

function normalizeDate(dateStr) {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2];
  
  return `${day}/${month}/${year}`;
}

function createDuplicateKey(transaction) {
  const normalizedDate = normalizeDate(transaction.date);
  return `${transaction.userId}-${transaction.amount}-${normalizedDate}-${transaction.supplier || 'cryptomate'}`;
}

async function findAndRemoveDuplicates(dryRun = true) {
  try {
    await connectDatabases();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const Transaction = getTransactionModel();
    
    console.log('\n🔍 Buscando transacciones con name="Deposit" y sus pares...\n');
    
    // Paso 1: Buscar todas las transacciones con name="Deposit"
    const depositTransactions = await Transaction.find({
      isDeleted: false,
      name: 'Deposit'
    }).sort({ createdAt: 1 });
    
    console.log(`📊 Transacciones con name="Deposit" encontradas: ${depositTransactions.length}\n`);
    
    if (depositTransactions.length === 0) {
      console.log('✅ No se encontraron transacciones con name="Deposit"');
      return;
    }
    
    const toDelete = [];
    const foundPairs = [];
    const noPairs = [];
    
    // Paso 2: Para cada transacción "Deposit", buscar su par
    for (const depositTx of depositTransactions) {
      console.log(`\n🔍 Buscando par para: ${depositTx._id}`);
      console.log(`   Amount: ${depositTx.amount}`);
      console.log(`   Date: ${depositTx.date}`);
      console.log(`   User: ${depositTx.userName}`);
      
      // Buscar transacciones con mismo userId, amount, fecha pero diferente name
      const normalizedDate = normalizeDate(depositTx.date);
      
      // Buscar transacciones que tengan la misma fecha normalizada
      const pairTransactions = await Transaction.find({
        _id: { $ne: depositTx._id },
        isDeleted: false,
        userId: depositTx.userId,
        amount: depositTx.amount,
        supplier: depositTx.supplier || 'cryptomate'
      }).then(transactions => {
        // Filtrar por fecha normalizada
        return transactions.filter(tx => {
          const txNormalizedDate = normalizeDate(tx.date);
          return txNormalizedDate === normalizedDate;
        });
      });
      
      if (pairTransactions.length > 0) {
        console.log(`   ✅ Par encontrado: ${pairTransactions.length} transacción(es)`);
        
        pairTransactions.forEach((pair, idx) => {
          console.log(`      ${idx + 1}. ID: ${pair._id}`);
          console.log(`         Name: "${pair.name}"`);
          console.log(`         Operation: ${pair.operation}`);
          console.log(`         Comment: "${pair.comentario || 'N/A'}"`);
        });
        
        foundPairs.push({
          deposit: depositTx,
          pairs: pairTransactions
        });
        
        toDelete.push(depositTx);
      } else {
        console.log(`   ❌ No se encontró par`);
        noPairs.push(depositTx);
      }
    }
    
    console.log('\n\n📊 RESUMEN:');
    console.log(`   Transacciones "Deposit" encontradas: ${depositTransactions.length}`);
    console.log(`   Pares encontrados: ${foundPairs.length}`);
    console.log(`   Sin par: ${noPairs.length}`);
    console.log(`   Transacciones "Deposit" a eliminar: ${toDelete.length}`);
    
    if (toDelete.length > 0) {
      if (dryRun) {
        console.log('\n⚠️  MODO DRY RUN - No se eliminará nada');
        console.log('   Para ejecutar la eliminación, ejecuta: node scripts/remove-duplicate-transactions.js --execute');
        
        const cardGroups = new Map();
        for (const tx of toDelete) {
          if (!cardGroups.has(tx.cardId)) {
            cardGroups.set(tx.cardId, []);
          }
          cardGroups.get(tx.cardId).push(tx);
        }
        
        console.log(`\n📊 Cards que serán afectadas: ${cardGroups.size}`);
        for (const [cardId, txs] of cardGroups.entries()) {
          console.log(`   - Card ${cardId}: ${txs.length} transacciones a eliminar`);
        }
      } else {
        console.log('\n🗑️  ELIMINANDO TRANSACCIONES "Deposit" Y ACTUALIZANDO STATS...\n');
        
        const cardGroups = new Map();
        for (const tx of toDelete) {
          if (!cardGroups.has(tx.cardId)) {
            cardGroups.set(tx.cardId, []);
          }
          cardGroups.get(tx.cardId).push(tx);
        }
        
        console.log(`📊 Cards afectadas: ${cardGroups.size}\n`);
        
        let totalDeleted = 0;
        let cardsUpdated = 0;
        
        for (const [cardId, txs] of cardGroups.entries()) {
          console.log(`\n💳 Procesando Card: ${cardId}`);
          console.log(`   Transacciones "Deposit" a eliminar: ${txs.length}`);
          
          const idsToDelete = txs.map(tx => tx._id);
          const deleteResult = await Transaction.deleteMany({ _id: { $in: idsToDelete } });
          
          console.log(`   ✅ Eliminadas ${deleteResult.deletedCount} transacciones "Deposit"`);
          totalDeleted += deleteResult.deletedCount;
          
          try {
            console.log(`   🔄 Actualizando stats de la card...`);
            await StatsRefreshService.refreshCardStats(cardId);
            console.log(`   ✅ Stats actualizadas correctamente`);
            cardsUpdated++;
          } catch (statsError) {
            console.error(`   ❌ Error actualizando stats: ${statsError.message}`);
          }
        }
        
        console.log(`\n\n✅ PROCESO COMPLETADO:`);
        console.log(`   📊 Total transacciones "Deposit" eliminadas: ${totalDeleted}`);
        console.log(`   💳 Cards con stats actualizadas: ${cardsUpdated}/${cardGroups.size}`);
      }
    }
    
    if (noPairs.length > 0) {
      console.log('\n⚠️  TRANSACCIONES "Deposit" SIN PAR:');
      console.log(`   Hay ${noPairs.length} transacciones "Deposit" que no tienen par`);
      console.log('   Estas NO se eliminarán automáticamente');
    }
    
    console.log('\n✅ Proceso completado\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await closeDatabaseConnections();
    process.exit(0);
  }
}

const dryRun = !process.argv.includes('--execute');

if (dryRun) {
  console.log('\n⚠️  EJECUTANDO EN MODO DRY RUN');
  console.log('   Solo se mostrarán los duplicados, no se eliminará nada\n');
} else {
  console.log('\n⚠️  MODO EJECUCIÓN - SE ELIMINARÁN LOS DUPLICADOS');
  console.log('   Asegúrate de haber revisado el dry run primero\n');
}

findAndRemoveDuplicates(dryRun);

