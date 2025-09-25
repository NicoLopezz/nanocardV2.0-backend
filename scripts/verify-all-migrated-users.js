require('dotenv').config();
const mongoose = require('mongoose');

// Configurar conexiones
const OLD_DB_URI = 'mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury';
const NEW_DB_URI = process.env.MONGODB_URI;

const verifyAllMigratedUsers = async () => {
  try {
    console.log('🔍 Verifying all migrated users accuracy...');
    
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
    
    console.log('\n📊 VERIFICATION STARTING...');
    console.log('='.repeat(50));
    
    // Obtener usuarios migrados de la nueva DB
    const migratedUsers = await newUsersDb.collection('users').find({}).toArray();
    const migratedCards = await newCardsDb.collection('cards').find({}).toArray();
    
    console.log(`\n🔍 Found ${migratedUsers.length} users in new architecture`);
    
    const oldUsersCollection = oldConnection.db.collection('clonar_db_antigua');
    
    let perfectMatches = 0;
    let discrepancies = 0;
    
    for (const newUser of migratedUsers) {
      // El _id del usuario en la nueva DB es el _id de la DB antigua
      const userId = newUser._id; 
      
      // Buscar tarjeta por userId (convertir a ObjectId si es necesario)
      const newCard = migratedCards.find(card => {
        const cardUserId = card.userId ? card.userId.toString() : null;
        return cardUserId === userId.toString();
      });
      
      console.log(`\n🔄 Verifying: ${newUser.username} (_id: ${userId})`);
      
      // Buscar en la DB antigua por _id
      const oldUser = await oldUsersCollection.findOne({ _id: userId });
      
      if (!oldUser) {
        console.log(`   ❌ User not found in old database with _id: ${userId}`);
        discrepancies++;
        continue;
      }
      
      if (!newCard) {
        console.log(`   ❌ Card not found in new database`);
        discrepancies++;
        continue;
      }
      
      // Comparar datos básicos
      const nameMatch = oldUser.nombre === newCard.name;
      const last4Match = oldUser.last4_ === newCard.last4;
      const statusMatch = oldUser.statusCard === newCard.status;
      
      // Comparar datos financieros
      const depositedMatch = (oldUser.total_depositado || 0) === newCard.deposited;
      const postedMatch = ((oldUser.total_movimientos || 0) - (oldUser.available_credit || 0)) === newCard.posted;
      const availableMatch = (oldUser.available_credit || 0) === newCard.available;
      
      // Contar transacciones en DB antigua
      const oldTransactions = [
        ...(oldUser.movimientos || []),
        ...(oldUser.recargas || []),
        ...(oldUser.retiros || []),
        ...(oldUser.reintegros || [])
      ];
      
      // Contar transacciones en nueva DB
      const newTransactions = await newTransactionsDb.collection('transactions').find({ cardId: newCard._id }).toArray();
      
      const transactionCountMatch = oldTransactions.length === newTransactions.length;
      
      // Mostrar comparación
      console.log(`   📋 Basic Data:`);
      console.log(`      Name: "${oldUser.nombre}" ${nameMatch ? '✅' : '❌'} "${newCard.name}"`);
      console.log(`      Last4: "${oldUser.last4_}" ${last4Match ? '✅' : '❌'} "${newCard.last4}"`);
      console.log(`      Status: "${oldUser.statusCard}" ${statusMatch ? '✅' : '❌'} "${newCard.status}"`);
      
      console.log(`   💰 Financial Data:`);
      console.log(`      Deposited: ${oldUser.total_depositado || 0} ${depositedMatch ? '✅' : '❌'} ${newCard.deposited}`);
      console.log(`      Posted: ${(oldUser.total_movimientos || 0) - (oldUser.available_credit || 0)} ${postedMatch ? '✅' : '❌'} ${newCard.posted}`);
      console.log(`      Available: ${oldUser.available_credit || 0} ${availableMatch ? '✅' : '❌'} ${newCard.available}`);
      
      console.log(`   📊 Transaction Count:`);
      console.log(`      Old DB: ${oldTransactions.length} ${transactionCountMatch ? '✅' : '❌'} New DB: ${newTransactions.length}`);
      
      // Verificar si es una coincidencia perfecta
      const isPerfectMatch = nameMatch && last4Match && statusMatch && 
                           depositedMatch && postedMatch && availableMatch && transactionCountMatch;
      
      if (isPerfectMatch) {
        console.log(`   🎉 PERFECT MATCH!`);
        perfectMatches++;
      } else {
        console.log(`   ⚠️ DISCREPANCY FOUND`);
        discrepancies++;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🎯 VERIFICATION SUMMARY:');
    console.log(`   - Users verified: ${migratedUsers.length}`);
    console.log(`   - Perfect matches: ${perfectMatches}`);
    console.log(`   - Discrepancies: ${discrepancies}`);
    console.log(`   - Accuracy: ${((perfectMatches / migratedUsers.length) * 100).toFixed(1)}%`);
    
    if (discrepancies === 0) {
      console.log('\n✅ MIGRATION IS 100% ACCURATE!');
      console.log('🎉 All data matches perfectly between old and new databases');
    } else {
      console.log('\n⚠️ Some discrepancies found - review the details above');
    }
    
  } catch (error) {
    console.error('❌ Verification error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from databases');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  verifyAllMigratedUsers();
}

module.exports = { verifyAllMigratedUsers };
