require('dotenv').config();
const mongoose = require('mongoose');

// Configurar conexión
const NEW_DB_URI = process.env.MONGODB_URI;

const recalculateSingleCard = async () => {
  const startTime = Date.now();
  
  try {
    const targetCardId = 'OXREcmFNUe1C30ZifTgZRknJ6lfPNv4U'; // Javier Santos
    
    console.log('🧮 Starting single card recalculation...');
    console.log(`🎯 Target card: ${targetCardId} (Javier Santos)`);
    
    // Conectar a la DB
    const connection = await mongoose.connect(NEW_DB_URI);
    console.log('✅ Connected to database');
    
    // Conectar a las bases de datos
    const cardsDb = connection.connection.useDb('dev_cards');
    const transactionsDb = connection.connection.useDb('dev_transactions');
    const usersDb = connection.connection.useDb('dev_users');
    
    // 1. Obtener la card
    const card = await cardsDb.collection('cards').findOne({ _id: targetCardId });
    if (!card) {
      console.log(`❌ Card not found: ${targetCardId}`);
      return;
    }
    
    console.log(`✅ Found card: ${card.name} (${card.last4})`);
    console.log(`📊 Current stored values:`);
    console.log(`   - Deposited: $${card.deposited || 0}`);
    console.log(`   - Refunded: $${card.refunded || 0}`);
    console.log(`   - Posted: $${card.posted || 0}`);
    console.log(`   - Pending: $${card.pending || 0}`);
    console.log(`   - Available: $${card.available || 0}`);
    
    // 2. Obtener todas las transacciones de esta tarjeta
    const cardTransactions = await transactionsDb.collection('transactions').find({ 
      cardId: targetCardId,
      isDeleted: { $ne: true },
      status: { $ne: 'DELETED' }
    }).toArray();
    
    console.log(`\n📄 Found ${cardTransactions.length} active transactions`);
    
    // 3. Calcular totales correctos basándose en las transacciones
    let totalDeposited = 0;   // Solo WALLET_DEPOSIT y OVERRIDE_VIRTUAL_BALANCE
    let totalRefunded = 0;    // Solo TRANSACTION_REFUND
    let totalPosted = 0;      // Solo TRANSACTION_APPROVED
    let totalPending = 0;     // Solo TRANSACTION_PENDING
    
    const operationCounts = {};
    
    for (const transaction of cardTransactions) {
      const operation = transaction.operation || 'UNKNOWN';
      const amount = transaction.amount || 0;
      
      // Contar operaciones
      operationCounts[operation] = (operationCounts[operation] || 0) + 1;
      
      // Calcular totales según el tipo de operación
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
      }
    }
    
    const totalAvailable = totalDeposited + totalRefunded - totalPosted - totalPending;
    
    console.log(`\n🧮 CALCULATED VALUES:`);
    console.log(`   - Deposited: $${totalDeposited}`);
    console.log(`   - Refunded: $${totalRefunded}`);
    console.log(`   - Posted: $${totalPosted}`);
    console.log(`   - Pending: $${totalPending}`);
    console.log(`   - Available: $${totalAvailable}`);
    console.log(`\n📊 Operations breakdown:`);
    Object.entries(operationCounts).forEach(([op, count]) => {
      console.log(`   - ${op}: ${count} transactions`);
    });
    
    // 4. Actualizar la card con los valores correctos
    const updateResult = await cardsDb.collection('cards').updateOne(
      { _id: targetCardId },
      {
        $set: {
          deposited: totalDeposited,
          refunded: totalRefunded,
          posted: totalPosted,
          pending: totalPending,
          available: totalAvailable,
          transactionStats: {
            totalTransactions: cardTransactions.length,
            byOperation: operationCounts,
            lastUpdated: new Date()
          },
          updatedAt: new Date()
        }
      }
    );
    
    if (updateResult.modifiedCount > 0) {
      console.log(`\n✅ Card updated successfully!`);
    } else {
      console.log(`\n⚠️ Card was not modified (values may be the same)`);
    }
    
    // 5. Actualizar KPIs del usuario
    const user = await usersDb.collection('users').findOne({ _id: card.userId });
    if (user) {
      console.log(`\n👤 Updating user KPIs: ${user.username}`);
      
      // Recalcular KPIs basándose en todas las transacciones del usuario
      const userTransactions = await transactionsDb.collection('transactions').find({ 
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
        
      const userTotalAvailable = userTotalDeposited + userTotalRefunded - userTotalPosted - userTotalPending;
      
      const userUpdateResult = await usersDb.collection('users').updateOne(
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
      
      if (userUpdateResult.modifiedCount > 0) {
        console.log(`   ✅ User KPIs updated successfully!`);
        console.log(`   📊 User totals:`);
        console.log(`      - Transactions: ${userTransactions.length}`);
        console.log(`      - Deposited: $${userTotalDeposited}`);
        console.log(`      - Refunded: $${userTotalRefunded}`);
        console.log(`      - Posted: $${userTotalPosted}`);
        console.log(`      - Available: $${userTotalAvailable}`);
      } else {
        console.log(`   ⚠️ User KPIs were not modified`);
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 SINGLE CARD RECALCULATION COMPLETED!');
    console.log('='.repeat(50));
    console.log(`📊 SUMMARY:`);
    console.log(`   🏁 Total time: ${totalTime} seconds`);
    console.log(`   💳 Card: ${card.name} (${card.last4})`);
    console.log(`   📄 Transactions processed: ${cardTransactions.length}`);
    console.log(`   🔢 New totals calculated and stored`);
    
  } catch (error) {
    console.error('❌ Recalculation error:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  recalculateSingleCard();
}

module.exports = { recalculateSingleCard };
