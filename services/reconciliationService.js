const { getReconciliationModel } = require('../models/Reconciliation');
const { getReconciliationTransactionModel } = require('../models/ReconciliationTransaction');
const { getReconciliationCardModel } = require('../models/ReconciliationCard');
const { getUserModel } = require('../models/User');
const { getCardModel } = require('../models/Card');
const { getTransactionModel } = require('../models/Transaction');
const crypto = require('crypto');

class ReconciliationService {
  
  // Crear una nueva conciliación
  static async createReconciliation(userId, reconciliationData, createdBy) {
    try {
      const Reconciliation = getReconciliationModel();
      const ReconciliationTransaction = getReconciliationTransactionModel();
      const ReconciliationCard = getReconciliationCardModel();
      const User = getUserModel();
      const Card = getCardModel();
      const Transaction = getTransactionModel();
      
      // Obtener datos completos del usuario
      console.log(`🔍 Looking for user with ID: "${userId}"`);
      const user = await User.findById(userId);
      if (!user) {
        console.log(`❌ User not found. Available users:`);
        const allUsers = await User.find({}).select('_id username email');
        console.log(allUsers);
        throw new Error(`User ${userId} not found`);
      }
      console.log(`✅ User found: ${user.username} (${user.email})`);
      
      // Crear snapshot de usuario
      const userSnapshot = {
        profile: user.profile,
        preferences: user.preferences,
        stats: user.stats
      };
      
      // Obtener todas las tarjetas del usuario
      const cards = await Card.find({ userId: userId });
      
      // Obtener todas las transacciones del usuario
      const transactions = await Transaction.find({ 
        userId: userId,
        isDeleted: false 
      }).sort({ createdAt: -1 });
      
      // Calcular resumen financiero
      const financialSummary = this.calculateFinancialSummary(transactions, cards);
      
      // Crear ID de conciliación
      const reconciliationId = `recon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Crear documentos individuales para cada tarjeta
      const reconciliationCards = cards.map(card => new ReconciliationCard({
        _id: `recon_card_${Date.now()}_${card._id}`,
        reconciliationId: reconciliationId,
        originalCardId: card._id,
        userId: userId,
        name: card.name,
        supplier: card.supplier,
        last4: card.last4,
        type: card.type,
        status: card.status,
        approval_method: card.approval_method,
        forwarded_3ds_type: card.forwarded_3ds_type,
        deposited: card.deposited,
        refunded: card.refunded,
        posted: card.posted,
        pending: card.pending,
        available: card.available,
        cryptoMateBalance: card.cryptoMateBalance,
        transactionStats: card.transactionStats,
        limits: card.limits,
        meta: card.meta,
        reconciledBy: createdBy,
        reconciliationDate: new Date()
      }));
      
      // Crear documentos individuales para cada transacción
      const reconciliationTransactions = transactions.map(transaction => new ReconciliationTransaction({
        _id: `recon_tx_${Date.now()}_${transaction._id}`,
        reconciliationId: reconciliationId,
        originalTransactionId: transaction._id,
        userId: userId,
        cardId: transaction.cardId,
        userName: transaction.userName,
        cardName: transaction.cardName,
        name: transaction.name,
        amount: transaction.amount,
        date: transaction.date,
        time: transaction.time,
        status: transaction.status,
        operation: transaction.operation,
        city: transaction.city,
        country: transaction.country,
        mcc_category: transaction.mcc_category,
        mercuryCategory: transaction.mercuryCategory,
        credit: transaction.credit,
        comentario: transaction.comentario,
        version: transaction.version,
        isDeleted: transaction.isDeleted,
        deletedAt: transaction.deletedAt,
        deletedBy: transaction.deletedBy,
        originalCreatedAt: transaction.createdAt,
        originalUpdatedAt: transaction.updatedAt,
        reconciledBy: createdBy,
        reconciliationDate: new Date()
      }));
      
      // Calcular metadatos del snapshot
      const snapshotMetadata = {
        totalCards: cards.length,
        totalTransactions: transactions.length,
        dateRange: {
          from: transactions.length > 0 ? transactions[transactions.length - 1].createdAt : new Date(),
          to: transactions.length > 0 ? transactions[0].createdAt : new Date()
        },
        version: '1.0',
        checksum: this.calculateChecksum(transactions)
      };
      
      // Crear la conciliación
      const reconciliation = new Reconciliation({
        _id: reconciliationId,
        userId: userId,
        userName: user.username,
        userEmail: user.email,
        name: reconciliationData.name || `Reconciliation ${new Date().toLocaleDateString()}`,
        description: reconciliationData.description,
        reconciliationDate: new Date(),
        createdBy: createdBy,
        userSnapshot: userSnapshot,
        financialSummary: financialSummary,
        snapshotMetadata: snapshotMetadata
      });
      
      // Guardar todo en paralelo
      await Promise.all([
        reconciliation.save(),
        ReconciliationCard.insertMany(reconciliationCards),
        ReconciliationTransaction.insertMany(reconciliationTransactions)
      ]);
      
      // Marcar transacciones como conciliadas
      await Transaction.updateMany(
        { userId: userId, isDeleted: false },
        { 
          reconciled: true,
          reconciledAt: new Date(),
          reconciledBy: createdBy,
          reconciliationId: reconciliation._id
        }
      );
      
      return reconciliation;
      
    } catch (error) {
      console.error('Error creating reconciliation:', error);
      throw error;
    }
  }
  
  // Calcular resumen financiero
  static calculateFinancialSummary(transactions, cards) {
    const summary = {
      totalDeposited: 0,
      totalRefunded: 0,
      totalPosted: 0,
      totalPending: 0,
      totalAvailable: 0,
      totalTransactions: transactions.length,
      byOperation: {
        TRANSACTION_APPROVED: { count: 0, amount: 0 },
        TRANSACTION_REJECTED: { count: 0, amount: 0 },
        TRANSACTION_REVERSED: { count: 0, amount: 0 },
        TRANSACTION_REFUND: { count: 0, amount: 0 },
        WALLET_DEPOSIT: { count: 0, amount: 0 },
        OVERRIDE_VIRTUAL_BALANCE: { count: 0, amount: 0 }
      },
      byCard: []
    };
    
    // Procesar transacciones
    transactions.forEach(transaction => {
      const operation = transaction.operation;
      const amount = Math.abs(transaction.amount);
      
      if (summary.byOperation[operation]) {
        summary.byOperation[operation].count++;
        summary.byOperation[operation].amount += amount;
      }
      
      // Acumular totales por tipo
      if (operation === 'WALLET_DEPOSIT') {
        summary.totalDeposited += amount;
      } else if (operation === 'TRANSACTION_REFUND') {
        summary.totalRefunded += amount;
      } else if (operation === 'TRANSACTION_APPROVED') {
        summary.totalPosted += amount;
      }
    });
    
    // Procesar tarjetas
    cards.forEach(card => {
      summary.byCard.push({
        cardId: card._id,
        cardName: card.name,
        deposited: card.deposited,
        refunded: card.refunded,
        posted: card.posted,
        pending: card.pending,
        available: card.available,
        transactionCount: card.transactionStats.totalTransactions
      });
      
      summary.totalDeposited += card.deposited;
      summary.totalRefunded += card.refunded;
      summary.totalPosted += card.posted;
      summary.totalPending += card.pending;
    });
    
    summary.totalAvailable = summary.totalDeposited + summary.totalRefunded - summary.totalPosted;
    
    return summary;
  }
  
  // Calcular checksum para verificar integridad
  static calculateChecksum(transactions) {
    const data = JSON.stringify(transactions);
    return crypto.createHash('md5').update(data).digest('hex');
  }
  
  // Obtener conciliaciones de un usuario
  static async getUserReconciliations(userId, limit = 10, offset = 0) {
    try {
      const Reconciliation = getReconciliationModel();
      
      const reconciliations = await Reconciliation.find({ 
        userId: userId,
        status: 'ACTIVE'
      })
      .sort({ reconciliationDate: -1 })
      .limit(limit)
      .skip(offset)
      .select('_id name description reconciliationDate financialSummary snapshotMetadata');
      
      const total = await Reconciliation.countDocuments({ 
        userId: userId,
        status: 'ACTIVE'
      });
      
      return {
        reconciliations,
        total,
        hasMore: offset + limit < total
      };
      
    } catch (error) {
      console.error('Error getting user reconciliations:', error);
      throw error;
    }
  }
  
  // Obtener una conciliación específica
  static async getReconciliationById(reconciliationId) {
    try {
      const Reconciliation = getReconciliationModel();
      return await Reconciliation.findById(reconciliationId);
    } catch (error) {
      console.error('Error getting reconciliation:', error);
      throw error;
    }
  }
  
  // Archivar una conciliación
  static async archiveReconciliation(reconciliationId, archivedBy) {
    try {
      const Reconciliation = getReconciliationModel();
      
      return await Reconciliation.findByIdAndUpdate(
        reconciliationId,
        { 
          status: 'ARCHIVED',
          updatedAt: new Date()
        },
        { new: true }
      );
      
    } catch (error) {
      console.error('Error archiving reconciliation:', error);
      throw error;
    }
  }
  
  // Eliminar una conciliación
  static async deleteReconciliation(reconciliationId, deletedBy) {
    try {
      const Reconciliation = getReconciliationModel();
      
      return await Reconciliation.findByIdAndUpdate(
        reconciliationId,
        { 
          status: 'DELETED',
          updatedAt: new Date()
        },
        { new: true }
      );
      
    } catch (error) {
      console.error('Error deleting reconciliation:', error);
      throw error;
    }
  }
}

module.exports = ReconciliationService;
