require('dotenv').config();
const mongoose = require('mongoose');

const NEW_DB_URI = process.env.MONGODB_URI;

const testCardModel = async () => {
  try {
    console.log('🔍 Testing Card model functionality...');
    
    // Conectar a la DB nueva
    const newConnection = await mongoose.connect(NEW_DB_URI);
    console.log('✅ Connected to new database');
    
    // Probar la función getCardModel
    const { getCardModel } = require('../models/Card');
    const Card = getCardModel();
    
    console.log('✅ Card model loaded successfully');
    
    // Probar búsqueda por ID
    const cardId = 'Qc4iMvkIQBfphcgCwJCFxQEF38Br1x0J';
    console.log(`🔍 Searching for card: ${cardId}`);
    
    const card = await Card.findById(cardId);
    
    if (card) {
      console.log('✅ Card found:');
      console.log(`   - Name: ${card.name}`);
      console.log(`   - ID: ${card._id}`);
      console.log(`   - Supplier: ${card.supplier}`);
      console.log(`   - Last4: ${card.last4}`);
    } else {
      console.log('❌ Card not found');
      
      // Probar búsqueda directa en la colección
      console.log('🔍 Trying direct collection search...');
      const newCardsDb = newConnection.connection.useDb('dev_cards');
      const directCard = await newCardsDb.collection('cards').findOne({ _id: cardId });
      
      if (directCard) {
        console.log('✅ Card found via direct collection search:');
        console.log(`   - Name: ${directCard.name}`);
        console.log(`   - ID: ${directCard._id}`);
      } else {
        console.log('❌ Card not found even via direct collection search');
      }
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from databases');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  testCardModel();
}

module.exports = { testCardModel };
