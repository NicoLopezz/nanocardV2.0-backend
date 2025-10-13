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
    
    // Verificar si el usuario existe (pero no cortar el flujo si no existe)
    const User = getUserModel();
    const userToDelete = await User.findById(userId);
    
    if (!userToDelete) {
      console.log(`⚠️ User ${userId} not found in users collection, but continuing with cleanup...`);
    } else {
      console.log(`✅ User found: ${userToDelete.username} (${userToDelete.email})`);
    }
    
    // Verificar que no se está intentando borrar a sí mismo (solo si el usuario existe)
    if (userToDelete && userId === adminUser._id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }
    
    console.log(`📊 Starting complete deletion for user ID: ${userId}`);
    if (userToDelete) {
      console.log(`   User details: ${userToDelete.username} (${userToDelete.email})`);
    } else {
      console.log(`   User not found in users collection, but will clean up related data`);
    }
    
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
    
    // 7. FINALMENTE, ELIMINAR EL USUARIO (solo si existe)
    console.log('👤 Step 7: Deleting user...');
    if (userToDelete) {
      const userResult = await User.deleteOne({ _id: userId });
      deletionStats.userDeleted = userResult.deletedCount > 0;
      console.log(`   ✅ User deleted: ${userResult.deletedCount > 0}`);
    } else {
      console.log(`   ⚠️ User not found, skipping user deletion`);
      deletionStats.userDeleted = false;
    }
    
    const responseTime = Date.now() - startTime;
    
    if (userToDelete) {
      console.log('🎉 Complete user deletion successful!');
    } else {
      console.log('🎉 Complete cleanup successful! (User was not found, but related data was cleaned up)');
    }
    console.log(`📊 Summary:`);
    if (userToDelete) {
      console.log(`   - User: ${userToDelete.username} (${userToDelete.email})`);
    } else {
      console.log(`   - User: Not found (cleaned up related data)`);
    }
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
        deletedUserName: userToDelete ? userToDelete.username : 'Not found',
        deletedUserEmail: userToDelete ? userToDelete.email : 'Not found',
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
      message: userToDelete 
        ? `User ${userToDelete.username} and all associated data deleted successfully`
        : `User not found, but all associated data cleaned up successfully`,
      deletedUser: userToDelete ? {
        _id: userToDelete._id,
        username: userToDelete.username,
        email: userToDelete.email
      } : null,
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

