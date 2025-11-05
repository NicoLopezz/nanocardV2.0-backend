const mongoose = require('mongoose');

const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';

async function analyzeDifference() {
  try {
    await mongoose.connect(OLD_DB_URI);
    console.log('✅ Connected to old DB\n');
    
    const db = mongoose.connection.db;
    const cardsCollection = db.collection('test-db-27-10-25');
    
    const santiagoCard = await cardsCollection.findOne({
      'Card_id': '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2'
    });
    
    if (!santiagoCard) {
      console.log('❌ Card not found');
      return;
    }
    
    console.log('📊 Analyzing Santiago Romano transactions in OLD DB:\n');
    
    const movements = santiagoCard.movimientos || [];
    
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let totalApproved = 0;
    let totalPending = 0;
    let totalRefunds = 0;
    let totalReversed = 0;
    
    const deposits = [];
    const withdrawals = [];
    const approved = [];
    const pending = [];
    const refunds = [];
    const reversed = [];
    
    movements.forEach(mov => {
      const amount = mov.MontoTransacction || 0;
      
      if (mov.status === 'Completed' && mov.credit === true && mov.MontoTransacction > 0) {
        if (mov.name === 'Deposited' || mov.name === 'Deposit') {
          totalDeposits += amount;
          deposits.push(mov);
        }
      }
      
      if (mov.name === 'WITHDRAWAL') {
        totalWithdrawals += amount;
        withdrawals.push(mov);
      }
      
      if (mov.status === 'sent' || mov.status === 'completed') {
        if (mov.credit === false && mov.MontoTransacction > 0) {
          totalApproved += amount;
          approved.push(mov);
        }
      }
      
      if (mov.status === 'pending') {
        totalPending += amount;
        pending.push(mov);
      }
      
      if (mov.operation === 'TRANSACTION_REFUND') {
        totalRefunds += amount;
        refunds.push(mov);
      }
      
      if (mov.operation === 'TRANSACTION_REVERSED') {
        totalReversed += amount;
        reversed.push(mov);
      }
    });
    
    console.log('💰 DEPOSITS (money_in):');
    console.log(`   Total: $${totalDeposits.toFixed(2)}`);
    deposits.forEach((dep, i) => console.log(`   ${i + 1}. $${dep.MontoTransacction} - ${dep.comentario || 'No comment'}`));
    
    console.log('\n💸 WITHDRAWALS:');
    console.log(`   Total: $${totalWithdrawals.toFixed(2)}`);
    withdrawals.forEach((w, i) => console.log(`   ${i + 1}. $${w.MontoTransacction} - ${w.comentario || 'No comment'}`));
    
    console.log('\n💳 APPROVED TRANSACTIONS (posted):');
    console.log(`   Total: $${totalApproved.toFixed(2)}`);
    console.log(`   Count: ${approved.length}`);
    
    console.log('\n⏳ PENDING TRANSACTIONS:');
    console.log(`   Total: $${totalPending.toFixed(2)}`);
    console.log(`   Count: ${pending.length}`);
    
    console.log('\n🔄 REFUNDS:');
    console.log(`   Total: $${totalRefunds.toFixed(2)}`);
    if (refunds.length > 0) {
      refunds.forEach((ref, i) => {
        console.log(`   ${i + 1}. $${ref.MontoTransacction || ref.amount || 0} - ${ref.comentario || 'No comment'}`);
      });
    }
    
    console.log('\n↩️ REVERSED:');
    console.log(`   Total: $${totalReversed.toFixed(2)}`);
    if (reversed.length > 0) {
      reversed.forEach((rev, i) => {
        console.log(`   ${i + 1}. $${rev.MontoTransacction || rev.amount || 0} - ${rev.comentario || 'No comment'}`);
      });
    }
    
    const money_in = totalDeposits - totalWithdrawals;
    const available = money_in + totalRefunds - totalApproved - totalPending;
    
    console.log('\n📊 CALCULATED VALUES:');
    console.log('='.repeat(60));
    console.log(`money_in:  $${money_in.toFixed(2)} (deposits $${totalDeposits.toFixed(2)} - withdrawals $${totalWithdrawals.toFixed(2)})`);
    console.log(`refund:    $${totalRefunds.toFixed(2)}`);
    console.log(`posted:    $${totalApproved.toFixed(2)}`);
    console.log(`pending:   $${totalPending.toFixed(2)}`);
    console.log('-'.repeat(60));
    console.log(`available: $${available.toFixed(2)}`);
    console.log('='.repeat(60));
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

analyzeDifference();
