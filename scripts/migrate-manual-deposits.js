require('dotenv').config();
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

// Forzar entorno de desarrollo
process.env.NODE_ENV = 'development';

const { databases, connectDatabases } = require('../config/database');

// Configuración de old_db
const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';

async function migrateManualDeposits() {
  let oldDbClient = null;
  
  try {
    console.log('🔄 Connecting to databases...');
    
    // Conectar a las bases de datos de desarrollo
    await connectDatabases();
    console.log('✅ Connected to DEV databases');
    
    // Conectar a old_db usando MongoClient
    oldDbClient = new MongoClient(OLD_DB_URI);
    await oldDbClient.connect();
    console.log('✅ Connected to OLD database');
    
    const oldDb = oldDbClient.db();
    
    // Listar todas las colecciones disponibles
    const collections = await oldDb.listCollections().toArray();
    console.log('📋 Available collections in old_db:');
    collections.forEach(col => console.log(`  - ${col.name}`));
    
    // Registrar esquemas
    const { cardSchema } = require('../models/Card');
    const { transactionSchema } = require('../models/Transaction');
    
    const Card = databases.cards.connection.model('Card', cardSchema);
    const Transaction = databases.transactions.connection.model('Transaction', transactionSchema);
    
    // Obtener todos los usuarios de old_db (probando diferentes colecciones)
    let oldUsers = await oldDb.collection('devTarjetas').find({}).toArray();
    console.log(`📊 Found ${oldUsers.length} users in devTarjetas collection`);
    
    if (oldUsers.length === 0) {
      oldUsers = await oldDb.collection('tarjetas').find({}).toArray();
      console.log(`📊 Found ${oldUsers.length} users in tarjetas collection`);
    }
    
    if (oldUsers.length === 0) {
      oldUsers = await oldDb.collection('tarjeta').find({}).toArray();
      console.log(`📊 Found ${oldUsers.length} users in tarjeta collection`);
    }
    
    const results = {
      totalFound: 0,
      totalMigrated: 0,
      totalSkipped: 0,
      skippedReasons: {},
      migratedDetails: [],
      skippedDetails: []
    };
    
    for (const oldUser of oldUsers) {
      try {
        console.log(`\n🔄 Processing user: ${oldUser.nombre} (${oldUser.Card_id})`);
        
        // Buscar la tarjeta correspondiente en dev_cards
        const devCard = await Card.findOne({ _id: oldUser.Card_id });
        if (!devCard) {
          console.log(`  ⚠️ Card not found in dev_cards: ${oldUser.Card_id}`);
          continue;
        }
        
        // Filtrar movimientos que son depósitos manuales
        const manualDeposits = oldUser.movimientos.filter(mov => 
          mov.credit === true && 
          (mov.name === 'Deposited' || mov.name === 'Deposit') &&
          (mov.status === 'completed' || mov.status === 'Completed')
        );
        
        console.log(`  📈 Found ${manualDeposits.length} manual deposits`);
        results.totalFound += manualDeposits.length;
        
        for (const deposit of manualDeposits) {
          try {
            // Verificar si ya existe una transacción similar
            const existingTransaction = await checkForDuplicate(Transaction, deposit, devCard._id);
            
            if (existingTransaction) {
              const reason = existingTransaction.reason;
              results.totalSkipped++;
              results.skippedReasons[reason] = (results.skippedReasons[reason] || 0) + 1;
              results.skippedDetails.push({
                originalId: deposit.id,
                amount: deposit.MontoTransacction,
                date: deposit.Date,
                reason: reason,
                existingTransactionId: existingTransaction._id
              });
              console.log(`    ⏭️ Skipped: ${reason}`);
              continue;
            }
            
            // Crear nueva transacción
            const newTransaction = await createManualDepositTransaction(deposit, devCard);
            await newTransaction.save();
            
            results.totalMigrated++;
            results.migratedDetails.push({
              originalId: deposit.id,
              newId: newTransaction._id,
              amount: deposit.MontoTransacction,
              date: formatDate(deposit.Date),
              reason: 'No duplicate found'
            });
            
            console.log(`    ✅ Migrated: $${deposit.MontoTransacction} on ${formatDate(deposit.Date)}`);
            
          } catch (depositError) {
            console.log(`    ❌ Error processing deposit ${deposit.id}: ${depositError.message}`);
          }
        }
        
        // Recalcular estadísticas de la tarjeta
        await recalculateCardStats(Card, Transaction, devCard._id);
        
      } catch (userError) {
        console.log(`  ❌ Error processing user ${oldUser.nombre}: ${userError.message}`);
      }
    }
    
    // Mostrar reporte final
    console.log('\n📊 MIGRATION REPORT');
    console.log('==================');
    console.log(`Total manual deposits found: ${results.totalFound}`);
    console.log(`Total migrated: ${results.totalMigrated}`);
    console.log(`Total skipped: ${results.totalSkipped}`);
    console.log('\nSkipped reasons:');
    Object.entries(results.skippedReasons).forEach(([reason, count]) => {
      console.log(`  ${reason}: ${count}`);
    });
    
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    if (oldDbClient) {
      await oldDbClient.close();
    }
  }
}

