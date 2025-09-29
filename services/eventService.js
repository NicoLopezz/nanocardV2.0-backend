const StatsRefreshService = require('./statsRefreshService');

class EventService {
  static eventListeners = new Map();
  
  // Registrar un listener para un evento
  static on(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(callback);
  }
  
  // Emitir un evento
  static emit(eventName, data) {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${eventName}:`, error);
        }
      });
    }
  }
  
  // Inicializar listeners para transacciones
  static initializeTransactionListeners() {
    // Listener para cuando se crea una transacción
    this.on('transaction.created', async (data) => {
      try {
        await StatsRefreshService.refreshAllStats(
          data.userId, 
          data.cardId, 
          data.transaction, 
          'create'
        );
        console.log(`✅ Stats updated after transaction creation: ${data.transaction._id}`);
      } catch (error) {
        console.error('❌ Error updating stats after transaction creation:', error);
      }
    });
    
    // Listener para cuando se actualiza una transacción
    this.on('transaction.updated', async (data) => {
      try {
        await StatsRefreshService.refreshAllStats(
          data.userId, 
          data.cardId, 
          data.transaction, 
          'update'
        );
        console.log(`✅ Stats updated after transaction update: ${data.transaction._id}`);
      } catch (error) {
        console.error('❌ Error updating stats after transaction update:', error);
      }
    });
    
    // Listener para cuando se elimina una transacción
    this.on('transaction.deleted', async (data) => {
      try {
        await StatsRefreshService.refreshAllStats(
          data.userId, 
          data.cardId, 
          data.transaction, 
          'delete'
        );
        console.log(`✅ Stats updated after transaction deletion: ${data.transaction._id}`);
      } catch (error) {
        console.error('❌ Error updating stats after transaction deletion:', error);
      }
    });
    
    // Listener para cuando se restaura una transacción
    this.on('transaction.restored', async (data) => {
      try {
        await StatsRefreshService.refreshAllStats(
          data.userId, 
          data.cardId, 
          data.transaction, 
          'restore'
        );
        console.log(`✅ Stats updated after transaction restoration: ${data.transaction._id}`);
      } catch (error) {
        console.error('❌ Error updating stats after transaction restoration:', error);
      }
    });
    
    console.log('✅ Transaction event listeners initialized');
  }
  
  // Emitir evento de transacción creada
  static emitTransactionCreated(userId, cardId, transaction) {
    this.emit('transaction.created', {
      userId,
      cardId,
      transaction
    });
  }
  
  // Emitir evento de transacción actualizada
  static emitTransactionUpdated(userId, cardId, transaction) {
    this.emit('transaction.updated', {
      userId,
      cardId,
      transaction
    });
  }
  
  // Emitir evento de transacción eliminada
  static emitTransactionDeleted(userId, cardId, transaction) {
    this.emit('transaction.deleted', {
      userId,
      cardId,
      transaction
    });
  }
  
  // Emitir evento de transacción restaurada
  static emitTransactionRestored(userId, cardId, transaction) {
    this.emit('transaction.restored', {
      userId,
      cardId,
      transaction
    });
  }
  
  // Inicializar todos los listeners
  static initialize() {
    this.initializeTransactionListeners();
    console.log('✅ Event service initialized');
  }
}

module.exports = EventService;
