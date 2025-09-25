require('dotenv').config();
const mongoose = require('mongoose');

const verifyMigration = async () => {
  try {
    console.log('🔍 Verifying migration results...');
    
    // Conectar a la DB nueva
    const connection = await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to new database');
    
    // Conectar a las bases de datos de desarrollo
    const usersDb = connection.connection.useDb('dev_users');
    const cardsDb = connection.connection.useDb('dev_cards');
    const transactionsDb = connection.connection.useDb('dev_transactions');
    const historyDb = connection.connection.useDb('dev_history');
    
    console.log('\n📊 VERIFICATION RESULTS:');
    console.log('='.repeat(50));
    
    // Buscar usuario por Card_id
    const cardId = '95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo';
    const card = await cardsDb.collection('cards').findOne({ _id: cardId });
    
    if (card) {
      console.log(`\n💳 CARD FOUND:`);
      console.log(`   - Card ID: ${card._id}`);
      console.log(`   - User ID: ${card.userId}`);
      console.log(`   - Name: ${card.name}`);
      console.log(`   - Last4: ${card.last4}`);
      console.log(`   - Email: ${card.meta?.email}`);
      console.log(`   - Expiration: ${card.expiration}`);
      console.log(`   - Phone: ${card.phoneNumber}`);
      
      // Buscar usuario por userId
      const userId = card.userId;
      const user = await usersDb.collection('users').findOne({ _id: userId });
      
      if (user) {
        console.log(`\n👤 USER FOUND:`);
        console.log(`   - User ID: ${user._id}`);
        console.log(`   - Username: ${user.username}`);
        console.log(`   - Email: ${user.email}`);
        console.log(`   - Name: ${user.profile.firstName} ${user.profile.lastName}`);
        console.log(`   - Stats:`, user.stats);
        
        // Buscar transacciones
        const transactions = await transactionsDb.collection('transactions').find({ 
          $or: [
            { userId: userId },
            { cardId: cardId }
          ]
        }).toArray();
        
        console.log(`\n💰 TRANSACTIONS FOUND: ${transactions.length}`);
        transactions.forEach((t, i) => {
          console.log(`   ${i+1}. ${t.name} - $${t.amount} (${t.operation}) - ${t.date} ${t.time}`);
          if (t.isDeleted) {
            console.log(`      🗑️ DELETED: ${t.isDeleted}`);
          }
        });
        
        // Buscar historial
        const history = await historyDb.collection('histories').find({ 
          $or: [
            { userId: userId },
            { cardId: cardId }
          ]
        }).toArray();
        
        console.log(`\n📚 HISTORY FOUND: ${history.length}`);
        history.forEach((h, i) => {
          console.log(`   ${i+1}. ${h.action} - ${h.timestamp}`);
        });
        
        // Comparar con datos originales
        console.log(`\n📊 COMPARISON WITH ORIGINAL:`);
        console.log(`   - Original Name: "corinna schwager endres"`);
        console.log(`   - Migrated Name: "${card.name}"`);
        console.log(`   - Original Last4: "3111"`);
        console.log(`   - Migrated Last4: "${card.last4}"`);
        console.log(`   - Original Email: "cards@ufly.club"`);
        console.log(`   - Migrated Email: "${card.meta?.email}"`);
        console.log(`   - Original Monthly Limit: 750`);
        console.log(`   - Migrated Monthly Limit: ${card.limits?.monthly}`);
        
        console.log(`\n✅ MIGRATION VERIFICATION COMPLETE!`);
        
      } else {
        console.log(`❌ User not found with ID: ${userId}`);
      }
    } else {
      console.log(`❌ Card not found with ID: ${cardId}`);
    }
    
  } catch (error) {
    console.error('❌ Verification error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  verifyMigration();
}

module.exports = { verifyMigration };
