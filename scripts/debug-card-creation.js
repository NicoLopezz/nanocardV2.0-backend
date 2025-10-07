const mongoose = require('mongoose');
const { connectDatabases, getCardsConnection } = require('../config/database');
const { cardSchema } = require('../models/Card');

const config = require('../config/environment');

async function debugCardCreation() {
  try {
    console.log('🔍 Debugging card creation logic...');
    
    await connectDatabases();
    
    const cardsConnection = getCardsConnection();
    
    await new Promise((resolve) => {
      if (cardsConnection.readyState === 1) {
        resolve();
      } else {
        const checkConnections = () => {
          if (cardsConnection.readyState === 1) {
            resolve();
          } else {
            setTimeout(checkConnections, 100);
          }
        };
        checkConnections();
      }
    });
    
    const Card = cardsConnection.model('Card', cardSchema);
    
    const cardId = '3tgy8OArdOY4q0BWWfDy91IPP9ZNxzrT';
    
    // Simular la lógica del endpoint
    console.log('🔍 Simulating endpoint logic...');
    
    // 1. Obtener cards existentes
    const existingCards = await Card.find({}, '_id').lean();
    const existingCardIds = new Set(existingCards.map(c => c._id));
    
    console.log(`📊 Existing cards: ${existingCards.length}`);
    console.log(`🔍 Card ${cardId} exists: ${existingCardIds.has(cardId)}`);
    
    if (!existingCardIds.has(cardId)) {
      console.log('✅ Card should be created (not in existing cards)');
      
      // Simular la creación de la card
      const nanoCard = {
        _id: cardId,
        userId: cardId,
        name: 'Nicolas Beguiristain',
        supplier: 'cryptomate',
        last4: '6498',
        type: 'Virtual',
        status: 'ACTIVE',
        limits: {
          daily: null,
          weekly: null,
          monthly: 8000,
          perTransaction: null
        },
        stats: {
          money_in: 0,
          refund: 0,
          posted: 0,
          reversed: 0,
          rejected: 0,
          pending: 0,
          available: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log('🚀 Creating card...');
      const newCard = new Card(nanoCard);
      await newCard.save();
      console.log('✅ Card created successfully!');
      
    } else {
      console.log('❌ Card already exists, should be updated');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  debugCardCreation();
}

module.exports = { debugCardCreation };
