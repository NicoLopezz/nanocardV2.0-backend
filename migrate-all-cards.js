require('dotenv').config();
const mongoose = require('mongoose');
const { migrateSingleCard } = require('./migrate-single-card.js');

const BKP_OLD_DB_URI = 'mongodb+srv://nico7913:7913@clusterinitial.eagt2m6.mongodb.net/bkp_old_db';
const NEW_DB_URI = process.env.MONGODB_URI;

async function migrateAllCards() {
  let oldConnection = null;
  let newConnection = null;
  
  const startTime = Date.now();
  const stats = {
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    errors: []
  };
  
  try {
    console.log('\n===========================================');
    console.log('🚀 MIGRATING ALL CARDS FROM OLD DB');
    console.log('===========================================\n');
    
    // Conectar a old DB (una sola vez)
    oldConnection = await mongoose.createConnection(BKP_OLD_DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000
    });
    
    await new Promise((resolve, reject) => {
      if (oldConnection.readyState === 1) {
        resolve();
      } else {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 30000);
        oldConnection.once('open', () => { clearTimeout(timeout); resolve(); });
        oldConnection.once('error', reject);
      }
    });
    
    console.log('✅ Connected to bkp_old_db');
    
    // Obtener todas las cards del old DB
    console.log('📋 Fetching all cards from old DB...');
    const allOldCards = await oldConnection.db.collection('bkp_old_db').find({}).toArray();
    stats.total = allOldCards.length;
    
    console.log(`✅ Found ${stats.total} cards in old DB\n`);
    
    if (stats.total === 0) {
      console.log('⚠️ No cards found in old DB');
      await oldConnection.close();
      return;
    }
    
    // Conectar a new DB (una sola vez)
    newConnection = await mongoose.connect(NEW_DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000
    });
    
    console.log('✅ Connected to new DB\n');
    
    // Crear conexiones reutilizables
    const connections = {
      cardsDb: newConnection.connection.useDb('dev_cards'),
      transactionsDb: newConnection.connection.useDb('dev_transactions'),
      usersDb: newConnection.connection.useDb('dev_users')
    };
    
    console.log('='.repeat(70));
    console.log(`🔄 Starting migration of ${stats.total} cards...`);
    console.log('='.repeat(70));
    console.log('ℹ️  Using shared connections for optimal performance\n');
    
    // Procesar cada card usando conexiones compartidas
    for (let i = 0; i < allOldCards.length; i++) {
      const oldCard = allOldCards[i];
      const cardId = oldCard.Card_id;
      const progress = ((i + 1) / stats.total * 100).toFixed(1);
      
      stats.processed++;
      
      try {
        // Usar verbose=false para reducir logs individuales
        const result = await migrateSingleCard(
          cardId,
          oldConnection,  // Conexión compartida
          connections,    // Conexiones compartidas
          false           // Modo silencioso
        );
        
        if (result.success) {
          stats.successful++;
          
          // Mostrar progreso cada card pero de forma compacta
          if ((i + 1) % 1 === 0) {
            process.stdout.write(`\r[${i + 1}/${stats.total}] (${progress}%) ✅ ${oldCard.nombre || cardId} - Success`);
          }
        } else {
          throw new Error(result.error || 'Unknown error');
        }
        
      } catch (error) {
        stats.failed++;
        stats.errors.push({
          cardId,
          cardName: oldCard.nombre || 'Unknown',
          error: error.message
        });
        
        process.stdout.write(`\r[${i + 1}/${stats.total}] (${progress}%) ❌ ${oldCard.nombre || cardId} - ${error.message}`);
      }
      
      // Log detallado cada 10 cards
      if ((i + 1) % 10 === 0 || i === allOldCards.length - 1) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const avgTime = (elapsed / (i + 1)).toFixed(1);
        const remaining = ((stats.total - (i + 1)) * avgTime).toFixed(0);
        
        console.log(`\n\n📊 Progress: ${i + 1}/${stats.total} (${progress}%)`);
        console.log(`   ✅ Successful: ${stats.successful}`);
        console.log(`   ❌ Failed: ${stats.failed}`);
        console.log(`   ⏱️  Elapsed: ${elapsed}s | Avg: ${avgTime}s/card | Est. remaining: ${remaining}s`);
      }
    }
    
    // Resumen final
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
    
    console.log('\n\n' + '='.repeat(70));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`   Total cards: ${stats.total}`);
    console.log(`   ✅ Successful: ${stats.successful} (${((stats.successful / stats.total) * 100).toFixed(1)}%)`);
    console.log(`   ❌ Failed: ${stats.failed} (${((stats.failed / stats.total) * 100).toFixed(1)}%)`);
    console.log(`   ⏱️  Total time: ${totalTime}s (${(totalTime / 60).toFixed(1)} minutes)`);
    console.log(`   📈 Average: ${(totalTime / stats.total).toFixed(1)}s per card`);
    
    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered (${stats.errors.length}):`);
      stats.errors.slice(0, 10).forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err.cardName} (${err.cardId}): ${err.error}`);
      });
      if (stats.errors.length > 10) {
        console.log(`   ... and ${stats.errors.length - 10} more errors`);
      }
    }
    
    console.log('\n✅ Migration process completed!\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error(error.stack);
  } finally {
    if (oldConnection) {
      await oldConnection.close();
      console.log('✅ Closed old DB connection');
    }
    if (newConnection) {
      await newConnection.connection.close();
      console.log('✅ Closed new DB connection');
    }
  }
}

// Ejecutar
if (require.main === module) {
  migrateAllCards()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateAllCards };
