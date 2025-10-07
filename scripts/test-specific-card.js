const mongoose = require('mongoose');
const config = require('../config/environment');

const MONGODB_URI = config.CARDS_DB_URI;
const BASE_URI = MONGODB_URI.includes('mongodb+srv://') ? 
  MONGODB_URI.substring(0, MONGODB_URI.lastIndexOf('/')) : 
  MONGODB_URI;

async function testSpecificCard() {
  try {
    console.log('🔍 Probando búsqueda específica...');
    
    const backupConnection = await mongoose.createConnection(`${BASE_URI}/bkp_old_db`, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    await new Promise((resolve) => {
      if (backupConnection.readyState === 1) {
        resolve();
      } else {
        backupConnection.once('connected', resolve);
      }
    });
    
    const db = backupConnection.db;
    const collection = db.collection('bkp_old_db');
    
    const testCardId = 'cd25225e-4b8b-11f0-b1b2-df833228e328';
    console.log(`🔍 Buscando tarjeta específica: ${testCardId}`);
    
    const backupCard = await collection.findOne({ Card_id: testCardId });
    console.log('📝 Resultado de búsqueda:', backupCard);
    
    if (backupCard) {
      console.log(`✅ Encontrada: ${backupCard.nombre}`);
    } else {
      console.log('❌ No encontrada');
      
      const allCards = await collection.find({}).limit(5).toArray();
      console.log('📋 Primeras 5 tarjetas en la colección:');
      allCards.forEach(card => {
        console.log(`  - Card_id: ${card.Card_id}, nombre: ${card.nombre}`);
      });
    }
    
    await backupConnection.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  testSpecificCard();
}

module.exports = { testSpecificCard };
