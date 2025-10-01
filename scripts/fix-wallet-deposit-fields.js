const { connectDatabases } = require('../config/database');
const { getTransactionModel } = require('../models/Transaction');
const config = require('../config/environment');

async function fixWalletDepositFields() {
  try {
    console.log('🚀 Iniciando corrección de campos contables en WALLET_DEPOSIT...');
    await connectDatabases();
    
    const Transaction = getTransactionModel();
    const commissionRate = config.WALLET_DEPOSIT_COMMISSION_RATE || 0.003;
    
    // Encontrar transacciones WALLET_DEPOSIT que necesitan corrección
    const transactionsToFix = await Transaction.find({
      operation: 'WALLET_DEPOSIT',
      $or: [
        { gross_amount: { $exists: false } },
        { gross_amount: null },
        { commission_rate: { $exists: false } },
        { commission_rate: null }
      ]
    });
    
    console.log(`📊 Encontradas ${transactionsToFix.length} transacciones WALLET_DEPOSIT para corregir`);
    
    if (transactionsToFix.length === 0) {
      console.log('✅ No hay transacciones que corregir');
      process.exit(0);
    }
    
    let corrected = 0;
    let errors = 0;
    
    for (const transaction of transactionsToFix) {
      try {
        // Calcular campos contables
        const grossAmount = transaction.amount / (1 - commissionRate); // Revertir la comisión para obtener el monto original
        const commissionAmount = grossAmount * commissionRate;
        const netAmount = grossAmount - commissionAmount;
        
        // Actualizar la transacción con los campos contables
        await Transaction.findByIdAndUpdate(transaction._id, {
          gross_amount: grossAmount,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          net_amount: netAmount,
          amount: netAmount // Asegurar que amount = net_amount
        });
        
        corrected++;
        
        if (corrected % 50 === 0) {
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
      operation: 'WALLET_DEPOSIT',
      $or: [
        { gross_amount: { $exists: false } },
        { gross_amount: null },
        { commission_rate: { $exists: false } },
        { commission_rate: null }
      ]
    });
    
    if (remainingToFix === 0) {
      console.log('\n✅ ¡Todas las transacciones WALLET_DEPOSIT están correctas!');
    } else {
      console.log(`\n⚠️  Aún quedan ${remainingToFix} transacciones por corregir`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error general:', error.message);
    process.exit(1);
  }
}

fixWalletDepositFields();
