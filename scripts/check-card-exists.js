const mongoose = require('mongoose');
const { connectDatabases, getCardsConnection } = require('../config/database');
const { cardSchema } = require('../models/Card');

const config = require('../config/environment');

async function checkCardExists() {
  try {
    console.log('🔍 Verificando si existe la card...');
    
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
    
    console.log(`🔍 Buscando card: ${cardId}`);
    const card = await Card.findById(cardId);
    
    if (card) {
      console.log('✅ Card encontrada:');
      console.log(`   - ID: ${card._id}`);
      console.log(`   - Nombre: ${card.name}`);
      console.log(`   - Usuario: ${card.userId}`);
      console.log(`   - Proveedor: ${card.supplier}`);
      console.log(`   - Creada: ${card.createdAt}`);
    } else {
      console.log('❌ Card NO encontrada');
      
      // Buscar cards del usuario
      const userId = '3tgy8OArdOY4q0BWWfDy91IPP9ZNxzrT';
      console.log(`\n🔍 Buscando cards del usuario: ${userId}`);
      const userCards = await Card.find({ userId: userId });
      console.log(`📊 Cards del usuario: ${userCards.length}`);
      
      if (userCards.length > 0) {
        userCards.forEach((card, index) => {
          console.log(`  ${index + 1}. ${card.name} (${card._id}) - ${card.supplier}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  checkCardExists();
}

module.exports = { checkCardExists };
