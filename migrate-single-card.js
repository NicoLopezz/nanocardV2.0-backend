require('dotenv').config();
const mongoose = require('mongoose');

const BKP_OLD_DB_URI = 'mongodb+srv://nico7913:7913@clusterinitial.eagt2m6.mongodb.net/bkp_old_db';
const NEW_DB_URI = process.env.MONGODB_URI;

const CARD_ID = 'zLgEFTKJxlHUJwmuqS7nZIDRdJyTjuES';

// Helper function to normalize supplier (handles Mercury, Mercury_M, MERcury, etc.)
function normalizeSupplier(supplier) {
  if (!supplier) return 'cryptomate';
  const supplierLower = supplier.toString().toLowerCase();
  // Si contiene "mercury" en cualquier variante (Mercury, Mercury_M, etc.)
  if (supplierLower.includes('mercury')) {
    return 'mercury';
  }
  return 'cryptomate';
}

// Helper function to normalize card status (handles frozen, FROZEN, Frozen, etc.)
function normalizeStatus(status) {
  if (!status) return 'ACTIVE';
  
  const statusStr = status.toString().trim();
  if (!statusStr) return 'ACTIVE';
  
  const statusLower = statusStr.toLowerCase();
  
  // Mapear variantes comunes
  if (statusLower === 'frozen' || statusLower === 'freeze') {
    return 'FROZEN';
  }
  if (statusLower === 'active' || statusLower === 'activo') {
    return 'ACTIVE';
  }
  if (statusLower === 'blocked' || statusLower === 'block') {
    return 'BLOCKED';
  }
  if (statusLower === 'closed' || statusLower === 'close') {
    return 'CLOSED';
  }
  if (statusLower === 'suspended' || statusLower === 'suspend') {
    return 'FROZEN'; // Suspended se mapea a FROZEN
  }
  
  // Si ya está en el formato correcto (ACTIVE, FROZEN, etc.), devolverlo tal cual
  if (['ACTIVE', 'FROZEN', 'BLOCKED', 'CLOSED'].includes(statusStr.toUpperCase())) {
    return statusStr.toUpperCase();
  }
  
  // Por defecto, ACTIVE
  return 'ACTIVE';
}

