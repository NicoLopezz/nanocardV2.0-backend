const express = require('express');
const router = express.Router();
const historyService = require('../../services/historyService');
const { authenticateToken } = require('../../middleware/auth');

// Endpoint para obtener historial por entidad
router.get('/entity/:entityType/:entityId', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { entityType, entityId } = req.params;
    const { limit = 50 } = req.query;
    
    const history = await historyService.getHistoryByEntity(entityType, entityId, parseInt(limit));
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ History fetched for ${entityType}:${entityId} in ${responseTime}ms`);
    
    res.json({
      success: true,
      entityType,
      entityId,
      history,
      count: history.length,
      responseTime: responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching entity history (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

// Endpoint para obtener historial por usuario
router.get('/user/:userId', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;
    
    // Verificar permisos: admin puede ver cualquier usuario, usuario estándar solo su propio historial
    if (req.user.role !== 'admin' && req.user.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. You can only view your own history.' 
      });
    }
    
    const history = await historyService.getHistoryByUser(userId, parseInt(limit));
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ User history fetched for ${userId} in ${responseTime}ms`);
    
    res.json({
      success: true,
      userId,
      history,
      count: history.length,
      responseTime: responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching user history (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

// Endpoint para obtener historial por categoría
router.get('/category/:category', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { category } = req.params;
    const { limit = 50 } = req.query;
    
    // Solo admin puede ver historial por categoría
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin role required.' 
      });
    }
    
    const history = await historyService.getHistoryByCategory(category, parseInt(limit));
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ Category history fetched for ${category} in ${responseTime}ms`);
    
    res.json({
      success: true,
      category,
      history,
      count: history.length,
      responseTime: responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching category history (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

// Endpoint para obtener estadísticas del historial
router.get('/stats', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Solo admin puede ver estadísticas
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin role required.' 
      });
    }
    
    const { timeRange = '24h' } = req.query;
    const stats = await historyService.getHistoryStats(timeRange);
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ History stats fetched in ${responseTime}ms`);
    
    res.json({
      success: true,
      timeRange,
      stats,
      responseTime: responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching history stats (${responseTime}ms):`, error);
    res.status(500).json({ success: false, error: error.message, responseTime: responseTime });
  }
});

// Endpoint para obtener historial reciente adaptado para Activity Log
router.get('/recent', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { limit = 100 } = req.query;
    
    // Solo admin puede ver historial reciente
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin role required.' 
      });
    }
    
    const { getHistoryModel } = require('../../models/History');
    const { getCardModel } = require('../../models/Card');
    const { getUserModel } = require('../../models/User');
    const { getTransactionModel } = require('../../models/Transaction');
    
    const History = getHistoryModel();
    const Card = getCardModel();
    const User = getUserModel();
    const Transaction = getTransactionModel();
    
    // Obtener historial
    const historyRecords = await History.find({})
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();
    
    // Función para mapear eventType a tipoAccion
    const mapEventTypeToTipoAccion = (eventType, entityType) => {
      const mapping = {
        // Login
        'LOGIN_SUCCESS': 'login_exitoso',
        'LOGIN_FAILED': 'login',
        'LOGOUT': 'login',
        
        // Depósitos
        'TRANSACTION_CREATED': 'deposito_manual',
        'WALLET_DEPOSIT': 'deposito_automatico',
        'OVERRIDE_VIRTUAL_BALANCE': 'deposito_manual',
        
        // Retiros
        'WITHDRAWAL': 'retiro_manual',
        'TRANSACTION_APPROVED': 'retiro_automatico',
        
        // Transferencias
        'TRANSFER': 'transferencia',
        
        // Cambios
        'TRANSACTION_UPDATED': 'edicion_transaccion',
        'CARD_UPDATED': 'cambio_datos',
        'USER_UPDATED': 'cambio_datos',
        'USER_ROLE_CHANGED': 'cambio_datos',
        
        // Eliminaciones
        'TRANSACTION_DELETED': 'eliminacion_transaccion',
        'CARD_DELETED': 'eliminacion_transaccion',
        'USER_DELETED': 'eliminacion_transaccion',
        
        // Restauraciones
        'TRANSACTION_RESTORED': 'reversion_transaccion',
        
        // Reversiones
        'TRANSACTION_REJECTED': 'reversion_transaccion',
        'TRANSACTION_REVERSED': 'reversion_transaccion',
        
        // Ajustes
        'TRANSACTION_REFUNDED': 'ajuste_contable',
        
        // Conciliaciones
        'CREATE': entityType === 'Reconciliation' ? 'conciliacion_manual' : 'otro',
        
        // Otros
        'CARD_SUSPENDED': 'bloqueo_cuenta',
        'CARD_ACTIVATED': 'desbloqueo_cuenta',
        'USER_ACTIVATED': 'desbloqueo_cuenta',
        'USER_DEACTIVATED': 'bloqueo_cuenta',
      };
      
      return mapping[eventType] || 'otro';
    };
    
    // Función para formatear cambios a detalleAnterior/detalleActual
    const formatChanges = (changes, record, transaction = null) => {
      if (!changes || !Array.isArray(changes) || changes.length === 0) {
        // Si no hay cambios, pero es una transacción, mostrar información de la transacción
        if (record.entityType === 'Transaction' && record.metadata) {
          const operation = record.metadata.transactionOperation || transaction?.operation || 'N/A';
          const amount = record.metadata.transactionAmount || transaction?.amount || 'N/A';
          return {
            detalleAnterior: `Tipo: ${operation} | Monto: ${amount}`,
            detalleActual: `Tipo: ${operation} | Monto: ${amount}`,
            before: `Tipo: ${operation} | Monto: ${amount}`,
            after: `Tipo: ${operation} | Monto: ${amount}`
          };
        }
        return {
          detalleAnterior: '',
          detalleActual: '',
          before: '',
          after: ''
        };
      }
      
      // Formatear cambios como texto legible
      const beforeParts = changes.map(c => {
        const value = c.oldValue !== null && c.oldValue !== undefined 
          ? String(c.oldValue) 
          : 'N/A';
        return `${c.field}: ${value}`;
      });
      
      const afterParts = changes.map(c => {
        const value = c.newValue !== null && c.newValue !== undefined 
          ? String(c.newValue) 
          : 'N/A';
        return `${c.field}: ${value}`;
      });
      
      // Agregar información adicional de la transacción si existe (ordenada y estructurada)
      let detalleAnterior = '';
      let detalleActual = '';
      
      if (record.entityType === 'Transaction') {
        // Obtener todos los datos de la transacción
        const transactionId = record.entityId || transaction?._id || record.metadata?.transactionId || null;
        const operation = transaction?.operation || record.metadata?.transactionOperation || null;
        const transactionName = transaction?.name || record.metadata?.transactionName || null;
        const status = transaction?.status || record.metadata?.transactionStatus || null;
        const date = transaction?.date || null;
        const time = transaction?.time || null;
        const supplier = transaction?.supplier || null;
        
        // Monto: si cambió, usar el valor del cambio; si no, usar el valor actual
        const amountOld = changes.find(c => c.field === 'amount')?.oldValue ?? (transaction?.amount || record.metadata?.transactionAmount || null);
        const amountNew = changes.find(c => c.field === 'amount')?.newValue ?? (transaction?.amount || record.metadata?.transactionAmount || null);
        
        // Construir detalleAnterior (valores anteriores)
        const anteriorParts = [];
        if (transactionId) anteriorParts.push(`ID: ${transactionId}`);
        if (operation) anteriorParts.push(`Tipo: ${operation}`);
        if (amountOld !== null) anteriorParts.push(`Monto: ${amountOld}`);
        if (transactionName) anteriorParts.push(`Nombre: ${transactionName}`);
        if (status) anteriorParts.push(`Estado: ${status}`);
        if (date) anteriorParts.push(`Fecha: ${date}`);
        if (time) anteriorParts.push(`Hora: ${time}`);
        if (supplier) anteriorParts.push(`Proveedor: ${supplier}`);
        detalleAnterior = anteriorParts.join(' | ');
        
        // Construir detalleActual (valores nuevos)
        const actualParts = [];
        if (transactionId) actualParts.push(`ID: ${transactionId}`);
        if (operation) actualParts.push(`Tipo: ${operation}`);
        if (amountNew !== null) actualParts.push(`Monto: ${amountNew}`);
        if (transactionName) actualParts.push(`Nombre: ${transactionName}`);
        if (status) actualParts.push(`Estado: ${status}`);
        if (date) actualParts.push(`Fecha: ${date}`);
        if (time) actualParts.push(`Hora: ${time}`);
        if (supplier) actualParts.push(`Proveedor: ${supplier}`);
        detalleActual = actualParts.join(' | ');
      } else {
        // Para otros tipos de entidades, usar el formato original
        detalleAnterior = beforeParts.join(' | ');
        detalleActual = afterParts.join(' | ');
      }
      
      return {
        detalleAnterior: detalleAnterior,
        detalleActual: detalleActual,
        before: detalleAnterior,
        after: detalleActual
      };
    };
    
    // Obtener IDs únicos para enriquecer datos
    // Para LOGIN_SUCCESS, necesitamos obtener el cardId desde metadata
    const cardIds = [...new Set(historyRecords
      .map(h => {
        if (h.entityType === 'Card') {
          return h.entityId;
        }
        // Para LOGIN_SUCCESS, el cardId está en metadata
        if (h.eventType === 'LOGIN_SUCCESS' && h.metadata?.cardLast4) {
          // Buscar tarjeta por last4 desde metadata
          return null; // Se buscará por last4 después
        }
        return h.metadata?.cardId || null;
      })
      .filter(Boolean))];
    
    // Para LOGIN_SUCCESS, obtener cardIds desde metadata.cardLast4
    const loginCardLast4s = [...new Set(historyRecords
      .filter(h => h.eventType === 'LOGIN_SUCCESS' && h.metadata?.cardLast4)
      .map(h => h.metadata.cardLast4))];
    
    const userIds = [...new Set(historyRecords
      .map(h => h.userId)
      .filter(Boolean))];
    
    const transactionIds = [...new Set(historyRecords
      .filter(h => h.entityType === 'Transaction')
      .map(h => h.entityId)
      .filter(Boolean))];
    
    // Para LOGIN_SUCCESS, buscar tarjetas por last4 también
    let loginCards = [];
    if (loginCardLast4s.length > 0) {
      loginCards = await Card.find({ last4: { $in: loginCardLast4s } }).lean();
    }
    
    // Enriquecer datos en paralelo
    // Incluir transacciones eliminadas para obtener cardId y name
    const [cards, users, transactions] = await Promise.all([
      cardIds.length > 0 ? Card.find({ _id: { $in: cardIds } }).lean() : Promise.resolve([]),
      userIds.length > 0 ? User.find({ _id: { $in: userIds } }).lean() : Promise.resolve([]),
      transactionIds.length > 0 ? Transaction.find({ _id: { $in: transactionIds } }).lean() : Promise.resolve([])
      // Nota: No filtramos por isDeleted porque queremos incluir transacciones eliminadas para obtener cardId y name
    ]);
    
    // Combinar todas las tarjetas (por _id y por last4)
    const allCards = [...cards, ...loginCards];
    
    // Crear mapas para búsqueda rápida
    const cardsMap = new Map(allCards.map(c => [c._id, c]));
    // Mapa por last4 para LOGIN_SUCCESS
    const cardsByLast4Map = new Map(allCards.map(c => [c.last4, c]));
    const usersMap = new Map(users.map(u => [u._id, u]));
    const transactionsMap = new Map(transactions.map(t => [t._id, t]));
    
    // Transformar historial al formato esperado por el frontend
    // Usar Promise.all para permitir búsquedas asíncronas cuando falten datos
    const transformedHistory = await Promise.all(historyRecords.map(async (record) => {
      // Obtener información de entidades relacionadas
      let card = null;
      let user = null;
      let transaction = null;
      
      // Si es LOGIN_SUCCESS, obtener tarjeta desde metadata.cardLast4
      if (record.eventType === 'LOGIN_SUCCESS') {
        if (record.metadata?.cardLast4) {
          card = cardsByLast4Map.get(record.metadata.cardLast4);
          // Si hay múltiples tarjetas con el mismo last4, usar la que coincida con el userId
          if (!card && record.userId) {
            const cardsWithLast4 = allCards.filter(c => c.last4 === record.metadata.cardLast4);
            card = cardsWithLast4.find(c => c.userId === record.userId) || cardsWithLast4[0];
          }
        }
        // Obtener usuario desde userId del registro
        if (record.userId) {
          user = usersMap.get(record.userId);
          // Si no encontramos el usuario en el mapa, buscar directamente
          if (!user) {
            try {
              const foundUser = await User.findById(record.userId).lean();
              if (foundUser) {
                user = foundUser;
                usersMap.set(foundUser._id, foundUser);
              }
            } catch (err) {
              console.error(`Error finding user ${record.userId}:`, err);
            }
          }
        }
        // Si no encontramos usuario, intentar desde la tarjeta
        if (!user && card && card.userId) {
          user = usersMap.get(card.userId);
          // Si no encontramos el usuario en el mapa, buscar directamente
          if (!user) {
            try {
              const foundUser = await User.findById(card.userId).lean();
              if (foundUser) {
                user = foundUser;
                usersMap.set(foundUser._id, foundUser);
              }
            } catch (err) {
              console.error(`Error finding user ${card.userId}:`, err);
            }
          }
        }
      }
      // Si es una transacción, obtener la transacción y luego la tarjeta/usuario
      else if (record.entityType === 'Transaction') {
        transaction = transactionsMap.get(record.entityId);
        if (transaction) {
          // Obtener tarjeta desde la transacción
          if (transaction.cardId) {
            card = cardsMap.get(transaction.cardId);
            // Si no encontramos la tarjeta en el mapa, intentar buscarla directamente
            if (!card && transaction.cardId) {
              try {
                const foundCard = await Card.findById(transaction.cardId).lean();
                if (foundCard) {
                  card = foundCard;
                  cardsMap.set(foundCard._id, foundCard);
                  cardsByLast4Map.set(foundCard.last4, foundCard);
                }
              } catch (err) {
                console.error(`Error finding card ${transaction.cardId}:`, err);
              }
            }
          }
          // Obtener usuario desde la transacción o desde la tarjeta
          if (transaction.userId) {
            user = usersMap.get(transaction.userId);
            // Si no encontramos el usuario en el mapa, intentar buscarlo directamente
            if (!user && transaction.userId) {
              try {
                const foundUser = await User.findById(transaction.userId).lean();
                if (foundUser) {
                  user = foundUser;
                  usersMap.set(foundUser._id, foundUser);
                }
              } catch (err) {
                console.error(`Error finding user ${transaction.userId}:`, err);
              }
            }
          } else if (card && card.userId) {
            user = usersMap.get(card.userId);
            // Si no encontramos el usuario en el mapa, intentar buscarlo directamente
            if (!user && card.userId) {
              try {
                const foundUser = await User.findById(card.userId).lean();
                if (foundUser) {
                  user = foundUser;
                  usersMap.set(foundUser._id, foundUser);
                }
              } catch (err) {
                console.error(`Error finding user ${card.userId}:`, err);
              }
            }
          }
        } else {
          // Si no encontramos la transacción, intentar buscarla directamente (puede estar eliminada)
          try {
            const foundTransaction = await Transaction.findById(record.entityId).lean();
            if (foundTransaction) {
              transaction = foundTransaction;
              transactionsMap.set(foundTransaction._id, foundTransaction);
              
              // Obtener tarjeta desde la transacción encontrada
              if (foundTransaction.cardId) {
                card = cardsMap.get(foundTransaction.cardId);
                if (!card) {
                  const foundCard = await Card.findById(foundTransaction.cardId).lean();
                  if (foundCard) {
                    card = foundCard;
                    cardsMap.set(foundCard._id, foundCard);
                    cardsByLast4Map.set(foundCard.last4, foundCard);
                  }
                }
              }
              
              // Obtener usuario desde la transacción encontrada
              if (foundTransaction.userId) {
                user = usersMap.get(foundTransaction.userId);
                if (!user) {
                  const foundUser = await User.findById(foundTransaction.userId).lean();
                  if (foundUser) {
                    user = foundUser;
                    usersMap.set(foundUser._id, foundUser);
                  }
                }
              }
            }
          } catch (err) {
            console.error(`Error finding transaction ${record.entityId}:`, err);
          }
        }
      }
      // Si es una tarjeta, obtener la tarjeta directamente
      else if (record.entityType === 'Card') {
        card = cardsMap.get(record.entityId);
        // Si no encontramos la tarjeta en el mapa, buscar directamente
        if (!card && record.entityId) {
          try {
            const foundCard = await Card.findById(record.entityId).lean();
            if (foundCard) {
              card = foundCard;
              cardsMap.set(foundCard._id, foundCard);
              cardsByLast4Map.set(foundCard.last4, foundCard);
            }
          } catch (err) {
            console.error(`Error finding card ${record.entityId}:`, err);
          }
        }
        if (card && card.userId) {
          user = usersMap.get(card.userId);
          // Si no encontramos el usuario en el mapa, buscar directamente
          if (!user) {
            try {
              const foundUser = await User.findById(card.userId).lean();
              if (foundUser) {
                user = foundUser;
                usersMap.set(foundUser._id, foundUser);
              }
            } catch (err) {
              console.error(`Error finding user ${card.userId}:`, err);
            }
          }
        }
      }
      // Si es un usuario, obtener el usuario directamente
      else if (record.entityType === 'User') {
        user = usersMap.get(record.entityId);
        // Si no encontramos el usuario en el mapa, buscar directamente
        if (!user && record.entityId) {
          try {
            const foundUser = await User.findById(record.entityId).lean();
            if (foundUser) {
              user = foundUser;
              usersMap.set(foundUser._id, foundUser);
            }
          } catch (err) {
            console.error(`Error finding user ${record.entityId}:`, err);
          }
        }
      }
      // Para otros tipos, intentar desde metadata
      else {
        if (record.metadata?.cardId) {
          card = cardsMap.get(record.metadata.cardId);
          // Si no encontramos la tarjeta en el mapa, buscar directamente
          if (!card) {
            try {
              const foundCard = await Card.findById(record.metadata.cardId).lean();
              if (foundCard) {
                card = foundCard;
                cardsMap.set(foundCard._id, foundCard);
                cardsByLast4Map.set(foundCard.last4, foundCard);
              }
            } catch (err) {
              console.error(`Error finding card ${record.metadata.cardId}:`, err);
            }
          }
          if (card && card.userId) {
            user = usersMap.get(card.userId);
            // Si no encontramos el usuario en el mapa, buscar directamente
            if (!user) {
              try {
                const foundUser = await User.findById(card.userId).lean();
                if (foundUser) {
                  user = foundUser;
                  usersMap.set(foundUser._id, foundUser);
                }
              } catch (err) {
                console.error(`Error finding user ${card.userId}:`, err);
              }
            }
          }
        }
        if (record.userId && !user) {
          user = usersMap.get(record.userId);
          // Si no encontramos el usuario en el mapa, buscar directamente
          if (!user) {
            try {
              const foundUser = await User.findById(record.userId).lean();
              if (foundUser) {
                user = foundUser;
                usersMap.set(foundUser._id, foundUser);
              }
            } catch (err) {
              console.error(`Error finding user ${record.userId}:`, err);
            }
          }
        }
      }
      
      // Formatear cambios (pasar el record completo y transaction para incluir metadata)
      const changes = formatChanges(record.changes, record, transaction);
      
      // Mapear tipo de acción
      const tipoAccion = mapEventTypeToTipoAccion(record.eventType, record.entityType);
      
      // Determinar walletName (prioridad: cardName → userName → metadata.cardName → record.userName → Unknown)
      const walletName = 
        card?.name || 
        user?.username || 
        record.metadata?.cardName || 
        record.userName || 
        transaction?.cardName ||
        transaction?.userName ||
        'Unknown';
      
      // Determinar wallet (prioridad: cardId → userId)
      const wallet = 
        card?._id || 
        transaction?.cardId ||
        record.metadata?.cardId || 
        (record.entityType === 'Card' ? record.entityId : null) ||
        user?._id ||
        transaction?.userId ||
        record.userId || 
        '...';
      
      // Determinar movimientoId (prioridad: movimientoId → transactionId → _id)
      const movimientoId = 
        record.entityType === 'Transaction' ? record.entityId :
        transaction?._id || 
        record.entityId || 
        record._id || 
        'No corresponde';
      
      // Obtener monto (prioridad: monto → amount → money)
      const amount = 
        record.metadata?.transactionAmount || 
        transaction?.amount || 
        record.metadata?.amount || 
        0;
      
      // Obtener comentario/reason y reemplazar IDs con nombres
      let comentario = 
        transaction?.comentario || 
        record.reason || 
        record.description || 
        '';
      
      // Reemplazar IDs con nombres en comentarios
      if (comentario) {
        // Reemplazar userId con nombre de usuario
        if (user?.username) {
          comentario = comentario.replace(new RegExp(user._id, 'g'), user.username);
        }
        // Reemplazar cardId con nombre de tarjeta
        if (card?.name) {
          comentario = comentario.replace(new RegExp(card._id, 'g'), card.name);
        }
        // Reemplazar transactionId con nombre de transacción si existe
        if (transaction?.name) {
          comentario = comentario.replace(new RegExp(transaction._id, 'g'), transaction.name);
        }
      }
      
      // Formatear timestamp
      const timestamp = record.timestamp || record.createdAt || new Date();
      const timestampISO = timestamp instanceof Date ? timestamp.toISOString() : timestamp;
      
      // Obtener cardId (con búsqueda directa si no se encontró)
      let finalCardId = card?._id || transaction?.cardId || record.metadata?.cardId || null;
      
      // Si no tenemos cardId pero tenemos userId, intentar buscar la tarjeta del usuario
      if (!finalCardId && user?._id) {
        try {
          const userCards = await Card.find({ userId: user._id }).limit(1).lean();
          if (userCards.length > 0) {
            card = userCards[0];
            finalCardId = card._id;
            cardsMap.set(card._id, card);
            cardsByLast4Map.set(card.last4, card);
          }
        } catch (err) {
          console.error(`Error finding card for user ${user._id}:`, err);
        }
      }
      
      // Si aún no tenemos cardId pero tenemos transactionId, buscar la transacción directamente
      if (!finalCardId && record.entityType === 'Transaction' && record.entityId) {
        try {
          const foundTransaction = await Transaction.findById(record.entityId).lean();
          if (foundTransaction && foundTransaction.cardId) {
            finalCardId = foundTransaction.cardId;
            // Buscar la tarjeta
            if (!card) {
              const foundCard = await Card.findById(foundTransaction.cardId).lean();
              if (foundCard) {
                card = foundCard;
                cardsMap.set(foundCard._id, foundCard);
                cardsByLast4Map.set(foundCard.last4, foundCard);
              }
            }
          }
        } catch (err) {
          console.error(`Error finding transaction ${record.entityId}:`, err);
        }
      }
      
      // Obtener name de la tarjeta
      let cardName = card?.name || transaction?.cardName || record.metadata?.cardName || null;
      
      // Si no tenemos cardName pero tenemos cardId, buscar directamente
      if (!cardName && finalCardId) {
        try {
          const foundCard = await Card.findById(finalCardId).lean();
          if (foundCard) {
            cardName = foundCard.name;
            card = foundCard;
            cardsMap.set(foundCard._id, foundCard);
            cardsByLast4Map.set(foundCard.last4, foundCard);
          }
        } catch (err) {
          console.error(`Error finding card ${finalCardId}:`, err);
        }
      }
      
      // Obtener nombre de la persona (SIEMPRE usar nombre real, nunca IDs)
      // Prioridad: firstName/lastName del usuario → username del usuario (si no es ID) → nombre de la tarjeta → record.userName (solo si no es un ID)
      let personName = null;
      
      if (user) {
        // Prioridad 1: firstName + lastName del usuario
        if (user.profile?.firstName || user.profile?.lastName) {
          personName = `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim();
        }
        // Prioridad 2: username del usuario (SOLO si no es un ID)
        if (!personName && user.username) {
          const isLikelyId = user.username.length > 20 && /^[a-zA-Z0-9]+$/.test(user.username);
          if (!isLikelyId) {
            personName = user.username;
          }
        }
      }
      
      // Si no tenemos nombre del usuario, usar nombre de la tarjeta
      if (!personName && card?.name) {
        personName = card.name;
      }
      
      // Si aún no tenemos nombre, usar userName de la transacción (si no es un ID)
      if (!personName && transaction?.userName) {
        const isLikelyId = transaction.userName.length > 20 && /^[a-zA-Z0-9]+$/.test(transaction.userName);
        if (!isLikelyId) {
          personName = transaction.userName;
        }
      }
      
      // Si aún no tenemos nombre, usar record.userName (solo si no es un ID)
      if (!personName && record.userName) {
        const isLikelyId = record.userName.length > 20 && /^[a-zA-Z0-9]+$/.test(record.userName);
        if (!isLikelyId) {
          personName = record.userName;
        }
      }
      
      // Si aún no tenemos nombre, usar metadata.cardName
      if (!personName && record.metadata?.cardName) {
        personName = record.metadata.cardName;
      }
      
      // Fallback final
      personName = personName || 'Unknown';
      
      // Construir respuesta
      const response = {
        // Identificador único del registro de historial
        id: record._id,
        
        // Nombre de la persona
        name: personName,
        
        // CardId (no el _id de la base de datos)
        cardId: finalCardId,
        
        // Tipo de acción
        tipoAccion: tipoAccion,
        
        // Detalle de lo que se hizo
        detalleAnterior: changes.detalleAnterior,
        detalleActual: changes.detalleActual,
        
        // Timestamp (opcional, pero útil)
        timestamp: timestampISO
      };
      
      // Si es LOGIN_SUCCESS, agregar metadata completo con información del dispositivo, navegador, OS y red
      if (record.eventType === 'LOGIN_SUCCESS' && record.metadata) {
        response.metadata = {
          loginMethod: record.metadata.loginMethod || 'card',
          cardLast4: record.metadata.cardLast4 || null,
          cardName: record.metadata.cardName || null,
          device: record.metadata.device || null,
          browser: record.metadata.browser || null,
          os: record.metadata.os || null,
          network: record.metadata.network || null,
          headers: record.metadata.headers || null,
          rawUserAgent: record.metadata.rawUserAgent || null
        };
      }
      
      // Si es una transacción, agregar el ID de la transacción y más detalles estructurados
      if (record.entityType === 'Transaction') {
        // Agregar el ID de la transacción modificada (entityId)
        if (record.entityId) {
          response.transactionId = record.entityId;
        }
        
        // Obtener todos los datos de la transacción
        const operation = transaction?.operation || record.metadata?.transactionOperation || null;
        const transactionName = transaction?.name || record.metadata?.transactionName || null;
        const status = transaction?.status || record.metadata?.transactionStatus || null;
        const date = transaction?.date || null;
        const time = transaction?.time || null;
        const supplier = transaction?.supplier || null;
        const amount = transaction?.amount || record.metadata?.transactionAmount || null;
        
        // Verificar si hay cambios o si es una creación/eliminación
        const hasChanges = record.changes && record.changes.length > 0;
        const isCreated = record.eventType === 'TRANSACTION_CREATED';
        const isDeleted = record.eventType === 'TRANSACTION_DELETED';
        
        // Obtener valores anteriores y nuevos SOLO de los campos que cambiaron
        const amountChange = record.changes?.find(c => c.field === 'amount');
        const nameChange = record.changes?.find(c => c.field === 'name');
        const statusChange = record.changes?.find(c => c.field === 'status');
        const dateChange = record.changes?.find(c => c.field === 'date');
        const timeChange = record.changes?.find(c => c.field === 'time');
        const supplierChange = record.changes?.find(c => c.field === 'supplier');
        const operationChange = record.changes?.find(c => c.field === 'operation');
        
        // Construir detalleAnterior
        const detalleAnteriorObj = {
          transactionId: record.entityId || transaction?._id || record.metadata?.transactionId || null
        };
        
        if (isCreated) {
          // Si es una creación, detalleAnterior está vacío (no había nada antes)
          // No agregamos nada
        } else if (isDeleted) {
          // Si es una eliminación, mostrar el estado anterior y las stats antes de eliminar
          if (status) detalleAnteriorObj.estado = status;
          if (operation) detalleAnteriorObj.tipo = operation;
          if (amount !== null) detalleAnteriorObj.monto = amount;
          if (transactionName) detalleAnteriorObj.nombre = transactionName;
          if (date) detalleAnteriorObj.fecha = date;
          if (time) detalleAnteriorObj.hora = time;
          if (supplier) detalleAnteriorObj.proveedor = supplier;
          
          // Agregar snapshot de stats de la tarjeta ANTES de eliminar
          if (record.metadata?.cardStatsSnapshotBefore) {
            detalleAnteriorObj.cardStats = record.metadata.cardStatsSnapshotBefore;
          }
        } else if (hasChanges) {
          // Si hay cambios, solo agregar los campos que cambiaron
          if (amountChange) detalleAnteriorObj.monto = amountChange.oldValue;
          if (nameChange) detalleAnteriorObj.nombre = nameChange.oldValue;
          if (statusChange) detalleAnteriorObj.estado = statusChange.oldValue;
          if (dateChange) detalleAnteriorObj.fecha = dateChange.oldValue;
          if (timeChange) detalleAnteriorObj.hora = timeChange.oldValue;
          if (supplierChange) detalleAnteriorObj.proveedor = supplierChange.oldValue;
          if (operationChange) detalleAnteriorObj.tipo = operationChange.oldValue;
          
          // Si hay cambios que afectan stats, agregar snapshot de stats de la tarjeta ANTES del cambio
          if ((amountChange || operationChange) && record.metadata?.cardStatsSnapshotBefore) {
            detalleAnteriorObj.cardStats = record.metadata.cardStatsSnapshotBefore;
          }
        }
        
        // Construir detalleActual
        const detalleActualObj = {
          transactionId: record.entityId || transaction?._id || record.metadata?.transactionId || null
        };
        
        if (isCreated || !hasChanges) {
          // Si es una creación o no hay cambios, mostrar todos los detalles de la transacción
          if (operation) detalleActualObj.tipo = operation;
          if (amount !== null) detalleActualObj.monto = amount;
          if (transactionName) detalleActualObj.nombre = transactionName;
          if (status) detalleActualObj.estado = status;
          if (date) detalleActualObj.fecha = date;
          if (time) detalleActualObj.hora = time;
          if (supplier) detalleActualObj.proveedor = supplier;
          
          // Si es una creación, agregar snapshot de stats de la tarjeta DESPUÉS de crear
          if (isCreated && record.metadata?.cardStatsSnapshotAfter) {
            detalleActualObj.cardStats = record.metadata.cardStatsSnapshotAfter;
          }
        } else if (isDeleted) {
          // Si es una eliminación, mostrar el estado DELETED y las stats después de eliminar
          detalleActualObj.estado = 'DELETED';
          if (operation) detalleActualObj.tipo = operation;
          if (amount !== null) detalleActualObj.monto = amount;
          if (transactionName) detalleActualObj.nombre = transactionName;
          if (date) detalleActualObj.fecha = date;
          if (time) detalleActualObj.hora = time;
          if (supplier) detalleActualObj.proveedor = supplier;
          
          // Agregar snapshot de stats de la tarjeta DESPUÉS de eliminar
          if (record.metadata?.cardStatsSnapshotAfter) {
            detalleActualObj.cardStats = record.metadata.cardStatsSnapshotAfter;
          }
        } else {
          // Si hay cambios, solo agregar los campos que cambiaron
          if (amountChange) detalleActualObj.monto = amountChange.newValue;
          if (nameChange) detalleActualObj.nombre = nameChange.newValue;
          if (statusChange) detalleActualObj.estado = statusChange.newValue;
          if (dateChange) detalleActualObj.fecha = dateChange.newValue;
          if (timeChange) detalleActualObj.hora = timeChange.newValue;
          if (supplierChange) detalleActualObj.proveedor = supplierChange.newValue;
          if (operationChange) detalleActualObj.tipo = operationChange.newValue;
          
          // Si hay cambios que afectan stats, agregar snapshot de stats de la tarjeta DESPUÉS del cambio
          if ((amountChange || operationChange) && record.metadata?.cardStatsSnapshotAfter) {
            detalleActualObj.cardStats = record.metadata.cardStatsSnapshotAfter;
          }
        }
        
        // Agregar detalles estructurados
        response.detalleAnterior = detalleAnteriorObj;
        response.detalleActual = detalleActualObj;
      }
      
      return response;
    }));
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ Recent history fetched and transformed in ${responseTime}ms`);
    
    res.json({
      success: true,
      count: transformedHistory.length,
      history: transformedHistory,
      responseTime: responseTime
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching recent history (${responseTime}ms):`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      responseTime: responseTime 
    });
  }
});

module.exports = router;
