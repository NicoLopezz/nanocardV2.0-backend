require('dotenv').config();
const mongoose = require('mongoose');

// Configurar conexiones
const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';
const NEW_DB_URI = process.env.MONGODB_URI;

const migrateAllMissingTransactions = async () => {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting MASS migration of missing transactions from old DB...');
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
    
    console.log('\n📊 ANALYZING DATA...');
    console.log('='.repeat(70));
    
    // 1. Obtener todos los usuarios de la DB antigua
    const oldUsersCollection = oldConnection.db.collection('clonar_db_antigua');
    const allOldUsers = await oldUsersCollection.find({}).toArray();
    console.log(`📦 Found ${allOldUsers.length} users in old database`);
    
    // 2. Obtener todos los usuarios de la DB nueva
    const allNewUsers = await newUsersDb.collection('users').find({}).toArray();
    console.log(`📦 Found ${allNewUsers.length} users in new database`);
    
    // 3. Obtener todas las transacciones existentes en la DB nueva
    const existingTransactions = await newTransactionsDb.collection('transactions').find({}).toArray();
    const existingTransactionIds = new Set(existingTransactions.map(t => t._id));
    console.log(`📦 Found ${existingTransactions.length} existing transactions in new database`);
    
    console.log('\n🔄 MIGRATION STARTING...');
    console.log('='.repeat(70));
    
    let totalProcessed = 0;
    let totalNewTransactions = 0;
    let totalNewUsers = 0;
    let totalNewCards = 0;
    let totalNewHistory = 0;
    
    // Procesar cada usuario de la DB antigua
    for (let i = 0; i < allOldUsers.length; i++) {
      const oldUser = allOldUsers[i];
      const progress = ((i + 1) / allOldUsers.length * 100).toFixed(1);
      
      console.log(`\n🔄 [${i + 1}/${allOldUsers.length}] (${progress}%) Processing: ${oldUser.nombre}...`);
      
      try {
        // Verificar si el usuario ya existe en la nueva DB
        const existingUser = await newUsersDb.collection('users').findOne({ _id: oldUser._id });
        const existingCard = await newCardsDb.collection('cards').findOne({ _id: oldUser.Card_id });
        
        // 1. CREAR/ACTUALIZAR USUARIO si no existe
        if (!existingUser) {
          console.log(`   👤 Creating new user: ${oldUser.nombre}`);
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
        }
        
        // 2. CREAR/ACTUALIZAR TARJETA si no existe
        if (!existingCard) {
          console.log(`   💳 Creating new card: ${oldUser.nombre}`);
          const newCard = {
            _id: oldUser.Card_id,
            userId: oldUser._id,
            name: oldUser.nombre,
            last4: oldUser.last4_,
            status: oldUser.statusCard || 'ACTIVE',
            type: oldUser.tipeCard || 'virtual',
            supplier: oldUser.supplier || 'cryptomate',
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
        }
        
        // 3. PROCESAR TRANSACCIONES FALTANTES
        const allMovements = [
          ...(oldUser.movimientos || []),
          ...(oldUser.recargas || []),
          ...(oldUser.retiros || []),
          ...(oldUser.reintegros || [])
        ];
        
        const deletedMovements = oldUser.movsDeleted || [];
        let userTransactionCount = 0;
        let userNewTransactionCount = 0;
        
        // Filtrar solo transacciones que NO existen en la nueva DB
        const missingTransactions = allMovements.filter(movement => {
          const transactionId = movement.id || movement._id;
          return !existingTransactionIds.has(transactionId);
        });
        
        if (missingTransactions.length > 0) {
          console.log(`   💰 Found ${missingTransactions.length} missing transactions for ${oldUser.nombre}`);
          
          // Preparar transacciones para inserción masiva
          const transactionsToInsert = [];
          
          for (const movement of missingTransactions) {
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
            userTransactionCount++;
            userNewTransactionCount++;
          }
          
          // Inserción masiva de transacciones
          if (transactionsToInsert.length > 0) {
            await newTransactionsDb.collection('transactions').insertMany(transactionsToInsert, { ordered: false });
            console.log(`   ✅ ${userNewTransactionCount} new transactions imported`);
          }
        } else {
          console.log(`   ✅ No missing transactions for ${oldUser.nombre}`);
        }
        
        // 4. PROCESAR HISTORIAL FALTANTE
        if (oldUser.loggins && oldUser.loggins.length > 0) {
          const existingHistory = await newHistoryDb.collection('histories').find({ userId: oldUser._id }).toArray();
          const existingHistoryIds = new Set(existingHistory.map(h => h._id));
          
          const missingHistory = oldUser.loggins.filter(login => !existingHistoryIds.has(login._id));
          
          if (missingHistory.length > 0) {
            console.log(`   📚 Found ${missingHistory.length} missing history records for ${oldUser.nombre}`);
            
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
            totalNewHistory += missingHistory.length;
            console.log(`   ✅ ${missingHistory.length} new history records imported`);
          }
        }
        
        totalProcessed++;
        totalNewTransactions += userNewTransactionCount;
        
        // Mostrar progreso cada 10 usuarios
        if ((i + 1) % 10 === 0 || i === allOldUsers.length - 1) {
          const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
          const eta = ((Date.now() - startTime) / (i + 1) * (allOldUsers.length - i - 1) / 1000 / 60).toFixed(1);
          console.log(`\n📊 Progress: ${i + 1}/${allOldUsers.length} users (${progress}%)`);
          console.log(`💰 New transactions: ${totalNewTransactions}`);
          console.log(`👤 New users: ${totalNewUsers}`);
          console.log(`💳 New cards: ${totalNewCards}`);
          console.log(`📚 New history: ${totalNewHistory}`);
          console.log(`⏱️  Elapsed: ${elapsed}min | ETA: ${eta}min`);
        }
        
      } catch (userError) {
        console.error(`   ❌ Error processing user ${oldUser.nombre}:`, userError.message);
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n' + '='.repeat(70));
    console.log('🎉 MASS MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log(`📊 FINAL SUMMARY:`);
    console.log(`   🏁 Total time: ${totalTime} minutes`);
    console.log(`   👥 Users processed: ${totalProcessed}`);
    console.log(`   👤 New users created: ${totalNewUsers}`);
    console.log(`   💳 New cards created: ${totalNewCards}`);
    console.log(`   💰 New transactions imported: ${totalNewTransactions}`);
    console.log(`   📚 New history records: ${totalNewHistory}`);
    console.log(`   ⚡ Average: ${(totalProcessed / (totalTime * 60)).toFixed(2)} users/second`);
    
  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from databases');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  migrateAllMissingTransactions();
}

module.exports = { migrateAllMissingTransactions };
