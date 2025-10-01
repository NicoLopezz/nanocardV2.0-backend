const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3002';
const AUTH_TOKEN = 'your_auth_token_here'; // Reemplazar con token real

// Headers para las peticiones
const headers = {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json'
};

async function testCommentPreservation() {
  console.log('🧪 Testing Comment Preservation in Delete/Restore...\n');

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

    // 2. Crear una transacción de prueba con comentario
    console.log('\n2️⃣ Creating test transaction with comment...');
    const testTransaction = {
      amount: 25,
      operation: 'TRANSACTION_APPROVED',
      date: '29/09/2025',
      time: '12:00 PM',
      comentario: 'Pago de prueba en supermercado'
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
      
      // Verificar que el comentario original se preservó
      if (deletedTransaction.comentario.includes('Pago de prueba en supermercado') && 
          deletedTransaction.comentario.includes('Deleted at')) {
        console.log('✅ Original comment preserved with delete info');
      } else {
        console.log('❌ Original comment was not preserved');
      }
    } else {
      console.log('❌ Failed to delete transaction');
      return;
    }

    // 4. Verificar historial de delete
    console.log('\n4️⃣ Checking delete history...');
    const historyResponse = await axios.get(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${transactionId}/history`,
      { headers }
    );

    if (historyResponse.data.success) {
      const history = historyResponse.data.history;
      const deleteEntry = history.find(h => h.action === 'deleted');
      
      if (deleteEntry) {
        console.log('✅ Delete history found:');
        const commentChange = deleteEntry.changes.find(c => c.field === 'comentario');
        if (commentChange) {
          console.log(`   Original comment: "${commentChange.oldValue}"`);
          console.log(`   New comment: "${commentChange.newValue}"`);
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
      
      // Verificar que el comentario original se restauró
      if (restoredTransaction.comentario === 'Pago de prueba en supermercado') {
        console.log('✅ Original comment restored correctly');
      } else {
        console.log('❌ Original comment was not restored correctly');
        console.log(`   Expected: "Pago de prueba en supermercado"`);
        console.log(`   Got: "${restoredTransaction.comentario}"`);
      }
    } else {
      console.log('❌ Failed to restore transaction');
      return;
    }

    // 6. Verificar historial de restore
    console.log('\n6️⃣ Checking restore history...');
    const finalHistoryResponse = await axios.get(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${transactionId}/history`,
      { headers }
    );

    if (finalHistoryResponse.data.success) {
      const history = finalHistoryResponse.data.history;
      const restoreEntry = history.find(h => h.action === 'restored');
      
      if (restoreEntry) {
        console.log('✅ Restore history found:');
        const commentChange = restoreEntry.changes.find(c => c.field === 'comentario');
        if (commentChange) {
          console.log(`   Old comment: "${commentChange.oldValue}"`);
          console.log(`   New comment: "${commentChange.newValue}"`);
        }
      }
    }

    // 7. Probar múltiples ciclos delete/restore
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
      
      // Debería tener: "Pago de prueba en supermercado | Deleted at [timestamp]"
      if (deleted2Transaction.comentario.includes('Pago de prueba en supermercado') && 
          deleted2Transaction.comentario.includes('Deleted at')) {
        console.log('   ✅ Original comment preserved in 2nd delete');
      } else {
        console.log('   ❌ Original comment not preserved in 2nd delete');
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
      
      if (restored2Transaction.comentario === 'Pago de prueba en supermercado') {
        console.log('   ✅ Original comment restored correctly in 2nd restore');
      } else {
        console.log('   ❌ Original comment not restored correctly in 2nd restore');
      }
    }

    console.log('\n🎉 Comment preservation test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Ejecutar el test
if (require.main === module) {
  testCommentPreservation();
}

module.exports = { testCommentPreservation };
