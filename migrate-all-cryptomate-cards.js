require('dotenv').config();
const mongoose = require('mongoose');

const BKP_OLD_DB_URI = 'mongodb+srv://nico7913:7913@clusterinitial.eagt2m6.mongodb.net/bkp_old_db';
const NEW_DB_URI = process.env.MONGODB_URI;

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

function mapOldToNewTransaction(oldTx, cardId, userName, cardName) {
  const status = oldTx.status;
  const name = oldTx.name;
  const isCredit = oldTx.credit === true;
  
  let operation = 'TRANSACTION_APPROVED';
  
  if (status === 'TRANSACTION_APPROVED') {
    operation = 'TRANSACTION_APPROVED';
  } else if (status === 'TRANSACTION_REJECTED') {
    operation = 'TRANSACTION_REJECTED';
  } else if (status === 'TRANSACTION_REVERSED') {
    operation = 'TRANSACTION_REVERSED';
  } else if (status === 'Completed' && name === 'Deposited') {
    operation = 'WALLET_DEPOSIT';
  } else if (status === 'Completed' && name === 'WITHDRAWAL') {
    operation = 'WITHDRAWAL';
  } else if (status === 'WALLET_DEPOSIT') {
    operation = 'WALLET_DEPOSIT';
  }
  
  const txDate = new Date(oldTx.Date);
  const formattedDate = formatDate(txDate);
  const formattedTime = formatTime(txDate);
  
  const newTx = {
    _id: oldTx.id,
    userId: cardId,
    cardId: cardId,
    supplier: 'cryptomate',
    name: name,
    amount: Math.abs(oldTx.MontoTransacction || 0),
    date: formattedDate,
    time: formattedTime,
    status: 'SUCCESS',
    userName: userName,
    cardName: cardName,
    operation: operation,
    city: oldTx.city || '',
    country: oldTx.country || '',
    mcc_category: oldTx.mcc_category || '',
    mercuryCategory: oldTx.mercuryCategory || '',
    credit: isCredit,
    comentario: oldTx.comentario || '',
    version: 1,
    isDeleted: false,
    reconciled: false,
    history: [{
      version: 1,
      action: 'created',
      timestamp: new Date(),
      modifiedBy: 'migration_script',
      reason: 'Migrated from old database'
    }]
  };
  
  if (operation === 'WALLET_DEPOSIT') {
    newTx.originalMovementId = oldTx.id;
    newTx.gross_amount = newTx.amount;
    newTx.commission_rate = 0;
    newTx.commission_amount = 0;
    newTx.net_amount = newTx.amount;
  }
  
  return newTx;
}

async function recalculateCardStats(connections, cardId) {
  try {
    const card = await connections.cardsDb.collection('cards').findOne({ _id: cardId });
    if (!card) {
      return;
    }
    
    const cardTransactions = await connections.transactionsDb.collection('transactions').find({ 
      cardId: cardId,
      isDeleted: { $ne: true },
      status: { $ne: 'DELETED' }
    }).toArray();
    
    let totalDeposited = 0;
    let totalRefunded = 0;
    let totalPosted = 0;
    let totalPending = 0;
    let totalWithdrawal = 0;
    let totalReversed = 0;
    let totalRejected = 0;
    
    const operationCounts = {};
    
    for (const transaction of cardTransactions) {
      const operation = transaction.operation || 'UNKNOWN';
      const amount = transaction.amount || 0;
      
      operationCounts[operation] = (operationCounts[operation] || 0) + 1;
      
      switch (operation) {
        case 'WALLET_DEPOSIT':
        case 'OVERRIDE_VIRTUAL_BALANCE':
          totalDeposited += amount;
          break;
        case 'TRANSACTION_REFUND':
          totalRefunded += amount;
          break;
        case 'TRANSACTION_APPROVED':
          totalPosted += amount;
          break;
        case 'TRANSACTION_PENDING':
          totalPending += amount;
          break;
        case 'WITHDRAWAL':
          totalWithdrawal += amount;
          break;
        case 'TRANSACTION_REVERSED':
          totalReversed += amount;
          break;
        case 'TRANSACTION_REJECTED':
          totalRejected += amount;
          break;
      }
    }
    
    const totalAvailable = totalDeposited + totalRefunded - totalPosted - totalPending - totalWithdrawal + totalReversed;
    
    await connections.cardsDb.collection('cards').updateOne(
      { _id: cardId },
      {
        $set: {
          deposited: totalDeposited,
          refunded: totalRefunded,
          posted: totalPosted,
          pending: totalPending,
          available: totalAvailable,
          stats: {
            money_in: totalDeposited,
            refund: totalRefunded,
            posted: totalPosted,
            reversed: totalReversed,
            rejected: totalRejected,
            pending: totalPending,
            withdrawal: totalWithdrawal,
            available: totalAvailable,
            total_all_transactions: cardTransactions.length,
            total_deleted_transactions: 0,
            deleted_amount: 0
          },
          transactionStats: {
            totalTransactions: cardTransactions.length,
            byOperation: operationCounts,
            lastUpdated: new Date()
          },
          updatedAt: new Date()
        }
      }
    );
    
    const user = await connections.usersDb.collection('users').findOne({ _id: card.userId });
    if (user) {
      const userTransactions = await connections.transactionsDb.collection('transactions').find({ 
        userId: card.userId,
        isDeleted: { $ne: true },
        status: { $ne: 'DELETED' }
      }).toArray();
      
      const userTotalDeposited = userTransactions
        .filter(t => ['WALLET_DEPOSIT', 'OVERRIDE_VIRTUAL_BALANCE'].includes(t.operation))
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      
      const userTotalRefunded = userTransactions
        .filter(t => t.operation === 'TRANSACTION_REFUND')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
        
      const userTotalPosted = userTransactions
        .filter(t => t.operation === 'TRANSACTION_APPROVED')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
        
      const userTotalPending = userTransactions
        .filter(t => t.operation === 'TRANSACTION_PENDING')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      
      const userTotalWithdrawal = userTransactions
        .filter(t => t.operation === 'WITHDRAWAL')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      
      const userTotalReversed = userTransactions
        .filter(t => t.operation === 'TRANSACTION_REVERSED')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      
      const userTotalAvailable = userTotalDeposited + userTotalRefunded - userTotalPosted - userTotalPending - userTotalWithdrawal + userTotalReversed;
      
      await connections.usersDb.collection('users').updateOne(
        { _id: card.userId },
        {
          $set: {
            'stats.totalTransactions': userTransactions.length,
            'stats.totalDeposited': userTotalDeposited,
            'stats.totalRefunded': userTotalRefunded,
            'stats.totalPosted': userTotalPosted,
            'stats.totalPending': userTotalPending,
            'stats.totalAvailable': userTotalAvailable,
            updatedAt: new Date()
          }
        }
      );
    }
    
  } catch (error) {
    console.error(`  ❌ Error recalculating stats:`, error.message);
  }
}

