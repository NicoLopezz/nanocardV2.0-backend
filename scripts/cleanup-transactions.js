const { connectDatabases } = require('../config/database');
const { getTransactionModel } = require('../models/Transaction');

const cleanupTransactions = async () => {
  try {
    console.log('🚀 Connecting to databases...');
    await connectDatabases();
    console.log('✅ Connected to databases\n');

    const Transaction = getTransactionModel();

    // Contar transacciones antes de limpiar
    const countBefore = await Transaction.countDocuments();
    console.log(`📊 Transactions before cleanup: ${countBefore}`);

    // Limpiar todas las transacciones
    const result = await Transaction.deleteMany({});
    console.log(`🗑️  Deleted ${result.deletedCount} transactions`);

    // Verificar que esté vacía
    const countAfter = await Transaction.countDocuments();
    console.log(`📊 Transactions after cleanup: ${countAfter}`);

    console.log('\n✅ Transactions database cleaned successfully!');

  } catch (error) {
    console.error('❌ Error cleaning transactions:', error);
    process.exit(1);
  }
};

// Ejecutar si es llamado directamente
if (require.main === module) {
  cleanupTransactions();
}

module.exports = { cleanupTransactions };
