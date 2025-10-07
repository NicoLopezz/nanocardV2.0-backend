const mongoose = require('mongoose');
const { connectDatabases, getCardsConnection } = require('../config/database');
const { cardSchema } = require('../models/Card');

const config = require('../config/environment');

async function checkCardStats() {
  try {
    console.log('🔍 Verificando stats de la card...');
    
    await connectDatabases();
    
    const cardsConnection = getCardsConnection();
    
    await new Promise((resolve) => {
      if (cardsConnection.readyState === 1) {
        resolve();
      } else {
        const checkConnections = () => {
          if (cardsConnection.readyState === 1) {
            resolve();
          } else {
            setTimeout(checkConnections, 100);
          }
        };
        checkConnections();
      }
    });
    
    const Card = cardsConnection.model('Card', cardSchema);
    
    const cardId = '3tgy8OArdOY4q0BWWfDy91IPP9ZNxzrT';
    
    console.log(`🔍 Buscando card: ${cardId}`);
    const card = await Card.findById(cardId);
    
    if (card) {
      console.log('✅ Card encontrada:');
      console.log(`   - ID: ${card._id}`);
      console.log(`   - Nombre: ${card.name}`);
      console.log(`   - Usuario: ${card.userId}`);
      console.log(`   - Proveedor: ${card.supplier}`);
      console.log(`   - Status: ${card.status}`);
      
      console.log('\n📊 Stats:');
      console.log(`   - money_in: $${card.stats.money_in}`);
      console.log(`   - refund: $${card.stats.refund}`);
      console.log(`   - posted: $${card.stats.posted}`);
      console.log(`   - reversed: $${card.stats.reversed}`);
      console.log(`   - rejected: $${card.stats.rejected}`);
      console.log(`   - pending: $${card.stats.pending}`);
      console.log(`   - withdrawal: $${card.stats.withdrawal}`);
      console.log(`   - available: $${card.stats.available}`);
      
      console.log('\n📈 Transaction Stats:');
      console.log(`   - totalTransactions: ${card.transactionStats.totalTransactions}`);
      console.log(`   - TRANSACTION_APPROVED: ${card.transactionStats.byOperation.TRANSACTION_APPROVED}`);
      console.log(`   - TRANSACTION_REJECTED: ${card.transactionStats.byOperation.TRANSACTION_REJECTED}`);
      console.log(`   - WALLET_DEPOSIT: ${card.transactionStats.byOperation.WALLET_DEPOSIT}`);
      
      console.log('\n💰 CryptoMate Balance:');
      console.log(`   - available_credit: $${card.cryptoMateBalance.available_credit}`);
      console.log(`   - lastUpdated: ${card.cryptoMateBalance.lastUpdated}`);
      
    } else {
      console.log('❌ Card no encontrada');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  checkCardStats();
}

module.exports = { checkCardStats };