function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTime(date) {
  const d = new Date(date);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

function mapOldToNewTransaction(oldTx, cardId, userId, userName, cardName, supplier = 'cryptomate') {
  const status = oldTx.status;
  const name = oldTx.name;
  const isCredit = oldTx.credit === true;
  
  let operation = null;
  let txStatus = 'SUCCESS';
  
  // Mapear operaciones basado en status y name
  // IMPORTANTE: Verificar en orden de especificidad, de más específico a más general
  
  // 1. Reversed (debe ir antes de APPROVED para evitar confusiones)
  if (status === 'TRANSACTION_REVERSED' || status === 'Reversed' || status === 'reversed') {
    operation = 'TRANSACTION_REVERSED';
    txStatus = 'SUCCESS';
  }
  // 2. Pending
  else if (status === 'TRANSACTION_PENDING' || status === 'Pending' || status === 'PENDING' || status === 'pending') {
    operation = 'TRANSACTION_PENDING';
    txStatus = 'PENDING';
  }
  // 3. Rejected (incluye 'failed' que es el status de Mercury)
  else if (status === 'TRANSACTION_REJECTED' || status === 'Rejected' || status === 'rejected' || status === 'failed' || status === 'FAILED') {
    operation = 'TRANSACTION_REJECTED';
    txStatus = 'FAILED';
  }
  // 4. Refund
  else if (status === 'TRANSACTION_REFUND' || status === 'Refund' || status === 'refund') {
    operation = 'TRANSACTION_REFUND';
    txStatus = 'SUCCESS';
  }
  // 5. Deposits (Completed + Deposited o WALLET_DEPOSIT)
  else if ((status === 'Completed' && name === 'Deposited') || status === 'WALLET_DEPOSIT') {
    operation = 'WALLET_DEPOSIT';
    txStatus = 'SUCCESS';
  }
  // 6. Withdrawals (Completed + WITHDRAWAL)
  else if (status === 'Completed' && name === 'WITHDRAWAL') {
    operation = 'WITHDRAWAL';
    txStatus = 'SUCCESS';
  }
  // 7. Approved/SUCCESS (solo si realmente es una transacción aprobada)
  // Para Mercury: status 'sent' es equivalente a APPROVED
  // Para CryptoMate: status 'TRANSACTION_APPROVED', 'Approved', 'SUCCESS', 'Success'
  else if (status === 'TRANSACTION_APPROVED' || status === 'Approved' || status === 'SUCCESS' || status === 'Success' || status === 'sent') {
    operation = 'TRANSACTION_APPROVED';
    txStatus = 'SUCCESS';
  }
  // 8. Completed sin name específico - solo si NO es reversed ni deposit ni withdrawal
  // Esto podría ser una transacción aprobada de Mercury
  else if (status === 'Completed' && name && name !== 'Deposited' && name !== 'WITHDRAWAL') {
    // Verificar si es una transacción de débito (no credit) = aprobada
    if (isCredit === false) {
      operation = 'TRANSACTION_APPROVED';
      txStatus = 'SUCCESS';
    } else {
      // Si es credit, podría ser un refund o algo más
      operation = 'TRANSACTION_REFUND';
      txStatus = 'SUCCESS';
    }
  }
  
  // Si no se asignó ninguna operación, usar APPROVED por defecto solo si es una transacción de débito
  if (!operation) {
    if (isCredit === false) {
      operation = 'TRANSACTION_APPROVED';
      txStatus = 'SUCCESS';
    } else {
      // Si no podemos determinar, usar PENDING como fallback más seguro
      operation = 'TRANSACTION_PENDING';
      txStatus = 'PENDING';
    }
  }
  
  const txDate = oldTx.Date ? new Date(oldTx.Date) : (oldTx.fecha ? new Date(oldTx.fecha) : new Date());
  const formattedDate = formatDate(txDate);
  const formattedTime = formatTime(txDate);
  
  const newTx = {
    _id: oldTx.id,
    userId: userId,
    cardId: cardId,
    supplier: normalizeSupplier(supplier),
    name: name || 'Transaction',
    amount: Math.abs(oldTx.MontoTransacction || oldTx.monto || 0),
    date: formattedDate,
    time: formattedTime,
    status: txStatus,
    userName: userName,
    cardName: cardName,
    operation: operation,
    city: oldTx.city || '',
    country: oldTx.country || '',
    mcc_category: oldTx.mcc_category || '',
    mercuryCategory: oldTx.mercuryCategory || '',
    credit: isCredit !== undefined ? isCredit : true,
    comentario: oldTx.comentario || '',
    version: 1,
    isDeleted: false,
    reconciled: false,
    history: [{
      version: 1,
      action: 'created',
      timestamp: new Date(),
      modifiedBy: 'migration_script',
      reason: 'Migrated from old database'
    }]
  };
  
  if (operation === 'WALLET_DEPOSIT') {
    newTx.originalMovementId = oldTx.id;
    newTx.gross_amount = newTx.amount;
    newTx.commission_rate = 0;
    newTx.commission_amount = 0;
    newTx.net_amount = newTx.amount;
  }
  
  return newTx;
}

// Función helper para mapear recargas (depósitos de Mercury)
function mapRecargaToTransaction(recarga, cardId, userId, userName, cardName, supplier = 'mercury') {
  const txDate = recarga.fecha ? new Date(recarga.fecha) : new Date();
  const formattedDate = formatDate(txDate);
  const formattedTime = formatTime(txDate);
  
  return {
    _id: recarga.id,
    userId: userId,
    cardId: cardId,
    supplier: normalizeSupplier(supplier),
    name: 'Deposited',
    amount: Math.abs(recarga.monto || 0),
    date: formattedDate,
    time: formattedTime,
    status: 'SUCCESS',
    userName: userName,
    cardName: cardName,
    operation: 'WALLET_DEPOSIT',
    city: '',
    country: '',
    mcc_category: '',
    mercuryCategory: '',
    credit: true,
    comentario: '',
    version: 1,
    isDeleted: false,
    reconciled: false,
    originalMovementId: recarga.id,
    gross_amount: Math.abs(recarga.monto || 0),
    commission_rate: 0,
    commission_amount: 0,
    net_amount: Math.abs(recarga.monto || 0),
    history: [{
      version: 1,
      action: 'created',
      timestamp: new Date(),
      modifiedBy: 'migration_script',
      reason: 'Migrated from old database (recarga)'
    }]
  };
}

// Función helper para mapear retiros (withdrawals de Mercury)
function mapRetiroToTransaction(retiro, cardId, userId, userName, cardName, supplier = 'mercury') {
  const txDate = retiro.fecha ? new Date(retiro.fecha) : (retiro.Date ? new Date(retiro.Date) : new Date());
  const formattedDate = formatDate(txDate);
  const formattedTime = formatTime(txDate);
  
  return {
    _id: retiro.id,
    userId: userId,
    cardId: cardId,
    supplier: normalizeSupplier(supplier),
    name: 'WITHDRAWAL',
    amount: Math.abs(retiro.monto || retiro.MontoTransacction || 0),
    date: formattedDate,
    time: formattedTime,
    status: retiro.status === 'Pending' || retiro.status === 'PENDING' ? 'PENDING' : 'SUCCESS',
    userName: userName,
    cardName: cardName,
    operation: retiro.status === 'Pending' || retiro.status === 'PENDING' ? 'TRANSACTION_PENDING' : 'WITHDRAWAL',
    city: retiro.city || '',
    country: retiro.country || '',
    mcc_category: retiro.mcc_category || '',
    mercuryCategory: retiro.mercuryCategory || '',
    credit: false,
    comentario: retiro.comentario || '',
    version: 1,
    isDeleted: false,
    reconciled: false,
    history: [{
      version: 1,
      action: 'created',
      timestamp: new Date(),
      modifiedBy: 'migration_script',
      reason: 'Migrated from old database (retiro)'
    }]
  };
}

// Función helper para mapear reintegros (refunds de Mercury)
function mapReintegroToTransaction(reintegro, cardId, userId, userName, cardName, supplier = 'mercury') {
  const txDate = reintegro.fecha ? new Date(reintegro.fecha) : (reintegro.Date ? new Date(reintegro.Date) : new Date());
  const formattedDate = formatDate(txDate);
  const formattedTime = formatTime(txDate);
  
  return {
    _id: reintegro.id,
    userId: userId,
    cardId: cardId,
    supplier: normalizeSupplier(supplier),
    name: reintegro.name || 'Refund',
    amount: Math.abs(reintegro.monto || reintegro.MontoTransacction || 0),
    date: formattedDate,
    time: formattedTime,
    status: reintegro.status === 'Pending' || reintegro.status === 'PENDING' ? 'PENDING' : 'SUCCESS',
    userName: userName,
    cardName: cardName,
    operation: reintegro.status === 'Pending' || reintegro.status === 'PENDING' ? 'TRANSACTION_PENDING' : 'TRANSACTION_REFUND',
    city: reintegro.city || '',
    country: reintegro.country || '',
    mcc_category: reintegro.mcc_category || '',
    mercuryCategory: reintegro.mercuryCategory || '',
    credit: true,
    comentario: reintegro.comentario || '',
    version: 1,
    isDeleted: false,
    reconciled: false,
    history: [{
      version: 1,
      action: 'created',
      timestamp: new Date(),
      modifiedBy: 'migration_script',
      reason: 'Migrated from old database (reintegro)'
    }]
  };
}

async function recalculateCardStats(connections, cardId, verbose = true) {
  try {
    const card = await connections.cardsDb.collection('cards').findOne({ _id: cardId });
    if (!card) {
      console.log(`  ⚠️ Card not found: ${cardId}`);
      return;
    }
    
    const pipeline = [
      {
        $match: {
          cardId: cardId,
          isDeleted: { $ne: true },
          status: { $ne: 'DELETED' }
        }
      },
      {
        $group: {
          _id: '$operation',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ];
    
    const stats = await connections.transactionsDb.collection('transactions').aggregate(pipeline).toArray();
    
    let totalDeposited = 0;
    let totalRefunded = 0;
    let totalPosted = 0;
    let totalPending = 0;
    let totalWithdrawal = 0;
    let totalReversed = 0;
    let totalRejected = 0;
    let totalCount = 0;
    
    const operationCounts = {};
    
    for (const stat of stats) {
      const operation = stat._id || 'UNKNOWN';
      const amount = stat.totalAmount || 0;
      const count = stat.count || 0;
      
      operationCounts[operation] = count;
      totalCount += count;
      
      switch (operation) {
        case 'WALLET_DEPOSIT':
        case 'OVERRIDE_VIRTUAL_BALANCE':
          totalDeposited += amount;
          break;
        case 'TRANSACTION_REFUND':
          totalRefunded += amount;
          break;
        case 'TRANSACTION_APPROVED':
          totalPosted += amount;
          break;
        case 'TRANSACTION_PENDING':
          totalPending += amount;
          break;
        case 'WITHDRAWAL':
          totalWithdrawal += amount;
          break;
        case 'TRANSACTION_REVERSED':
          totalReversed += amount;
          break;
        case 'TRANSACTION_REJECTED':
          totalRejected += amount;
          break;
      }
    }
    
    const moneyIn = totalDeposited - totalWithdrawal;
    const totalAvailable = moneyIn + totalRefunded - totalPosted - totalPending + totalReversed;
    
    await connections.cardsDb.collection('cards').updateOne(
      { _id: cardId },
      {
        $set: {
          deposited: totalDeposited,
          refunded: totalRefunded,
          posted: totalPosted,
          pending: totalPending,
          available: totalAvailable,
          stats: {
            money_in: moneyIn,
            refund: totalRefunded,
            posted: totalPosted,
            reversed: totalReversed,
            rejected: totalRejected,
            pending: totalPending,
            withdrawal: totalWithdrawal,
            available: totalAvailable,
            total_all_transactions: totalCount,
            total_deleted_transactions: 0,
            deleted_amount: 0
          },
          transactionStats: {
            totalTransactions: totalCount,
            byOperation: operationCounts,
            lastUpdated: new Date()
          },
          updatedAt: new Date()
        }
      }
    );
    
    const user = await connections.usersDb.collection('users').findOne({ _id: card.userId });
    if (user) {
      const userPipeline = [
        {
          $match: {
            userId: card.userId,
            isDeleted: { $ne: true },
            status: { $ne: 'DELETED' }
          }
        },
        {
          $group: {
            _id: '$operation',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ];
      
      const userStats = await connections.transactionsDb.collection('transactions').aggregate(userPipeline).toArray();
      
      let userTotalDeposited = 0;
      let userTotalRefunded = 0;
      let userTotalPosted = 0;
      let userTotalPending = 0;
      let userTotalWithdrawal = 0;
      let userTotalReversed = 0;
      let userTotalCount = 0;
      
      for (const stat of userStats) {
        const operation = stat._id || 'UNKNOWN';
        const amount = stat.totalAmount || 0;
        userTotalCount += stat.count || 0;
        
        if (operation === 'WALLET_DEPOSIT' || operation === 'OVERRIDE_VIRTUAL_BALANCE') {
          userTotalDeposited += amount;
        } else if (operation === 'TRANSACTION_REFUND') {
          userTotalRefunded += amount;
        } else if (operation === 'TRANSACTION_APPROVED') {
          userTotalPosted += amount;
        } else if (operation === 'TRANSACTION_PENDING') {
          userTotalPending += amount;
        } else if (operation === 'WITHDRAWAL') {
          userTotalWithdrawal += amount;
        } else if (operation === 'TRANSACTION_REVERSED') {
          userTotalReversed += amount;
        }
      }
      
      const userMoneyIn = userTotalDeposited - userTotalWithdrawal;
      const userTotalAvailable = userMoneyIn + userTotalRefunded - userTotalPosted - userTotalPending + userTotalReversed;
      
      await connections.usersDb.collection('users').updateOne(
        { _id: card.userId },
        {
          $set: {
            'stats.totalTransactions': userTotalCount,
            'stats.totalDeposited': userTotalDeposited,
            'stats.totalRefunded': userTotalRefunded,
            'stats.totalPosted': userTotalPosted,
            'stats.totalPending': userTotalPending,
            'stats.totalAvailable': userTotalAvailable,
            updatedAt: new Date()
          }
        }
      );
    }
    
    // Debug: Mostrar breakdown por operación
    if (verbose) {
      console.log(`\n  📊 Stats updated:`);
      console.log(`     Deposited: $${totalDeposited}`);
      console.log(`     Withdrawal: $${totalWithdrawal}`);
      console.log(`     Money In (Deposited - Withdrawal): $${moneyIn}`);
      console.log(`     Refunded: $${totalRefunded}`);
      console.log(`     Posted: $${totalPosted}`);
      console.log(`     Pending: $${totalPending}`);
      console.log(`     Reversed: $${totalReversed}`);
      console.log(`     Rejected: $${totalRejected}`);
      console.log(`     Available: $${totalAvailable}`);
      console.log(`     Calculation: Money In (${moneyIn}) + Refunded (${totalRefunded}) - Posted (${totalPosted}) - Pending (${totalPending}) + Reversed (${totalReversed}) = ${moneyIn + totalRefunded - totalPosted - totalPending + totalReversed}`);
      console.log(`     Total Transactions: ${totalCount}`);
      console.log(`\n  🔍 Breakdown by operation:`);
      for (const [op, count] of Object.entries(operationCounts)) {
        const opStat = stats.find(s => s._id === op);
        const amount = opStat ? opStat.totalAmount : 0;
        console.log(`     ${op}: ${count} transactions, total: $${amount}`);
      }
    }
    
  } catch (error) {
    console.error(`  ❌ Error recalculating stats:`, error.message);
  }
}

async function migrateSingleCard(cardId, providedOldConnection = null, providedConnections = null, verbose = true) {
  let oldConnection = providedOldConnection;
  let newConnection = null;
  let shouldCloseOldConnection = false;
  let shouldCloseNewConnection = false;
  
  try {
    if (verbose) {
      console.log('\n===========================================');
      console.log('🔄 MIGRATING SINGLE CARD');
      console.log('===========================================\n');
      console.log(`🎯 Card ID: ${cardId}\n`);
    }
    
    // Conectar a old DB si no se proporcionó conexión
    if (!oldConnection) {
      shouldCloseOldConnection = true;
      oldConnection = await mongoose.createConnection(BKP_OLD_DB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000
      });
      
      await new Promise((resolve, reject) => {
        if (oldConnection.readyState === 1) {
          resolve();
        } else {
          const timeout = setTimeout(() => reject(new Error('Timeout')), 30000);
          oldConnection.once('open', () => { clearTimeout(timeout); resolve(); });
          oldConnection.once('error', reject);
        }
      });
      
      if (verbose) console.log('✅ Connected to bkp_old_db');
    }
    
    const oldCard = await oldConnection.db.collection('bkp_old_db').findOne({ Card_id: cardId });
    
    if (!oldCard) {
      if (verbose) console.log(`❌ Card not found in old DB`);
      return { success: false, error: 'Card not found in old DB' };
    }
    
    const userName = oldCard.nombre;
    const userId = oldCard._id || cardId;
    const supplier = oldCard.supplier || 'cryptomate';
    const movimientos = oldCard.movimientos || [];
    const recargas = oldCard.recargas || [];
    const retiros = oldCard.retiros || [];
    const reintegros = oldCard.reintegros || [];
    const totalTransactions = movimientos.length + recargas.length + retiros.length + reintegros.length;
    
    if (verbose) {
      console.log(`✅ Found card: ${userName} (supplier: ${supplier})`);
      console.log(`📊 Transactions in old DB:`);
      console.log(`   - Movimientos: ${movimientos.length}`);
      console.log(`   - Recargas: ${recargas.length}`);
      console.log(`   - Retiros: ${retiros.length}`);
      console.log(`   - Reintegros: ${reintegros.length}`);
      console.log(`   - Total: ${totalTransactions}\n`);
    }
    
    // Conectar a new DB si no se proporcionaron conexiones
    let connections = providedConnections;
    if (!connections) {
      shouldCloseNewConnection = true;
      newConnection = await mongoose.connect(NEW_DB_URI);
      if (verbose) console.log('✅ Connected to new DB\n');
      
      connections = {
        cardsDb: newConnection.connection.useDb('dev_cards'),
        transactionsDb: newConnection.connection.useDb('dev_transactions'),
        usersDb: newConnection.connection.useDb('dev_users')
      };
    }
    
    let cardDoc = await connections.cardsDb.collection('cards').findOne({ _id: cardId });
    
    if (!cardDoc) {
      if (verbose) console.log(`⚠️ Card not found in new DB, creating user and card...\n`);
      
      const existingUser = await connections.usersDb.collection('users').findOne({ _id: userId });
      
      if (!existingUser) {
        if (verbose) console.log(`   👤 Creating user: ${userName}`);
        const newUser = {
          _id: userId,
          username: userName.toLowerCase().replace(/\s+/g, '_'),
          email: `${userId}@nanocard.xyz`,
          role: oldCard.role || 'standard',
          profile: {
            firstName: userName.split(' ')[0] || 'User',
            lastName: userName.split(' ').slice(1).join(' ') || 'Card'
          },
          stats: {
            totalTransactions: 0,
            totalDeposited: 0,
            totalRefunded: 0,
            totalPosted: 0,
            totalPending: 0,
            totalAvailable: 0,
            lastLogin: oldCard.loggins && oldCard.loggins.length > 0 
              ? new Date(oldCard.loggins[oldCard.loggins.length - 1].fecha)
              : new Date(),
            loginCount: oldCard.loggins ? oldCard.loggins.length : 0
          },
          createdAt: oldCard.createAt || new Date(),
          updatedAt: new Date()
        };
        
        await connections.usersDb.collection('users').insertOne(newUser);
        if (verbose) console.log(`   ✅ User created: ${newUser.username}\n`);
      } else {
        if (verbose) console.log(`   ✅ User already exists: ${existingUser.username}\n`);
      }
      
      if (verbose) console.log(`   💳 Creating card: ${userName}`);
      const newCard = {
        _id: cardId,
        userId: userId,
        name: userName,
        last4: oldCard.last4_ || '0000',
        status: normalizeStatus(oldCard.statusCard),
        type: oldCard.tipeCard || 'Virtual',
        supplier: normalizeSupplier(oldCard.supplier),
        expiration: oldCard.vencimiento || null,
        phoneNumber: oldCard.phone_number || null,
        deposited: 0,
        posted: 0,
        pending: 0,
        available: 0,
        refunded: 0,
        stats: {
          money_in: 0,
          refund: 0,
          posted: 0,
          reversed: 0,
          rejected: 0,
          pending: 0,
          withdrawal: 0,
          available: 0,
          total_all_transactions: 0,
          total_deleted_transactions: 0,
          deleted_amount: 0
        },
        limits: {
          daily: oldCard.daily_limit || 0,
          weekly: oldCard.weekly_limit || 0,
          monthly: oldCard.monthly_limit || 0,
          perTransaction: 0
        },
        meta: {
          email: oldCard.email || null,
          otp_phone_number: {
            dial_code: 1,
            phone_number: oldCard.phone_number?.toString() || null
          }
        },
        createdAt: oldCard.createAt || new Date(),
        updatedAt: new Date()
      };
      
      await connections.cardsDb.collection('cards').insertOne(newCard);
      cardDoc = newCard;
      if (verbose) console.log(`   ✅ Card created: ${newCard.name} (${newCard.last4})\n`);
    } else {
      // Verificar y actualizar usuario si es necesario
      const existingUser = await connections.usersDb.collection('users').findOne({ _id: userId });
      if (existingUser) {
        const userNameParts = userName.split(' ');
        const firstName = userNameParts[0] || 'User';
        const lastName = userNameParts.slice(1).join(' ') || 'Card';
        const username = userName.toLowerCase().replace(/\s+/g, '_');
        
        if (existingUser.profile?.firstName !== firstName || 
            existingUser.profile?.lastName !== lastName ||
            existingUser.username !== username) {
          await connections.usersDb.collection('users').updateOne(
            { _id: userId },
            {
              $set: {
                username: username,
                'profile.firstName': firstName,
                'profile.lastName': lastName,
                updatedAt: new Date()
              }
            }
          );
          if (verbose) console.log(`   ✅ User info updated: ${username}\n`);
        }
      }
      
      // Actualizar el nombre y otros campos si son diferentes del old DB
      const correctSupplier = normalizeSupplier(oldCard.supplier);
      const correctStatus = normalizeStatus(oldCard.statusCard);
      const needsUpdate = cardDoc.name !== userName || 
                         cardDoc.last4 !== (oldCard.last4_ || '0000') ||
                         cardDoc.status !== correctStatus ||
                         cardDoc.supplier !== correctSupplier;
      
      if (needsUpdate) {
        if (verbose) console.log(`⚠️ Updating card info from old DB...`);
        const updateData = {
          name: userName,
          last4: oldCard.last4_ || cardDoc.last4 || '0000',
          status: normalizeStatus(oldCard.statusCard || cardDoc.status),
          supplier: normalizeSupplier(oldCard.supplier || cardDoc.supplier),
          type: oldCard.tipeCard || cardDoc.type || 'Virtual',
          expiration: oldCard.vencimiento || cardDoc.expiration || null,
          phoneNumber: oldCard.phone_number || cardDoc.phoneNumber || null,
          updatedAt: new Date()
        };
        
        // Actualizar meta si es necesario
        if (oldCard.email || oldCard.phone_number) {
          updateData.meta = {
            email: oldCard.email || cardDoc.meta?.email || null,
            otp_phone_number: {
              dial_code: 1,
              phone_number: oldCard.phone_number?.toString() || cardDoc.meta?.otp_phone_number?.phone_number || null
            }
          };
        }
        
        await connections.cardsDb.collection('cards').updateOne(
          { _id: cardId },
          { $set: updateData }
        );
        
        if (verbose) console.log(`   ✅ Card updated: ${updateData.name} (${updateData.last4})\n`);
        // Actualizar cardDoc para reflejar los cambios
        cardDoc = { ...cardDoc, ...updateData };
      } else {
        if (verbose) console.log(`✅ Card found in new DB: ${cardDoc.name}\n`);
      }
    }
    
    if (verbose) console.log('🗑️ Deleting existing transactions...');
    const deletedCount = await connections.transactionsDb.collection('transactions').deleteMany({ cardId: cardId }).then(r => r.deletedCount);
    if (verbose) console.log(`   Deleted: ${deletedCount} transactions\n`);
    
    if (verbose) console.log('🔄 Mapping transactions...');
    const newTransactions = [];
    const transactionIds = [];
    
    // Mapear movimientos
    for (const oldTx of movimientos) {
      try {
        const newTx = mapOldToNewTransaction(oldTx, cardId, userId, userName, userName, supplier);
        newTransactions.push(newTx);
        transactionIds.push(newTx._id);
      } catch (error) {
        if (verbose) console.error(`   ❌ Error mapping movimiento ${oldTx.id}:`, error.message);
      }
    }
    
    // Mapear recargas (depósitos)
    for (const recarga of recargas) {
      try {
        // Evitar duplicados si ya existe en movimientos
        if (!transactionIds.includes(recarga.id)) {
          const newTx = mapRecargaToTransaction(recarga, cardId, userId, userName, userName, supplier);
          newTransactions.push(newTx);
          transactionIds.push(newTx._id);
        }
      } catch (error) {
        if (verbose) console.error(`   ❌ Error mapping recarga ${recarga.id}:`, error.message);
      }
    }
    
    // Mapear retiros (withdrawals)
    for (const retiro of retiros) {
      try {
        if (!transactionIds.includes(retiro.id)) {
          const newTx = mapRetiroToTransaction(retiro, cardId, userId, userName, userName, supplier);
          newTransactions.push(newTx);
          transactionIds.push(newTx._id);
        }
      } catch (error) {
        if (verbose) console.error(`   ❌ Error mapping retiro ${retiro.id}:`, error.message);
      }
    }
    
    // Mapear reintegros (refunds)
    for (const reintegro of reintegros) {
      try {
        if (!transactionIds.includes(reintegro.id)) {
          const newTx = mapReintegroToTransaction(reintegro, cardId, userId, userName, userName, supplier);
          newTransactions.push(newTx);
          transactionIds.push(newTx._id);
        }
      } catch (error) {
        if (verbose) console.error(`   ❌ Error mapping reintegro ${reintegro.id}:`, error.message);
      }
    }
    
    if (verbose) console.log(`   Mapped: ${newTransactions.length} transactions\n`);
    
    if (verbose) console.log('🔄 Checking for existing transactions...');
    const existingIds = await connections.transactionsDb.collection('transactions')
      .find({ _id: { $in: transactionIds } })
      .project({ _id: 1 })
      .toArray()
      .then(results => new Set(results.map(r => r._id)));
    
    const transactionsToInsert = newTransactions.filter(tx => !existingIds.has(tx._id));
    const skipped = newTransactions.length - transactionsToInsert.length;
    
    if (verbose) console.log(`   New: ${transactionsToInsert.length}, Already exist: ${skipped}\n`);
    
    let inserted = 0;
    let errors = 0;
    
    if (transactionsToInsert.length > 0) {
      if (verbose) console.log('🔄 Inserting transactions in batch...');
      
      const BATCH_SIZE = 500;
      for (let i = 0; i < transactionsToInsert.length; i += BATCH_SIZE) {
        const batch = transactionsToInsert.slice(i, i + BATCH_SIZE);
        
        try {
          const result = await connections.transactionsDb.collection('transactions').insertMany(batch, { ordered: false });
          inserted += Object.keys(result.insertedIds).length;
          
          if (verbose && ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= transactionsToInsert.length)) {
            console.log(`   Progress: ${Math.min(i + BATCH_SIZE, transactionsToInsert.length)}/${transactionsToInsert.length}`);
          }
        } catch (error) {
          if (error.writeErrors) {
            const insertedCount = error.result?.nInserted || 0;
            inserted += insertedCount;
            errors += error.writeErrors.length;
          } else {
            errors += batch.length;
          }
        }
      }
    }
    
    if (verbose) {
      console.log(`\n✅ Migration complete:`);
      console.log(`   Inserted: ${inserted}`);
      console.log(`   Skipped: ${skipped}`);
      console.log(`   Errors: ${errors}\n`);
    }
    
    if (verbose) console.log('🔄 Recalculating card stats...');
    await recalculateCardStats(connections, cardId, verbose);
    
    if (verbose) console.log('\n✅ Migration and recalculation complete!');
    
    return { success: true, cardId, userName };
    
  } catch (error) {
    if (verbose) console.error('❌ Migration error:', error);
    return { success: false, error: error.message, cardId };
  } finally {
    // Solo cerrar conexiones si las creamos nosotros
    if (shouldCloseOldConnection && oldConnection) {
      await oldConnection.close();
    }
    if (shouldCloseNewConnection && newConnection) {
      await newConnection.connection.close();
    }
  }
}

// Exportar función para uso como módulo
module.exports = { migrateSingleCard, recalculateCardStats, normalizeSupplier, normalizeStatus };

// Ejecutar como script standalone
if (require.main === module) {
  const cardId = process.argv[2] || CARD_ID;

  if (!cardId) {
    console.log('Usage: node migrate-single-card.js [cardId]');
    console.log('Or edit CARD_ID constant in the script');
    process.exit(1);
  }

  migrateSingleCard(cardId)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

