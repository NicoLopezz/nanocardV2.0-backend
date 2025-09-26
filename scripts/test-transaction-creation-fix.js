const http = require('http');

// Configuración del servidor
const BASE_URL = 'http://localhost:3001';
let ADMIN_TOKEN = null; // Se obtendrá dinámicamente

// Función para hacer requests con autenticación usando http nativo
const makeRequest = async (method, path, data = null) => {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    // Agregar token si existe
    if (ADMIN_TOKEN) {
      options.headers['Authorization'] = `Bearer ${ADMIN_TOKEN}`;
    }
    
    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }
    
    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonResponse = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(jsonResponse);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${jsonResponse.error || body}`));
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
};

// Función para hacer login y obtener token
const login = async () => {
  console.log('🔐 Obteniendo token de administrador...');
  
  try {
    const loginData = {
      loginName: 'Darola',
      last4: '0517'
    };
    
    const response = await makeRequest('POST', '/api/auth/login', loginData);
    
    if (response.success && response.data && response.data.tokens) {
      ADMIN_TOKEN = response.data.tokens.accessToken;
      console.log(`✅ Token obtenido exitosamente`);
      console.log(`   - User: ${response.data.user.username}`);
      console.log(`   - Role: ${response.data.user.role}`);
      console.log(`   - Card: ${response.data.card.name} (${response.data.card.last4})`);
      return true;
    } else {
      console.error('❌ Error en login:', response);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error durante login:', error.message);
    return false;
  }
};

// Función para probar creación de transacción con fix aplicado
const testTransactionCreationFixed = async () => {
  console.log('🔧 Probando creación de transacción con fix aplicado...\n');
  
  const cardId = 'TTxprbYhkeYIKWsfxYeyGuoMLR6l1NN9';
  
  try {
    const transactionData = {
      amount: 25.00,
      operation: 'WALLET_DEPOSIT',
      date: new Date().toLocaleDateString('en-GB'),
      time: new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }),
      comentario: `Test transaction with fix at ${new Date().toISOString()}`
    };
    
    console.log('📤 Enviando datos de transacción:');
    console.log(`   - Amount: $${transactionData.amount}`);
    console.log(`   - Operation: ${transactionData.operation}`);
    console.log(`   - Date: ${transactionData.date}`);
    console.log(`   - Time: ${transactionData.time}`);
    console.log(`   - Comment: ${transactionData.comentario}`);
    
    const response = await makeRequest('POST', `/api/cards/card/${cardId}/transactions`, transactionData);
    
    console.log('\n✅ Transacción creada exitosamente!');
    console.log(`   - Success: ${response.success}`);
    console.log(`   - Message: ${response.message}`);
    console.log(`   - Transaction ID: ${response.transaction._id}`);
    console.log(`   - Transaction Name: ${response.transaction.name}`);
    console.log(`   - Transaction Amount: $${response.transaction.amount}`);
    console.log(`   - Transaction Operation: ${response.transaction.operation}`);
    console.log(`   - Updated Card Stats:`);
    console.log(`     * Deposited: $${response.updatedCardStats.deposited}`);
    console.log(`     * Posted: $${response.updatedCardStats.posted}`);
    console.log(`     * Available: $${response.updatedCardStats.available}`);
    console.log(`   - Response Time: ${response.responseTime}ms`);
    
    return response;
    
  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error.message);
    return null;
  }
};

// Función para probar el nuevo endpoint de stats
const testCardStatsEndpoint = async () => {
  console.log('\n🔍 Probando endpoint de stats de tarjeta...\n');
  
  const cardId = 'TTxprbYhkeYIKWsfxYeyGuoMLR6l1NN9';
  
  try {
    const response = await makeRequest('GET', `/api/cards/admin/${cardId}/stats`);
    
    console.log('✅ Stats obtenidos exitosamente!');
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
    console.error('\n❌ Error obteniendo stats:', error.message);
    return null;
  }
};

// Función principal
const runTest = async () => {
  console.log('🚀 Iniciando pruebas con fix aplicado...\n');
  
  try {
    // 0. Hacer login primero para obtener token válido
    const loginSuccess = await login();
    if (!loginSuccess) {
      console.log('❌ No se pudo obtener token. Terminando pruebas.');
      return;
    }
    
    console.log(); // Espacio en blanco
    
    // 1. Probar creación de transacción (esto debería funcionar ahora sin errores)
    const transactionResult = await testTransactionCreationFixed();
    
    if (transactionResult) {
      console.log('\n🎉 ¡Fix exitoso! La transacción se creó sin errores de validación.');
      
      // 2. Probar el endpoint de stats
      const statsResult = await testCardStatsEndpoint();
      
      if (statsResult) {
        console.log('\n🎉 ¡Endpoint de stats funcionando perfectamente!');
        
        // Comparar los valores para verificar consistencia
        if (transactionResult.updatedCardStats.deposited === statsResult.card.deposited) {
          console.log('\n✅ Los stats están consistentes entre endpoints!');
        } else {
          console.log('\n⚠️  Discrepancia en los stats detectada.');
        }
      }
      
    } else {
      console.log('\n❌ El fix no funcionó, aún hay errores.');
    }
    
    console.log('\n🏁 Pruebas completadas!');
    
  } catch (error) {
    console.error('\n❌ Error durante las pruebas:', error.message);
  }
};

// Ejecutar pruebas
if (require.main === module) {
  runTest();
}

module.exports = {
  testTransactionCreationFixed,
  testCardStatsEndpoint,
  runTest
};
