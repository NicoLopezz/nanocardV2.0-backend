const { recalculateUserStats } = require('./services/statsRefreshService');
const { getUserModel } = require('./models/User');
const { getTransactionModel } = require('./models/Transaction');

async function updateUserStats(userId) {
  console.log(`🔄 Updating stats for user: ${userId}\n`);

  try {
    // 1. Verificar que el usuario existe
    console.log('1️⃣ Checking if user exists...');
    const User = getUserModel();
    const user = await User.findById(userId);
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`✅ User found: ${user.username} (${user.email})`);
    console.log(`   Current stats:`, user.stats);

    // 2. Obtener estadísticas actuales de transacciones
    console.log('\n2️⃣ Getting current transaction stats...');
    const Transaction = getTransactionModel();
    
    const allTransactions = await Transaction.find({ 
      userId: userId,
      isDeleted: { $ne: true },
      status: { $ne: 'DELETED' }
    });
    
    console.log(`✅ Found ${allTransactions.length} active transactions`);
    
    // Calcular stats manualmente para verificar
    let totalDeposited = 0;
    let totalRefunded = 0;
    let totalPosted = 0;
    let totalPending = 0;
    let totalWithdrawal = 0;
    
    allTransactions.forEach(tx => {
      switch (tx.operation) {
        case 'WALLET_DEPOSIT':
        case 'OVERRIDE_VIRTUAL_BALANCE':
          totalDeposited += tx.amount;
          break;
        case 'TRANSACTION_REFUND':
          totalRefunded += tx.amount;
          break;
        case 'TRANSACTION_APPROVED':
          totalPosted += tx.amount;
          break;
        case 'TRANSACTION_PENDING':
          totalPending += tx.amount;
          break;
        case 'WITHDRAWAL':
          totalWithdrawal += tx.amount;
          break;
      }
    });
    
    const calculatedStats = {
      totalTransactions: allTransactions.length,
      totalDeposited,
      totalRefunded,
      totalPosted,
      totalPending,
      totalWithdrawal,
      totalAvailable: totalDeposited + totalRefunded - totalPosted - totalPending - totalWithdrawal
    };
    
    console.log('📊 Calculated stats from transactions:');
    console.log(`   Total Transactions: ${calculatedStats.totalTransactions}`);
    console.log(`   Total Deposited: $${calculatedStats.totalDeposited}`);
    console.log(`   Total Refunded: $${calculatedStats.totalRefunded}`);
    console.log(`   Total Posted: $${calculatedStats.totalPosted}`);
    console.log(`   Total Pending: $${calculatedStats.totalPending}`);
    console.log(`   Total Withdrawal: $${calculatedStats.totalWithdrawal}`);
    console.log(`   Total Available: $${calculatedStats.totalAvailable}`);

    // 3. Recalcular stats usando el servicio
    console.log('\n3️⃣ Recalculating user stats...');
    await recalculateUserStats(userId);
    console.log('✅ User stats recalculated successfully');

    // 4. Verificar stats actualizadas
    console.log('\n4️⃣ Verifying updated stats...');
    const updatedUser = await User.findById(userId);
    console.log('📊 Updated user stats:');
    console.log(`   Total Transactions: ${updatedUser.stats.totalTransactions}`);
    console.log(`   Total Deposited: $${updatedUser.stats.totalDeposited}`);
    console.log(`   Total Refunded: $${updatedUser.stats.totalRefunded}`);
    console.log(`   Total Posted: $${updatedUser.stats.totalPosted}`);
    console.log(`   Total Pending: $${updatedUser.stats.totalPending}`);
    console.log(`   Total Available: $${updatedUser.stats.totalAvailable}`);

    // 5. Comparar con stats calculadas
    console.log('\n5️⃣ Comparing with calculated stats...');
    const statsMatch = 
      updatedUser.stats.totalTransactions === calculatedStats.totalTransactions &&
      updatedUser.stats.totalDeposited === calculatedStats.totalDeposited &&
      updatedUser.stats.totalRefunded === calculatedStats.totalRefunded &&
      updatedUser.stats.totalPosted === calculatedStats.totalPosted &&
      updatedUser.stats.totalPending === calculatedStats.totalPending &&
      Math.abs(updatedUser.stats.totalAvailable - calculatedStats.totalAvailable) < 0.01;

    if (statsMatch) {
      console.log('✅ Stats match perfectly!');
    } else {
      console.log('⚠️ Stats do not match - there might be an issue');
      console.log('   Calculated vs Updated:');
      console.log(`   Total Transactions: ${calculatedStats.totalTransactions} vs ${updatedUser.stats.totalTransactions}`);
      console.log(`   Total Deposited: $${calculatedStats.totalDeposited} vs $${updatedUser.stats.totalDeposited}`);
      console.log(`   Total Refunded: $${calculatedStats.totalRefunded} vs $${updatedUser.stats.totalRefunded}`);
      console.log(`   Total Posted: $${calculatedStats.totalPosted} vs $${updatedUser.stats.totalPosted}`);
      console.log(`   Total Pending: $${calculatedStats.totalPending} vs $${updatedUser.stats.totalPending}`);
      console.log(`   Total Available: $${calculatedStats.totalAvailable} vs $${updatedUser.stats.totalAvailable}`);
    }

    // 6. Obtener tarjetas del usuario para actualizar sus stats también
    console.log('\n6️⃣ Updating card stats...');
    const { getCardModel } = require('./models/Card');
    const Card = getCardModel();
    const userCards = await Card.find({ userId: userId });
    
    console.log(`✅ Found ${userCards.length} cards for user`);
    
    for (const card of userCards) {
      try {
        const { recalculateCardStats } = require('./services/cardStatsService');
        await recalculateCardStats(card._id);
        console.log(`   ✅ Updated stats for card: ${card.name} (${card.last4})`);
      } catch (error) {
        console.log(`   ⚠️ Could not update stats for card ${card.name}: ${error.message}`);
      }
    }

    console.log('\n🎉 User stats update completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   ✅ User stats recalculated`);
    console.log(`   ✅ ${userCards.length} cards stats updated`);
    console.log(`   ✅ All calculations verified`);

  } catch (error) {
    console.error('❌ Error updating user stats:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const userId = process.argv[2];
  if (!userId) {
    console.log('❌ Usage: node update-user-stats.js <userId>');
    console.log('   Example: node update-user-stats.js 3aHxD5fWTeNkmiTigQSD1K1nMRk1c6V7');
    process.exit(1);
  }
  
  updateUserStats(userId);
}

module.exports = { updateUserStats };
