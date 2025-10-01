require('dotenv').config();

// Forzar entorno de desarrollo
process.env.NODE_ENV = 'development';

const { connectDatabases } = require('./config/database');
const { getCardModel } = require('./models/Card');
const { getTransactionModel } = require('./models/Transaction');

async function debugStatsIssue() {
  try {
    console.log('🔄 Connecting to DEV databases...');
    await connectDatabases();
    console.log('✅ Connected to all DEV databases');

    const Card = getCardModel();
    const Transaction = getTransactionModel();
    const cardId = 'HREu8JkLnYQrpxe5ZlqvFvw95mkzTC7T';

    console.log(`\n🔍 Debugging stats issue for card: ${cardId}`);

    // 1. Obtener la tarjeta con stats
    const card = await Card.findById(cardId).select('+stats');
    console.log('\n📊 Card Stats from DB:');
    console.log('  money_in:', card.stats?.money_in || 0);
    console.log('  withdrawal:', card.stats?.withdrawal || 0);
    console.log('  available:', card.stats?.available || 0);
    console.log('  total_all_transactions:', card.stats?.total_all_transactions || 0);

    // 2. Obtener TODAS las transacciones (activas y eliminadas)
    const allTransactions = await Transaction.find({ cardId: cardId });
    console.log(`\n📈 Total transactions in DB: ${allTransactions.length}`);

    const activeTransactions = allTransactions.filter(tx => !tx.isDeleted && tx.status !== 'DELETED');
    const deletedTransactions = allTransactions.filter(tx => tx.isDeleted || tx.status === 'DELETED');

    console.log(`📊 Active transactions: ${activeTransactions.length}`);
    console.log(`🗑️ Deleted transactions: ${deletedTransactions.length}`);

    // 3. Calcular stats manualmente desde transacciones ACTIVAS
    let totalDeposited = 0;
    let totalWithdrawal = 0;
    let totalRefunded = 0;
    let totalPosted = 0;
    let totalPending = 0;
    let totalReversed = 0;
    let totalRejected = 0;

    console.log('\n🔍 Processing ACTIVE transactions:');
    for (const tx of activeTransactions) {
      const operation = tx.operation || 'UNKNOWN';
      console.log(`  - ${operation}: $${tx.amount} (${tx.isDeleted ? 'DELETED' : 'ACTIVE'})`);
      
      switch (operation) {
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
        case 'TRANSACTION_REVERSED':
          totalReversed += tx.amount;
          break;
        case 'TRANSACTION_REJECTED':
          totalRejected += tx.amount;
          break;
      }
    }

    const calculatedAvailable = totalDeposited + totalRefunded - totalPosted - totalPending - totalWithdrawal;

    console.log('\n📊 Calculated Stats from ACTIVE transactions:');
    console.log('  money_in:', totalDeposited);
    console.log('  refund:', totalRefunded);
    console.log('  posted:', totalPosted);
    console.log('  pending:', totalPending);
    console.log('  withdrawal:', totalWithdrawal);
    console.log('  reversed:', totalReversed);
    console.log('  rejected:', totalRejected);
    console.log('  available:', calculatedAvailable);

    console.log('\n🔍 Comparison:');
    console.log('  money_in:', card.stats?.money_in || 0, '→', totalDeposited, card.stats?.money_in === totalDeposited ? '✅' : '❌');
    console.log('  withdrawal:', card.stats?.withdrawal || 0, '→', totalWithdrawal, card.stats?.withdrawal === totalWithdrawal ? '✅' : '❌');
    console.log('  available:', card.stats?.available || 0, '→', calculatedAvailable, card.stats?.available === calculatedAvailable ? '✅' : '❌');

    // 4. Verificar transacciones eliminadas
    console.log('\n🗑️ DELETED transactions:');
    for (const tx of deletedTransactions) {
      console.log(`  - ${tx.operation}: $${tx.amount} (DELETED at ${tx.deletedAt})`);
    }

    // 5. Verificar si hay transacciones que no se están contando
    const allWithdrawals = allTransactions.filter(tx => tx.operation === 'WITHDRAWAL');
    console.log(`\n💰 All WITHDRAWAL transactions: ${allWithdrawals.length}`);
    for (const tx of allWithdrawals) {
      console.log(`  - ${tx.operation}: $${tx.amount} (${tx.isDeleted ? 'DELETED' : 'ACTIVE'}) - ${tx.status}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugStatsIssue();
