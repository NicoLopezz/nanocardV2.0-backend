const fetch = require('node-fetch');
const mercuryConfig = require('../config/mercury');

class MercuryService {
  constructor() {
    this.baseUrl = mercuryConfig.api.baseUrl;
    this.token = mercuryConfig.api.token;
    this.accountId = mercuryConfig.api.accountId;
  }

  // Obtener todas las cards de Mercury
  async getAllCards() {
    try {
      console.log(`🔗 Fetching cards from Mercury API...`);
      const url = `${this.baseUrl}/account/${this.accountId}/cards`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Mercury API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Fetched ${data.cards?.length || 0} cards from Mercury`);
      
      return data.cards || [];
    } catch (error) {
      console.error(`❌ Error fetching Mercury cards:`, error);
      throw error;
    }
  }

  // Obtener todas las transacciones de Mercury
  async getAllTransactions(options = {}) {
    try {
      console.log(`🔗 Fetching transactions from Mercury API...`);
      
      // Parámetros por defecto para obtener TODAS las transacciones
      const defaultOptions = {
        limit: 1000, // Máximo permitido por Mercury
        offset: 0,
        startDate: '2020-01-01', // Desde 2020 para obtener histórico completo
        ...options
      };
      
      // Construir URL con parámetros
      const params = new URLSearchParams();
      Object.entries(defaultOptions).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value);
        }
      });
      
      const url = `${this.baseUrl}/account/${this.accountId}/transactions?${params.toString()}`;
      console.log(`🔗 URL: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      console.log(`📊 Mercury API Response Status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Mercury API Error Response:`, errorText);
        throw new Error(`Mercury API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`📊 Mercury API Response Data type:`, typeof data);
      console.log(`📊 Mercury API Response Data keys:`, Object.keys(data || {}));
      
      // La API de Mercury retorna { total: X, transactions: [...] }
      const transactions = data?.transactions || [];
      const total = data?.total || 0;
      
      console.log(`📊 Mercury API Response Data length:`, transactions?.length || 0);
      console.log(`📊 Mercury API Total available:`, total);
      console.log(`📊 Mercury API Response Data isArray:`, Array.isArray(transactions));
      
      // Si hay más transacciones disponibles y no hemos alcanzado el límite
      if (total > transactions.length && defaultOptions.limit === 1000) {
        console.log(`⚠️ WARNING: Only fetched ${transactions.length} of ${total} available transactions`);
        console.log(`💡 Consider implementing pagination to get all transactions`);
      }
      
      console.log(`✅ Fetched ${transactions?.length || 0} transactions from Mercury`);
      
      return transactions;
    } catch (error) {
      console.error(`❌ Error fetching Mercury transactions:`, error);
      throw error;
    }
  }

  // Mapear estados de Mercury a operaciones unificadas de Nano
  mapMercuryStatusToOperation(status) {
    const mapping = {
      'pending': 'TRANSACTION_PENDING',
      'sent': 'TRANSACTION_APPROVED',     // ← Unificar con CryptoMate
      'cancelled': 'TRANSACTION_CANCELLED',
      'failed': 'TRANSACTION_REJECTED',
      'reversed': 'TRANSACTION_REVERSED',
      'blocked': 'TRANSACTION_BLOCKED'
    };
    return mapping[status] || 'TRANSACTION_PENDING';
  }

  // Convertir card de Mercury a formato Nano
  convertMercuryCardToNano(mercuryCard) {
    return {
      _id: mercuryCard.cardId,
      name: mercuryCard.nameOnCard,
      userId: mercuryCard.cardId, // Usar cardId como userId
      supplier: 'mercury',
      network: mercuryCard.network,
      last4: mercuryCard.lastFourDigits, // Mapear lastFourDigits a last4 (requerido)
      lastFourDigits: mercuryCard.lastFourDigits,
      status: mercuryCard.status,
      balance: 0,
      availableBalance: 0,
      stats: {
        money_in: 0,
        refund: 0,
        posted: 0,
        reversed: 0,
        rejected: 0,
        pending: 0,
        available: 0
      },
      createdAt: new Date(mercuryCard.createdAt),
      updatedAt: new Date()
    };
  }

  // Convertir transacción de Mercury a formato Nano
  convertMercuryTransactionToNano(mercuryTransaction) {
    const operation = this.mapMercuryStatusToOperation(mercuryTransaction.status);
    const transactionDate = new Date(mercuryTransaction.createdAt);
    
    // Formatear fecha como DD/MM/YYYY (requerido por el modelo)
    const formattedDate = transactionDate.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    // Formatear tiempo como HH:MM AM/PM (requerido por el modelo)
    const formattedTime = transactionDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    // Mapear status de Mercury a status del modelo
    const statusMapping = {
      'pending': 'PENDING',
      'sent': 'SUCCESS',
      'cancelled': 'FAILED',
      'failed': 'FAILED',
      'reversed': 'FAILED',
      'blocked': 'FAILED'
    };
    
    return {
      _id: mercuryTransaction.id,
      cardId: mercuryTransaction.details?.debitCardInfo?.id,
      userId: mercuryTransaction.details?.debitCardInfo?.id, // Usar cardId como userId
      supplier: 'mercury',
      operation: operation,
      amount: Math.abs(mercuryTransaction.amount),
      name: mercuryTransaction.counterpartyName || mercuryTransaction.bankDescription || 'Mercury Transaction', // Campo requerido 'name'
      status: statusMapping[mercuryTransaction.status] || 'PENDING', // Status compatible con el modelo
      date: formattedDate, // Formato DD/MM/YYYY requerido por el modelo
      time: formattedTime, // Formato HH:MM AM/PM requerido por el modelo
      userName: 'Mercury User', // Se actualizará con el nombre real del usuario
      cardName: 'Mercury Card', // Se actualizará con el nombre real de la card
      mercuryCategory: mercuryTransaction.mercuryCategory, // Campo específico de Mercury
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}

module.exports = new MercuryService();