const { connectDatabases, databases } = require('./config/database');
const mongoose = require('mongoose');

async function fixSupplierCase() {
  try {
    console.log('🔧 Fixing supplier case in production...');
    
    await connectDatabases();
    
    // Esperar a que la conexión esté lista
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const Transaction = databases.transactions.connection.model('Transaction', new mongoose.Schema({}, { strict: false }));
    
    // Buscar transacciones con supplier incorrecto
    const transactionsWithCryptoMate = await Transaction.find({ supplier: 'CryptoMate' });
    console.log(`📊 Found ${transactionsWithCryptoMate.length} transactions with 'CryptoMate'`);
    
    if (transactionsWithCryptoMate.length > 0) {
      // Corregir a minúscula
      const result = await Transaction.updateMany(
        { supplier: 'CryptoMate' },
        { $set: { supplier: 'cryptomate' } }
      );
      
      console.log(`✅ Updated ${result.modifiedCount} transactions from 'CryptoMate' to 'cryptomate'`);
    }
    
    // Buscar transacciones con Mercury incorrecto
    const transactionsWithMercury = await Transaction.find({ supplier: 'Mercury' });
    console.log(`📊 Found ${transactionsWithMercury.length} transactions with 'Mercury'`);
    
    if (transactionsWithMercury.length > 0) {
      // Corregir a minúscula
      const result = await Transaction.updateMany(
        { supplier: 'Mercury' },
        { $set: { supplier: 'mercury' } }
      );
      
      console.log(`✅ Updated ${result.modifiedCount} transactions from 'Mercury' to 'mercury'`);
    }
    
    // Verificar resultado final
    const cryptomateCount = await Transaction.countDocuments({ supplier: 'cryptomate' });
    const mercuryCount = await Transaction.countDocuments({ supplier: 'mercury' });
    const invalidCount = await Transaction.countDocuments({ 
      supplier: { $in: ['CryptoMate', 'Mercury'] } 
    });
    
    console.log(`\n📊 Final statistics:`);
    console.log(`   - cryptomate: ${cryptomateCount}`);
    console.log(`   - mercury: ${mercuryCount}`);
    console.log(`   - invalid (CryptoMate/Mercury): ${invalidCount}`);
    
    if (invalidCount === 0) {
      console.log('✅ All supplier values are now correct!');
    } else {
      console.log('❌ Some invalid supplier values remain');
    }
    
  } catch (error) {
    console.error('❌ Error fixing supplier case:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  fixSupplierCase();
}

module.exports = { fixSupplierCase };
