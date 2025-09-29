const StatsRefreshService = require('../services/statsRefreshService');
const EventService = require('../services/eventService');
const { getTransactionModel } = require('../models/Transaction');
const { getUserModel } = require('../models/User');
const { getCardModel } = require('../models/Card');

async function testStatsMicroservice() {
  try {
    console.log('🧪 Testing Stats Microservice...\n');
    
    // Inicializar sistema de eventos
    EventService.initialize();
    
    // Ejemplo 1: Refrescar stats de un usuario específico
    console.log('1️⃣ Testing user stats refresh...');
    const User = getUserModel();
    const users = await User.find({}).limit(1);
    
    if (users.length > 0) {
      const userId = users[0]._id;
      console.log(`   User ID: ${userId}`);
      
      // Recalcular stats del usuario
      await StatsRefreshService.recalculateUserStats(userId);
      console.log('   ✅ User stats recalculated');
      
      // Refrescar stats de todas las tarjetas del usuario
      const result = await StatsRefreshService.recalculateUserCardsStats(userId);
      console.log(`   ✅ User cards stats recalculated: ${result.processed} cards processed`);
    }
    
    // Ejemplo 2: Refrescar stats de una tarjeta específica
    console.log('\n2️⃣ Testing card stats refresh...');
    const Card = getCardModel();
    const cards = await Card.find({}).limit(1);
    
    if (cards.length > 0) {
      const cardId = cards[0]._id;
      console.log(`   Card ID: ${cardId}`);
      
      // Refrescar stats de la tarjeta
      await StatsRefreshService.refreshCardStats(cardId);
      console.log('   ✅ Card stats refreshed');
      
      // Recalcular stats de la tarjeta
      await StatsRefreshService.recalculateCardStats(cardId);
      console.log('   ✅ Card stats recalculated');
    }
    
    // Ejemplo 3: Simular evento de transacción
    console.log('\n3️⃣ Testing transaction events...');
    const Transaction = getTransactionModel();
    const transactions = await Transaction.find({ isDeleted: { $ne: true } }).limit(1);
    
    if (transactions.length > 0) {
      const transaction = transactions[0];
      console.log(`   Transaction ID: ${transaction._id}`);
      
      // Simular eventos
      EventService.emitTransactionCreated(
        transaction.userId, 
        transaction.cardId, 
        transaction
      );
      console.log('   ✅ Transaction created event emitted');
      
      EventService.emitTransactionUpdated(
        transaction.userId, 
        transaction.cardId, 
        transaction
      );
      console.log('   ✅ Transaction updated event emitted');
    }
    
    // Ejemplo 4: Batch operations
    console.log('\n4️⃣ Testing batch operations...');
    const allUsers = await User.find({}).limit(3);
    const allCards = await Card.find({}).limit(3);
    
    if (allUsers.length > 0) {
      const userIds = allUsers.map(u => u._id);
      console.log(`   Batch refreshing ${userIds.length} users...`);
      
      // Simular batch refresh (en producción usarías las rutas API)
      for (const userId of userIds) {
        try {
          await StatsRefreshService.recalculateUserStats(userId);
          console.log(`   ✅ User ${userId} stats refreshed`);
        } catch (error) {
          console.log(`   ❌ Error refreshing user ${userId}: ${error.message}`);
        }
      }
    }
    
    console.log('\n✅ Stats Microservice test completed successfully!');
    console.log('\n📋 Available API endpoints:');
    console.log('   POST /api/stats/users/:userId/refresh');
    console.log('   POST /api/stats/cards/:cardId/refresh');
    console.log('   POST /api/stats/users/:userId/recalculate');
    console.log('   POST /api/stats/cards/:cardId/recalculate');
    console.log('   GET  /api/stats/cards/:cardId');
    console.log('   POST /api/stats/users/batch/refresh');
    console.log('   POST /api/stats/cards/batch/refresh');
    
  } catch (error) {
    console.error('❌ Error testing stats microservice:', error);
  }
}

// Ejecutar test si se llama directamente
if (require.main === module) {
  testStatsMicroservice()
    .then(() => {
      console.log('\n🏁 Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = testStatsMicroservice;
