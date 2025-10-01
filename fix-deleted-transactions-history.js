const mongoose = require('mongoose');
const { getTransactionModel } = require('./models/Transaction');

async function fixDeletedTransactionsHistory() {
  console.log('🔧 Fixing deleted transactions without comment history...\n');

  try {
    // Conectar a la base de datos
    const { databases } = require('./config/database');
    const Transaction = getTransactionModel();

    // Buscar transacciones eliminadas que no tienen historial de comentario
    const deletedTransactions = await Transaction.find({
      isDeleted: true,
      status: 'DELETED',
      'history.action': 'deleted'
    });

    console.log(`📊 Found ${deletedTransactions.length} deleted transactions to check`);

    let fixedCount = 0;
    let alreadyFixedCount = 0;

    for (const transaction of deletedTransactions) {
      console.log(`\n🔍 Processing transaction: ${transaction._id}`);
      
      // Buscar el historial de delete
      const deleteHistory = transaction.history.find(h => h.action === 'deleted');
      
      if (deleteHistory) {
        // Verificar si ya tiene el cambio del comentario
        const hasCommentChange = deleteHistory.changes.some(c => c.field === 'comentario');
        
        if (!hasCommentChange) {
          console.log(`   ⚠️ Missing comment history - fixing...`);
          
          // Agregar el cambio del comentario al historial existente
          const originalComment = transaction.comentario && transaction.comentario.includes('Deleted at') 
            ? '' // Si el comentario actual es "Deleted at...", el original era vacío
            : transaction.comentario || ''; // Usar el comentario actual como original
          
          const newCommentChange = {
            field: 'comentario',
            oldValue: originalComment,
            newValue: transaction.comentario || `Deleted at ${transaction.deletedAt?.toLocaleDateString('en-GB')} ${transaction.deletedAt?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`
          };

          // Actualizar el historial
          await Transaction.updateOne(
            { _id: transaction._id },
            { 
              $push: { 
                'history.$[elem].changes': newCommentChange 
              }
            },
            { 
              arrayFilters: [{ 'elem.version': deleteHistory.version }]
            }
          );

          console.log(`   ✅ Added comment history for version ${deleteHistory.version}`);
          console.log(`      Original: "${newCommentChange.oldValue}"`);
          console.log(`      New: "${newCommentChange.newValue}"`);
          
          fixedCount++;
        } else {
          console.log(`   ✅ Already has comment history`);
          alreadyFixedCount++;
        }
      } else {
        console.log(`   ⚠️ No delete history found`);
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`   ✅ Fixed: ${fixedCount} transactions`);
    console.log(`   ✅ Already correct: ${alreadyFixedCount} transactions`);
    console.log(`   📊 Total processed: ${deletedTransactions.length} transactions`);

    if (fixedCount > 0) {
      console.log(`\n🎉 Migration completed! Now you can restore transactions with proper comment history.`);
    } else {
      console.log(`\n✅ All transactions already have proper comment history.`);
    }

  } catch (error) {
    console.error('❌ Error fixing deleted transactions:', error);
  } finally {
    // No cerrar la conexión ya que puede estar siendo usada por la aplicación
    console.log('\n🔧 Fix completed.');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  fixDeletedTransactionsHistory();
}

module.exports = { fixDeletedTransactionsHistory };
