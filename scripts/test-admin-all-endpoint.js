require('dotenv').config();
const mongoose = require('mongoose');

const NEW_DB_URI = process.env.MONGODB_URI;

const testAdminAllEndpoint = async () => {
  try {
    console.log('🧪 Testing admin/all endpoint structure...');
    
    // Conectar a la DB
    const connection = await mongoose.connect(NEW_DB_URI);
    console.log('✅ Connected to database');
    
    // Conectar a las bases de datos
    const cardsDb = connection.connection.useDb('dev_cards');
    const transactionsDb = connection.connection.useDb('dev_transactions');
    const usersDb = connection.connection.useDb('dev_users');
    
    // Simular la lógica del endpoint admin/all
    console.log('\n📊 Simulating /admin/all endpoint logic...');
    
    // 1. Obtener todas las cards (limitamos a 3 para el test)
    const cards = await cardsDb.collection('cards').find({}).limit(3).toArray();
    console.log(`📦 Found ${cards.length} cards for testing`);
    
    // 2. Obtener usuarios
    const userIds = [...new Set(cards.map(card => card.userId ? card.userId.toString() : null).filter(Boolean))];
    const users = await usersDb.collection('users').find(
      { _id: { $in: userIds } },
      { projection: { _id: 1, username: 1, profile: 1 } }
    ).toArray();
    
    // 3. Crear mapa de usuarios
    const userMap = new Map();
    users.forEach(user => {
      userMap.set(user._id.toString(), user);
    });
    
    // 4. Obtener transacciones para estas cards
    const cardIds = cards.map(card => card._id);
    const allTransactions = await transactionsDb.collection('transactions').find({ 
      cardId: { $in: cardIds },
      isDeleted: { $ne: true },
      status: { $ne: 'DELETED' }
    })
    .sort({ createdAt: -1 })
    .project({
      _id: 1,
      cardId: 1,
      name: 1,
      amount: 1,
      date: 1,
      time: 1,
      status: 1,
      operation: 1,
      createdAt: 1
    }).toArray();
    
    console.log(`💰 Found ${allTransactions.length} total transactions`);
    
    // 5. Agrupar transacciones por cardId (máximo 4 por card)
    const transactionsByCard = new Map();
    allTransactions.forEach(transaction => {
      const cardId = transaction.cardId;
      if (!transactionsByCard.has(cardId)) {
        transactionsByCard.set(cardId, []);
      }
      const cardTransactions = transactionsByCard.get(cardId);
      if (cardTransactions.length < 4) {
        cardTransactions.push(transaction);
      }
    });
    
    // 6. Enriquecer cards
    const enrichedCards = cards.map(card => {
      const userIdString = card.userId ? card.userId.toString() : null;
      const user = userIdString ? userMap.get(userIdString) : null;
      const lastTransactions = transactionsByCard.get(card._id) || [];
      
      return {
        _id: card._id,
        name: card.name,
        last4: card.last4,
        status: card.status,
        deposited: card.deposited || 0,
        refunded: card.refunded || 0,
        posted: card.posted || 0,
        available: card.available || 0,
        userId: card.userId,
        userName: user ? `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || user.username : 'Unknown User',
        supplier: card.supplier || 'Nano',
        limits: card.limits,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
        transactions: lastTransactions // Las últimas 4 transacciones
      };
    });
    
    console.log('\n🔍 TESTING RESULTS:');
    console.log('==================');
    
    enrichedCards.forEach((card, index) => {
      console.log(`\n📄 Card ${index + 1}: ${card.name} (${card.last4})`);
      console.log(`   - deposited: ${card.deposited}`);
      console.log(`   - posted: ${card.posted}`);
      console.log(`   - available: ${card.available}`);
      console.log(`   - transactions: ${card.transactions.length} movements`);
      
      if (card.transactions.length > 0) {
        console.log(`   📊 Latest transactions:`);
        card.transactions.forEach((tx, txIndex) => {
          console.log(`      ${txIndex + 1}. ${tx.name} - $${tx.amount} (${tx.operation})`);
        });
      } else {
        console.log(`   ❌ No transactions found`);
      }
    });
    
    // Verificar que las transacciones estén incluidas
    const hasTransactionsField = enrichedCards.every(card => 
      card.hasOwnProperty('transactions') && Array.isArray(card.transactions)
    );
    
    console.log(`\n✅ VERIFICATION:`);
    console.log(`   hasTransactionsField: ${hasTransactionsField}`);
    console.log(`   ${hasTransactionsField ? '🎉 SUCCESS: All cards now include transactions!' : '❌ FAIL: Transactions field missing'}`);
    
    // Mostrar estructura de ejemplo
    if (enrichedCards.length > 0) {
      console.log(`\n📋 SAMPLE RESPONSE STRUCTURE:`);
      console.log(JSON.stringify(enrichedCards[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
    process.exit(0);
  }
};

// Ejecutar test
if (require.main === module) {
  testAdminAllEndpoint();
}

module.exports = { testAdminAllEndpoint };
