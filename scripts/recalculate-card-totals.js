const { connectDatabases } = require('../config/database');
const { getCardModel } = require('../models/Card');
const { getTransactionModel } = require('../models/Transaction');
const { getUserModel } = require('../models/User');

const recalculateCardTotals = async () => {
  try {
    console.log('🚀 Connecting to databases...');
    await connectDatabases();
    console.log('✅ Connected to databases\n');

    const Card = getCardModel();
    const Transaction = getTransactionModel();
    const User = getUserModel();

    // Obtener todas las tarjetas
    const cards = await Card.find({});
    console.log(`📊 Found ${cards.length} cards to recalculate\n`);

    let updatedCards = 0;
    let updatedUsers = 0;

    for (const card of cards) {
      try {
        console.log(`🔄 Recalculating totals for card: ${card.name} (${card.last4})`);
        
        // Obtener todas las transacciones de esta tarjeta
        const cardTransactions = await Transaction.find({ cardId: card._id });
        
        // Calcular totales
        const totalDeposited = cardTransactions
          .filter(t => t.credit)
          .reduce((sum, t) => sum + t.amount, 0);
        
        const totalPosted = cardTransactions
          .filter(t => !t.credit)
          .reduce((sum, t) => sum + t.amount, 0);
        
        const totalRefunded = cardTransactions
          .filter(t => t.operation === 'TRANSACTION_REFUND')
          .reduce((sum, t) => sum + t.amount, 0);
        
        const totalPending = 0; // Por ahora 0, se puede calcular si hay transacciones pendientes
        const totalAvailable = totalDeposited - totalPosted;

        // Actualizar la tarjeta
        card.deposited = totalDeposited;
        card.refunded = totalRefunded;
        card.posted = totalPosted;
        card.pending = totalPending;
        card.available = totalAvailable;

        await card.save();
        updatedCards++;

        console.log(`   💰 Deposited: $${totalDeposited}`);
        console.log(`   💸 Posted: $${totalPosted}`);
        console.log(`   🔄 Refunded: $${totalRefunded}`);
        console.log(`   💳 Available: $${totalAvailable}`);
        console.log(`   📊 Transactions: ${cardTransactions.length}\n`);

        // Actualizar KPIs del usuario
        try {
          const user = await User.findById(card.userId);
          if (user) {
            // Recalcular KPIs basándose en todas las transacciones del usuario
            const userTransactions = await Transaction.find({ userId: card.userId });
            
            user.stats.totalTransactions = userTransactions.length;
            user.stats.totalDeposited = userTransactions
              .filter(t => t.credit)
              .reduce((sum, t) => sum + t.amount, 0);
            user.stats.totalPosted = userTransactions
              .filter(t => !t.credit)
              .reduce((sum, t) => sum + t.amount, 0);
            user.stats.totalAvailable = user.stats.totalDeposited - user.stats.totalPosted;
            
            await user.save();
            updatedUsers++;
            console.log(`   👤 Updated user KPIs: ${user.username}\n`);
          }
        } catch (userError) {
          console.error(`   ❌ Error updating user ${card.userId}:`, userError.message);
        }

      } catch (cardError) {
        console.error(`❌ Error recalculating card ${card._id}:`, cardError.message);
      }
    }

    console.log('🎉 Card totals recalculation completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Cards updated: ${updatedCards}`);
    console.log(`   - Users updated: ${updatedUsers}`);

  } catch (error) {
    console.error('❌ Error recalculating card totals:', error);
    process.exit(1);
  }
};

// Ejecutar si es llamado directamente
if (require.main === module) {
  recalculateCardTotals();
}

module.exports = { recalculateCardTotals };
