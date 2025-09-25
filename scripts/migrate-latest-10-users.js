require('dotenv').config();
const mongoose = require('mongoose');

// Configurar conexiones
const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';
const NEW_DB_URI = process.env.MONGODB_URI;

const migrateLatest10Users = async () => {
  try {
    console.log('🚀 Starting migration of latest 10 users from old DB...');
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
    
    console.log('\n🔍 Searching for latest 10 users in clonar_db_antigua...');
    
    // Obtener los 10 usuarios más recientes de la DB antigua
    const oldUsersCollection = oldConnection.db.collection('clonar_db_antigua');
    const latestUsers = await oldUsersCollection
      .find({})
      .sort({ createAt: -1 }) // Ordenar por fecha de creación descendente (más recientes primero)
      .limit(10)
      .toArray();
    
    if (latestUsers.length === 0) {
      console.log('❌ No users found in old database');
      return;
    }
    
    console.log(`✅ Found ${latestUsers.length} latest users in old database`);
    
    console.log('\n📊 LATEST 10 USERS TO MIGRATE:');
    console.log('='.repeat(50));
    latestUsers.forEach((user, i) => {
      console.log(`${i+1}. ${user.nombre} (${user.Card_id}) - Created: ${user.createAt}`);
    });
    
    console.log('\n📊 MIGRATION STARTING...');
    console.log('='.repeat(50));
    
    let migratedUsers = 0;
    let migratedCards = 0;
    let migratedTransactions = 0;
    let migratedHistory = 0;
    
    for (const oldUser of latestUsers) {
      try {
        console.log(`\n🔄 Migrating user: ${oldUser.nombre} (${oldUser.Card_id})`);
        
        // 1. CREAR USUARIO
        console.log('   👤 Creating user...');
        const newUser = {
          _id: oldUser._id,
          username: oldUser.nombre.toLowerCase().replace(/\s+/g, '_'),
          email: `${oldUser._id}@nanocard.xyz`, // Email único basado en el ID
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
        
        await newUsersDb.collection('users').replaceOne({ _id: newUser._id }, newUser, { upsert: true });
        console.log(`   ✅ User created: ${newUser.username}`);
        migratedUsers++;
        
        // 2. CREAR TARJETA
        console.log('   💳 Creating card...');
        const newCard = {
          _id: oldUser.Card_id,
          userId: oldUser._id,
          name: oldUser.nombre,
          last4: oldUser.last4_,
          status: oldUser.statusCard || 'ACTIVE',
          type: oldUser.tipeCard || 'virtual',
          supplier: oldUser.supplier || 'CryptoMate',
          
          // NUEVOS CAMPOS
          expiration: oldUser.vencimiento || null,
          phoneNumber: oldUser.phone_number || null,
          
          // Campos financieros
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
              dial_code: 1, // default
              phone_number: oldUser.phone_number?.toString() || null
            }
          },
          
          createdAt: oldUser.createAt || new Date(),
          updatedAt: new Date()
        };
        
        await newCardsDb.collection('cards').replaceOne({ _id: newCard._id }, newCard, { upsert: true });
        console.log(`   ✅ Card created: ${newCard.name} (${newCard.last4})`);
        migratedCards++;
        
        // 3. CREAR TRANSACCIONES
        console.log('   💰 Creating transactions...');
        const allMovements = [
          ...(oldUser.movimientos || []),
          ...(oldUser.recargas || []),
          ...(oldUser.retiros || []),
          ...(oldUser.reintegros || [])
        ];
        
        const deletedMovements = oldUser.movsDeleted || [];
        
        for (const movement of allMovements) {
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
          
          await newTransactionsDb.collection('transactions').replaceOne({ _id: transaction._id }, transaction, { upsert: true });
          migratedTransactions++;
        }
        
        console.log(`   ✅ ${allMovements.length} transactions migrated`);
        
        // 4. CREAR HISTORIAL
        console.log('   📚 Creating history...');
        let userHistoryCount = 0;
        
        if (oldUser.loggins && oldUser.loggins.length > 0) {
          for (const login of oldUser.loggins) {
            const historyRecord = {
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
            };
            
            await newHistoryDb.collection('histories').replaceOne({ _id: historyRecord._id }, historyRecord, { upsert: true });
            userHistoryCount++;
          }
        }
        
        console.log(`   ✅ ${userHistoryCount} history records migrated`);
        migratedHistory += userHistoryCount;
        
        console.log(`   🎉 User ${oldUser.nombre} migrated successfully!`);
        
      } catch (userError) {
        console.error(`   ❌ Error migrating user ${oldUser.nombre}:`, userError.message);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 MIGRATION COMPLETED!');
    console.log('📊 Summary:');
    console.log(`   - Users migrated: ${migratedUsers}`);
    console.log(`   - Cards migrated: ${migratedCards}`);
    console.log(`   - Transactions migrated: ${migratedTransactions}`);
    console.log(`   - History records migrated: ${migratedHistory}`);
    
    console.log('\n📋 Migrated users:');
    latestUsers.forEach((user, i) => {
      console.log(`   ${i+1}. ${user.nombre} (${user.Card_id})`);
    });
    
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
  migrateLatest10Users();
}

module.exports = { migrateLatest10Users };
