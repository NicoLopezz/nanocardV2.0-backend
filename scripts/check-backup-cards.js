const mongoose = require('mongoose');
const config = require('../config/environment');

const MONGODB_URI = config.CARDS_DB_URI;
const BASE_URI = MONGODB_URI.includes('mongodb+srv://') ? 
  MONGODB_URI.substring(0, MONGODB_URI.lastIndexOf('/')) : 
  MONGODB_URI;

console.log(`🔍 MONGODB_URI: ${MONGODB_URI}`);
console.log(`🔍 BASE_URI: ${BASE_URI}`);

async function checkBackupCards() {
  try {
    console.log('🔍 Verificando tarjetas en bkp_old_db...');
    console.log(`📡 Conectando a: ${BASE_URI}/bkp_old_db`);
    
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
    
    console.log('✅ Conectado a bkp_old_db');
    
    const db = backupConnection.db;
    const collections = await db.listCollections().toArray();
    
    console.log('\n📋 Colecciones encontradas:');
    collections.forEach(collection => {
      console.log(`  - ${collection.name}`);
    });
    
    if (collections.length === 0) {
      console.log('⚠️ No se encontraron colecciones en bkp_old_db');
      return;
    }
    
    for (const collection of collections) {
      console.log(`\n🔍 Analizando colección: ${collection.name}`);
      
      const collectionObj = db.collection(collection.name);
      const count = await collectionObj.countDocuments();
      console.log(`  📊 Total de documentos: ${count}`);
      
      if (count > 0) {
        const sample = await collectionObj.findOne();
        console.log(`  📝 Estructura del primer documento:`);
        console.log(`     ${JSON.stringify(sample, null, 2)}`);
        
        if (sample && sample.Card_id) {
          console.log(`  🆔 Campo 'Card_id' encontrado: ${sample.Card_id}`);
        }
        
        if (sample && sample.nombre) {
          console.log(`  📛 Campo 'nombre' encontrado: ${sample.nombre}`);
        }
        
        if (sample && sample.supplier) {
          console.log(`  🏢 Campo 'supplier' encontrado: ${sample.supplier}`);
        }
        
        const mercuryCards = await collectionObj.find({ supplier: { $in: ['Mercury', 'Mercury_M'] } }).toArray();
        console.log(`  🔍 Tarjetas Mercury encontradas: ${mercuryCards.length}`);
        
        if (mercuryCards.length > 0) {
          console.log(`  📋 IDs de tarjetas Mercury:`);
          mercuryCards.forEach(card => {
            console.log(`    - Card_id: ${card.Card_id}, nombre: ${card.nombre}`);
          });
        }
      }
    }
    
    await backupConnection.close();
    console.log('\n🔌 Conexión cerrada');
    
  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  checkBackupCards();
}

module.exports = { checkBackupCards };
