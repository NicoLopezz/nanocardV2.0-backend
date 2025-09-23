const express = require('express');
const router = express.Router();
const ReconciliationService = require('../../services/reconciliationService');

// Crear nueva conciliación
router.post('/create', async (req, res) => {
  try {
    const { userId, name, description } = req.body;
    const createdBy = 'system'; // Simplificado
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }
    
    const reconciliation = await ReconciliationService.createReconciliation(
      userId, 
      { name, description }, 
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
