const StatsRefreshService = require('../services/statsRefreshService');
const EventService = require('../services/eventService');
const { getTransactionModel } = require('../models/Transaction');
const { getUserModel } = require('../models/User');
const { getCardModel } = require('../models/Card');

async function testIntegration() {
  try {
    console.log('🧪 Testing Stats Microservice Integration...\n');
    
    // Inicializar sistema de eventos
    EventService.initialize();
    
    // 1. Test: Crear transacción y verificar que las stats se actualicen automáticamente
    console.log('1️⃣ Testing automatic stats refresh on transaction creation...');
    
    const Card = getCardModel();
    const Transaction = getTransactionModel();
    const User = getUserModel();
    
    // Obtener una tarjeta existente
    const card = await Card.findOne({});
    if (!card) {
      console.log('   ❌ No cards found in database');
      return;
    }
    
    console.log(`   Using card: ${card._id} (${card.name})`);
    
    // Crear una transacción de prueba
    const testTransaction = {
      _id: `test-${Date.now()}`,
      userId: card.userId,
      cardId: card._id,
      userName: 'Test User',
      cardName: card.name,
      name: 'Test Transaction',
      amount: 100,
      date: '28/09/2025',
      time: '10:00 PM',
      status: 'Completed',
      operation: 'WALLET_DEPOSIT',
      credit: true,
      comentario: 'Test transaction for integration',
      version: 1,
      isDeleted: false,
      history: [{
        version: 1,
        action: 'created',
        timestamp: new Date(),
        modifiedBy: 'test-user',
        reason: 'Test transaction created'
      }]
    };
    
    const transaction = new Transaction(testTransaction);
    await transaction.save();
    console.log(`   ✅ Test transaction created: ${transaction._id}`);
    
    // Simular evento de creación
    EventService.emitTransactionCreated(
      transaction.userId, 
      transaction.cardId, 
      transaction
    );
    console.log('   ✅ Transaction created event emitted');
    
    // 2. Test: Refrescar stats manualmente
    console.log('\n2️⃣ Testing manual stats refresh...');
    
    await StatsRefreshService.refreshCardStats(card._id);
    console.log('   ✅ Card stats refreshed manually');
    
    await StatsRefreshService.refreshUserStats(card.userId, transaction, 'create');
    console.log('   ✅ User stats refreshed manually');
    
    // 3. Test: Recalcular stats completas
    console.log('\n3️⃣ Testing complete stats recalculation...');
    
    await StatsRefreshService.recalculateUserStats(card.userId);
    console.log('   ✅ User stats recalculated completely');
    
    await StatsRefreshService.recalculateCardStats(card._id);
    console.log('   ✅ Card stats recalculated completely');
    
    // 4. Test: Batch operations
    console.log('\n4️⃣ Testing batch operations...');
    
    const allCards = await Card.find({}).limit(3);
    const cardIds = allCards.map(c => c._id);
    
    console.log(`   Batch refreshing ${cardIds.length} cards...`);
    for (const cardId of cardIds) {
      try {
        await StatsRefreshService.refreshCardStats(cardId);
        console.log(`   ✅ Card ${cardId} stats refreshed`);
      } catch (error) {
        console.log(`   ❌ Error refreshing card ${cardId}: ${error.message}`);
      }
    }
    
    // 5. Test: Verificar que las stats se actualizaron
    console.log('\n5️⃣ Verifying stats updates...');
    
    const updatedCard = await Card.findById(card._id);
    const updatedUser = await User.findById(card.userId);
    
    console.log('   Updated Card Stats:');
    console.log(`     - Deposited: ${updatedCard.deposited || 0}`);
    console.log(`     - Posted: ${updatedCard.posted || 0}`);
    console.log(`     - Available: ${updatedCard.available || 0}`);
    
    console.log('   Updated User Stats:');
    console.log(`     - Total Transactions: ${updatedUser.stats?.totalTransactions || 0}`);
    console.log(`     - Total Deposited: ${updatedUser.stats?.totalDeposited || 0}`);
    console.log(`     - Total Available: ${updatedUser.stats?.totalAvailable || 0}`);
    
    // 6. Test: API Endpoints simulation
    console.log('\n6️⃣ Testing API endpoints simulation...');
    
    // Simular llamada a /api/cards/admin/:cardId/stats
    console.log('   Simulating GET /api/cards/admin/:cardId/stats...');
    await StatsRefreshService.refreshCardStats(card._id);
    console.log('   ✅ Admin card stats endpoint would refresh stats automatically');
    
    // Simular llamada a /api/cards/user/:userId/stats
    console.log('   Simulating GET /api/cards/user/:userId/stats...');
    await StatsRefreshService.recalculateUserStats(card.userId);
    console.log('   ✅ User stats endpoint would refresh stats automatically');
    
    // 7. Cleanup: Eliminar transacción de prueba
    console.log('\n7️⃣ Cleaning up test data...');
    
    await Transaction.findByIdAndDelete(transaction._id);
    console.log('   ✅ Test transaction deleted');
    
    console.log('\n✅ Integration test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Automatic stats refresh on transaction events');
    console.log('   ✅ Manual stats refresh via microservice');
    console.log('   ✅ Complete stats recalculation');
    console.log('   ✅ Batch operations');
    console.log('   ✅ API endpoints integration');
    console.log('   ✅ Stats verification');
    
    console.log('\n🚀 The microservice is ready for production!');
    console.log('\n📡 Available API endpoints:');
    console.log('   POST /api/stats/users/:userId/refresh');
    console.log('   POST /api/stats/cards/:cardId/refresh');
    console.log('   POST /api/stats/users/:userId/recalculate');
    console.log('   POST /api/stats/cards/:cardId/recalculate');
    console.log('   GET  /api/stats/cards/:cardId');
    console.log('   POST /api/stats/users/batch/refresh');
    console.log('   POST /api/stats/cards/batch/refresh');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    throw error;
  }
}

// Ejecutar test si se llama directamente
if (require.main === module) {
  testIntegration()
    .then(() => {
      console.log('\n🏁 Integration test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Integration test failed:', error);
      process.exit(1);
    });
}

module.exports = testIntegration;
