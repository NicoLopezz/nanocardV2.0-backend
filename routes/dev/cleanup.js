const express = require('express');
const router = express.Router();
const { getUserModel } = require('../../models/User');

// Endpoint para limpiar los lastName artificiales "Card"
router.post('/cleanup-artificial-lastnames', async (req, res) => {
  try {
    const User = getUserModel();
    
    // Buscar usuarios con lastName "Card"
    const usersWithCardLastName = await User.find({
      'profile.lastName': 'Card'
    });
    
    console.log(`Found ${usersWithCardLastName.length} users with artificial "Card" lastName`);
    
    let updatedCount = 0;
    
    for (const user of usersWithCardLastName) {
      // Solo limpiar si el firstName no está vacío
      if (user.profile.firstName && user.profile.firstName.trim()) {
        await User.findByIdAndUpdate(
          user._id,
          { 
            'profile.lastName': '',
            updatedAt: new Date()
          }
        );
        updatedCount++;
        console.log(`✅ Cleaned user: ${user.profile.firstName} (removed "Card")`);
      }
    }
    
    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      summary: {
        totalFound: usersWithCardLastName.length,
        updated: updatedCount
      }
    });
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Cleanup failed', 
      message: error.message 
    });
  }
});

// Endpoint para limpiar usuarios con firstName "User" (también artificial)
router.post('/cleanup-artificial-firstnames', async (req, res) => {
  try {
    const User = getUserModel();
    
    // Buscar usuarios con firstName "User"
    const usersWithUserFirstName = await User.find({
      'profile.firstName': 'User'
    });
    
    console.log(`Found ${usersWithUserFirstName.length} users with artificial "User" firstName`);
    
    let updatedCount = 0;
    
    for (const user of usersWithUserFirstName) {
      await User.findByIdAndUpdate(
        user._id,
        { 
          'profile.firstName': '',
          updatedAt: new Date()
        }
      );
      updatedCount++;
      console.log(`✅ Cleaned user: ${user._id} (removed "User")`);
    }
    
    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      summary: {
        totalFound: usersWithUserFirstName.length,
        updated: updatedCount
      }
    });
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Cleanup failed', 
      message: error.message 
    });
  }
});

module.exports = router;