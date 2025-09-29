const { getCardModel } = require('../models/Card');
const { getTransactionModel } = require('../models/Transaction');
const { getUserModel } = require('../models/User');
const StatsRefreshService = require('../services/statsRefreshService');
const { connectDatabases } = require('../config/database');

async function debugCardStats() {
  try {
    console.log('🔍 Debugging Card Stats (DEV DATABASE)...\n');
    
    // Forzar entorno de desarrollo
    process.env.NODE_ENV = 'development';
    
    // Conectar a las bases de datos
    await connectDatabases();
    console.log('✅ Databases connected');
    
    const cardId = 'HREu8JkLnYQrpxe5ZlqvFvw95mkzTC7T';
    const userId = 'HREu8JkLnYQrpxe5ZlqvFvw95mkzTC7T';
    
    const Card = getCardModel();
    const Transaction = getTransactionModel();
    const User = getUserModel();
    
    // 1. Obtener datos actuales
    console.log('1️⃣ Current Data:');
    const card = await Card.findById(cardId);
    const user = await User.findById(userId);
    
    console.log('   Card Stats:', JSON.stringify(card.stats, null, 2));
    console.log('   User Stats:', JSON.stringify(user.stats, null, 2));
    
    // 2. Obtener todas las transacciones de la tarjeta
    console.log('\n2️⃣ All Transactions for Card:');
    const allTransactions = await Transaction.find({ cardId: cardId });
    
    console.log(`   Total transactions found: ${allTransactions.length}`);
    
    allTransactions.forEach((tx, index) => {
      console.log(`   ${index + 1}. ${tx.operation} - $${tx.amount} - Deleted: ${tx.isDeleted} - Status: ${tx.status}`);
    });
    
    // 3. Analizar transacciones por operación
    console.log('\n3️⃣ Transactions by Operation:');
    const byOperation = {};
    allTransactions.forEach(tx => {
      if (!byOperation[tx.operation]) {
        byOperation[tx.operation] = { count: 0, total: 0, transactions: [] };
      }
      byOperation[tx.operation].count++;
      byOperation[tx.operation].total += tx.amount;
      byOperation[tx.operation].transactions.push({
        id: tx._id,
        amount: tx.amount,
        isDeleted: tx.isDeleted,
        status: tx.status
      });
    });
    
    Object.keys(byOperation).forEach(operation => {
      const data = byOperation[operation];
      console.log(`   ${operation}: ${data.count} transactions, Total: $${data.total}`);
      data.transactions.forEach(tx => {
        console.log(`     - ${tx.id}: $${tx.amount} (Deleted: ${tx.isDeleted}, Status: ${tx.status})`);
      });
    });
    
    // 4. Calcular stats manualmente
    console.log('\n4️⃣ Manual Calculation:');
    
    const activeTransactions = allTransactions.filter(tx => !tx.isDeleted && tx.status !== 'DELETED');
    const deletedTransactions = allTransactions.filter(tx => tx.isDeleted || tx.status === 'DELETED');
    
    console.log(`   Active transactions: ${activeTransactions.length}`);
    console.log(`   Deleted transactions: ${deletedTransactions.length}`);
    
    let manualStats = {
      money_in: 0,
      refund: 0,
      posted: 0,
      reversed: 0,
      rejected: 0,
      pending: 0,
      withdrawal: 0,
      total_all_transactions: allTransactions.length,
      total_deleted_transactions: deletedTransactions.length,
      deleted_amount: 0
    };
    
    // Calcular stats de transacciones activas
    activeTransactions.forEach(tx => {
      switch (tx.operation) {
        case 'WALLET_DEPOSIT':
        case 'OVERRIDE_VIRTUAL_BALANCE':
          manualStats.money_in += tx.amount;
          break;
        case 'TRANSACTION_REFUND':
          manualStats.refund += tx.amount;
          break;
        case 'TRANSACTION_APPROVED':
          manualStats.posted += tx.amount;
          break;
        case 'TRANSACTION_REJECTED':
          manualStats.rejected += tx.amount;
          break;
        case 'TRANSACTION_REVERSED':
          manualStats.reversed += tx.amount;
          break;
        case 'TRANSACTION_PENDING':
          manualStats.pending += tx.amount;
          break;
        case 'WITHDRAWAL':
          manualStats.withdrawal += tx.amount;
          break;
      }
    });
    
    // Calcular monto de transacciones eliminadas
    deletedTransactions.forEach(tx => {
      manualStats.deleted_amount += tx.amount;
    });
    
    // Calcular available
    manualStats.available = manualStats.money_in + manualStats.refund - manualStats.posted - manualStats.pending - manualStats.withdrawal;
    
    console.log('   Manual Stats:', JSON.stringify(manualStats, null, 2));
    
    // 5. Comparar con stats actuales
    console.log('\n5️⃣ Comparison:');
    console.log('   Current vs Manual:');
    console.log(`   money_in: ${card.stats.money_in} vs ${manualStats.money_in}`);
    console.log(`   withdrawal: ${card.stats.withdrawal} vs ${manualStats.withdrawal}`);
    console.log(`   available: ${card.stats.available} vs ${manualStats.available}`);
    console.log(`   total_all_transactions: ${card.stats.total_all_transactions} vs ${manualStats.total_all_transactions}`);
    
    // 6. Recalcular stats usando el microservicio
    console.log('\n6️⃣ Recalculating with Microservice:');
    try {
      const result = await StatsRefreshService.recalculateCardStats(cardId);
      console.log('   ✅ Card stats recalculated');
      console.log('   Result:', JSON.stringify(result.card, null, 2));
    } catch (error) {
      console.log('   ❌ Error recalculating:', error.message);
    }
    
    // 7. Verificar stats después del recálculo
    console.log('\n7️⃣ Stats After Recalculation:');
    const updatedCard = await Card.findById(cardId);
    console.log('   Updated Card Stats:', JSON.stringify(updatedCard.stats, null, 2));
    
    // 8. Buscar transacciones duplicadas o problemáticas
    console.log('\n8️⃣ Looking for Duplicate/Problematic Transactions:');
    const withdrawalTransactions = allTransactions.filter(tx => tx.operation === 'WITHDRAWAL');
    console.log(`   WITHDRAWAL transactions found: ${withdrawalTransactions.length}`);
    
    withdrawalTransactions.forEach((tx, index) => {
      console.log(`   ${index + 1}. ID: ${tx._id}, Amount: $${tx.amount}, Deleted: ${tx.isDeleted}, Status: ${tx.status}, Date: ${tx.date} ${tx.time}`);
    });
    
    // 9. Verificar si hay transacciones con el mismo monto
    console.log('\n9️⃣ Checking for Duplicate Amounts:');
    const amountGroups = {};
    allTransactions.forEach(tx => {
      if (!amountGroups[tx.amount]) {
        amountGroups[tx.amount] = [];
      }
      amountGroups[tx.amount].push(tx);
    });
    
    Object.keys(amountGroups).forEach(amount => {
      const transactions = amountGroups[amount];
      if (transactions.length > 1) {
        console.log(`   Amount $${amount} appears ${transactions.length} times:`);
        transactions.forEach(tx => {
          console.log(`     - ${tx._id}: ${tx.operation} (Deleted: ${tx.isDeleted}, Status: ${tx.status})`);
        });
      }
    });
    
    console.log('\n✅ Debug completed!');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Ejecutar debug si se llama directamente
if (require.main === module) {
  debugCardStats()
    .then(() => {
      console.log('\n🏁 Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}

module.exports = debugCardStats;
