const express = require('express');
const router = express.Router();
const { getUserModel } = require('../../../models/User');
const { getCardModel } = require('../../../models/Card');
const { convertCryptoMateCardToNano } = require('../../../services/cryptomateService');

// Datos de prueba simulando la respuesta de CryptoMate
const sampleCryptoMateData = [
  {
    "id": "Qc4iMvkIQBfphcgCwjCFxQEF38Br1x0J",
    "card_holder_name": "CHRISTOPH SCHWAGER",
    "type": "Virtual",
    "last4": "8446",
    "status": "ACTIVE",
    "approval_method": "TopUp",
    "daily_limit": null,
    "weekly_limit": null,
    "monthly_limit": 750,
    "forwarded_3ds_type": "sms",
    "meta": {
      "email": "cards@ufly.club",
      "otp_phone_number": {
        "dial_code": 1,
        "phone_number": "7863960227"
      }
    }
  },
  {
    "id": "95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo",
    "card_holder_name": "CORINNA SCHWAGER ENDRES",
    "type": "Virtual",
    "last4": "3111",
    "status": "ACTIVE",
    "approval_method": "TopUp",
    "daily_limit": null,
    "weekly_limit": null,
    "monthly_limit": 750,
    "forwarded_3ds_type": "sms",
    "meta": {
      "email": "cards@ufly.club",
      "otp_phone_number": {
        "dial_code": 1,
        "phone_number": "7863960227"
      }
    }
  },
  {
    "id": "YEgOGQZc6deSju1Tz3VYCwQNKhb8ozcy",
    "card_holder_name": "Martin Aguilar",
    "type": "Virtual",
    "last4": "5844",
    "status": "ACTIVE",
    "approval_method": "TopUp",
    "daily_limit": null,
    "weekly_limit": null,
    "monthly_limit": 4000,
    "forwarded_3ds_type": "sms",
    "meta": {
      "email": "martin.aguilar.bugeau@gmail.com",
      "otp_phone_number": {
        "dial_code": 54,
        "phone_number": "1130770395"
      }
    }
  }
];

// Probar el mapeo de datos de CryptoMate a Nano
router.post('/test-mapping', async (req, res) => {
  try {
    console.log('🧪 Testing CryptoMate to Nano mapping...');
    
    const User = getUserModel();
    const Card = getCardModel();
    
    let importedUsers = 0;
    let importedCards = 0;
    const results = [];
    
    for (const cryptoCard of sampleCryptoMateData) {
      try {
        // Convertir datos de CryptoMate a formato Nano
        const nanoCard = convertCryptoMateCardToNano(cryptoCard);
        
        // Crear o actualizar usuario
        let user = await User.findById(nanoCard.userId);
        if (!user) {
          user = new User({
            _id: nanoCard.userId,
            username: nanoCard.userId,
            email: nanoCard.meta.email || `${nanoCard.userId}@nanocard.xyz`,
            role: 'standard',
            profile: {
              firstName: nanoCard.name.split(' ')[0] || 'User',
              lastName: nanoCard.name.split(' ').slice(1).join(' ') || 'Card'
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
          await user.save();
          importedUsers++;
          console.log(`✅ Created user: ${nanoCard.userId}`);
        }
        
        // Crear o actualizar tarjeta
        let existingCard = await Card.findById(nanoCard._id);
        if (!existingCard) {
          existingCard = new Card(nanoCard);
          await existingCard.save();
          importedCards++;
          console.log(`✅ Created card: ${nanoCard._id} - ${nanoCard.name}`);
        } else {
          // Actualizar tarjeta existente
          Object.assign(existingCard, nanoCard);
          await existingCard.save();
          console.log(`🔄 Updated card: ${nanoCard._id} - ${nanoCard.name}`);
        }
        
        results.push({
          cryptoCard: {
            id: cryptoCard.id,
            card_holder_name: cryptoCard.card_holder_name,
            last4: cryptoCard.last4,
            status: cryptoCard.status,
            monthly_limit: cryptoCard.monthly_limit
          },
          nanoCard: {
            _id: nanoCard._id,
            name: nanoCard.name,
            last4: nanoCard.last4,
            status: nanoCard.status,
            limits: nanoCard.limits,
            meta: nanoCard.meta
          },
          success: true
        });
        
      } catch (cardError) {
        console.error(`❌ Error processing card ${cryptoCard.id}:`, cardError);
        results.push({
          cryptoCard: {
            id: cryptoCard.id,
            card_holder_name: cryptoCard.card_holder_name
          },
          error: cardError.message,
          success: false
        });
      }
    }
    
    console.log('🎉 Test mapping completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Users imported: ${importedUsers}`);
    console.log(`   - Cards imported: ${importedCards}`);
    
    res.json({
      success: true,
      message: 'Test mapping completed successfully',
      summary: {
        users: importedUsers,
        cards: importedCards
      },
      results: results
    });
    
  } catch (error) {
    console.error('❌ Error during test mapping:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Test mapping failed', 
      message: error.message 
    });
  }
});

// Ver las tarjetas importadas
router.get('/imported-cards', async (req, res) => {
  try {
    const Card = getCardModel();
    const cards = await Card.find({}).limit(10);
    
    res.json({
      success: true,
      cards: cards,
      count: cards.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

