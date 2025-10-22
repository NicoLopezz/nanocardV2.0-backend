require('dotenv').config();
const mongoose = require('mongoose');

// Configurar conexiones
const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';
const NEW_DB_URI = process.env.MONGODB_URI;

const migrateSpecificUserByCardId = async () => {
  try {
    console.log('🚀 Starting migration of specific user by Card_id...');
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
    
    const targetCardId = 'vYghJnzi2y8qkSN2Kcvx4S5WycEVjcb9';
    
    console.log(`\n🔍 Searching for user with Card_id: ${targetCardId}...`);
    
    // Buscar el usuario en la DB antigua por Card_id
    const oldUsersCollection = oldConnection.db.collection('clonar_db_antigua');
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
    if (existingUser) {
      console.log(`⚠️ User already exists in new database. Updating...`);
    } else {
      console.log(`📝 Creating new user...`);
    }
    
    console.log('\n📊 MIGRATION STARTING...');
    console.log('='.repeat(50));
    
    try {
      // 1. CREAR/ACTUALIZAR USUARIO
      console.log('   👤 Creating/updating user...');
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
      console.log(`   ✅ User created/updated: ${newUser.username}`);
      
      // 2. CREAR/ACTUALIZAR TARJETA
      console.log('   💳 Creating/updating card...');
      const newCard = {
        _id: oldUser.Card_id,
        userId: oldUser._id,
        name: oldUser.nombre,
        last4: oldUser.last4_,
        status: oldUser.statusCard || 'ACTIVE',
        type: oldUser.tipeCard || 'virtual',
        supplier: oldUser.supplier || 'cryptomate',
        
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
      console.log(`   ✅ Card created/updated: ${newCard.name} (${newCard.last4})`);
      
      // 3. CREAR/ACTUALIZAR TRANSACCIONES
      console.log('   💰 Creating/updating transactions...');
      const allMovements = [
        ...(oldUser.movimientos || []),
        ...(oldUser.recargas || []),
        ...(oldUser.retiros || []),
        ...(oldUser.reintegros || [])
      ];
      
      const deletedMovements = oldUser.movsDeleted || [];
      let transactionCount = 0;
      
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
        transactionCount++;
      }
      
      console.log(`   ✅ ${transactionCount} transactions created/updated`);
      
      // 4. CREAR/ACTUALIZAR HISTORIAL
      console.log('   📚 Creating/updating history...');
      let historyCount = 0;
      
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
          historyCount++;
        }
      }
      
      console.log(`   ✅ ${historyCount} history records created/updated`);
      
      console.log(`\n🎉 User ${oldUser.nombre} migrated successfully!`);
      
      // Mostrar resumen
      console.log('\n📊 MIGRATION SUMMARY:');
      console.log(`   - User: ${newUser.username}`);
      console.log(`   - Card: ${newCard.name} (${newCard.last4})`);
      console.log(`   - Card ID: ${newCard._id}`);
      console.log(`   - Transactions: ${transactionCount}`);
      console.log(`   - History records: ${historyCount}`);
      console.log(`   - Deposited: ${newCard.deposited}`);
      console.log(`   - Posted: ${newCard.posted}`);
      console.log(`   - Available: ${newCard.available}`);
      
    } catch (userError) {
      console.error(`   ❌ Error migrating user ${oldUser.nombre}:`, userError.message);
    }
    
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
  migrateSpecificUserByCardId();
}

module.exports = { migrateSpecificUserByCardId };
