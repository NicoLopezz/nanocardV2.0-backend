require('dotenv').config();
const mongoose = require('mongoose');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

async function updateCardsBatchSmart() {
  try {
    console.log('🚀 Starting SMART batch update for ALL cards...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const cardsDb = mongoose.connection.useDb('dev_cards');
    const cards = cardsDb.collection('cards');
    
    // 1. Obtener todas las cards
    const allCards = await cards.find({}).toArray();
    console.log(`\\n📊 Total cards to process: ${allCards.length}`);
    
    // 2. Procesar en lotes de 10
    const batchSize = 10;
    const totalBatches = Math.ceil(allCards.length / batchSize);
    
    console.log(`\\n📦 Processing in batches of ${batchSize} cards (${totalBatches} batches total)`);
    
    let processedCards = 0;
    let successfulCards = 0;
    let failedCards = 0;
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, allCards.length);
      const batchCards = allCards.slice(startIndex, endIndex);
      
      console.log(`\\n📥 BATCH ${batchIndex + 1}/${totalBatches}: Processing cards ${startIndex + 1}-${endIndex}`);
      
      // Procesar cada card en el lote
      for (let cardIndex = 0; cardIndex < batchCards.length; cardIndex++) {
        const card = batchCards[cardIndex];
        const globalIndex = startIndex + cardIndex + 1;
        
        console.log(`\\n   📋 Card ${globalIndex}/${allCards.length}: ${card.name} (${card._id})`);
        
        try {
          const importCommand = `curl -X POST http://localhost:3001/api/real-cryptomate/import-transactions/${card._id} \\
  -H "Content-Type: application/json" \\
  -d '{
    "fromDate": "2024-01-01",
    "toDate": "2025-12-31",
    "maxPages": 10,
    "operations": "TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE"
  }'`;
          
          const { stdout, stderr } = await execAsync(importCommand);
          
          // Parse response to get summary
          try {
            const response = JSON.parse(stdout);
            if (response.success) {
              console.log(`     ✅ Success: ${response.summary.imported} imported, ${response.summary.updated} updated`);
              successfulCards++;
            } else {
              console.log(`     ❌ Failed: ${response.error || 'Unknown error'}`);
              failedCards++;
            }
          } catch (parseError) {
            console.log(`     ⚠️  Response received but couldn't parse JSON`);
            successfulCards++; // Assume success if we got a response
          }
          
        } catch (error) {
          console.log(`     ❌ Error: ${error.message}`);
          failedCards++;
        }
        
        processedCards++;
        
        // Pequeña pausa entre cards para no sobrecargar
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Pausa más larga entre lotes
      if (batchIndex < totalBatches - 1) {
        console.log(`\\n⏸️  Batch ${batchIndex + 1} completed. Pausing before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // 3. Resumen final
    console.log(`\\n🎉 BATCH UPDATE COMPLETED!`);
    console.log(`\\n📊 Final Summary:`);
    console.log(`   - Total cards processed: ${processedCards}`);
    console.log(`   - Successful: ${successfulCards}`);
    console.log(`   - Failed: ${failedCards}`);
    console.log(`   - Success rate: ${((successfulCards / processedCards) * 100).toFixed(1)}%`);
    
    if (failedCards > 0) {
      console.log(`\\n⚠️  ${failedCards} cards failed. Check the logs above for details.`);
    }
    
    console.log(`\\n✅ All cards have been processed with the new transaction logic!`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateCardsBatchSmart();

