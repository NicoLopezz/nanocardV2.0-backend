require('dotenv').config();
process.env.NODE_ENV = 'development';

const { databases, connectDatabases } = require('./config/database');

async function verifyFinalStats() {
  try {
    await connectDatabases();
    console.log('✅ Connected to databases\n');
    
    const CARD_ID = '2j8XCMNboZoEsAvJViBl0kJCsK6p3as2';
    
    const Card = require('./models/Card').getCardModel();
    const card = await Card.findById(CARD_ID);
    
    if (!card) {
      console.log('❌ Card not found');
      return;
    }
    
    console.log('📊 SANTIAGO ROMANO - FINAL STATS:');
    console.log('='.repeat(60));
    console.log(`money_in:      $${card.stats.money_in.toFixed(2)}`);
    console.log(`refund:        $${card.stats.refund.toFixed(2)}`);
    console.log(`posted:        $${card.stats.posted.toFixed(2)}`);
    console.log(`pending:       $${card.stats.pending.toFixed(2)}`);
    console.log(`withdrawal:    $${card.stats.withdrawal.toFixed(2)}`);
    console.log('-'.repeat(60));
    console.log(`available:     $${card.stats.available.toFixed(2)}`);
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyFinalStats();
