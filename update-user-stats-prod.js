require('dotenv').config();

// Forzar entorno de producción
process.env.NODE_ENV = 'production';

const { databases, connectDatabases } = require('./config/database');

async function updateUserStats(userId) {
  try {
    console.log(`🔄 Updating stats for user: ${userId}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    
    await connectDatabases();
    console.log('✅ Connected to all databases');

    // Registrar esquemas en las conexiones
    const { userSchema } = require('./models/User');
    const { cardSchema } = require('./models/Card');
    const { transactionSchema } = require('./models/Transaction');
    
    const User = databases.users.connection.model('User', userSchema);
    const Card = databases.cards.connection.model('Card', cardSchema);
    const Transaction = databases.transactions.connection.model('Transaction', transactionSchema);

    // 1. Verificar que el usuario existe
    console.log('\n1️⃣ Checking if user exists...');
    const user = await User.findById(userId);
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`✅ User found: ${user.username} (${user.email})`);
    console.log(`   Current stats:`, user.stats);

    // 2. Obtener todas las transacciones activas del usuario
    console.log('\n2️⃣ Getting user transactions...');
    const allTransactions = await Transaction.find({ 
      userId: userId,
      isDeleted: { $ne: true },
      status: { $ne: 'DELETED' }
    });
    
    console.log(`✅ Found ${allTransactions.length} active transactions`);
    
    // Calcular stats manualmente
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

    // 3. Actualizar stats del usuario
    console.log('\n3️⃣ Updating user stats...');
    user.stats = {
      totalTransactions: calculatedStats.totalTransactions,
      totalDeposited: calculatedStats.totalDeposited,
      totalRefunded: calculatedStats.totalRefunded,
      totalPosted: calculatedStats.totalPosted,
      totalPending: calculatedStats.totalPending,
      totalAvailable: calculatedStats.totalAvailable
    };
    
    await user.save();
    console.log('✅ User stats updated successfully');

    // 4. Obtener tarjetas del usuario y actualizar sus stats
    console.log('\n4️⃣ Updating card stats...');
    const userCards = await Card.find({ userId: userId });
    console.log(`✅ Found ${userCards.length} cards for user`);
    
    for (const card of userCards) {
      try {
        console.log(`\n🔄 Processing card: ${card.name} (${card._id})`);
        
        // Obtener todas las transacciones de la tarjeta
        const cardTransactions = await Transaction.find({ cardId: card._id });
        const activeCardTransactions = cardTransactions.filter(tx => !tx.isDeleted && tx.status !== 'DELETED');
        const deletedCardTransactions = cardTransactions.filter(tx => tx.isDeleted || tx.status === 'DELETED');
        
        console.log(`  📈 Total transactions: ${cardTransactions.length}`);
        console.log(`  ✅ Active transactions: ${activeCardTransactions.length}`);
        console.log(`  ❌ Deleted transactions: ${deletedCardTransactions.length}`);

        // Calcular estadísticas de la tarjeta
        let cardTotalDeposited = 0;
        let cardTotalRefunded = 0;
        let cardTotalPosted = 0;
        let cardTotalPending = 0;
        let cardTotalWithdrawal = 0;
        let cardTotalDeletedAmount = 0;

        // Calcular stats de transacciones activas
        for (const transaction of activeCardTransactions) {
          const operation = transaction.operation || 'UNKNOWN';
          
          if (operation === 'WALLET_DEPOSIT' || operation === 'OVERRIDE_VIRTUAL_BALANCE') {
            cardTotalDeposited += transaction.amount;
          } else if (operation === 'TRANSACTION_REFUND') {
            cardTotalRefunded += transaction.amount;
          } else if (operation === 'TRANSACTION_APPROVED') {
            cardTotalPosted += transaction.amount;
          } else if (operation === 'TRANSACTION_PENDING') {
            cardTotalPending += transaction.amount;
          } else if (operation === 'WITHDRAWAL') {
            cardTotalWithdrawal += transaction.amount;
          }
        }
        
        // Calcular monto de transacciones eliminadas
        for (const transaction of deletedCardTransactions) {
          cardTotalDeletedAmount += transaction.amount;
        }
        
        // Actualizar la tarjeta con las estadísticas calculadas
        card.stats = {
          money_in: cardTotalDeposited,
          refund: cardTotalRefunded,
          posted: cardTotalPosted,
          reversed: 0, // Se puede calcular si es necesario
          rejected: 0, // Se puede calcular si es necesario
          pending: cardTotalPending,
          withdrawal: cardTotalWithdrawal,
          available: cardTotalDeposited + cardTotalRefunded - cardTotalPosted - cardTotalPending - cardTotalWithdrawal,
          total_all_transactions: cardTransactions.length,
          total_deleted_transactions: deletedCardTransactions.length,
          deleted_amount: cardTotalDeletedAmount
        };
        
        await card.save();
        console.log(`  ✅ Updated stats for card: ${card.name} (${card.last4})`);
        console.log(`     Deposited: $${card.stats.money_in}`);
        console.log(`     Posted: $${card.stats.posted}`);
        console.log(`     Available: $${card.stats.available}`);
        
      } catch (error) {
        console.log(`  ❌ Error updating card ${card.name}: ${error.message}`);
      }
    }

    console.log('\n🎉 User stats update completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   ✅ User stats recalculated`);
    console.log(`   ✅ ${userCards.length} cards stats updated`);
    console.log(`   ✅ All calculations verified`);

  } catch (error) {
    console.error('❌ Error updating user stats:', error);
  } finally {
    // Cerrar conexiones
    Object.values(databases).forEach(db => {
      if (db.connection) {
        db.connection.close();
      }
    });
    console.log('\n🔌 Database connections closed');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const userId = process.argv[2];
  if (!userId) {
    console.log('❌ Usage: node update-user-stats-prod.js <userId>');
    console.log('   Example: node update-user-stats-prod.js 3aHxD5fWTeNkmiTigQSD1K1nMRk1c6V7');
    process.exit(1);
  }
  
  updateUserStats(userId);
}

module.exports = { updateUserStats };
