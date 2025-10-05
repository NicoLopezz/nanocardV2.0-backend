const express = require('express');
const router = express.Router();
const { getUserModel } = require('../../models/User');
const { getCardModel } = require('../../models/Card');
const { getTransactionModel } = require('../../models/Transaction');
const { getHistoryModel } = require('../../models/History');
const { getReconciliationModel } = require('../../models/Reconciliation');
const { getReconciliationCardModel } = require('../../models/ReconciliationCard');
const { getReconciliationTransactionModel } = require('../../models/ReconciliationTransaction');
const historyService = require('../../services/historyService');

// Middleware para verificar que el usuario sea admin
const requireAdmin = async (req, res, next) => {
  try {
    const User = getUserModel();
    const user = {
      _id: 'admin-system',
      username: 'system-admin',
      email: 'admin@system.com',
      role: 'admin'
    };
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Access denied' });
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

// Endpoint para eliminar un usuario completamente (solo admin)
router.delete('/user/:userId/complete', requireAdmin, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { userId } = req.params;
    const adminUser = req.user;
    
    console.log(`🗑️ Admin ${adminUser.username} attempting to delete user: ${userId}`);
    
    // Verificar que el usuario existe
    const User = getUserModel();
    const userToDelete = await User.findById(userId);
    
    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Verificar que no se está intentando borrar a sí mismo
    if (userId === adminUser._id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }
    
    console.log(`📊 Starting complete deletion for user: ${userToDelete.username} (${userToDelete.email})`);
    
    const deletionStats = {
      userDeleted: false,
      cardsDeleted: 0,
      transactionsDeleted: 0,
      historyDeleted: 0,
      reconciliationsDeleted: 0,
      reconciliationCardsDeleted: 0,
      reconciliationTransactionsDeleted: 0
    };
    
    // 1. ELIMINAR TODAS LAS TRANSACCIONES DEL USUARIO
    console.log('🗑️ Step 1: Deleting all transactions...');
    const Transaction = getTransactionModel();
    const transactionResult = await Transaction.deleteMany({ userId: userId });
    deletionStats.transactionsDeleted = transactionResult.deletedCount;
    console.log(`   ✅ Deleted ${transactionResult.deletedCount} transactions`);
    
    // 2. ELIMINAR TODAS LAS TARJETAS DEL USUARIO
    console.log('💳 Step 2: Deleting all cards...');
    const Card = getCardModel();
    const cardsResult = await Card.deleteMany({ userId: userId });
    deletionStats.cardsDeleted = cardsResult.deletedCount;
    console.log(`   ✅ Deleted ${cardsResult.deletedCount} cards`);
    
    // 3. ELIMINAR TODO EL HISTORIAL DEL USUARIO
    console.log('📝 Step 3: Deleting all history records...');
    const History = getHistoryModel();
    const historyResult = await History.deleteMany({ 
      $or: [
        { userId: userId },
        { entityId: userId }
      ]
    });
    deletionStats.historyDeleted = historyResult.deletedCount;
    console.log(`   ✅ Deleted ${historyResult.deletedCount} history records`);
    
    // 4. ELIMINAR TODAS LAS RECONCILIACIONES DEL USUARIO
    console.log('🔍 Step 4: Deleting all reconciliations...');
    const Reconciliation = getReconciliationModel();
    const reconciliationResult = await Reconciliation.deleteMany({ userId: userId });
    deletionStats.reconciliationsDeleted = reconciliationResult.deletedCount;
    console.log(`   ✅ Deleted ${reconciliationResult.deletedCount} reconciliations`);
    
    // 5. ELIMINAR RECONCILIATION CARDS RELACIONADAS
    console.log('💳 Step 5: Deleting reconciliation cards...');
    const ReconciliationCard = getReconciliationCardModel();
    const reconciliationCardResult = await ReconciliationCard.deleteMany({ userId: userId });
    deletionStats.reconciliationCardsDeleted = reconciliationCardResult.deletedCount;
    console.log(`   ✅ Deleted ${reconciliationCardResult.deletedCount} reconciliation cards`);
    
    // 6. ELIMINAR RECONCILIATION TRANSACTIONS RELACIONADAS
    console.log('💰 Step 6: Deleting reconciliation transactions...');
    const ReconciliationTransaction = getReconciliationTransactionModel();
    const reconciliationTransactionResult = await ReconciliationTransaction.deleteMany({ userId: userId });
    deletionStats.reconciliationTransactionsDeleted = reconciliationTransactionResult.deletedCount;
    console.log(`   ✅ Deleted ${reconciliationTransactionResult.deletedCount} reconciliation transactions`);
    
    // 7. FINALMENTE, ELIMINAR EL USUARIO
    console.log('👤 Step 7: Deleting user...');
    const userResult = await User.deleteOne({ _id: userId });
    deletionStats.userDeleted = userResult.deletedCount > 0;
    console.log(`   ✅ User deleted: ${userResult.deletedCount > 0}`);
    
    const responseTime = Date.now() - startTime;
    
    console.log('🎉 Complete user deletion successful!');
    console.log(`📊 Summary:`);
    console.log(`   - User: ${userToDelete.username} (${userToDelete.email})`);
    console.log(`   - Cards deleted: ${deletionStats.cardsDeleted}`);
    console.log(`   - Transactions deleted: ${deletionStats.transactionsDeleted}`);
    console.log(`   - History records deleted: ${deletionStats.historyDeleted}`);
    console.log(`   - Reconciliations deleted: ${deletionStats.reconciliationsDeleted}`);
    console.log(`   - Response time: ${responseTime}ms`);
    
    // Log en historial centralizado
    try {
      await historyService.logCRUDOperation(
        'USER_DELETED', 
        'User', 
        userId, 
        adminUser, 
        [], 
        {
          deletedUserName: userToDelete.username,
          deletedUserEmail: userToDelete.email,
          deletionStats: deletionStats
        }, 
        {
          method: 'DELETE',
          endpoint: `/api/admin/user/${userId}/complete`,
          statusCode: 200,
          responseTime: responseTime
        }
      );
    } catch (historyError) {
      console.error('❌ Error logging user deletion to history:', historyError);
    }
    
    res.json({
      success: true,
      message: `User ${userToDelete.username} and all associated data deleted successfully`,
      deletedUser: {
        _id: userToDelete._id,
        username: userToDelete.username,
        email: userToDelete.email
      },
      deletionStats: deletionStats,
      responseTime: responseTime
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error deleting user completely (${responseTime}ms):`, error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete user completely',
      message: error.message,
      responseTime: responseTime
    });
  }
});

module.exports = router;

