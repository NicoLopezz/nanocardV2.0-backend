require('dotenv').config();

// Forzar entorno de desarrollo
process.env.NODE_ENV = 'development';

const { databases, connectDatabases } = require('../config/database');

async function recalculateCardStats() {
  try {
    console.log('🔄 Connecting to DEV databases...');
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    console.log(`💳 Cards DB: ${process.env.MONGODB_URI}dev_cards`);
    console.log(`💰 Transactions DB: ${process.env.MONGODB_URI}dev_transactions`);
    
    await connectDatabases();
    console.log('✅ Connected to all DEV databases');

    // Registrar esquemas en las conexiones
    const { cardSchema } = require('../models/Card');
    const { transactionSchema } = require('../models/Transaction');
    
    const Card = databases.cards.connection.model('Card', cardSchema);
    const Transaction = databases.transactions.connection.model('Transaction', transactionSchema);

    const cards = await Card.find({});
    console.log(`📊 Found ${cards.length} cards to update`);

    for (const card of cards) {
      try {
        console.log(`\n🔄 Processing card: ${card.name} (${card._id})`);
        
        // Obtener todas las transacciones de la tarjeta
        const allTransactions = await Transaction.find({ cardId: card._id });
        const activeTransactions = allTransactions.filter(tx => !tx.isDeleted && tx.status !== 'DELETED');
        const deletedTransactions = allTransactions.filter(tx => tx.isDeleted || tx.status === 'DELETED');
        
        console.log(`  📈 Total transactions: ${allTransactions.length}`);
        console.log(`  ✅ Active transactions: ${activeTransactions.length}`);
        console.log(`  ❌ Deleted transactions: ${deletedTransactions.length}`);

        // Calcular estadísticas
        let totalDeposited = 0;   // WALLET_DEPOSIT + OVERRIDE_VIRTUAL_BALANCE
        let totalRefunded = 0;    // TRANSACTION_REFUND
        let totalPosted = 0;      // TRANSACTION_APPROVED
        let totalPending = 0;     // TRANSACTION_PENDING
        let totalWithdrawal = 0;  // WITHDRAWAL
        let totalDeletedAmount = 0; // Monto de transacciones eliminadas

        const stats = {
          totalTransactions: activeTransactions.length,
          byOperation: {
            TRANSACTION_APPROVED: 0,
            TRANSACTION_REJECTED: 0,
            TRANSACTION_REVERSED: 0,
            TRANSACTION_REFUND: 0,
            WALLET_DEPOSIT: 0,
            OVERRIDE_VIRTUAL_BALANCE: 0,
            WITHDRAWAL: 0
          },
          byAmount: {
            TRANSACTION_APPROVED: 0,
            TRANSACTION_REJECTED: 0,
            TRANSACTION_REVERSED: 0,
            TRANSACTION_REFUND: 0,
            WALLET_DEPOSIT: 0,
            OVERRIDE_VIRTUAL_BALANCE: 0,
            WITHDRAWAL: 0
          }
        };

        // Calcular estadísticas de transacciones activas
        console.log(`  🔍 Processing ${activeTransactions.length} active transactions:`);
        for (const transaction of activeTransactions) {
          const operation = transaction.operation || 'UNKNOWN';
          console.log(`    - ${operation}: $${transaction.amount} (${transaction.isDeleted ? 'DELETED' : 'ACTIVE'})`);
          
          // Contar por operación
          if (stats.byOperation.hasOwnProperty(operation)) {
            stats.byOperation[operation]++;
            stats.byAmount[operation] += transaction.amount;
          }
          
          // Calcular por tipo específico de operación
          if (operation === 'WALLET_DEPOSIT' || operation === 'OVERRIDE_VIRTUAL_BALANCE') {
            totalDeposited += transaction.amount;
          } else if (operation === 'TRANSACTION_REFUND') {
            totalRefunded += transaction.amount;
          } else if (operation === 'TRANSACTION_APPROVED') {
            totalPosted += transaction.amount;
          } else if (operation === 'TRANSACTION_PENDING') {
            totalPending += transaction.amount;
          } else if (operation === 'WITHDRAWAL') {
            totalWithdrawal += transaction.amount;
          }
        }
        
        // Calcular monto de transacciones eliminadas
        console.log(`  🗑️ Processing ${deletedTransactions.length} deleted transactions:`);
        for (const transaction of deletedTransactions) {
          console.log(`    - ${transaction.operation}: $${transaction.amount} (DELETED)`);
          totalDeletedAmount += transaction.amount;
        }

        // Mostrar cálculos intermedios
        console.log(`  📊 Calculated amounts:`);
        console.log(`    💰 Total Deposited: $${totalDeposited}`);
        console.log(`    💸 Total Withdrawal: $${totalWithdrawal}`);
        console.log(`    💳 Total Posted: $${totalPosted}`);
        console.log(`    ⏳ Total Pending: $${totalPending}`);
        console.log(`    🗑️ Total Deleted Amount: $${totalDeletedAmount}`);

        // Actualizar la tarjeta con las estadísticas calculadas
        const newStats = {
          money_in: totalDeposited,
          refund: totalRefunded,
          posted: totalPosted,
          reversed: stats.byAmount.TRANSACTION_REVERSED,
          rejected: stats.byAmount.TRANSACTION_REJECTED,
          pending: totalPending,
          withdrawal: totalWithdrawal,
          available: totalDeposited + totalRefunded - totalPosted - totalPending - totalWithdrawal,
          total_all_transactions: allTransactions.length,
          total_deleted_transactions: deletedTransactions.length,
          deleted_amount: totalDeletedAmount
        };

        card.stats = newStats;
        card.transactionStats = {
          ...stats,
          lastUpdated: new Date()
        };

        // Mostrar comparación con stats anteriores
        console.log(`  📊 Stats Comparison:`);
        console.log(`     💰 Money in: ${card.stats?.money_in || 0} → ${newStats.money_in} ${(card.stats?.money_in || 0) === newStats.money_in ? '✅' : '🔄'}`);
        console.log(`     💸 Withdrawal: ${card.stats?.withdrawal || 0} → ${newStats.withdrawal} ${(card.stats?.withdrawal || 0) === newStats.withdrawal ? '✅' : '🔄'}`);
        console.log(`     💳 Available: ${card.stats?.available || 0} → ${newStats.available} ${(card.stats?.available || 0) === newStats.available ? '✅' : '🔄'}`);
        console.log(`     🗑️ Deleted: ${card.stats?.total_deleted_transactions || 0} → ${newStats.total_deleted_transactions} ${(card.stats?.total_deleted_transactions || 0) === newStats.total_deleted_transactions ? '✅' : '🔄'}`);

        await card.save();
        
        console.log(`  ✅ Updated stats:`);
        console.log(`     💰 Money in: $${newStats.money_in}`);
        console.log(`     💸 Withdrawal: $${newStats.withdrawal}`);
        console.log(`     💳 Available: $${newStats.available}`);
        console.log(`     🗑️  Deleted: ${newStats.total_deleted_transactions} transactions ($${newStats.deleted_amount})`);
        
      } catch (cardError) {
        console.log(`  ❌ Error updating card ${card.name}: ${cardError.message}`);
        console.log(`     Skipping this card and continuing...`);
      }
    }

    console.log('\n🎉 All card statistics updated successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

recalculateCardStats();
