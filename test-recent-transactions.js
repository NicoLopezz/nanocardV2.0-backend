const axios = require('axios');

const testRecentTransactions = async () => {
  try {
    console.log('🧪 Testing recent transactions endpoint...');
    
    const response = await axios.get('http://localhost:3000/api/transactions/recent', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Response Status:', response.status);
    console.log('📊 Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.data.transactions) {
      console.log(`\n🎯 Found ${response.data.data.totalTransactions} recent transactions`);
      
      response.data.data.transactions.forEach((txn, index) => {
        console.log(`\n${index + 1}. Transaction: ${txn.transactionId}`);
        console.log(`   User: ${txn.userName} (${txn.userId})`);
        console.log(`   Card: ${txn.cardName} (****${txn.last4})`);
        console.log(`   Amount: $${txn.transactionDetails.amount}`);
        console.log(`   Operation: ${txn.transactionDetails.operation}`);
        console.log(`   Date: ${txn.transactionDetails.date} ${txn.transactionDetails.time}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error testing endpoint:', error.response?.data || error.message);
  }
};

// Test with different limits
const testWithLimit = async (limit) => {
  try {
    console.log(`\n🧪 Testing with limit=${limit}...`);
    
    const response = await axios.get(`http://localhost:3000/api/transactions/recent?limit=${limit}`);
    
    console.log(`✅ Found ${response.data.data.totalTransactions} transactions`);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
};

const runTests = async () => {
  await testRecentTransactions();
  await testWithLimit(5);
  await testWithLimit(20);
};

if (require.main === module) {
  runTests();
}

module.exports = { testRecentTransactions, testWithLimit };
