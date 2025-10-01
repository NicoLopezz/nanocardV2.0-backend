const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3002';
const AUTH_TOKEN = 'your_auth_token_here'; // Reemplazar con token real

// Headers para las peticiones
const headers = {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json'
};

async function testLegacyRestore() {
  console.log('🧪 Testing Legacy Transaction Restore (without comment history)...\n');

  try {
    // 1. Obtener una tarjeta existente
    console.log('1️⃣ Getting user cards...');
    const cardsResponse = await axios.get(`${BASE_URL}/api/cards`, { headers });
    const cards = cardsResponse.data.cards;
    
    if (cards.length === 0) {
      console.log('❌ No cards found. Please create a card first.');
      return;
    }

    const card = cards[0];
    console.log(`✅ Found card: ${card.name} (${card.last4})`);

    // 2. Obtener transacciones eliminadas
    console.log('\n2️⃣ Getting deleted transactions...');
    const transactionsResponse = await axios.get(
      `${BASE_URL}/api/cards/card/${card._id}/transactions?action=all-movements&limit=20`, 
      { headers }
    );
    
    const transactions = transactionsResponse.data.transactions;
    const deletedTransactions = transactions.filter(tx => tx.isDeleted || tx.status === 'DELETED');
    
    console.log(`✅ Found ${deletedTransactions.length} deleted transactions`);

    if (deletedTransactions.length === 0) {
      console.log('❌ No deleted transactions found to test restore');
      return;
    }

    // 3. Seleccionar una transacción eliminada para restaurar
    const transactionToRestore = deletedTransactions[0];
    console.log(`\n3️⃣ Selected transaction for restore:`);
    console.log(`   ID: ${transactionToRestore._id}`);
    console.log(`   Name: ${transactionToRestore.name}`);
    console.log(`   Amount: ${transactionToRestore.amount}`);
    console.log(`   Status: ${transactionToRestore.status}`);
    console.log(`   Comment: "${transactionToRestore.comentario || 'No comment'}"`);
    console.log(`   Is Deleted: ${transactionToRestore.isDeleted}`);

    // 4. Verificar historial antes del restore
    console.log('\n4️⃣ Checking history before restore...');
    const historyResponse = await axios.get(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${transactionToRestore._id}/history`,
      { headers }
    );

    if (historyResponse.data.success) {
      const history = historyResponse.data.history;
      console.log(`✅ Found ${history.length} history entries`);
      
      const deleteEntry = history.find(h => h.action === 'deleted');
      if (deleteEntry) {
        console.log(`   Delete entry (v${deleteEntry.version}):`);
        console.log(`   Changes: ${JSON.stringify(deleteEntry.changes, null, 2)}`);
        
        const commentChange = deleteEntry.changes.find(c => c.field === 'comentario');
        if (commentChange) {
          console.log(`   ✅ Comment change found: "${commentChange.oldValue}" → "${commentChange.newValue}"`);
        } else {
          console.log(`   ⚠️ No comment change found in history (legacy transaction)`);
        }
      }
    }

    // 5. Restaurar la transacción
    console.log('\n5️⃣ Restoring transaction...');
    const restoreResponse = await axios.post(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${transactionToRestore._id}/restore`,
      {},
      { headers }
    );

    if (restoreResponse.data.success) {
      console.log('✅ Transaction restored successfully');
      console.log(`   New status: ${restoreResponse.data.transaction.status}`);
      console.log(`   New comment: "${restoreResponse.data.transaction.comentario || 'No comment'}"`);
      console.log(`   Is Deleted: ${restoreResponse.data.transaction.isDeleted}`);
    } else {
      console.log('❌ Failed to restore transaction');
      console.log(`   Error: ${restoreResponse.data.message || 'Unknown error'}`);
      return;
    }

    // 6. Verificar historial después del restore
    console.log('\n6️⃣ Checking history after restore...');
    const finalHistoryResponse = await axios.get(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${transactionToRestore._id}/history`,
      { headers }
    );

    if (finalHistoryResponse.data.success) {
      const history = finalHistoryResponse.data.history;
      const restoreEntry = history.find(h => h.action === 'restored');
      
      if (restoreEntry) {
        console.log(`✅ Restore entry (v${restoreEntry.version}):`);
        console.log(`   Changes: ${JSON.stringify(restoreEntry.changes, null, 2)}`);
        
        const commentChange = restoreEntry.changes.find(c => c.field === 'comentario');
        if (commentChange) {
          console.log(`   Comment change: "${commentChange.oldValue}" → "${commentChange.newValue}"`);
        }
      }
    }

    // 7. Verificar estado final
    console.log('\n7️⃣ Final verification...');
    const finalTransactionResponse = await axios.get(
      `${BASE_URL}/api/cards/card/${card._id}/transactions?action=all-movements&limit=20`, 
      { headers }
    );
    
    const finalTransaction = finalTransactionResponse.data.transactions.find(tx => 
      tx._id === transactionToRestore._id
    );

    if (finalTransaction) {
      console.log(`✅ Final transaction state:`);
      console.log(`   Status: ${finalTransaction.status}`);
      console.log(`   Is Deleted: ${finalTransaction.isDeleted}`);
      console.log(`   Comment: "${finalTransaction.comentario || 'No comment'}"`);
      console.log(`   Version: ${finalTransaction.version}`);
    }

    console.log('\n🎉 Legacy restore test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Ejecutar el test
if (require.main === module) {
  testLegacyRestore();
}

module.exports = { testLegacyRestore };
