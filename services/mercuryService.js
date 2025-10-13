const config = require('../config/mercury');

class MercuryService {
  constructor() {
    this.baseUrl = config.api.baseUrl;
    this.token = config.api.token;
    this.accountId = config.api.accountId;
  }

  // Obtener todas las cards de Mercury
  async getAllCards() {
    try {
      const response = await fetch(`${this.baseUrl}/account/${this.accountId}/cards`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mercury Cards API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const cards = data?.cards || [];
      
      return cards;
    } catch (error) {
      throw error;
    }
  }

  async getAllTransactions(options = {}) {
    try {
      const defaultOptions = {
        limit: 1000,
        offset: 0,
        startDate: '2020-01-01',
        ...options
      };
      
      if (options.startDate) {
        defaultOptions.start = options.startDate;
      }
      if (options.endDate) {
        defaultOptions.end = options.endDate;
      }
      
      const params = new URLSearchParams();
      Object.entries(defaultOptions).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value);
        }
      });
      
      const url = `${this.baseUrl}/account/${this.accountId}/transactions?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mercury API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const transactions = data?.transactions || [];
      
      return transactions;
    } catch (error) {
      throw error;
    }
  }

  // Mapear estados de Mercury a operaciones unificadas de Nano
  mapMercuryStatusToOperation(status, amount) {
    // Si el amount es positivo, es una entrada de dinero (REFUND)
    // Si el amount es negativo, es una salida de dinero (APPROVED/REJECTED según status)
    
    if (amount > 0) {
      // Transacciones positivas = entrada de dinero = REFUND
      return 'TRANSACTION_REFUND';
    } else {
      // Transacciones negativas = salida de dinero = según status
      const mapping = {
        'pending': 'TRANSACTION_PENDING',
        'sent': 'TRANSACTION_APPROVED',
        'cancelled': 'TRANSACTION_CANCELLED',
        'failed': 'TRANSACTION_REJECTED',
        'reversed': 'TRANSACTION_REVERSED',
        'blocked': 'TRANSACTION_BLOCKED'
      };
      return mapping[status] || 'TRANSACTION_PENDING';
    }
  }

  // Convertir card de Mercury a formato Nano
  convertMercuryCardToNano(mercuryCard) {
    return {
      _id: mercuryCard.cardId,
      userId: mercuryCard.cardId, // Usar cardId como userId si no hay userId específico
      name: mercuryCard.nameOnCard,
      supplier: 'mercury',
      last4: mercuryCard.lastFourDigits, // Mapear lastFourDigits a last4 (campo requerido)
      lastFourDigits: mercuryCard.lastFourDigits,
      network: mercuryCard.network,
      type: 'Virtual',
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

  // Función auxiliar para obtener cardId (directo o de transacción relacionada)
  getCardIdFromTransaction(mercuryTransaction, allMercuryTransactions = []) {
    // 1. Intentar cardId directo
    let cardId = mercuryTransaction.details?.debitCardInfo?.id;
    let originalTransactionId = null;
    
    // 2. Si no hay cardId directo, buscar en relatedTransactions
    if (!cardId && mercuryTransaction.relatedTransactions?.length > 0) {
      const relatedId = mercuryTransaction.relatedTransactions[0].id;
      const relatedTransaction = allMercuryTransactions.find(t => t.id === relatedId);
      
      if (relatedTransaction?.details?.debitCardInfo?.id) {
        cardId = relatedTransaction.details.debitCardInfo.id;
        originalTransactionId = relatedId;
      }
    }
    
    return { cardId, originalTransactionId };
  }

  // Convertir transacción de Mercury a formato Nano
  convertMercuryTransactionToNano(mercuryTransaction, allMercuryTransactions = [], cardName = null, userName = null) {
    const operation = this.mapMercuryStatusToOperation(mercuryTransaction.status, mercuryTransaction.amount);
    const transactionDate = new Date(mercuryTransaction.createdAt);
    
    // Formatear fecha como DD/MM/YYYY (mantener zona horaria UTC de Mercury)
    const formattedDate = transactionDate.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC' // Mantener zona horaria UTC
    });
    
    // Formatear tiempo como HH:MM AM/PM (mantener zona horaria UTC de Mercury)
    const formattedTime = transactionDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC' // Mantener zona horaria UTC
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

    // Obtener cardId y originalTransactionId usando la función auxiliar
    const { cardId, originalTransactionId } = this.getCardIdFromTransaction(mercuryTransaction, allMercuryTransactions);
    
    // Determinar si es crédito basado en el signo del amount original
    const isCredit = mercuryTransaction.amount > 0;
    
    return {
      _id: mercuryTransaction.id,
      cardId: cardId,
      userId: cardId, // Usar cardId como userId
      supplier: 'mercury',
      operation: operation,
      amount: Math.abs(mercuryTransaction.amount), // Siempre positivo para el amount
      credit: isCredit, // true si amount original > 0, false si amount original < 0
      name: mercuryTransaction.counterpartyName || mercuryTransaction.bankDescription || 'Mercury Transaction', // Campo requerido 'name'
      status: statusMapping[mercuryTransaction.status] || 'PENDING', // Status compatible con el modelo
      date: formattedDate, // Formato DD/MM/YYYY requerido por el modelo
      time: formattedTime, // Formato HH:MM AM/PM requerido por el modelo
      rawDate: mercuryTransaction.createdAt, // Fecha original de Mercury (ISO string)
      userName: userName || 'Mercury User', // Usar el nombre real del usuario si se proporciona
      cardName: cardName || 'Mercury Card', // Usar el nombre real de la card si se proporciona
      mercuryCategory: mercuryTransaction.mercuryCategory, // Campo específico de Mercury
      mercuryKind: mercuryTransaction.kind, // Tipo de transacción de Mercury
      originalTransactionId: originalTransactionId, // ID de la transacción original (para fees)
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}

module.exports = new MercuryService();
