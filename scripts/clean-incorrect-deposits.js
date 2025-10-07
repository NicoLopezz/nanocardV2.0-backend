const mongoose = require('mongoose');
const { connectDatabases, getTransactionsConnection } = require('../config/database');
const { getTransactionModel } = require('../models/Transaction');

const config = require('../config/environment');

async function cleanIncorrectDeposits() {
  try {
    console.log('🧹 Limpiando depósitos con montos redondeados...');
    
    await connectDatabases();
    
    const transactionsConnection = getTransactionsConnection();
    
    await new Promise((resolve) => {
      if (transactionsConnection.readyState === 1) {
        resolve();
      } else {
        transactionsConnection.once('connected', resolve);
      }
    });
    
    const Transaction = getTransactionModel();
    
    // Buscar transacciones que fueron migradas desde bkp_old_db
    const incorrectDeposits = await Transaction.find({
      operation: 'WALLET_DEPOSIT',
      comentario: { $regex: /Manual-Deposit/ },
      history: { $elemMatch: { reason: 'Migrated from bkp_old_db' } }
    });
    
    console.log(`📊 Encontradas ${incorrectDeposits.length} transacciones para eliminar`);
    
    if (incorrectDeposits.length === 0) {
      console.log('✅ No hay transacciones incorrectas para limpiar');
      return;
    }
    
    // Mostrar detalles antes de eliminar
    console.log('\n📋 Transacciones a eliminar:');
    for (const tx of incorrectDeposits) {
      console.log(`  - ${tx._id}: $${tx.amount} (${tx.cardName})`);
    }
    
    // Eliminar las transacciones
    const deleteResult = await Transaction.deleteMany({
      _id: { $in: incorrectDeposits.map(tx => tx._id) }
    });
    
    console.log(`\n✅ Eliminadas ${deleteResult.deletedCount} transacciones incorrectas`);
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  cleanIncorrectDeposits();
}

module.exports = { cleanIncorrectDeposits };
