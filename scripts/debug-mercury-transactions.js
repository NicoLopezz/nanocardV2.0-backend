const mercuryService = require('../services/mercuryService');

async function debugMercuryTransactions() {
  try {
    console.log('🔍 Debugging Mercury transactions...');
    
    // Obtener todas las transacciones
    const allTransactions = await mercuryService.getAllTransactions();
    console.log(`📊 Total transactions fetched: ${allTransactions.length}`);
    
    if (allTransactions.length > 0) {
      console.log('\n📋 First 3 transactions structure:');
      allTransactions.slice(0, 3).forEach((tx, index) => {
        console.log(`\n${index + 1}. Transaction ${tx.id}:`);
        console.log(`   - Amount: $${tx.amount}`);
        console.log(`   - Status: ${tx.status}`);
        console.log(`   - Counterparty: ${tx.counterpartyName}`);
        console.log(`   - Details:`, JSON.stringify(tx.details, null, 2));
        console.log(`   - Related transactions:`, tx.relatedTransactions?.length || 0);
      });
      
      // Buscar transacciones con cardId
      const transactionsWithCardId = allTransactions.filter(tx => 
        tx.details?.debitCardInfo?.id
      );
      
      console.log(`\n💳 Transactions with cardId: ${transactionsWithCardId.length}`);
      
      if (transactionsWithCardId.length > 0) {
        console.log('\n📋 Card IDs found:');
        const cardIds = [...new Set(transactionsWithCardId.map(tx => tx.details.debitCardInfo.id))];
        cardIds.forEach((cardId, index) => {
          const count = transactionsWithCardId.filter(tx => tx.details.debitCardInfo.id === cardId).length;
          console.log(`  ${index + 1}. ${cardId}: ${count} transactions`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  debugMercuryTransactions();
}

module.exports = { debugMercuryTransactions };
