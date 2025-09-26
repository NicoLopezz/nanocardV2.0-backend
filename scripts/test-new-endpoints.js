const axios = require('axios');

// Configuración del servidor
const BASE_URL = 'http://localhost:3000';
const ADMIN_TOKEN = 'your-admin-token-here'; // Reemplazar con token real

// Función para hacer requests con autenticación
const makeRequest = async (method, url, data = null) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ Error en ${method} ${url}:`, error.response?.data || error.message);
    throw error;
  }
};

// Función para probar el nuevo endpoint de stats de tarjeta
const testCardStatsEndpoint = async (cardId) => {
  console.log(`\n🔍 Probando GET /api/cards/admin/${cardId}/stats`);
  
  try {
    const response = await makeRequest('GET', `/api/cards/admin/${cardId}/stats`);
    
    console.log('✅ Respuesta exitosa:');
    console.log(`   - Success: ${response.success}`);
    console.log(`   - Card ID: ${response.card._id}`);
    console.log(`   - Card Name: ${response.card.name}`);
    console.log(`   - Supplier: ${response.card.supplier}`);
    console.log(`   - Last4: ${response.card.last4}`);
    console.log(`   - Deposited: $${response.card.deposited}`);
    console.log(`   - Posted: $${response.card.posted}`);
    console.log(`   - Available: $${response.card.available}`);
    console.log(`   - Status: ${response.card.status}`);
    console.log(`   - Response Time: ${response.responseTime}ms`);
    
    return response;
  } catch (error) {
    console.error('❌ Error probando endpoint de stats:', error.message);
    return null;
  }
};

// Función para probar actualización de transacción con stats
const testTransactionUpdateWithStats = async (cardId, transactionId) => {
  console.log(`\n🔍 Probando PUT /api/cards/card/${cardId}/transactions/${transactionId} con stats`);
  
  try {
    const updateData = {
      comentario: `Test update at ${new Date().toISOString()}`
    };
    
    const response = await makeRequest('PUT', `/api/cards/card/${cardId}/transactions/${transactionId}`, updateData);
    
    console.log('✅ Respuesta exitosa:');
    console.log(`   - Success: ${response.success}`);
    console.log(`   - Message: ${response.message}`);
    console.log(`   - Transaction ID: ${response.transaction._id}`);
    console.log(`   - Updated Card Stats:`);
    console.log(`     * Deposited: $${response.updatedCardStats.deposited}`);
    console.log(`     * Posted: $${response.updatedCardStats.posted}`);
    console.log(`     * Available: $${response.updatedCardStats.available}`);
    console.log(`   - Response Time: ${response.responseTime}ms`);
    
    return response;
  } catch (error) {
    console.error('❌ Error probando actualización con stats:', error.message);
    return null;
  }
};

// Función para probar creación de transacción con stats
const testTransactionCreationWithStats = async (cardId) => {
  console.log(`\n🔍 Probando POST /api/cards/card/${cardId}/transactions con stats`);
  
  try {
    const transactionData = {
      amount: 10.00,
      operation: 'WALLET_DEPOSIT',
      date: new Date().toLocaleDateString('en-GB'),
      time: new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }),
      comentario: `Test transaction at ${new Date().toISOString()}`
    };
    
    const response = await makeRequest('POST', `/api/cards/card/${cardId}/transactions`, transactionData);
    
    console.log('✅ Respuesta exitosa:');
    console.log(`   - Success: ${response.success}`);
    console.log(`   - Message: ${response.message}`);
    console.log(`   - Transaction ID: ${response.transaction._id}`);
    console.log(`   - Updated Card Stats:`);
    console.log(`     * Deposited: $${response.updatedCardStats.deposited}`);
    console.log(`     * Posted: $${response.updatedCardStats.posted}`);
    console.log(`     * Available: $${response.updatedCardStats.available}`);
    console.log(`   - Response Time: ${response.responseTime}ms`);
    
    return response;
  } catch (error) {
    console.error('❌ Error probando creación con stats:', error.message);
    return null;
  }
};

// Función principal de prueba
const runTests = async () => {
  console.log('🚀 Iniciando pruebas de los nuevos endpoints optimizados...\n');
  
  // ID de tarjeta de prueba (reemplazar con uno real)
  const testCardId = 'TTxprbYhkeYIKWsfxYeyGuoMLR6l1NN9';
  
  try {
    // 1. Probar endpoint de stats de tarjeta
    const cardStats = await testCardStatsEndpoint(testCardId);
    
    if (cardStats) {
      console.log('\n✅ Endpoint de stats de tarjeta funcionando correctamente');
    } else {
      console.log('\n❌ Endpoint de stats de tarjeta falló');
    }
    
    // 2. Probar actualización de transacción con stats
    // Nota: Necesitarás un transactionId real para probar esto
    const testTransactionId = 'test-transaction-id';
    const updateResult = await testTransactionUpdateWithStats(testCardId, testTransactionId);
    
    if (updateResult) {
      console.log('\n✅ Endpoint de actualización con stats funcionando correctamente');
    } else {
      console.log('\n❌ Endpoint de actualización con stats falló');
    }
    
    // 3. Probar creación de transacción con stats
    const creationResult = await testTransactionCreationWithStats(testCardId);
    
    if (creationResult) {
      console.log('\n✅ Endpoint de creación con stats funcionando correctamente');
    } else {
      console.log('\n❌ Endpoint de creación con stats falló');
    }
    
    console.log('\n🎉 Pruebas completadas!');
    
  } catch (error) {
    console.error('❌ Error durante las pruebas:', error.message);
  }
};

// Ejecutar pruebas si se llama directamente
if (require.main === module) {
  runTests();
}

module.exports = {
  testCardStatsEndpoint,
  testTransactionUpdateWithStats,
  testTransactionCreationWithStats,
  runTests
};