async function migrateAllCryptomateCards() {
  let oldConnection = null;
  let newConnection = null;
  
  try {
    console.log('\n===========================================');
    console.log('🔄 MIGRATING ALL CRYPTOMATE CARDS');
    console.log('===========================================\n');
    
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
    
    const allOldCards = await oldConnection.db.collection('bkp_old_db').find({ supplier: 'CryptoMate' }).toArray();
    console.log(`📊 Found ${allOldCards.length} CryptoMate cards in old DB\n`);
    
    if (allOldCards.length === 0) {
      console.log('⚠️ No CryptoMate cards found');
      return;
    }
    
    newConnection = await mongoose.connect(NEW_DB_URI);
    console.log('✅ Connected to new DB\n');
    
    const connections = {
      cardsDb: newConnection.connection.useDb('dev_cards'),
      transactionsDb: newConnection.connection.useDb('dev_transactions'),
      usersDb: newConnection.connection.useDb('dev_users')
    };
    
    const results = {
      totalCards: allOldCards.length,
      processed: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
      totalTransactions: {
        deleted: 0,
        inserted: 0,
        skipped: 0,
        errors: 0
      }
    };
    
    console.log('🔄 Starting migration process...\n');
    
    for (let i = 0; i < allOldCards.length; i++) {
      const oldCard = allOldCards[i];
      const cardId = oldCard.Card_id;
      const userName = oldCard.nombre;
      const movimientos = oldCard.movimientos || [];
      
      try {
        console.log(`[${i + 1}/${allOldCards.length}] ${userName} (${cardId})`);
        console.log(`  📊 Transactions: ${movimientos.length}`);
        
        if (movimientos.length === 0) {
          console.log(`  ⏭️ Skipping (no transactions)`);
          results.skipped++;
          results.processed++;
          continue;
        }
        
        const cardDoc = await connections.cardsDb.collection('cards').findOne({ _id: cardId });
        if (!cardDoc) {
          console.log(`  ⚠️ Card not found in new DB`);
          results.skipped++;
          results.processed++;
          continue;
        }
        
        const deletedCount = await connections.transactionsDb.collection('transactions').deleteMany({ cardId: cardId }).then(r => r.deletedCount);
        results.totalTransactions.deleted += deletedCount;
        console.log(`  🗑️ Deleted ${deletedCount} existing transactions`);
        
        let inserted = 0;
        let errors = 0;
        let skipped = 0;
        
        for (const oldTx of movimientos) {
          try {
            const newTx = mapOldToNewTransaction(oldTx, cardId, userName, userName);
            
            const existing = await connections.transactionsDb.collection('transactions').findOne({ _id: newTx._id });
            if (existing) {
              skipped++;
              continue;
            }
            
            await connections.transactionsDb.collection('transactions').insertOne(newTx);
            inserted++;
          } catch (error) {
            errors++;
          }
        }
        
        results.totalTransactions.inserted += inserted;
        results.totalTransactions.errors += errors;
        results.totalTransactions.skipped += skipped;
        
        console.log(`  ✅ Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`);
        
        await recalculateCardStats(connections, cardId);
        console.log(`  📊 Stats recalculated`);
        
        results.migrated++;
        
      } catch (error) {
        console.error(`  ❌ Error:`, error.message);
        results.errors++;
      }
      
      results.processed++;
      
      if ((i + 1) % 10 === 0) {
        console.log(`\n📊 Progress: ${i + 1}/${allOldCards.length} cards\n`);
      }
    }
    
    console.log('\n===========================================');
    console.log('📊 MIGRATION SUMMARY');
    console.log('===========================================\n');
    console.log(`Total Cards: ${results.totalCards}`);
    console.log(`Processed: ${results.processed}`);
    console.log(`Migrated Successfully: ${results.migrated}`);
    console.log(`Skipped: ${results.skipped}`);
    console.log(`Errors: ${results.errors}`);
    console.log(`\nTransactions:`);
    console.log(`  Deleted: ${results.totalTransactions.deleted}`);
    console.log(`  Inserted: ${results.totalTransactions.inserted}`);
    console.log(`  Skipped: ${results.totalTransactions.skipped}`);
    console.log(`  Errors: ${results.totalTransactions.errors}`);
    
    console.log('\n✅ Migration complete!');
    
  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    if (oldConnection) await oldConnection.close();
    if (newConnection) await newConnection.connection.close();
    process.exit(0);
  }
}

migrateAllCryptomateCards();
