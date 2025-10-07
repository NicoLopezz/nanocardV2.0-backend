const mongoose = require('mongoose');
const { connectDatabases, getCardsConnection } = require('../config/database');
const { cardSchema } = require('../models/Card');

const config = require('../config/environment');

async function debugImportLogic() {
  try {
    console.log('🔍 Debugging import logic...');
    
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
    
    console.log(`🔍 Buscando card específica: ${cardId}`);
    const specificCard = await Card.findById(cardId);
    
    if (specificCard) {
      console.log('✅ Card específica encontrada:');
      console.log(`   - ID: ${specificCard._id}`);
      console.log(`   - Nombre: ${specificCard.name}`);
      console.log(`   - Usuario: ${specificCard.userId}`);
      console.log(`   - Creada: ${specificCard.createdAt}`);
      console.log(`   - Actualizada: ${specificCard.updatedAt}`);
    } else {
      console.log('❌ Card específica NO encontrada');
    }
    
    // Buscar todas las cards del usuario
    const userId = '3tgy8OArdOY4q0BWWfDy91IPP9ZNxzrT';
    console.log(`\n🔍 Buscando TODAS las cards del usuario: ${userId}`);
    const userCards = await Card.find({ userId: userId });
    console.log(`📊 Cards del usuario: ${userCards.length}`);
    
    if (userCards.length > 0) {
      userCards.forEach((card, index) => {
        console.log(`  ${index + 1}. ${card.name} (${card._id}) - ${card.supplier} - Creada: ${card.createdAt}`);
      });
    }
    
    // Buscar cards recientes (últimas 24 horas)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCards = await Card.find({
      createdAt: { $gte: yesterday }
    }).select('_id name userId supplier createdAt').sort({ createdAt: -1 });
    
    console.log(`\n📊 Cards creadas en las últimas 24 horas: ${recentCards.length}`);
    recentCards.forEach((card, index) => {
      console.log(`  ${index + 1}. ${card.name} (${card._id}) - Usuario: ${card.userId} - ${card.createdAt}`);
    });
    
    // Buscar cards con el mismo ID que el usuario
    const cardsWithUserIdAsId = await Card.find({ _id: userId });
    console.log(`\n🔍 Cards con _id igual al userId: ${cardsWithUserIdAsId.length}`);
    if (cardsWithUserIdAsId.length > 0) {
      cardsWithUserIdAsId.forEach((card, index) => {
        console.log(`  ${index + 1}. ${card.name} (${card._id}) - Usuario: ${card.userId}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  debugImportLogic();
}

module.exports = { debugImportLogic };
