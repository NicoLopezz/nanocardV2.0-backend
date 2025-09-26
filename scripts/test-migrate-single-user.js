require('dotenv').config();
const mongoose = require('mongoose');

// Configurar conexiones
const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';
const NEW_DB_URI = process.env.MONGODB_URI;

const testMigrateSingleUser = async () => {
  const startTime = Date.now();
  
  try {
    console.log('🧪 TESTING migration of single user: Javier Santos');
    console.log('🔗 Connecting to old database: tarjetasCrypto-Mercury');
    
    // Conectar a la DB antigua
    const oldConnection = await mongoose.createConnection(OLD_DB_URI);
    console.log('✅ Connected to old database');
    
    // Conectar a la DB nueva
    const newConnection = await mongoose.connect(NEW_DB_URI);
    console.log('✅ Connected to new database');
    
    // Conectar a las nuevas bases de datos
    const newUsersDb = newConnection.connection.useDb('dev_users');
    const newCardsDb = newConnection.connection.useDb('dev_cards');
    const newTransactionsDb = newConnection.connection.useDb('dev_transactions');
    const newHistoryDb = newConnection.connection.useDb('dev_history');
    
    const targetCardId = 'OXREcmFNUe1C30ZifTgZRknJ6lfPNv4U';
    const targetUserName = 'Javier Santos';
    
    console.log(`\n🔍 Searching for user: ${targetUserName} (Card ID: ${targetCardId})...`);
    
    // Buscar el usuario en la DB antigua
    const oldUsersCollection = oldConnection.useDb("tarjetasCrypto-Mercury").collection('clonar_db_antigua');
    const oldUser = await oldUsersCollection.findOne({ Card_id: targetCardId });
    
    if (!oldUser) {
      console.log(`❌ User not found in old database with Card_id: ${targetCardId}`);
      return;
    }
    
    console.log(`✅ Found user: ${oldUser.nombre} (${oldUser.Card_id})`);
    console.log(`   - Created: ${oldUser.createAt}`);
    console.log(`   - Email: ${oldUser.email}`);
    console.log(`   - Last4: ${oldUser.last4_}`);
    console.log(`   - Status: ${oldUser.statusCard}`);
    console.log(`   - Total depositado: ${oldUser.total_depositado}`);
    console.log(`   - Total movimientos: ${oldUser.total_movimientos}`);
    console.log(`   - Available credit: ${oldUser.available_credit}`);
    
    // Verificar si ya existe en la nueva DB
    const existingUser = await newUsersDb.collection('users').findOne({ _id: oldUser._id });
    const existingCard = await newCardsDb.collection('cards').findOne({ _id: oldUser.Card_id });
    
    console.log(`\n📊 ANALYZING EXISTING DATA...`);
    console.log(`   - User exists in new DB: ${existingUser ? 'YES' : 'NO'}`);
    console.log(`   - Card exists in new DB: ${existingCard ? 'YES' : 'NO'}`);
    
    // Contar transacciones existentes
    const existingTransactions = await newTransactionsDb.collection('transactions').find({ 
      userId: oldUser._id 
    }).toArray();
    console.log(`   - Existing transactions in new DB: ${existingTransactions.length}`);
    
    // Contar transacciones en DB antigua
    const allMovements = [
      ...(oldUser.movimientos || []),
      ...(oldUser.recargas || []),
      ...(oldUser.retiros || []),
      ...(oldUser.reintegros || [])
    ];
    console.log(`   - Total movements in old DB: ${allMovements.length}`);
    
    // Identificar transacciones faltantes - MEJORADO
    const existingTransactionIds = new Set(existingTransactions.map(t => t._id));
    const missingTransactions = allMovements.filter(movement => {
      const transactionId = movement.id || movement._id;
      return transactionId && !existingTransactionIds.has(transactionId);
    });
    
    // También verificar por cardId para transacciones que puedan tener diferentes userIds
    const existingTransactionsByCard = await newTransactionsDb.collection('transactions').find({ 
      cardId: oldUser.Card_id 
    }).toArray();
    const existingTransactionIdsByCard = new Set(existingTransactionsByCard.map(t => t._id));
    
    const missingTransactionsByCard = allMovements.filter(movement => {
      const transactionId = movement.id || movement._id;
      return transactionId && !existingTransactionIdsByCard.has(transactionId);
    });
    
    console.log(`   - Missing transactions (by userId): ${missingTransactions.length}`);
    console.log(`   - Missing transactions (by cardId): ${missingTransactionsByCard.length}`);
    
    // Usar la lista más completa
    const finalMissingTransactions = missingTransactionsByCard.length > missingTransactions.length 
      ? missingTransactionsByCard 
      : missingTransactions;
    
    console.log(`   - Final missing transactions: ${finalMissingTransactions.length}`);
    
    if (finalMissingTransactions.length === 0) {
      console.log(`\n✅ No missing transactions found for ${oldUser.nombre}`);
      console.log(`   All transactions are already migrated!`);
      return;
    }
    
    console.log(`\n🔄 MIGRATION STARTING...`);
    console.log('='.repeat(50));
    
    let totalNewTransactions = 0;
    let totalNewUsers = 0;
    let totalNewCards = 0;
    let totalNewHistory = 0;
    
    try {
      // 1. CREAR/ACTUALIZAR USUARIO si no existe
      if (!existingUser) {
        console.log('   👤 Creating new user...');
        const newUser = {
          _id: oldUser._id,
          username: oldUser.nombre.toLowerCase().replace(/\s+/g, '_'),
          email: `${oldUser._id}@nanocard.xyz`,
          role: oldUser.role || 'standard',
          profile: {
            firstName: oldUser.nombre.split(' ')[0] || 'User',
            lastName: oldUser.nombre.split(' ').slice(1).join(' ') || 'Card'
          },
          stats: {
            totalTransactions: oldUser.total_movimientos || 0,
            totalDeposited: oldUser.total_depositado || 0,
            totalPosted: (oldUser.total_movimientos || 0) - (oldUser.available_credit || 0),
            totalPending: oldUser.total_pending || 0,
            totalAvailable: oldUser.available_credit || 0,
            lastLogin: oldUser.loggins && oldUser.loggins.length > 0 
              ? new Date(oldUser.loggins[oldUser.loggins.length - 1].fecha)
              : new Date(),
            loginCount: oldUser.loggins ? oldUser.loggins.length : 0
          },
          createdAt: oldUser.createAt || new Date(),
          updatedAt: new Date()
        };
        
        await newUsersDb.collection('users').insertOne(newUser);
        totalNewUsers++;
        console.log(`   ✅ User created: ${newUser.username}`);
      } else {
        console.log(`   ✅ User already exists: ${existingUser.username}`);
      }
      
      // 2. CREAR/ACTUALIZAR TARJETA si no existe
      if (!existingCard) {
        console.log('   💳 Creating new card...');
        const newCard = {
          _id: oldUser.Card_id,
          userId: oldUser._id,
          name: oldUser.nombre,
          last4: oldUser.last4_,
          status: oldUser.statusCard || 'ACTIVE',
          type: oldUser.tipeCard || 'virtual',
          supplier: oldUser.supplier || 'CryptoMate',
          expiration: oldUser.vencimiento || null,
          phoneNumber: oldUser.phone_number || null,
          deposited: oldUser.total_depositado || 0,
          posted: (oldUser.total_movimientos || 0) - (oldUser.available_credit || 0),
          pending: oldUser.total_pending || 0,
          available: oldUser.available_credit || 0,
          refunded: 0,
          limits: {
            daily: oldUser.daily_limit || 0,
            weekly: oldUser.weekly_limit || 0,
            monthly: oldUser.monthly_limit || 0,
            perTransaction: 0
          },
          meta: {
            email: oldUser.email,
            otp_phone_number: {
              dial_code: 1,
              phone_number: oldUser.phone_number?.toString() || null
            }
          },
          createdAt: oldUser.createAt || new Date(),
          updatedAt: new Date()
        };
        
        await newCardsDb.collection('cards').insertOne(newCard);
        totalNewCards++;
        console.log(`   ✅ Card created: ${newCard.name} (${newCard.last4})`);
      } else {
        console.log(`   ✅ Card already exists: ${existingCard.name}`);
      }
      
      // 3. PROCESAR TRANSACCIONES FALTANTES
      console.log(`   💰 Processing ${finalMissingTransactions.length} missing transactions...`);
      
      const deletedMovements = oldUser.movsDeleted || [];
      const transactionsToInsert = [];
      
      for (const movement of finalMissingTransactions) {
        const isDeleted = deletedMovements.includes(movement.id || movement._id);
        
        const transaction = {
          _id: movement.id || movement._id,
          userId: oldUser._id,
          cardId: oldUser.Card_id,
          userName: oldUser.nombre,
          cardName: oldUser.nombre,
          name: movement.name || 'Transaction',
          amount: movement.MontoTransacction || movement.monto || 0,
          date: new Date(movement.Date || movement.fecha).toLocaleDateString('es-AR'),
          time: new Date(movement.Date || movement.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
          status: movement.status || 'Completed',
          operation: movement.status === 'TRANSACTION_APPROVED' ? 'TRANSACTION_APPROVED' :
                    movement.status === 'TRANSACTION_REFUND' ? 'TRANSACTION_REFUND' :
                    movement.credit ? 'WALLET_DEPOSIT' : 'TRANSACTION_APPROVED',
          city: movement.city || '',
          country: movement.country || '',
          mcc_category: movement.mcc_category || '',
          mercuryCategory: movement.mercuryCategory || '',
          credit: movement.credit !== undefined ? movement.credit : 
                 (movement.status === 'TRANSACTION_REFUND' || movement.name === 'Deposited'),
          comentario: movement.comentario || '',
          version: 1,
          isDeleted: isDeleted,
          deletedAt: isDeleted ? new Date() : null,
          deletedBy: isDeleted ? 'migration' : null,
          history: [{
            version: 1,
            action: 'migrated',
            timestamp: new Date(),
            modifiedBy: oldUser._id,
            reason: 'Migrated from old database structure'
          }],
          createdAt: new Date(movement.Date || movement.fecha),
          updatedAt: new Date()
        };
        
        transactionsToInsert.push(transaction);
        totalNewTransactions++;
      }
      
      // Inserción masiva de transacciones con manejo de duplicados
      if (transactionsToInsert.length > 0) {
        try {
          const result = await newTransactionsDb.collection('transactions').insertMany(transactionsToInsert, { ordered: false });
          console.log(`   ✅ ${result.insertedCount} new transactions imported`);
        } catch (insertError) {
          if (insertError.code === 11000) {
            // Manejar duplicados - insertar uno por uno
            console.log(`   ⚠️ Some transactions already exist, inserting individually...`);
            let insertedCount = 0;
            let skippedCount = 0;
            
            for (const transaction of transactionsToInsert) {
              try {
                await newTransactionsDb.collection('transactions').insertOne(transaction);
                insertedCount++;
              } catch (duplicateError) {
                if (duplicateError.code === 11000) {
                  skippedCount++;
                } else {
                  throw duplicateError;
                }
              }
            }
            
            console.log(`   ✅ ${insertedCount} new transactions imported, ${skippedCount} duplicates skipped`);
          } else {
            throw insertError;
          }
        }
      }
      
      // 4. PROCESAR HISTORIAL FALTANTE
      if (oldUser.loggins && oldUser.loggins.length > 0) {
        const existingHistory = await newHistoryDb.collection('histories').find({ userId: oldUser._id }).toArray();
        const existingHistoryIds = new Set(existingHistory.map(h => h._id));
        
        const missingHistory = oldUser.loggins.filter(login => !existingHistoryIds.has(login._id));
        
        if (missingHistory.length > 0) {
          console.log(`   📚 Processing ${missingHistory.length} missing history records...`);
          
          const historyToInsert = missingHistory.map(login => ({
            _id: login._id,
            userId: oldUser._id,
            cardId: oldUser.Card_id,
            action: 'login',
            description: `User login from ${login.ip}`,
            details: {
              ip: login.ip,
              device: login.dispositivo,
              userAgent: login.dispositivo
            },
            timestamp: new Date(login.fecha),
            createdAt: new Date(login.fecha),
            updatedAt: new Date()
          }));
          
          await newHistoryDb.collection('histories').insertMany(historyToInsert, { ordered: false });
          totalNewHistory = missingHistory.length;
          console.log(`   ✅ ${totalNewHistory} new history records imported`);
        } else {
          console.log(`   ✅ No missing history records`);
        }
      }
      
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log('\n' + '='.repeat(50));
      console.log('🎉 TEST MIGRATION COMPLETED SUCCESSFULLY!');
      console.log('='.repeat(50));
      console.log(`📊 SUMMARY:`);
      console.log(`   🏁 Total time: ${totalTime} seconds`);
      console.log(`   👤 New users created: ${totalNewUsers}`);
      console.log(`   💳 New cards created: ${totalNewCards}`);
      console.log(`   💰 New transactions imported: ${totalNewTransactions}`);
      console.log(`   📚 New history records: ${totalNewHistory}`);
      
    } catch (userError) {
      console.error(`   ❌ Error processing user ${oldUser.nombre}:`, userError.message);
      console.error(`   Stack trace:`, userError.stack);
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from databases');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  testMigrateSingleUser();
}

module.exports = { testMigrateSingleUser };
