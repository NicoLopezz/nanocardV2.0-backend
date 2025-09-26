require('dotenv').config();
const mongoose = require('mongoose');

const testServerConfig = async () => {
  try {
    console.log('🔍 Testing server configuration...');
    
    // Verificar variables de entorno
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    
    // Cargar configuración
    const config = require('../config/environment');
    console.log(`Environment: ${config.NODE_ENV}`);
    console.log(`Users DB: ${config.USERS_DB_URI}`);
    console.log(`Cards DB: ${config.CARDS_DB_URI}`);
    console.log(`Transactions DB: ${config.TRANSACTIONS_DB_URI}`);
    
    // Conectar a la DB
    const connection = await mongoose.connect(config.CARDS_DB_URI);
    console.log('✅ Connected to cards database');
    
    // Probar búsqueda de tarjeta
    const cardId = 'Qc4iMvkIQBfphcgCwJCFxQEF38Br1x0J';
    const card = await connection.connection.db.collection('cards').findOne({ _id: cardId });
    
    if (card) {
      console.log('✅ Card found:');
      console.log(`   - Name: ${card.name}`);
      console.log(`   - ID: ${card._id}`);
      console.log(`   - Supplier: ${card.supplier}`);
    } else {
      console.log('❌ Card not found');
      
      // Listar todas las tarjetas disponibles
      const allCards = await connection.connection.db.collection('cards').find({}).toArray();
      console.log(`📋 Available cards (${allCards.length}):`);
      allCards.forEach(card => {
        console.log(`   - ${card.name}: ${card._id}`);
      });
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
  testServerConfig();
}

module.exports = { testServerConfig };
