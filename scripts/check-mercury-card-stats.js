const mongoose = require('mongoose');
const { connectDatabases, getCardsConnection } = require('../config/database');
const { cardSchema } = require('../models/Card');

const config = require('../config/environment');

async function checkMercuryCardStats() {
  try {
    console.log('🔍 Verificando stats de cards Mercury...');
    
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
    
    // Buscar cards Mercury
    const mercuryCards = await Card.find({ supplier: 'mercury' }).select('_id name stats createdAt');
    
    console.log(`📊 Cards Mercury encontradas: ${mercuryCards.length}`);
    
    mercuryCards.forEach((card, index) => {
      console.log(`\n${index + 1}. ${card.name} (${card._id}):`);
      console.log(`   - Creada: ${card.createdAt}`);
      console.log(`   - money_in: $${card.stats.money_in}`);
      console.log(`   - posted: $${card.stats.posted}`);
      console.log(`   - pending: $${card.stats.pending}`);
      console.log(`   - available: $${card.stats.available}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  checkMercuryCardStats();
}

module.exports = { checkMercuryCardStats };
