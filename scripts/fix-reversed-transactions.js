const { connectDatabases } = require('../config/database');
const { getTransactionModel } = require('../models/Transaction');

async function fixReversedTransactions() {
  try {
    console.log('🚀 Iniciando corrección de transacciones TRANSACTION_REVERSED...');
    await connectDatabases();
    
    const Transaction = getTransactionModel();
    
    // Encontrar transacciones TRANSACTION_REVERSED que necesitan corrección
    const transactionsToFix = await Transaction.find({
      operation: 'TRANSACTION_REVERSED',
      $or: [
        { bill_amount: { $exists: false } },
        { bill_amount: null },
        { credit: { $ne: true } }
      ]
    });
    
    console.log(`📊 Encontradas ${transactionsToFix.length} transacciones TRANSACTION_REVERSED para corregir`);
    
    if (transactionsToFix.length === 0) {
      console.log('✅ No hay transacciones que corregir');
      process.exit(0);
    }
    
    let corrected = 0;
    let errors = 0;
    
    for (const transaction of transactionsToFix) {
      try {
        // Actualizar la transacción con los campos corregidos
        await Transaction.findByIdAndUpdate(transaction._id, {
          credit: true, // TRANSACTION_REVERSED siempre es crédito
          // Los campos bill_amount, etc. ya deberían estar presentes si vinieron de la API
          // Solo corregimos el campo credit si está mal
        });
        
        corrected++;
        
        if (corrected % 20 === 0) {
          console.log(`✅ Corregidas ${corrected}/${transactionsToFix.length} transacciones...`);
        }
        
      } catch (error) {
        console.error(`❌ Error corrigiendo transacción ${transaction._id}:`, error.message);
        errors++;
      }
    }
    
    console.log('\n🎉 Corrección completada:');
    console.log(`✅ Transacciones corregidas: ${corrected}`);
    console.log(`❌ Errores: ${errors}`);
    console.log(`📊 Total procesadas: ${transactionsToFix.length}`);
    
    // Verificar resultado
    const remainingToFix = await Transaction.countDocuments({
      operation: 'TRANSACTION_REVERSED',
      $or: [
        { bill_amount: { $exists: false } },
        { bill_amount: null },
        { credit: { $ne: true } }
      ]
    });
    
    if (remainingToFix === 0) {
      console.log('\n✅ ¡Todas las transacciones TRANSACTION_REVERSED están correctas!');
    } else {
      console.log(`\n⚠️  Aún quedan ${remainingToFix} transacciones por corregir`);
    }
    
    // Mostrar estadísticas finales
    const totalReversed = await Transaction.countDocuments({ operation: 'TRANSACTION_REVERSED' });
    const withCredit = await Transaction.countDocuments({ operation: 'TRANSACTION_REVERSED', credit: true });
    const withBillAmount = await Transaction.countDocuments({ operation: 'TRANSACTION_REVERSED', bill_amount: { $exists: true } });
    
    console.log('\n📊 Estadísticas finales:');
    console.log(`Total TRANSACTION_REVERSED: ${totalReversed}`);
    console.log(`Con credit: true: ${withCredit}`);
    console.log(`Con bill_amount: ${withBillAmount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error general:', error.message);
    process.exit(1);
  }
}

fixReversedTransactions();
