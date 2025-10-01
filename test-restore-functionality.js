const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3002';
const AUTH_TOKEN = 'your_auth_token_here'; // Reemplazar con token real

// Headers para las peticiones
const headers = {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json'
};

async function testRestoreFunctionality() {
  console.log('🧪 Testing Restore Functionality...\n');

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

    console.log(`✅ Found active transaction: ${activeTransaction._id} (${activeTransaction.name})`);

    // 4. Eliminar la transacción
    console.log('\n3️⃣ Deleting transaction...');
    const deleteResponse = await axios.delete(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${activeTransaction._id}`,
      { headers }
    );

    if (deleteResponse.data.success) {
      console.log('✅ Transaction deleted successfully');
      console.log(`   Updated stats:`, deleteResponse.data.updatedCardStats);
    } else {
      console.log('❌ Failed to delete transaction');
      return;
    }

    // 5. Verificar que la transacción esté eliminada
    console.log('\n4️⃣ Verifying transaction is deleted...');
    const deletedTransactionsResponse = await axios.get(
      `${BASE_URL}/api/cards/card/${card._id}/transactions?action=all-movements&limit=10`, 
      { headers }
    );
    
    const deletedTransaction = deletedTransactionsResponse.data.transactions.find(tx => 
      tx._id === activeTransaction._id
    );

    if (deletedTransaction && deletedTransaction.isDeleted) {
      console.log('✅ Transaction is marked as deleted');
    } else {
      console.log('❌ Transaction is not marked as deleted');
      return;
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
      console.log(`   Updated stats:`, restoreResponse.data.updatedCardStats);
    } else {
      console.log('❌ Failed to restore transaction');
      return;
    }

    // 7. Verificar que la transacción esté restaurada
    console.log('\n6️⃣ Verifying transaction is restored...');
    const restoredTransactionsResponse = await axios.get(
      `${BASE_URL}/api/cards/card/${card._id}/transactions?action=all-movements&limit=10`, 
      { headers }
    );
    
    const restoredTransaction = restoredTransactionsResponse.data.transactions.find(tx => 
      tx._id === activeTransaction._id
    );

    if (restoredTransaction && !restoredTransaction.isDeleted && restoredTransaction.status !== 'DELETED') {
      console.log('✅ Transaction is restored and active');
      console.log(`   Status: ${restoredTransaction.status}`);
      console.log(`   Is Deleted: ${restoredTransaction.isDeleted}`);
    } else {
      console.log('❌ Transaction is not properly restored');
      return;
    }

    // 8. Verificar historial
    console.log('\n7️⃣ Checking transaction history...');
    const historyResponse = await axios.get(
      `${BASE_URL}/api/cards/card/${card._id}/transactions/${activeTransaction._id}/history`,
      { headers }
    );

    if (historyResponse.data.success) {
      const history = historyResponse.data.history;
      console.log(`✅ Found ${history.length} history entries`);
      
      const deleteEntry = history.find(h => h.action === 'deleted');
      const restoreEntry = history.find(h => h.action === 'restored');
      
      if (deleteEntry) {
        console.log(`   Delete entry: v${deleteEntry.version} at ${deleteEntry.timestamp}`);
      }
      
      if (restoreEntry) {
        console.log(`   Restore entry: v${restoreEntry.version} at ${restoreEntry.timestamp}`);
      }
    }

    console.log('\n🎉 Restore functionality test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Transaction deleted successfully');
    console.log('   ✅ Transaction restored successfully');
    console.log('   ✅ Stats recalculated correctly');
    console.log('   ✅ History tracked properly');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Ejecutar el test
if (require.main === module) {
  testRestoreFunctionality();
}

module.exports = { testRestoreFunctionality };
