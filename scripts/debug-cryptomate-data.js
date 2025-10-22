const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function debugCryptoMateData() {
  try {
    console.log('🔍 Fetching CryptoMate data to debug...');
    
    const curlCommand = `curl --location --max-time 30 --connect-timeout 10 'https://api.cryptomate.me/cards/virtual-cards/list' --header 'x-api-key: api-45f14849-914c-420e-a788-2e969d92bd5d' --header 'Content-Type: application/json' --header 'Cookie: JSESSIONID=97A7964CFD65CCA327AF0AA1AB798D42'`;
    
    const { stdout, stderr } = await execAsync(curlCommand);
    
    if (stderr) {
      console.error('❌ Curl stderr:', stderr);
    }
    
    const data = JSON.parse(stdout);
    console.log(`✅ Fetched ${data.length} cards from CryptoMate`);
    
    // Buscar la card específica
    const targetCard = data.find(card => 
      card.card_holder_name && 
      card.card_holder_name.toLowerCase().includes('nicolas') ||
      card.id === '3tgy8OArdOY4q0BWWfDy91IPP9ZNxzrT'
    );
    
    if (targetCard) {
      console.log('\n🎯 Target card found:');
      console.log(`   - ID: ${targetCard.id}`);
      console.log(`   - Name: ${targetCard.card_holder_name}`);
      console.log(`   - Status: ${targetCard.status}`);
      console.log(`   - Last4: ${targetCard.last4}`);
      console.log(`   - Type: ${targetCard.type}`);
      console.log(`   - Daily Limit: ${targetCard.daily_limit}`);
      console.log(`   - Monthly Limit: ${targetCard.monthly_limit}`);
      
      // Simular la conversión
      const nanoCard = {
        _id: targetCard.id,
        userId: targetCard.id,
        name: targetCard.card_holder_name,
        supplier: 'cryptomate'
      };
      
      console.log('\n🔄 Converted to Nano format:');
      console.log(`   - _id: ${nanoCard._id}`);
      console.log(`   - userId: ${nanoCard.userId}`);
      console.log(`   - name: ${nanoCard.name}`);
      console.log(`   - supplier: ${nanoCard.supplier}`);
      
    } else {
      console.log('❌ Target card not found in CryptoMate data');
      console.log('\n📋 First 5 cards:');
      data.slice(0, 5).forEach((card, index) => {
        console.log(`  ${index + 1}. ${card.card_holder_name} (${card.id})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

if (require.main === module) {
  debugCryptoMateData();
}

module.exports = { debugCryptoMateData };
