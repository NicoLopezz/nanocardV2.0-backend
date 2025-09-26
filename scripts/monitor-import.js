require('dotenv').config();
const mongoose = require('mongoose');
const { exec } = require('child_process');

const NEW_DB_URI = process.env.MONGODB_URI;

const monitorImport = async () => {
  console.log('🔍 Starting import monitor...');
  console.log('📊 Will check progress every 30 seconds');
  console.log('⏹️  Press Ctrl+C to stop monitoring\n');
  
  let lastCount = 0;
  let checkCount = 0;
  
  const checkProgress = async () => {
    try {
      checkCount++;
      const connection = await mongoose.connect(NEW_DB_URI);
      
      const cardsDb = connection.connection.useDb('dev_cards');
      const transactionsDb = connection.connection.useDb('dev_transactions');
      
      const totalCards = await cardsDb.collection('cards').countDocuments();
      const totalTransactions = await transactionsDb.collection('transactions').countDocuments();
      
      const cardsWithTransactions = await transactionsDb.collection('transactions').aggregate([
        { $group: { _id: '$cardId' } }
      ]).toArray();
      
      const progressPercentage = Math.round((cardsWithTransactions.length / totalCards) * 100);
      const transactionsDelta = totalTransactions - lastCount;
      
      // Verificar si el proceso aún está corriendo
      exec('ps aux | grep "import-all-transactions" | grep -v grep', (error, stdout) => {
        const isRunning = !error && stdout.trim().length > 0;
        const status = isRunning ? '🟢 RUNNING' : '🔴 STOPPED';
        
        console.log(`[${new Date().toLocaleTimeString()}] Check #${checkCount} - ${status}`);
        console.log(`   📋 Cards: ${cardsWithTransactions.length}/${totalCards} (${progressPercentage}%)`);
        console.log(`   💰 Transactions: ${totalTransactions} (+${transactionsDelta})`);
        
        if (!isRunning && progressPercentage < 100) {
          console.log('\n❌ Import process stopped unexpectedly!');
          console.log('🔄 You may need to restart the import process');
          process.exit(1);
        } else if (progressPercentage >= 100) {
          console.log('\n🎉 IMPORT COMPLETED SUCCESSFULLY!');
          console.log('✅ All cards have been processed');
          process.exit(0);
        }
      });
      
      lastCount = totalTransactions;
      await mongoose.disconnect();
      
    } catch (error) {
      console.error(`❌ Monitor error: ${error.message}`);
    }
  };
  
  // Primer check inmediato
  await checkProgress();
  
  // Checks cada 30 segundos
  const interval = setInterval(checkProgress, 30000);
  
  // Manejar Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n⏹️  Monitoring stopped by user');
    clearInterval(interval);
    mongoose.disconnect();
    process.exit(0);
  });
};

monitorImport().catch(console.error);
