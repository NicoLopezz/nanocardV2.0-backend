const mongoose = require('mongoose');

const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';
const CARD_ID = '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2';

async function analyzeParsingLogic() {
  try {
    await mongoose.connect(OLD_DB_URI);
    console.log('✅ Connected to old DB\n');
    
    const db = mongoose.connection.db;
    const cardsCollection = db.collection('test-db-27-10-25');
    
    const santiagoCard = await cardsCollection.findOne({
      'Card_id': CARD_ID
    });
    
    const movements = santiagoCard.movimientos || [];
    
    console.log('📊 ANALYSIS OF PARSING LOGIC:\n');
    console.log('='.repeat(100));
    
    const categories = {
      withdrawal: [],
      deposit: [],
      refund: [],
      reversed: [],
      approved: [],
      pending: [],
      other: []
    };
    
    movements.forEach((mov, index) => {
      const obj = {
        index: index + 1,
        id: mov.id,
        name: mov.name,
        amount: mov.MontoTransacction,
        credit: mov.credit,
        status: mov.status,
        operation: '',
        mappedAs: ''
      };
      
      if (mov.name === 'WITHDRAWAL' || mov.name === 'Withdrawal') {
        obj.operation = 'WITHDRAWAL';
        obj.mappedAs = 'WITHDRAWAL';
        categories.withdrawal.push(obj);
      } else if (mov.credit === true && mov.MontoTransacction > 0) {
        obj.operation = 'WALLET_DEPOSIT';
        obj.mappedAs = 'WALLET_DEPOSIT';
        categories.deposit.push(obj);
      } else if (mov.status === 'TRANSACTION_REFUND') {
        obj.operation = 'TRANSACTION_REFUND';
        obj.mappedAs = 'TRANSACTION_REFUND';
        categories.refund.push(obj);
      } else if (mov.status === 'TRANSACTION_REVERSED') {
        obj.operation = 'TRANSACTION_REVERSED';
        obj.mappedAs = 'TRANSACTION_REVERSED';
        categories.reversed.push(obj);
      } else if (mov.status === 'TRANSACTION_APPROVED') {
        obj.operation = 'TRANSACTION_APPROVED';
        obj.mappedAs = 'TRANSACTION_APPROVED';
        categories.approved.push(obj);
      } else if (mov.status === 'TRANSACTION_PENDING') {
        obj.operation = 'TRANSACTION_PENDING';
        obj.mappedAs = 'TRANSACTION_PENDING';
        categories.pending.push(obj);
      } else if (mov.credit === false) {
        obj.operation = 'TRANSACTION_APPROVED (default)';
        obj.mappedAs = 'TRANSACTION_APPROVED';
        categories.approved.push(obj);
      } else {
        obj.operation = 'OTHER';
        obj.mappedAs = 'TRANSACTION_APPROVED';
        categories.other.push(obj);
      }
    });
    
    console.log('\n📋 CATEGORIZATION SUMMARY:\n');
    console.log(`WITHDRAWAL:          ${categories.withdrawal.length} transactions`);
    console.log(`WALLET_DEPOSIT:      ${categories.deposit.length} transactions`);
    console.log(`TRANSACTION_REFUND:  ${categories.refund.length} transactions`);
    console.log(`TRANSACTION_REVERSED: ${categories.reversed.length} transactions`);
    console.log(`TRANSACTION_APPROVED: ${categories.approved.length} transactions (THIS IS THE PROBLEM!)`);
    console.log(`TRANSACTION_PENDING: ${categories.pending.length} transactions`);
    console.log(`OTHER:               ${categories.other.length} transactions`);
    
    console.log('\n\n🔍 DETAILS - TRANSACTION_APPROVED (117 transactions that shouldn\'t be):\n');
    console.log('='.repeat(100));
    console.log('These are being mapped as TRANSACTION_APPROVED by the default rule at line 29');
    console.log('(= everything that doesn\'t match previous conditions)\n');
    
    categories.approved.slice(0, 10).forEach(tx => {
      console.log(`  ${tx.index}. "${tx.name}" - $${tx.amount} - credit:${tx.credit} - status:"${tx.status}"`);
    });
    
    if (categories.approved.length > 10) {
      console.log(`  ... and ${categories.approved.length - 10} more`);
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

analyzeParsingLogic();
