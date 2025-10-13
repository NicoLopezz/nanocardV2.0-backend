#!/usr/bin/env node

require('dotenv').config();

const http = require('http');

const BASE_URL = 'http://localhost:3001';

const ENDPOINTS = [
  { 
    name: 'Import CryptoMate Cards',
    url: '/api/real-cryptomate/import-cryptomate-cards',
    method: 'POST'
  },
  { 
    name: 'Refresh CryptoMate Transactions',
    url: '/api/real-cryptomate/refresh-all-transactions',
    method: 'POST'
  },
  { 
    name: 'Import Mercury Cards',
    url: '/api/real-mercury/import-mercury-cards',
    method: 'POST'
  },
  { 
    name: 'Refresh Mercury Transactions',
    url: '/api/real-mercury/refresh-all-transactions',
    method: 'POST'
  }
];

function makeRequest(url, method = 'POST', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const postData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 120000
    };
    
    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            data: parsed
          });
        } catch (error) {
          reject(new Error(`Error parsing response: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

async function refreshCardsStats() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🚀 REFRESH CARDS & STATS JOB');
  console.log(`📅 ${new Date().toLocaleString('es-AR')}`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  const startTime = Date.now();
  const results = [];
  
  for (const endpoint of ENDPOINTS) {
    console.log(`\n▶▶▶ ${endpoint.name}`);
    
    try {
      const requestStart = Date.now();
      const response = await makeRequest(`${BASE_URL}${endpoint.url}`, endpoint.method);
      const requestTime = Date.now() - requestStart;
      
      if (response.statusCode === 200 && response.data.success) {
        const summary = {
          endpoint: endpoint.name,
          success: true,
          duration: requestTime,
          data: response.data
        };
        
        if (endpoint.name.includes('CryptoMate Cards')) {
          const usersImported = response.data.summary?.usersImported || 0;
          const cardsImported = response.data.summary?.cardsImported || 0;
          const cardsUpdated = response.data.summary?.cardsUpdated || 0;
          console.log(`    ✅ ${usersImported} users, ${cardsImported} cards imported, ${cardsUpdated} updated (${requestTime}ms)`);
        } else if (endpoint.name.includes('Mercury Cards')) {
          const usersImported = response.data.summary?.usersImported || 0;
          const cardsImported = response.data.summary?.cardsImported || 0;
          const cardsUpdated = response.data.summary?.cardsUpdated || 0;
          console.log(`    ✅ ${usersImported} users, ${cardsImported} cards imported, ${cardsUpdated} updated (${requestTime}ms)`);
        } else if (endpoint.name.includes('CryptoMate Transactions')) {
          const cardsWithNew = response.data.summary?.cardsWithNewTransactions || 0;
          const newTxs = response.data.summary?.newTransactionsCreated || 0;
          console.log(`    ✅ ${cardsWithNew} cards with ${newTxs} new transactions (${requestTime}ms)`);
          
          if (response.data.cardsWithNewTransactions && response.data.cardsWithNewTransactions.length > 0) {
            response.data.cardsWithNewTransactions.forEach(card => {
              console.log(`       - ${card.cardName}: ${card.newTransactions?.length || 0} new`);
            });
          }
        } else if (endpoint.name.includes('Mercury Transactions')) {
          const cardsWithNew = response.data.summary?.cardsWithNewTransactions || 0;
          const newTxs = response.data.summary?.newTransactionsCreated || 0;
          console.log(`    ✅ ${cardsWithNew} cards with ${newTxs} new transactions (${requestTime}ms)`);
          
          if (response.data.cardsWithNewTransactions && response.data.cardsWithNewTransactions.length > 0) {
            response.data.cardsWithNewTransactions.forEach(card => {
              console.log(`       - ${card.cardName}: ${card.newTransactions?.length || 0} new`);
            });
          }
        }
        
        results.push(summary);
        
      } else {
        throw new Error(`HTTP ${response.statusCode}: ${response.data?.message || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.log(`    ❌ ERROR: ${error.message}`);
      results.push({
        endpoint: endpoint.name,
        success: false,
        error: error.message
      });
    }
  }
  
  const totalTime = Date.now() - startTime;
  
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('📊 FINAL SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  const cryptoMateImport = results.find(r => r.endpoint === 'Import CryptoMate Cards');
  const cryptoMateRefresh = results.find(r => r.endpoint === 'Refresh CryptoMate Transactions');
  const mercuryImport = results.find(r => r.endpoint === 'Import Mercury Cards');
  const mercuryRefresh = results.find(r => r.endpoint === 'Refresh Mercury Transactions');
  
  console.log('🔷 CryptoMate:');
  if (cryptoMateImport && cryptoMateImport.success) {
    const users = cryptoMateImport.data.summary?.usersImported || 0;
    const imported = cryptoMateImport.data.summary?.cardsImported || 0;
    const updated = cryptoMateImport.data.summary?.cardsUpdated || 0;
    console.log(`   Cards: ${imported} imported, ${updated} updated | Users: ${users}`);
  } else {
    console.log(`   ❌ Import failed`);
  }
  
  if (cryptoMateRefresh && cryptoMateRefresh.success) {
    const cardsWithNew = cryptoMateRefresh.data.summary?.cardsWithNewTransactions || 0;
    const newTxs = cryptoMateRefresh.data.summary?.newTransactionsCreated || 0;
    console.log(`   Transactions: ${newTxs} new in ${cardsWithNew} cards`);
    
    if (cryptoMateRefresh.data.cardsWithNewTransactions && cryptoMateRefresh.data.cardsWithNewTransactions.length > 0) {
      cryptoMateRefresh.data.cardsWithNewTransactions.forEach(card => {
        console.log(`      - ${card.cardName}: ${card.newTransactions?.length || 0} new`);
      });
    }
  } else {
    console.log(`   ❌ Refresh failed`);
  }
  
  console.log('\n🔶 Mercury:');
  if (mercuryImport && mercuryImport.success) {
    const users = mercuryImport.data.summary?.usersImported || 0;
    const imported = mercuryImport.data.summary?.cardsImported || 0;
    const updated = mercuryImport.data.summary?.cardsUpdated || 0;
    console.log(`   Cards: ${imported} imported, ${updated} updated | Users: ${users}`);
  } else {
    console.log(`   ❌ Import failed`);
  }
  
  if (mercuryRefresh && mercuryRefresh.success) {
    const cardsWithNew = mercuryRefresh.data.summary?.cardsWithNewTransactions || 0;
    const newTxs = mercuryRefresh.data.summary?.newTransactionsCreated || 0;
    console.log(`   Transactions: ${newTxs} new in ${cardsWithNew} cards`);
    
    if (mercuryRefresh.data.cardsWithNewTransactions && mercuryRefresh.data.cardsWithNewTransactions.length > 0) {
      mercuryRefresh.data.cardsWithNewTransactions.forEach(card => {
        console.log(`      - ${card.cardName}: ${card.newTransactions?.length || 0} new`);
      });
    }
  } else {
    console.log(`   ❌ Refresh failed`);
  }
  
  console.log('\n⏱️  Performance:');
  console.log(`   Total: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
  console.log(`   Success: ${results.filter(r => r.success).length}/${results.length}`);
  
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`✅ Job completed at ${new Date().toLocaleString('es-AR')}`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  const allSuccess = results.every(r => r.success);
  process.exit(allSuccess ? 0 : 1);
}

if (require.main === module) {
  refreshCardsStats()
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { refreshCardsStats };

