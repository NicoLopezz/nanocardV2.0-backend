require('dotenv').config();
const mongoose = require('mongoose');

const NEW_DB_URI = process.env.MONGODB_URI;

const checkExistingCards = async () => {
  try {
    console.log('🔍 Checking existing cards in database...');
    
    // Conectar a la DB nueva
    const newConnection = await mongoose.connect(NEW_DB_URI);
    console.log('✅ Connected to new database');
    
    // Conectar a las nuevas bases de datos
    const newCardsDb = newConnection.connection.useDb('dev_cards');
    
    console.log('\n📊 EXISTING CARDS:');
    console.log('='.repeat(50));
    
    const cards = await newCardsDb.collection('cards').find({}).toArray();
    
    console.log(`📋 Found ${cards.length} cards:`);
    cards.forEach((card, index) => {
      console.log(`${index + 1}. ${card.name}`);
      console.log(`   - ID: ${card._id}`);
      console.log(`   - Supplier: ${card.supplier}`);
      console.log(`   - Last4: ${card.last4}`);
      console.log(`   - Deposited: $${card.deposited || 0}`);
      console.log(`   - Posted: $${card.posted || 0}`);
      console.log(`   - Pending: $${card.pending || 0}`);
      console.log(`   - Available: $${card.available || 0}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Check error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from databases');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  checkExistingCards();
}

module.exports = { checkExistingCards };
