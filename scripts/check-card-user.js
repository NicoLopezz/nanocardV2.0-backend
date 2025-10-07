const mongoose = require('mongoose');
const { connectDatabases, getCardsConnection } = require('../config/database');
const { cardSchema } = require('../models/Card');

const config = require('../config/environment');

async function checkCardUser() {
  try {
    console.log('🔍 Verificando card y usuario...');
    
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
    
    const cardId = '139be3d6-6355-11f0-a30c-4f597792ce2a';
    
    console.log(`🔍 Buscando card: ${cardId}`);
    const card = await Card.findById(cardId);
    
    if (card) {
      console.log('✅ Card encontrada:');
      console.log(`   - ID: ${card._id}`);
      console.log(`   - User ID: ${card.userId}`);
      console.log(`   - Name: ${card.name}`);
      console.log(`   - Supplier: ${card.supplier}`);
      console.log(`   - Status: ${card.status}`);
      console.log(`   - Creada: ${card.createdAt}`);
    } else {
      console.log('❌ Card NO encontrada');
      
      // Buscar cards similares
      console.log('\n🔍 Buscando cards con ID similar...');
      const similarCards = await Card.find({
        _id: { $regex: cardId.substring(0, 8) }
      }).select('_id userId name supplier status createdAt');
      
      if (similarCards.length > 0) {
        console.log(`📊 Cards similares encontradas: ${similarCards.length}`);
        similarCards.forEach((c, index) => {
          console.log(`  ${index + 1}. ${c.name} (${c._id}) - User: ${c.userId} - ${c.supplier}`);
        });
      } else {
        console.log('❌ No se encontraron cards similares');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  checkCardUser();
}

module.exports = { checkCardUser };
