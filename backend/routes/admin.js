const express = require('express');
const router = express.Router();
const { getUserModel } = require('../models/User');
const { getCardModel } = require('../models/Card');

// Middleware para verificar que el usuario sea admin
const requireAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const config = require('../config/environment');
    const decoded = jwt.verify(token, config.JWT_SECRET);
    
    const User = getUserModel();
    const user = await User.findById(decoded.userId);
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

// Endpoint para actualizar el role de un usuario
router.put('/user/:userId/role', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!['admin', 'standard'].includes(role)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid role. Must be "admin" or "standard"' 
      });
    }
    
    const User = getUserModel();
    const user = await User.findByIdAndUpdate(
      userId, 
      { role: role, updatedAt: new Date() }, 
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile: user.profile
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating user role:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update user role',
      message: error.message 
    });
  }
});

// Endpoint para obtener todos los usuarios (solo admin)
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const User = getUserModel();
    const users = await User.find({}, { 
      _id: 1, 
      username: 1, 
      email: 1, 
      role: 1, 
      profile: 1, 
      stats: 1,
      createdAt: 1,
      updatedAt: 1 
    });
    
    res.json({
      success: true,
      users: users,
      count: users.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch users',
      message: error.message 
    });
  }
});

// Endpoint para hacer admin a un usuario por nombre de tarjeta
router.put('/make-admin-by-card', async (req, res) => {
  try {
    const { cardName, last4 } = req.body;
    
    if (!cardName || !last4) {
      return res.status(400).json({ 
        success: false, 
        error: 'cardName and last4 are required' 
      });
    }
    
    const Card = getCardModel();
    const User = getUserModel();
    
    // Buscar la tarjeta
    const card = await Card.findOne({ 
      name: { $regex: new RegExp(cardName, 'i') }, 
      last4: last4 
    });
    
    if (!card) {
      return res.status(404).json({ 
        success: false, 
        error: 'Card not found' 
      });
    }
    
    // Buscar y actualizar el usuario
    const user = await User.findByIdAndUpdate(
      card.userId, 
      { role: 'admin', updatedAt: new Date() }, 
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    res.json({
      success: true,
      message: `User ${user.username} is now admin`,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile: user.profile
      },
      card: {
        _id: card._id,
        name: card.name,
        last4: card.last4
      }
    });
    
  } catch (error) {
    console.error('❌ Error making user admin:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to make user admin',
      message: error.message 
    });
  }
});

module.exports = router;

