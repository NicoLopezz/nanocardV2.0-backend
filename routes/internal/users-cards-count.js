const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { getCardModel } = require('../../models/Card');
    const { getTransactionModel } = require('../../models/Transaction');
    
    const Card = getCardModel();
    const Transaction = getTransactionModel();
    
    const allCards = await Card.find({}).lean();
    
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const cardIds = allCards.map(card => card._id);
    
    const recentTransactions = await Transaction.aggregate([
      {
        $match: {
          cardId: { $in: cardIds },
          createdAt: { $gte: threeMonthsAgo },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$cardId',
          lastTransactionDate: { $max: '$createdAt' },
          transactionCount: { $sum: 1 }
        }
      }
    ]);
    
    const activeCardIds = new Set(recentTransactions.map(t => t._id));
    
    let totalCards = allCards.length;
    let mercuryCards = 0;
    let cryptomateCards = 0;
    let mercuryActive = 0;
    let mercuryInactive = 0;
    let cryptomateActive = 0;
    let cryptomateInactive = 0;
    
    const cardDetails = [];
    
    allCards.forEach(card => {
      const isMercury = card.supplier === 'mercury';
      const isActive = activeCardIds.has(card._id);
      
      if (isMercury) {
        mercuryCards++;
        if (isActive) {
          mercuryActive++;
        } else {
          mercuryInactive++;
        }
      } else {
        cryptomateCards++;
        if (isActive) {
          cryptomateActive++;
        } else {
          cryptomateInactive++;
        }
      }
      
      const transactionInfo = recentTransactions.find(t => t._id === card._id);
      
      cardDetails.push({
        cardId: card._id,
        name: card.name,
        supplier: card.supplier,
        last4: card.last4,
        status: isActive ? 'active' : 'inactive',
        lastTransactionDate: transactionInfo?.lastTransactionDate || null,
        recentTransactionCount: transactionInfo?.transactionCount || 0,
        email: card.meta?.email || 'N/A'
      });
    });
    
    cardDetails.sort((a, b) => {
      if (a.lastTransactionDate && b.lastTransactionDate) {
        return new Date(b.lastTransactionDate) - new Date(a.lastTransactionDate);
      }
      if (a.lastTransactionDate) return -1;
      if (b.lastTransactionDate) return 1;
      return 0;
    });
    
    res.json({
      success: true,
      data: {
        summary: {
          totalCards: totalCards,
          totalActive: mercuryActive + cryptomateActive,
          totalInactive: mercuryInactive + cryptomateInactive,
          bySupplier: {
            mercury: {
              total: mercuryCards,
              active: mercuryActive,
              inactive: mercuryInactive
            },
            cryptomate: {
              total: cryptomateCards,
              active: cryptomateActive,
              inactive: cryptomateInactive
            }
          }
        },
        cards: cardDetails
      }
    });
    
  } catch (error) {
    console.error('Error getting cards count:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting cards count',
      error: error.message
    });
  }
});

module.exports = router;



