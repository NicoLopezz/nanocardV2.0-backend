const mongoose = require('mongoose');
const { connectDatabases, getTransactionsConnection } = require('../config/database');
const { getTransactionModel } = require('../models/Transaction');

const config = require('../config/environment');

async function checkUserTransactions() {
  try {
    console.log('🔍 Verificando transacciones del usuario...');
    
    await connectDatabases();
    
    const transactionsConnection = getTransactionsConnection();
    
    await new Promise((resolve) => {
      if (transactionsConnection.readyState === 1) {
        resolve();
      } else {
        const checkConnections = () => {
          if (transactionsConnection.readyState === 1) {
            resolve();
          } else {
            setTimeout(checkConnections, 100);
          }
        };
        checkConnections();
      }
    });
    
    const Transaction = getTransactionModel();
    
    const userId = '3tgy8OArdOY4q0BWWfDy91IPP9ZNxzrT';
    
    console.log(`🔍 Buscando transacciones para usuario: ${userId}`);
    const userTransactions = await Transaction.find({ userId: userId });
    
    console.log(`📊 Transacciones encontradas: ${userTransactions.length}`);
    
    if (userTransactions.length > 0) {
      console.log('\n📋 Primeras 5 transacciones:');
      userTransactions.slice(0, 5).forEach((tx, index) => {
        console.log(`  ${index + 1}. ${tx.name} - $${tx.amount} (${tx.date}) - Card: ${tx.cardId}`);
      });
      
      // Agrupar por cardId
      const cardsWithTransactions = {};
      userTransactions.forEach(tx => {
        if (!cardsWithTransactions[tx.cardId]) {
          cardsWithTransactions[tx.cardId] = 0;
        }
        cardsWithTransactions[tx.cardId]++;
      });
      
      console.log('\n💳 Transacciones por card:');
      Object.entries(cardsWithTransactions).forEach(([cardId, count]) => {
        console.log(`  - ${cardId}: ${count} transacciones`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  checkUserTransactions();
}

module.exports = { checkUserTransactions };
