const http = require('http');

// Configuración del servidor
let ADMIN_TOKEN = null;

// Función para hacer requests con autenticación
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

// Función para hacer login
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
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Error durante login:', error.message);
    return false;
  }
};

// Función para probar el endpoint mejorado con movimientos
const testCardStatsWithMovements = async () => {
  console.log('\n🔍 Probando GET /api/cards/admin/{cardId}/stats con movimientos...\n');
  
  const cardId = 'TTxprbYhkeYIKWsfxYeyGuoMLR6l1NN9';
  
  try {
    const response = await makeRequest('GET', `/api/cards/admin/${cardId}/stats`);
    
    console.log('✅ Response exitosa!');
    console.log('\n📊 Card Stats:');
    console.log(`   - Card ID: ${response.card._id}`);
    console.log(`   - Card Name: ${response.card.name}`);
    console.log(`   - Deposited: $${response.card.deposited}`);
    console.log(`   - Posted: $${response.card.posted}`);
    console.log(`   - Available: $${response.card.available}`);
    console.log(`   - Status: ${response.card.status}`);
    
    console.log('\n📝 Last Movements:');
    if (response.lastMovements && response.lastMovements.length > 0) {
      response.lastMovements.forEach((movement, index) => {
        console.log(`   ${index + 1}. ${movement.name}`);
        console.log(`      - Date: ${movement.date} ${movement.time}`);
        console.log(`      - Amount: $${movement.amount}`);
        console.log(`      - Operation: ${movement.operation}`);
        console.log(`      - ID: ${movement.id}`);
        console.log('');
      });
    } else {
      console.log('   No movements found');
    }
    
    console.log(`⏱️  Response Time: ${response.responseTime}ms`);
    
    // Verificar estructura de respuesta
    const hasRequiredFields = response.success && 
                             response.card && 
                             response.lastMovements &&
                             Array.isArray(response.lastMovements);
    
    if (hasRequiredFields) {
      console.log('\n✅ ¡Estructura de respuesta correcta!');
      
      // Mostrar JSON formateado como ejemplo
      console.log('\n📋 JSON Response Example:');
      console.log(JSON.stringify({
        success: response.success,
        card: response.card,
        lastMovements: response.lastMovements.slice(0, 2) // Mostrar solo 2 para ejemplo
      }, null, 2));
      
    } else {
      console.log('\n❌ Estructura de respuesta incorrecta');
    }
    
    return response;
    
  } catch (error) {
    console.error('\n❌ Error probando endpoint:', error.message);
    return null;
  }
};

// Función principal
const runTest = async () => {
  console.log('🚀 Probando endpoint mejorado con movimientos...\n');
  
  try {
    // Login primero
    const loginSuccess = await login();
    if (!loginSuccess) {
      console.log('❌ No se pudo obtener token. Terminando pruebas.');
      return;
    }
    
    // Probar el endpoint
    const result = await testCardStatsWithMovements();
    
    if (result) {
      console.log('\n🎉 ¡Prueba exitosa! El endpoint funciona correctamente con movimientos.');
    } else {
      console.log('\n❌ Falló la prueba del endpoint.');
    }
    
  } catch (error) {
    console.error('\n❌ Error durante las pruebas:', error.message);
  }
};

// Ejecutar pruebas
if (require.main === module) {
  runTest();
}

module.exports = {
  testCardStatsWithMovements,
  runTest
};
