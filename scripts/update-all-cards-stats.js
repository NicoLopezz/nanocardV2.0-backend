const { connectDatabases, getCardsConnection, getTransactionsConnection } = require('../config/database');
const { recalculateAllCardStats } = require('../services/cardStatsService');

async function updateAllCardsStats() {
  try {
    console.log('🔄 Conectando a las bases de datos...');
    await connectDatabases();
    
    const cardsConn = getCardsConnection();
    const transConn = getTransactionsConnection();
    
    await new Promise((resolve) => {
      if (cardsConn.readyState === 1 && transConn.readyState === 1) {
        resolve();
      } else {
        const checkConnections = () => {
          if (cardsConn.readyState === 1 && transConn.readyState === 1) {
            resolve();
          } else {
            setTimeout(checkConnections, 100);
          }
        };
        checkConnections();
      }
    });
    
    console.log('✅ Conexiones listas');
    console.log('📊 Recalculando estadísticas de todas las tarjetas...');
    
    const result = await recalculateAllCardStats();
    
    console.log('\n✅ Proceso completado!');
    console.log(`📈 Tarjetas procesadas: ${result.processed}`);
    console.log(`❌ Errores: ${result.errors}`);
    console.log(`📊 Total: ${result.total}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  updateAllCardsStats();
}

module.exports = { updateAllCardsStats };

