const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { connectDatabases, getCardsConnection, getTransactionsConnection } = require('../config/database');
const { cardSchema } = require('../models/Card');
const { getTransactionModel } = require('../models/Transaction');

const config = require('../config/environment');
const MONGODB_URI = config.CARDS_DB_URI;
const BASE_URI = MONGODB_URI.includes('mongodb+srv://') ? 
  MONGODB_URI.substring(0, MONGODB_URI.lastIndexOf('/')) : 
  MONGODB_URI;

async function migrateManualDepositsFixed() {
  try {
    console.log('🚀 Iniciando migración CORREGIDA de depósitos manuales desde bkp_old_db...');
    console.log('📝 Usando montos EXACTOS (sin redondear)');
    
    await connectDatabases();
    
    const cardsConnection = getCardsConnection();
    const transactionsConnection = getTransactionsConnection();
    
    await new Promise((resolve) => {
      if (cardsConnection.readyState === 1 && transactionsConnection.readyState === 1) {
        resolve();
      } else {
        const checkConnections = () => {
          if (cardsConnection.readyState === 1 && transactionsConnection.readyState === 1) {
            resolve();
          } else {
            setTimeout(checkConnections, 100);
          }
        };
        checkConnections();
      }
    });
    
    const Card = cardsConnection.model('Card', cardSchema);
    const Transaction = getTransactionModel();
    
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
    const backupCollection = db.collection('bkp_old_db');
    
    console.log('📊 Buscando tarjetas Mercury en dev_cards...');
    
    const mercuryCards = await Card.find({
      supplier: { $in: ['mercury', 'Mercury', 'Mercury_M'] }
    }).select('_id name supplier userId');
    
    console.log(`✅ Encontradas ${mercuryCards.length} tarjetas Mercury en dev_cards`);
    
    if (mercuryCards.length === 0) {
      console.log('⚠️ No se encontraron tarjetas Mercury para migrar');
      return;
    }
    
    let totalDepositsCreated = 0;
    let totalCardsProcessed = 0;
    
    for (const card of mercuryCards) {
      try {
        console.log(`🔍 Procesando tarjeta ${card._id} (${card.name})...`);
        
        const backupCard = await backupCollection.findOne({ Card_id: card._id });
        
        if (backupCard && backupCard.recargas && backupCard.recargas.length > 0) {
          console.log(`  📝 Encontradas ${backupCard.recargas.length} recargas para migrar`);
          
          for (const recarga of backupCard.recargas) {
            try {
              const transactionId = uuidv4();
              
              const transactionDate = new Date(recarga.fecha);
              const formattedDate = transactionDate.toLocaleDateString('es-ES');
              const formattedTime = transactionDate.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit', 
                hour12: true 
              });
              
              let comentario = 'Manual-Deposit';
              
              if (backupCard.observaciones && backupCard.observaciones.length > 0) {
                const observacion = backupCard.observaciones.find(obs => 
                  obs.texto && obs.texto.includes(recarga.id)
                );
                if (observacion) {
                  const match = observacion.texto.match(/Agregó comentario al movimiento \w+: "([^"]+)"/);
                  if (match) {
                    comentario = `Manual-Deposit: ${match[1]}`;
                  }
                }
              }
              
              // 🔧 CORRECCIÓN: Usar monto EXACTO sin redondear
              const exactAmount = parseFloat(recarga.monto);
              
              const transactionData = {
                _id: transactionId,
                userId: card.userId,
                cardId: card._id,
                userName: card.name,
                cardName: card.name,
                name: 'Deposit',
                amount: exactAmount, // ✅ Monto exacto
                date: formattedDate,
                time: formattedTime,
                status: 'SUCCESS',
                operation: 'WALLET_DEPOSIT',
                credit: true,
                comentario: comentario,
                originalMovementId: recarga.id,
                version: 1,
                isDeleted: false,
                reconciled: false,
                createdAt: transactionDate,
                updatedAt: transactionDate,
                history: [{
                  version: 1,
                  action: 'created',
                  timestamp: new Date(),
                  modifiedBy: 'system',
                  reason: 'Migrated from bkp_old_db (FIXED - exact amounts)'
                }]
              };
              
              const existingTransaction = await Transaction.findOne({
                originalMovementId: recarga.id,
                cardId: card._id
              });
              
              if (existingTransaction) {
                console.log(`    ⚠️ Transacción ya existe para ${recarga.id}, saltando...`);
                continue;
              }
              
              const transaction = new Transaction(transactionData);
              await transaction.save();
              
              console.log(`    ✅ Creada transacción ${transactionId} por $${exactAmount} (${recarga.fecha})`);
              totalDepositsCreated++;
              
            } catch (error) {
              console.error(`    ❌ Error creando transacción para recarga ${recarga.id}:`, error.message);
            }
          }
          
          totalCardsProcessed++;
        } else {
          console.log(`  ⚠️ No se encontraron recargas para la tarjeta ${card._id}`);
        }
      } catch (error) {
        console.error(`❌ Error procesando tarjeta ${card._id}:`, error.message);
      }
    }
    
    console.log('\n📊 Resumen de migración CORREGIDA:');
    console.log(`✅ Tarjetas procesadas: ${totalCardsProcessed}`);
    console.log(`💰 Depósitos creados: ${totalDepositsCreated}`);
    console.log(`📝 Total tarjetas Mercury: ${mercuryCards.length}`);
    console.log('🔧 Montos: EXACTOS (sin redondear)');
    
    await backupConnection.close();
    console.log('🔌 Conexión a bkp_old_db cerrada');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  migrateManualDepositsFixed();
}

module.exports = { migrateManualDepositsFixed };
