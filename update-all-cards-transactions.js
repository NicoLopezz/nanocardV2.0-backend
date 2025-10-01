require('dotenv').config();
const mongoose = require('mongoose');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

async function updateAllCardsTransactions() {
  try {
    console.log('🚀 Starting COMPLETE transaction update for ALL cards in dev_cards...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const cardsDb = mongoose.connection.useDb('dev_cards');
    const transactionsDb = mongoose.connection.useDb('dev_transactions');
    
    const cards = cardsDb.collection('cards');
    const transactions = transactionsDb.collection('transactions');
    
    // 1. Obtener todas las cards
    console.log('\\n📊 STEP 1: Getting all cards from dev_cards...');
    const allCards = await cards.find({}).toArray();
    console.log(`   - Total cards found: ${allCards.length}`);
    
    // 2. Mostrar algunas cards de ejemplo
    console.log('\\n📋 Sample cards:');
    allCards.slice(0, 5).forEach((card, index) => {
      console.log(`   ${index + 1}. ID: ${card._id}`);
      console.log(`      Name: ${card.name}`);
      console.log(`      Last4: ${card.last4}`);
      console.log(`      Status: ${card.status}`);
      console.log('');
    });
    
    // 3. Verificar transacciones actuales por card
    console.log('\\n📊 STEP 2: Checking current transactions per card...');
    const cardsWithTransactions = [];
    
    for (const card of allCards) {
      const cardTransactions = await transactions.find({ userId: card._id }).toArray();
      if (cardTransactions.length > 0) {
        cardsWithTransactions.push({
          cardId: card._id,
          name: card.name,
          transactionCount: cardTransactions.length
        });
      }
    }
    
    console.log(`   - Cards with transactions: ${cardsWithTransactions.length}`);
    console.log('   - Sample cards with transactions:');
    cardsWithTransactions.slice(0, 5).forEach((card, index) => {
      console.log(`     ${index + 1}. ${card.cardId} (${card.name}): ${card.transactionCount} transactions`);
    });
    
    // 4. Preguntar confirmación
    console.log('\\n⚠️  IMPORTANT: This will:');
    console.log('   - Delete ALL transactions for ALL cards');
    console.log('   - Re-import ALL transactions for ALL cards');
    console.log('   - Update stats for ALL cards');
    console.log(`   - Process ${allCards.length} cards total`);
    
    console.log('\\n📝 To proceed, you need to run the import for each card manually.');
    console.log('   The script will show you the commands to run.');
    
    // 5. Generar comandos para cada card
    console.log('\\n📥 STEP 3: Import commands for each card...');
    
    const importCommands = [];
    for (const card of allCards) {
      const command = `curl -X POST http://localhost:3001/api/real-cryptomate/import-transactions/${card._id} \\
  -H "Content-Type: application/json" \\
  -d '{
    "fromDate": "2024-01-01",
    "toDate": "2025-12-31",
    "maxPages": 10,
    "operations": "TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE"
  }'`;
      
      importCommands.push({
        cardId: card._id,
        name: card.name,
        command: command
      });
    }
    
    console.log(`\\n📋 Commands generated for ${importCommands.length} cards:`);
    console.log('\\n⚠️  IMPORTANT: Run these commands one by one or create a batch script.');
    
    // Mostrar primeros 3 comandos como ejemplo
    console.log('\\n📝 Example commands (first 3 cards):');
    importCommands.slice(0, 3).forEach((cmd, index) => {
      console.log(`\\n   # Card ${index + 1}: ${cmd.name} (${cmd.cardId})`);
      console.log(`   ${cmd.command}`);
    });
    
    if (importCommands.length > 3) {
      console.log(`\\n   ... and ${importCommands.length - 3} more cards`);
    }
    
    // 6. Crear script batch
    console.log('\\n📄 STEP 4: Creating batch script...');
    
    const batchScript = `#!/bin/bash
# Batch script to update all cards transactions
# Generated on ${new Date().toISOString()}

echo "🚀 Starting batch update for ${importCommands.length} cards..."

${importCommands.map((cmd, index) => `
echo "\\n📥 Processing card ${index + 1}/${importCommands.length}: ${cmd.name} (${cmd.cardId})"
${cmd.command}
echo "✅ Card ${index + 1} completed"
`).join('')}

echo "\\n🎉 All cards processed!"
echo "📊 Total cards: ${importCommands.length}"
echo "✅ Batch update completed!"
`;
    
    const fs = require('fs');
    fs.writeFileSync('update-all-cards-batch.sh', batchScript);
    console.log('   - Batch script created: update-all-cards-batch.sh');
    console.log('   - To run: chmod +x update-all-cards-batch.sh && ./update-all-cards-batch.sh');
    
    console.log('\\n✅ Setup completed!');
    console.log('\\n📋 Next steps:');
    console.log('   1. Make sure server is running on port 3001');
    console.log('   2. Run: chmod +x update-all-cards-batch.sh');
    console.log('   3. Run: ./update-all-cards-batch.sh');
    console.log('   4. Or run commands manually one by one');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateAllCardsTransactions();

