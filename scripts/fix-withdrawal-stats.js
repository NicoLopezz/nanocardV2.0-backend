const { getCardModel } = require('../models/Card');
const { getTransactionModel } = require('../models/Transaction');
const { getUserModel } = require('../models/User');
const { connectDatabases } = require('../config/database');

async function fixWithdrawalStats() {
  try {
    console.log('🔧 Fixing Withdrawal Stats...\n');
    
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
    console.log('1️⃣ Current Stats:');
    const card = await Card.findById(cardId);
    const user = await User.findById(userId);
    
    console.log('   Card Stats:', JSON.stringify(card.stats, null, 2));
    console.log('   User Stats:', JSON.stringify(user.stats, null, 2));
    
    // 2. Obtener todas las transacciones
    const allTransactions = await Transaction.find({ cardId: cardId });
    const activeTransactions = allTransactions.filter(tx => !tx.isDeleted && tx.status !== 'DELETED');
    const deletedTransactions = allTransactions.filter(tx => tx.isDeleted || tx.status === 'DELETED');
    
    console.log(`\n2️⃣ Transactions Analysis:`);
    console.log(`   Total: ${allTransactions.length}`);
    console.log(`   Active: ${activeTransactions.length}`);
    console.log(`   Deleted: ${deletedTransactions.length}`);
    
    // 3. Calcular stats correctas
    console.log('\n3️⃣ Calculating Correct Stats:');
    
    let correctStats = {
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
      console.log(`   Processing: ${tx.operation} - $${tx.amount} (${tx.isDeleted ? 'DELETED' : 'ACTIVE'})`);
      
      switch (tx.operation) {
        case 'WALLET_DEPOSIT':
        case 'OVERRIDE_VIRTUAL_BALANCE':
          correctStats.money_in += tx.amount;
          break;
        case 'TRANSACTION_REFUND':
          correctStats.refund += tx.amount;
          break;
        case 'TRANSACTION_APPROVED':
          correctStats.posted += tx.amount;
          break;
        case 'TRANSACTION_REJECTED':
          correctStats.rejected += tx.amount;
          break;
        case 'TRANSACTION_REVERSED':
          correctStats.reversed += tx.amount;
          break;
        case 'TRANSACTION_PENDING':
          correctStats.pending += tx.amount;
          break;
        case 'WITHDRAWAL':
          correctStats.withdrawal += tx.amount;
          break;
      }
    });
    
    // Calcular monto de transacciones eliminadas
    deletedTransactions.forEach(tx => {
      correctStats.deleted_amount += tx.amount;
    });
    
    // Calcular available
    correctStats.available = correctStats.money_in + correctStats.refund - correctStats.posted - correctStats.pending - correctStats.withdrawal;
    
    console.log('\n   Correct Stats:', JSON.stringify(correctStats, null, 2));
    
    // 4. Comparar con stats actuales
    console.log('\n4️⃣ Comparison:');
    console.log(`   money_in: ${card.stats.money_in} → ${correctStats.money_in} ${card.stats.money_in === correctStats.money_in ? '✅' : '❌'}`);
    console.log(`   withdrawal: ${card.stats.withdrawal} → ${correctStats.withdrawal} ${card.stats.withdrawal === correctStats.withdrawal ? '✅' : '❌'}`);
    console.log(`   available: ${card.stats.available} → ${correctStats.available} ${card.stats.available === correctStats.available ? '✅' : '❌'}`);
    console.log(`   total_all_transactions: ${card.stats.total_all_transactions} → ${correctStats.total_all_transactions} ${card.stats.total_all_transactions === correctStats.total_all_transactions ? '✅' : '❌'}`);
    
    // 5. Actualizar stats de la tarjeta
    console.log('\n5️⃣ Updating Card Stats:');
    card.stats = correctStats;
    await card.save();
    console.log('   ✅ Card stats updated');
    
    // 6. Actualizar stats del usuario
    console.log('\n6️⃣ Updating User Stats:');
    const userStats = {
      totalTransactions: activeTransactions.length,
      totalDeposited: correctStats.money_in,
      totalRefunded: correctStats.refund,
      totalPosted: correctStats.posted,
      totalPending: correctStats.pending,
      totalAvailable: correctStats.available
    };
    
    user.stats = { ...user.stats, ...userStats };
    await user.save();
    console.log('   ✅ User stats updated');
    
    // 7. Verificar stats después de la actualización
    console.log('\n7️⃣ Verification:');
    const updatedCard = await Card.findById(cardId);
    const updatedUser = await User.findById(userId);
    
    console.log('   Updated Card Stats:', JSON.stringify(updatedCard.stats, null, 2));
    console.log('   Updated User Stats:', JSON.stringify(updatedUser.stats, null, 2));
    
    // 8. Verificar que el cálculo es correcto
    console.log('\n8️⃣ Final Verification:');
    const expectedAvailable = correctStats.money_in + correctStats.refund - correctStats.posted - correctStats.pending - correctStats.withdrawal;
    console.log(`   Expected Available: ${expectedAvailable}`);
    console.log(`   Actual Available: ${updatedCard.stats.available}`);
    console.log(`   Match: ${expectedAvailable === updatedCard.stats.available ? '✅' : '❌'}`);
    
    console.log('\n✅ Withdrawal stats fixed successfully!');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

// Ejecutar fix si se llama directamente
if (require.main === module) {
  fixWithdrawalStats()
    .then(() => {
      console.log('\n🏁 Fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fix failed:', error);
      process.exit(1);
    });
}

module.exports = fixWithdrawalStats;
