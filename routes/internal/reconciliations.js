const express = require('express');
const router = express.Router();
const ReconciliationService = require('../../services/reconciliationService');

// Obtener todas las reconciliaciones con desglose por usuario
router.get('/', async (req, res) => {
  try {
    const { getReconciliationModel } = require('../../models/Reconciliation');
    const Reconciliation = getReconciliationModel();
    
    // Obtener todas las reconciliaciones
    const allReconciliations = await Reconciliation.find({})
      .sort({ reconciliationDate: -1 })
      .lean();
    
    // Calcular total
    const totalReconciliations = allReconciliations.length;
    
    // Obtener información de las tarjetas para tener los nombres correctos
    const { getCardModel } = require('../../models/Card');
    const Card = getCardModel();
    const cardInfo = {};
    
    // Obtener información de todas las tarjetas únicas
    const uniqueUserIds = [...new Set(allReconciliations.map(rec => rec.userId))];
    const cards = await Card.find({ userId: { $in: uniqueUserIds } }).lean();
    
    cards.forEach(card => {
      cardInfo[card.userId] = {
        name: card.name,
        email: card.meta?.email || 'N/A'
      };
    });

    // Agrupar por usuario
    const userGroups = {};
    
    allReconciliations.forEach(rec => {
      const userId = rec.userId;
      
      if (!userGroups[userId]) {
        userGroups[userId] = {
          userId: userId,
          userName: cardInfo[userId]?.name || userId, // Usar el nombre de la tarjeta o el userId como fallback
          userEmail: cardInfo[userId]?.email || rec.userEmail || 'N/A',
          reconciliationCount: 0,
          totalAmount: 0,
          totalTransactionsReconciled: 0,
          lastReconciliation: null,
          reconciliations: []
        };
      }
      
      // Agregar reconciliación al usuario
      const amount = rec.summary?.available || rec.financialSummary?.totalAvailable || 0;
      const transactionCount = rec.transactions?.count || rec.summary?.totalTransactions || 0;
      
      userGroups[userId].reconciliationCount++;
      userGroups[userId].totalAmount += amount;
      userGroups[userId].totalTransactionsReconciled += transactionCount;
      
      // Actualizar última reconciliación
      if (!userGroups[userId].lastReconciliation || 
          new Date(rec.reconciliationDate) > new Date(userGroups[userId].lastReconciliation)) {
        userGroups[userId].lastReconciliation = rec.reconciliationDate.toISOString().split('T')[0];
      }
      
      // Agregar detalles de la reconciliación
      userGroups[userId].reconciliations.push({
        id: rec._id,
        name: rec.name,
        date: rec.reconciliationDate.toISOString().split('T')[0],
        status: rec.status,
        total: `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        amount: amount,
        transactionsReconciled: transactionCount,
        transactionIds: rec.transactions?.ids || [],
        processedAt: rec.createdAt?.toISOString() || rec.reconciliationDate.toISOString(),
        notes: rec.metadata?.notes || rec.description || 'No notes',
        summary: rec.summary || {
          moneyIn: 0,
          posted: 0,
          pending: 0,
          available: 0,
          totalTransactions: transactionCount
        }
      });
    });
    
    // Convertir a array y ordenar por última reconciliación
    const byUser = Object.values(userGroups).sort((a, b) => 
      new Date(b.lastReconciliation) - new Date(a.lastReconciliation)
    );
    
    res.json({
      success: true,
      data: {
        summary: {
          totalReconciliations: totalReconciliations
        },
        byUser: byUser
      }
    });
    
  } catch (error) {
    console.error('Error getting all reconciliations:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting all reconciliations',
      error: error.message
    });
  }
});

// Crear nueva conciliación
router.post('/create', async (req, res) => {
  try {
    const { 
      userId, 
      name, 
      description,
      summary,
      transactions,
      metadata,
      notes
    } = req.body;
    
    const createdBy = 'system'; // Simplificado
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }
    
    const reconciliation = await ReconciliationService.createReconciliation(
      userId, 
      { 
        name, 
        description,
        summary,
        transactions,
        metadata,
        notes
      }, 
      createdBy
    );
    
    res.status(201).json({
      success: true,
      message: 'Reconciliation created successfully',
      data: reconciliation
    });
    
  } catch (error) {
    console.error('Error creating reconciliation:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating reconciliation',
      error: error.message
    });
  }
});

// Obtener conciliaciones de un usuario
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    
    const result = await ReconciliationService.getUserReconciliations(
      userId, 
      parseInt(limit), 
      parseInt(offset)
    );
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error getting user reconciliations:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting user reconciliations',
      error: error.message
    });
  }
});

// Obtener conciliación específica
router.get('/:reconciliationId', async (req, res) => {
  try {
    const { reconciliationId } = req.params;
    
    const reconciliation = await ReconciliationService.getReconciliationById(reconciliationId);
    
    if (!reconciliation) {
      return res.status(404).json({
        success: false,
        message: 'Reconciliation not found'
      });
    }
    
    res.json({
      success: true,
      data: reconciliation
    });
    
  } catch (error) {
    console.error('Error getting reconciliation:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting reconciliation',
      error: error.message
    });
  }
});

// Archivar conciliación
router.put('/:reconciliationId/archive', async (req, res) => {
  try {
    const { reconciliationId } = req.params;
    const archivedBy = 'system';
    
    const reconciliation = await ReconciliationService.archiveReconciliation(
      reconciliationId, 
      archivedBy
    );
    
    if (!reconciliation) {
      return res.status(404).json({
        success: false,
        message: 'Reconciliation not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Reconciliation archived successfully',
      data: reconciliation
    });
    
  } catch (error) {
    console.error('Error archiving reconciliation:', error);
    res.status(500).json({
      success: false,
      message: 'Error archiving reconciliation',
      error: error.message
    });
  }
});

// Eliminar conciliación
router.delete('/:reconciliationId', async (req, res) => {
  try {
    const { reconciliationId } = req.params;
    const deletedBy = 'system';
    
    const reconciliation = await ReconciliationService.deleteReconciliation(
      reconciliationId, 
      deletedBy
    );
    
    if (!reconciliation) {
      return res.status(404).json({
        success: false,
        message: 'Reconciliation not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Reconciliation deleted successfully',
      data: reconciliation
    });
    
  } catch (error) {
    console.error('Error deleting reconciliation:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting reconciliation',
      error: error.message
    });
  }
});

module.exports = router;
