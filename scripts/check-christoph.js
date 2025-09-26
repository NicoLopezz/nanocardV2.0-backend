const mongoose = require('mongoose');
const config = require('../config/environment');

async function checkChristoph() {
  try {
    console.log('🔍 Checking Christoph Schwager in database...');
    
    // Connect to development database
    const mongoUri = config.MONGODB_DEV_URI.replace('dev_users', 'dev_cards');
    console.log('🔗 Connecting to:', mongoUri);
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database');
    
    // Define card schema
    const cardSchema = new mongoose.Schema({
      _id: String,
      name: String,
      card_id: String,
      supplier: String,
      last_4: String,
      // Add other fields as needed
    }, { collection: 'cards' });
    
    const Card = mongoose.model('Card', cardSchema);
    
    // Search for Christoph by name
    const christoph = await Card.findOne({ name: /Christoph/i });
    console.log('👤 Christoph found:', christoph);
    
    // Search by card ID
    const byCardId = await Card.findOne({ _id: 'Qc4iMvkIQBfphcgCwJCFxQEF38Br1x0J' });
    console.log('💳 Card by ID:', byCardId);
    
    // List all cards to see what we have
    const allCards = await Card.find({}).limit(10);
    console.log('📋 First 10 cards:');
    allCards.forEach(card => {
      console.log(`  - ${card.name} (${card._id})`);
    });
    
    await mongoose.disconnect();
    console.log('✅ Disconnected');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkChristoph();
