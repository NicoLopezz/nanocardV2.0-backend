require('dotenv').config();
const mongoose = require('mongoose');

const DB_URI = process.env.MONGODB_URI;

async function fixDeletedTransactions() {
  try {
    console.log('🔧 Starting fix for deleted transactions...');
    
    // Conectar a la DB
    const connection = await mongoose.connect(DB_URI);
    console.log('✅ Connected to database');
    
    // Conectar a la base de datos de transacciones
    const transactionsDb = connection.connection.useDb('dev_transactions');
    
    // Buscar transacciones con status DELETED pero isDeleted != true
    const incorrectTransactions = await transactionsDb.collection('transactions').find({
      status: 'DELETED',
      isDeleted: { $ne: true }
    }).toArray();
    
    console.log(`📊 Found ${incorrectTransactions.length} transactions with inconsistent deletion status`);
    
    if (incorrectTransactions.length === 0) {
      console.log('✅ No transactions to fix. All deletion statuses are consistent.');
      return;
    }
    
    // Mostrar detalles de las transacciones que se van a corregir
    console.log('\n📋 Transactions to be fixed:');
    incorrectTransactions.forEach((tx, index) => {
      console.log(`${index + 1}. ID: ${tx._id}, Card: ${tx.cardId}, Amount: $${tx.amount}, Status: ${tx.status}, isDeleted: ${tx.isDeleted}`);
    });
    
    console.log('\n🔄 Fixing transactions...');
    
    let fixedCount = 0;
    
    for (const transaction of incorrectTransactions) {
      try {
        await transactionsDb.collection('transactions').updateOne(
          { _id: transaction._id },
          { 
            $set: { 
              isDeleted: true 
            }
          }
        );
        
        fixedCount++;
        console.log(`✅ Fixed transaction ${transaction._id}`);
      } catch (error) {
        console.error(`❌ Error fixing transaction ${transaction._id}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Fixed ${fixedCount}/${incorrectTransactions.length} transactions`);
    
    // Verificar que la corrección funcionó
    const stillIncorrect = await transactionsDb.collection('transactions').find({
      status: 'DELETED',
      isDeleted: { $ne: true }
    }).toArray();
    
    if (stillIncorrect.length === 0) {
      console.log('✅ All deletion statuses are now consistent!');
    } else {
      console.log(`⚠️  Still ${stillIncorrect.length} transactions with inconsistent status`);
    }
    
    // Obtener estadísticas después de la corrección
    const totalDeleted = await transactionsDb.collection('transactions').countDocuments({ 
      $or: [
        { status: 'DELETED' },
        { isDeleted: true }
      ]
    });
    
    const totalActive = await transactionsDb.collection('transactions').countDocuments({ 
      isDeleted: { $ne: true },
      status: { $ne: 'DELETED' }
    });
    
    console.log(`\n📈 Final Statistics:`);
    console.log(`   - Active transactions: ${totalActive}`);
    console.log(`   - Deleted transactions: ${totalDeleted}`);
    
  } catch (error) {
    console.error('❌ Error during fix process:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔐 Disconnected from database');
    process.exit(0);
  }
}

if (require.main === module) {
  fixDeletedTransactions();
}

module.exports = { fixDeletedTransactions };