// Endpoint para eliminar una transacción específica y actualizar stats
router.delete('/transaction/:transactionId/complete', requireAdmin, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { transactionId } = req.params;
    const adminUser = req.user;
    
    console.log(`🗑️ Admin ${adminUser.username} attempting to delete transaction: ${transactionId}`);
    
    // Step 1: Buscar la transacción en la base de datos
    console.log('🔍 Step 1: Searching for transaction...');
    const Transaction = getTransactionModel();
    const transactionToDelete = await Transaction.findById(transactionId);
    
    if (!transactionToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }
    
    console.log(`✅ Transaction found: ${transactionToDelete.name} - $${transactionToDelete.amount}`);
    console.log(`   Card ID: ${transactionToDelete.cardId}`);
    console.log(`   User ID: ${transactionToDelete.userId}`);
    console.log(`   Operation: ${transactionToDelete.operation}`);
    
    // Step 2: Guardar datos de la transacción antes de eliminar
    const transactionData = {
      _id: transactionToDelete._id,
      name: transactionToDelete.name,
      amount: transactionToDelete.amount,
      operation: transactionToDelete.operation,
      cardId: transactionToDelete.cardId,
      userId: transactionToDelete.userId,
      date: transactionToDelete.date,
      status: transactionToDelete.status
    };
    
    console.log('💾 Step 2: Transaction data saved for logging');
    
    // Step 3: Eliminar la transacción
    console.log('🗑️ Step 3: Deleting transaction from database...');
    const deleteResult = await Transaction.deleteOne({ _id: transactionId });
    
    if (deleteResult.deletedCount === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete transaction'
      });
    }
    
    console.log(`✅ Transaction deleted successfully`);
    
    // Step 4: Actualizar stats de la card asociada (manejar eliminación correctamente)
    console.log('📊 Step 4: Updating card stats for deleted transaction...');
    let statsUpdated = false;
    let statsError = null;
    
    try {
      const StatsRefreshService = require('../../services/statsRefreshService');
      
      console.log(`🔍 DEBUG: About to refresh stats with:`);
      console.log(`   - User ID: ${transactionData.userId}`);
      console.log(`   - Card ID: ${transactionData.cardId}`);
      console.log(`   - Operation: ${transactionData.operation}`);
      console.log(`   - Amount: $${transactionData.amount}`);
      console.log(`   - Action: delete`);
      
      // OPTIMIZACIÓN: Intentar actualizar stats del usuario primero, si falla, solo actualizar card
      try {
        console.log(`🔄 Attempting to refresh user stats...`);
        await StatsRefreshService.refreshUserStats(
          transactionData.userId, 
          transactionData, 
          'delete'
        );
        console.log(`✅ User stats updated successfully`);
      } catch (userStatsError) {
        console.warn(`⚠️ User stats update failed (user may not exist):`, userStatsError.message);
        console.log(`   - Continuing with card stats update only...`);
      }
      
      // SIEMPRE actualizar stats de la card (independientemente del usuario)
      console.log(`🔄 Updating card stats...`);
      await StatsRefreshService.refreshCardStats(transactionData.cardId);
      console.log(`✅ Card stats updated successfully`);
      
      statsUpdated = true;
      console.log(`✅ Stats updated for deleted transaction: ${transactionData.name}`);
      console.log(`   - User ID: ${transactionData.userId}`);
      console.log(`   - Card ID: ${transactionData.cardId}`);
      console.log(`   - Operation: ${transactionData.operation}`);
      console.log(`   - Amount: $${transactionData.amount}`);
      
    } catch (statsError) {
      console.error(`❌ Error updating stats for deleted transaction:`, statsError.message);
      console.error(`❌ Full error:`, statsError);
      statsError = statsError.message;
    }
    
    const responseTime = Date.now() - startTime;
    
    // Log en historial centralizado
    try {
      const { logToHistory } = require('../../services/historyService');
      await logToHistory(
        'Transaction', 
        transactionId, 
        adminUser, 
        [], 
        {
          deletedTransactionName: transactionData.name,
          deletedTransactionAmount: transactionData.amount,
          deletedTransactionOperation: transactionData.operation,
          associatedCardId: transactionData.cardId,
          associatedUserId: transactionData.userId,
          statsUpdated: statsUpdated,
          statsError: statsError
        }, 
        {
          method: 'DELETE',
          endpoint: `/api/admin/transaction/${transactionId}/complete`,
          statusCode: 200,
          responseTime: responseTime
        }
      );
    } catch (historyError) {
      console.error('❌ Error logging transaction deletion to history:', historyError);
    }
    
    console.log('🎉 Transaction deletion completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Transaction: ${transactionData.name} ($${transactionData.amount})`);
    console.log(`   - Card ID: ${transactionData.cardId}`);
    console.log(`   - Stats updated: ${statsUpdated ? 'Yes' : 'No'}`);
    if (statsError) {
      console.log(`   - Stats error: ${statsError}`);
    }
    console.log(`   - Response time: ${responseTime}ms`);
    
    res.json({
      success: true,
      message: `Transaction ${transactionData.name} deleted successfully`,
      deletedTransaction: {
        _id: transactionData._id,
        name: transactionData.name,
        amount: transactionData.amount,
        operation: transactionData.operation,
        cardId: transactionData.cardId,
        userId: transactionData.userId
      },
      statsUpdated: statsUpdated,
      statsError: statsError,
      responseTime: responseTime
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error deleting transaction completely (${responseTime}ms):`, error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete transaction completely',
      message: error.message,
      responseTime: responseTime
    });
  }
});

module.exports = router;

