const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3002';
const AUTH_TOKEN = 'your_auth_token_here'; // Reemplazar con token real

// Headers para las peticiones
const headers = {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json'
};

async function debugCommentIssue() {
  console.log('🔍 Debugging Comment Issue...\n');

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
    const testComment = 'DEBUG: Comentario de prueba para verificar preservación';
    const testTransaction = {
      amount: 15,
      operation: 'TRANSACTION_APPROVED',
      date: '29/09/2025',
      time: '1:00 PM',
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

    // 3. Verificar estado antes del delete
    console.log('\n3️⃣ Checking state before delete...');
    const beforeDeleteResponse = await axios.get(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${transactionId}/history`,
      { headers }
    );

    if (beforeDeleteResponse.data.success) {
      const transaction = beforeDeleteResponse.data.transaction;
      console.log(`   Status: ${transaction.status}`);
      console.log(`   Comment: "${transaction.comentario}"`);
      console.log(`   Is Deleted: ${transaction.isDeleted}`);
    }

    // 4. Eliminar la transacción
    console.log('\n4️⃣ Deleting transaction...');
    const deleteResponse = await axios.delete(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${transactionId}`,
      { headers }
    );

    if (deleteResponse.data.success) {
      const deletedTransaction = deleteResponse.data.transaction;
      console.log('✅ Transaction deleted successfully');
      console.log(`   Comment after delete: "${deletedTransaction.comentario}"`);
      
      // Verificar el formato esperado
      const expectedFormat = `${testComment} | Deleted at`;
      if (deletedTransaction.comentario.includes(testComment) && 
          deletedTransaction.comentario.includes('Deleted at')) {
        console.log('✅ Comment preserved correctly in delete');
        console.log(`   Format: "${deletedTransaction.comentario}"`);
      } else {
        console.log('❌ Comment was not preserved correctly in delete');
        console.log(`   Expected to contain: "${testComment}"`);
        console.log(`   Expected to contain: "Deleted at"`);
        console.log(`   Got: "${deletedTransaction.comentario}"`);
        return;
      }
    } else {
      console.log('❌ Failed to delete transaction');
      return;
    }

    // 5. Verificar historial de delete
    console.log('\n5️⃣ Checking delete history...');
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
        
        const commentChange = deleteEntry.changes.find(c => c.field === 'comentario');
        if (commentChange) {
          console.log(`   Comment change:`);
          console.log(`     Old: "${commentChange.oldValue}"`);
          console.log(`     New: "${commentChange.newValue}"`);
          
          if (commentChange.oldValue === testComment) {
            console.log('✅ Original comment saved correctly in history');
          } else {
            console.log('❌ Original comment not saved correctly in history');
          }
        } else {
          console.log('❌ No comment change found in delete history');
        }
      }
    }

    // 6. Restaurar la transacción
    console.log('\n6️⃣ Restoring transaction...');
    const restoreResponse = await axios.post(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${transactionId}/restore`,
      {},
      { headers }
    );

    if (restoreResponse.data.success) {
      const restoredTransaction = restoreResponse.data.transaction;
      console.log('✅ Transaction restored successfully');
      console.log(`   Comment after restore: "${restoredTransaction.comentario}"`);
      
      if (restoredTransaction.comentario === testComment) {
        console.log('✅ Original comment restored correctly');
      } else {
        console.log('❌ Original comment was not restored correctly');
        console.log(`   Expected: "${testComment}"`);
        console.log(`   Got: "${restoredTransaction.comentario}"`);
      }
    } else {
      console.log('❌ Failed to restore transaction');
      console.log(`   Error: ${restoreResponse.data.message || 'Unknown error'}`);
      return;
    }

    // 7. Verificar historial de restore
    console.log('\n7️⃣ Checking restore history...');
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
        
        const commentChange = restoreEntry.changes.find(c => c.field === 'comentario');
        if (commentChange) {
          console.log(`   Comment change:`);
          console.log(`     Old: "${commentChange.oldValue}"`);
          console.log(`     New: "${commentChange.newValue}"`);
        }
      }
    }

    console.log('\n🎉 Debug completed!');

  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  }
}

// Ejecutar el debug
if (require.main === module) {
  debugCommentIssue();
}

module.exports = { debugCommentIssue };
