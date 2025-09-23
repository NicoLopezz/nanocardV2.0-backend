const express = require('express');
const router = express.Router();
const { getUserModel } = require('../../models/User');
const { getCardModel } = require('../../models/Card');
const { getTransactionModel } = require('../../models/Transaction');

// Crear datos de prueba
router.post('/create-sample-data', async (req, res) => {
  try {
    const User = getUserModel();
    const Card = getCardModel();
    const Transaction = getTransactionModel();
    
    // Crear usuario de prueba
    const testUser = new User({
      _id: 'test_user_001',
      username: 'test_user_001',
      email: 'test@nanocard.xyz',
      role: 'standard',
      profile: {
        firstName: 'Test',
        lastName: 'User'
      },
      stats: {
        totalTransactions: 0,
        totalDeposited: 0,
        totalPosted: 0,
        totalPending: 0,
        totalAvailable: 0,
        lastLogin: new Date(),
        loginCount: 0
      }
    });
    
    await testUser.save();
    console.log('✅ Created test user');
    
    // Crear tarjeta de prueba
    const testCard = new Card({
      _id: 'test_card_001',
      userId: 'test_user_001',
      name: 'Test Card',
      supplier: 'Nano',
      last4: '1234',
      deposited: 1000,
      posted: 300,
      pending: 50,
      available: 700,
      status: 'active'
    });
    
    await testCard.save();
    console.log('✅ Created test card');
    
    // Crear transacciones de prueba
    const sampleTransactions = [
      {
        _id: 'trans_001',
        userId: 'test_user_001',
        cardId: 'test_card_001',
        name: 'Starbucks',
        amount: 5.50,
        date: '15/01/2025',
        time: '10:30 AM',
        status: 'TRANSACTION_APPROVED',
        credit: false,
        comentario: 'Coffee purchase',
        version: 1,
        isDeleted: false,
        history: [{
          version: 1,
          action: 'created',
          timestamp: new Date(),
          modifiedBy: 'seed_script',
          reason: 'Sample data creation'
        }]
      },
      {
        _id: 'trans_002',
        userId: 'test_user_001',
        cardId: 'test_card_001',
        name: 'Deposit',
        amount: 200,
        date: '14/01/2025',
        time: '09:15 AM',
        status: 'TRANSACTION_APPROVED',
        credit: true,
        comentario: 'Initial deposit',
        version: 1,
        isDeleted: false,
        history: [{
          version: 1,
          action: 'created',
          timestamp: new Date(),
          modifiedBy: 'seed_script',
          reason: 'Sample data creation'
        }]
      },
      {
        _id: 'trans_003',
        userId: 'test_user_001',
        cardId: 'test_card_001',
        name: 'Amazon',
        amount: 25.99,
        date: '13/01/2025',
        time: '14:45 PM',
        status: 'TRANSACTION_APPROVED',
        credit: false,
        comentario: 'Online purchase',
        version: 1,
        isDeleted: false,
        history: [{
          version: 1,
          action: 'created',
          timestamp: new Date(),
          modifiedBy: 'seed_script',
          reason: 'Sample data creation'
        }]
      }
    ];
    
    for (const transData of sampleTransactions) {
      const transaction = new Transaction(transData);
      await transaction.save();
      
      // Actualizar KPIs del usuario
      if (transData.credit) {
        testUser.stats.totalDeposited += transData.amount;
      } else {
        testUser.stats.totalPosted += transData.amount;
      }
      testUser.stats.totalTransactions += 1;
    }
    
    testUser.stats.totalAvailable = testUser.stats.totalDeposited - testUser.stats.totalPosted;
    await testUser.save();
    
    console.log('✅ Created sample transactions');
    
    res.json({
      success: true,
      message: 'Sample data created successfully',
      data: {
        user: testUser._id,
        card: testCard._id,
        transactions: sampleTransactions.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create sample data', 
      message: error.message 
    });
  }
});

module.exports = router;

