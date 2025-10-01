const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3002';
const AUTH_TOKEN = 'your_auth_token_here'; // Reemplazar con token real

// Headers para las peticiones
const headers = {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json'
};

async function testCommentRestore() {
  console.log('🧪 Testing Comment Restore Functionality...\n');

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

    // 2. Obtener transacciones de la tarjeta
    console.log('\n2️⃣ Getting card transactions...');
    const transactionsResponse = await axios.get(
      `${BASE_URL}/api/cards/card/${card._id}/transactions?action=all-movements&limit=10`, 
      { headers }
    );
    
    const transactions = transactionsResponse.data.transactions;
    console.log(`✅ Found ${transactions.length} transactions`);

    // 3. Buscar una transacción activa para eliminar
    const activeTransaction = transactions.find(tx => 
      !tx.isDeleted && tx.status !== 'DELETED'
    );

    if (!activeTransaction) {
      console.log('❌ No active transactions found to test delete/restore');
      return;
    }

    console.log(`✅ Found active transaction: ${activeTransaction._id}`);
    console.log(`   Original comment: "${activeTransaction.comentario || 'No comment'}"`);

    // 4. Eliminar la transacción
    console.log('\n3️⃣ Deleting transaction...');
    const deleteResponse = await axios.delete(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${activeTransaction._id}`,
      { headers }
    );

    if (deleteResponse.data.success) {
      console.log('✅ Transaction deleted successfully');
      console.log(`   Comment after delete: "${deleteResponse.data.transaction.comentario}"`);
    } else {
      console.log('❌ Failed to delete transaction');
      return;
    }

    // 5. Verificar historial de delete
    console.log('\n4️⃣ Checking delete history...');
    const historyResponse = await axios.get(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${activeTransaction._id}/history`,
      { headers }
    );

    if (historyResponse.data.success) {
      const history = historyResponse.data.history;
      const deleteEntry = history.find(h => h.action === 'deleted');
      
      if (deleteEntry) {
        console.log('✅ Delete history found:');
        console.log(`   Version: ${deleteEntry.version}`);
        console.log(`   Changes: ${JSON.stringify(deleteEntry.changes, null, 2)}`);
        
        // Buscar el cambio del comentario
        const commentChange = deleteEntry.changes.find(c => c.field === 'comentario');
        if (commentChange) {
          console.log(`   Original comment: "${commentChange.oldValue}"`);
          console.log(`   New comment: "${commentChange.newValue}"`);
        }
      }
    }

    // 6. Restaurar la transacción
    console.log('\n5️⃣ Restoring transaction...');
    const restoreResponse = await axios.post(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${activeTransaction._id}/restore`,
      {},
      { headers }
    );

    if (restoreResponse.data.success) {
      console.log('✅ Transaction restored successfully');
      console.log(`   Comment after restore: "${restoreResponse.data.transaction.comentario}"`);
    } else {
      console.log('❌ Failed to restore transaction');
      return;
    }

    // 7. Verificar historial de restore
    console.log('\n6️⃣ Checking restore history...');
    const finalHistoryResponse = await axios.get(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${activeTransaction._id}/history`,
      { headers }
    );

    if (finalHistoryResponse.data.success) {
      const history = finalHistoryResponse.data.history;
      const restoreEntry = history.find(h => h.action === 'restored');
      
      if (restoreEntry) {
        console.log('✅ Restore history found:');
        console.log(`   Version: ${restoreEntry.version}`);
        console.log(`   Changes: ${JSON.stringify(restoreEntry.changes, null, 2)}`);
        
        // Buscar el cambio del comentario
        const commentChange = restoreEntry.changes.find(c => c.field === 'comentario');
        if (commentChange) {
          console.log(`   Old comment: "${commentChange.oldValue}"`);
          console.log(`   New comment: "${commentChange.newValue}"`);
        }
      }
    }

    // 8. Verificar estado final
    console.log('\n7️⃣ Final verification...');
    const finalTransactionResponse = await axios.get(
      `${BASE_URL}/api/cards/card/${card._id}/transactions?action=all-movements&limit=10`, 
      { headers }
    );
    
    const finalTransaction = finalTransactionResponse.data.transactions.find(tx => 
      tx._id === activeTransaction._id
    );

    if (finalTransaction) {
      console.log(`✅ Final transaction state:`);
      console.log(`   Status: ${finalTransaction.status}`);
      console.log(`   Is Deleted: ${finalTransaction.isDeleted}`);
      console.log(`   Comment: "${finalTransaction.comentario || 'No comment'}"`);
      
      // Verificar que el comentario se restauró correctamente
      const originalComment = activeTransaction.comentario || '';
      const finalComment = finalTransaction.comentario || '';
      
      if (originalComment === finalComment) {
        console.log('✅ Comment restored correctly!');
      } else {
        console.log('❌ Comment was not restored correctly');
        console.log(`   Expected: "${originalComment}"`);
        console.log(`   Got: "${finalComment}"`);
      }
    }

    console.log('\n🎉 Comment restore test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Ejecutar el test
if (require.main === module) {
  testCommentRestore();
}

module.exports = { testCommentRestore };
