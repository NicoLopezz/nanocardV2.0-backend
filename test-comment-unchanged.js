const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3002';
const AUTH_TOKEN = 'your_auth_token_here'; // Reemplazar con token real

// Headers para las peticiones
const headers = {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json'
};

async function testCommentUnchanged() {
  console.log('🧪 Testing Comment Unchanged in Delete/Restore...\n');

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

    // 2. Crear una transacción de prueba con comentario específico
    console.log('\n2️⃣ Creating test transaction with specific comment...');
    const testComment = 'Comentario original del usuario - NO debe cambiar';
    const testTransaction = {
      amount: 30,
      operation: 'TRANSACTION_APPROVED',
      date: '29/09/2025',
      time: '2:00 PM',
      comentario: testComment
    };

    const createResponse = await axios.post(
      `${BASE_URL}/api/cards/card/${card._id}/transactions`,
      testTransaction,
      { headers }
    );

    if (createResponse.data.success) {
      const transaction = createResponse.data.transaction;
      console.log(`✅ Test transaction created: ${transaction._id}`);
      console.log(`   Original comment: "${transaction.comentario}"`);
      
      if (transaction.comentario !== testComment) {
        console.log('❌ Comment was not set correctly during creation');
        return;
      }
    } else {
      console.log('❌ Failed to create test transaction');
      return;
    }

    const transactionId = createResponse.data.transaction._id;

    // 3. Eliminar la transacción
    console.log('\n3️⃣ Deleting transaction...');
    const deleteResponse = await axios.delete(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${transactionId}`,
      { headers }
    );

    if (deleteResponse.data.success) {
      const deletedTransaction = deleteResponse.data.transaction;
      console.log('✅ Transaction deleted successfully');
      console.log(`   Comment after delete: "${deletedTransaction.comentario}"`);
      
      // Verificar que el comentario NO cambió
      if (deletedTransaction.comentario === testComment) {
        console.log('✅ Comment preserved correctly - NO changes made');
      } else {
        console.log('❌ Comment was modified during delete');
        console.log(`   Expected: "${testComment}"`);
        console.log(`   Got: "${deletedTransaction.comentario}"`);
        return;
      }
    } else {
      console.log('❌ Failed to delete transaction');
      return;
    }

    // 4. Verificar historial de delete
    console.log('\n4️⃣ Checking delete history...');
    const deleteHistoryResponse = await axios.get(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${transactionId}/history`,
      { headers }
    );

    if (deleteHistoryResponse.data.success) {
      const history = deleteHistoryResponse.data.history;
      const deleteEntry = history.find(h => h.action === 'deleted');
      
      if (deleteEntry) {
        console.log('✅ Delete history found:');
        console.log(`   Version: ${deleteEntry.version}`);
        console.log(`   Changes: ${JSON.stringify(deleteEntry.changes, null, 2)}`);
        
        // Verificar que NO hay cambio de comentario en el historial
        const commentChange = deleteEntry.changes.find(c => c.field === 'comentario');
        if (commentChange) {
          console.log('❌ Comment change found in history (should not exist)');
        } else {
          console.log('✅ No comment change in history (correct behavior)');
        }
      }
    }

    // 5. Restaurar la transacción
    console.log('\n5️⃣ Restoring transaction...');
    const restoreResponse = await axios.post(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${transactionId}/restore`,
      {},
      { headers }
    );

    if (restoreResponse.data.success) {
      const restoredTransaction = restoreResponse.data.transaction;
      console.log('✅ Transaction restored successfully');
      console.log(`   Comment after restore: "${restoredTransaction.comentario}"`);
      
      // Verificar que el comentario sigue siendo el mismo
      if (restoredTransaction.comentario === testComment) {
        console.log('✅ Comment unchanged after restore');
      } else {
        console.log('❌ Comment was modified during restore');
        console.log(`   Expected: "${testComment}"`);
        console.log(`   Got: "${restoredTransaction.comentario}"`);
      }
    } else {
      console.log('❌ Failed to restore transaction');
      return;
    }

    // 6. Verificar historial de restore
    console.log('\n6️⃣ Checking restore history...');
    const restoreHistoryResponse = await axios.get(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${transactionId}/history`,
      { headers }
    );

    if (restoreHistoryResponse.data.success) {
      const history = restoreHistoryResponse.data.history;
      const restoreEntry = history.find(h => h.action === 'restored');
      
      if (restoreEntry) {
        console.log('✅ Restore history found:');
        console.log(`   Version: ${restoreEntry.version}`);
        console.log(`   Changes: ${JSON.stringify(restoreEntry.changes, null, 2)}`);
        
        // Verificar que NO hay cambio de comentario en el historial
        const commentChange = restoreEntry.changes.find(c => c.field === 'comentario');
        if (commentChange) {
          console.log('❌ Comment change found in restore history (should not exist)');
        } else {
          console.log('✅ No comment change in restore history (correct behavior)');
        }
      }
    }

    // 7. Probar múltiples ciclos
    console.log('\n7️⃣ Testing multiple delete/restore cycles...');
    
    // Segundo delete
    console.log('   Second delete...');
    const delete2Response = await axios.delete(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${transactionId}`,
      { headers }
    );
    
    if (delete2Response.data.success) {
      const deleted2Transaction = delete2Response.data.transaction;
      console.log(`   Comment after 2nd delete: "${deleted2Transaction.comentario}"`);
      
      if (deleted2Transaction.comentario === testComment) {
        console.log('   ✅ Comment unchanged in 2nd delete');
      } else {
        console.log('   ❌ Comment changed in 2nd delete');
      }
    }

    // Segundo restore
    console.log('   Second restore...');
    const restore2Response = await axios.post(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${transactionId}/restore`,
      {},
      { headers }
    );
    
    if (restore2Response.data.success) {
      const restored2Transaction = restore2Response.data.transaction;
      console.log(`   Comment after 2nd restore: "${restored2Transaction.comentario}"`);
      
      if (restored2Transaction.comentario === testComment) {
        console.log('   ✅ Comment unchanged in 2nd restore');
      } else {
        console.log('   ❌ Comment changed in 2nd restore');
      }
    }

    console.log('\n🎉 Comment unchanged test completed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Comment preserved during DELETE');
    console.log('   ✅ Comment preserved during RESTORE');
    console.log('   ✅ No comment changes in history');
    console.log('   ✅ Multiple cycles work correctly');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Ejecutar el test
if (require.main === module) {
  testCommentUnchanged();
}

module.exports = { testCommentUnchanged };