async function checkForDuplicate(Transaction, deposit, cardId) {
  const depositDate = new Date(deposit.Date);
  const depositAmount = Math.round(deposit.MontoTransacction);
  
  // Buscar transacciones en un rango de ±1 día y ±$10
  const startDate = new Date(depositDate.getTime() - 24 * 60 * 60 * 1000);
  const endDate = new Date(depositDate.getTime() + 24 * 60 * 60 * 1000);
  
  const existingTransactions = await Transaction.find({
    cardId: cardId,
    operation: 'WALLET_DEPOSIT',
    amount: { 
      $gte: depositAmount - 10, 
      $lte: depositAmount + 10 
    },
    createdAt: { 
      $gte: startDate, 
      $lte: endDate 
    }
  });
  
  if (existingTransactions.length === 0) {
    return null;
  }
  
  // Verificar si alguna no es manual
  const nonManualTransactions = existingTransactions.filter(tx => 
    !tx.comentario || !tx.comentario.includes('Manual-Deposit')
  );
  
  if (nonManualTransactions.length > 0) {
    return {
      _id: nonManualTransactions[0]._id,
      reason: 'Duplicate by amount and date'
    };
  }
  
  return {
    _id: existingTransactions[0]._id,
    reason: 'Manual deposit already exists'
  };
}

async function createManualDepositTransaction(deposit, card) {
  const { transactionSchema } = require('../models/Transaction');
  const newTransaction = new (databases.transactions.connection.model('Transaction', transactionSchema))({
    _id: uuidv4(),
    userId: card.userId,
    cardId: card._id,
    userName: card.name,
    cardName: card.name,
    name: 'Deposit',
    amount: Math.round(deposit.MontoTransacction),
    date: formatDate(deposit.Date),
    time: formatTime(deposit.Date),
    status: 'SUCCESS',
    operation: 'WALLET_DEPOSIT',
    credit: true,
    comentario: 'Manual-Deposit',
    originalMovementId: deposit._id,
    createdAt: deposit.Date,
    updatedAt: deposit.Date
  });
  
  return newTransaction;
}

function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTime(date) {
  const d = new Date(date);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

async function recalculateCardStats(Card, Transaction, cardId) {
  try {
    const card = await Card.findById(cardId);
    if (!card) return;
    
    const allTransactions = await Transaction.find({ cardId: cardId });
    const activeTransactions = allTransactions.filter(tx => !tx.isDeleted && tx.status !== 'DELETED');
    
    let totalDeposited = 0;
    let totalRefunded = 0;
    let totalPosted = 0;
    let totalPending = 0;
    let totalWithdrawal = 0;
    
    for (const transaction of activeTransactions) {
      const operation = transaction.operation || 'UNKNOWN';
      
      if (operation === 'WALLET_DEPOSIT' || operation === 'OVERRIDE_VIRTUAL_BALANCE') {
        totalDeposited += transaction.amount;
      } else if (operation === 'TRANSACTION_REFUND') {
        totalRefunded += transaction.amount;
      } else if (operation === 'TRANSACTION_APPROVED') {
        totalPosted += transaction.amount;
      } else if (operation === 'TRANSACTION_PENDING') {
        totalPending += transaction.amount;
      } else if (operation === 'WITHDRAWAL') {
        totalWithdrawal += transaction.amount;
      }
    }
    
    card.stats = {
      money_in: totalDeposited,
      refund: totalRefunded,
      posted: totalPosted,
      reversed: 0,
      rejected: 0,
      pending: totalPending,
      withdrawal: totalWithdrawal,
      available: totalDeposited + totalRefunded - totalPosted - totalPending - totalWithdrawal,
      total_all_transactions: allTransactions.length,
      total_deleted_transactions: allTransactions.length - activeTransactions.length,
      deleted_amount: 0
    };
    
    await card.save();
    console.log(`  📊 Updated card stats for ${card.name}`);
    
  } catch (error) {
    console.log(`  ❌ Error updating card stats: ${error.message}`);
  }
}

migrateManualDeposits();
