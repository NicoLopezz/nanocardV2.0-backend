const mongoose = require('mongoose');
require('dotenv').config();

// Configuración de las bases de datos
const devUsersUri = process.env.MONGODB_URI ? 
  `${process.env.MONGODB_URI.split('?')[0]}nano_users_dev${process.env.MONGODB_URI.includes('?') ? `?${process.env.MONGODB_URI.split('?')[1]}` : ''}` : 
  'mongodb://localhost:27017/nano_users_dev';

const devCardsUri = process.env.MONGODB_URI ? 
  `${process.env.MONGODB_URI.split('?')[0]}nano_cards_dev${process.env.MONGODB_URI.includes('?') ? `?${process.env.MONGODB_URI.split('?')[1]}` : ''}` : 
  'mongodb://localhost:27017/nano_cards_dev';

const devTransactionsUri = process.env.MONGODB_URI ? 
  `${process.env.MONGODB_URI.split('?')[0]}nano_transactions_dev${process.env.MONGODB_URI.includes('?') ? `?${process.env.MONGODB_URI.split('?')[1]}` : ''}` : 
  'mongodb://localhost:27017/nano_transactions_dev';

const prodUsersUri = process.env.MONGODB_URI ? 
  `${process.env.MONGODB_URI.split('?')[0]}nano_users_prod${process.env.MONGODB_URI.includes('?') ? `?${process.env.MONGODB_URI.split('?')[1]}` : ''}` : 
  'mongodb://localhost:27017/nano_users_prod';

const prodCardsUri = process.env.MONGODB_URI ? 
  `${process.env.MONGODB_URI.split('?')[0]}nano_cards_prod${process.env.MONGODB_URI.includes('?') ? `?${process.env.MONGODB_URI.split('?')[1]}` : ''}` : 
  'mongodb://localhost:27017/nano_cards_prod';

const prodTransactionsUri = process.env.MONGODB_URI ? 
  `${process.env.MONGODB_URI.split('?')[0]}nano_transactions_prod${process.env.MONGODB_URI.includes('?') ? `?${process.env.MONGODB_URI.split('?')[1]}` : ''}` : 
  'mongodb://localhost:27017/nano_transactions_prod';

async function cloneDevToProd() {
  try {
    console.log('🚀 Starting clone from DEV to PROD...');

    // Conectar a las bases de datos
    const devUsersConn = await mongoose.createConnection(devUsersUri);
    const devCardsConn = await mongoose.createConnection(devCardsUri);
    const devTransactionsConn = await mongoose.createConnection(devTransactionsUri);
    
    const prodUsersConn = await mongoose.createConnection(prodUsersUri);
    const prodCardsConn = await mongoose.createConnection(prodCardsUri);
    const prodTransactionsConn = await mongoose.createConnection(prodTransactionsUri);

    console.log('✅ Connected to all databases');

    // Limpiar las bases de datos de producción (eliminar todas las colecciones)
    console.log('🧹 Cleaning production databases...');
    
    // Eliminar colecciones específicas
    try {
      await prodUsersConn.db.collection('users').drop();
    } catch (e) {
      console.log('Users collection did not exist');
    }
    
    try {
      await prodCardsConn.db.collection('cards').drop();
    } catch (e) {
      console.log('Cards collection did not exist');
    }
    
    try {
      await prodTransactionsConn.db.collection('transactions').drop();
    } catch (e) {
      console.log('Transactions collection did not exist');
    }
    
    console.log('✅ Production databases cleaned');

    // Clonar usuarios
    console.log('👥 Cloning users...');
    const users = await devUsersConn.db.collection('users').find({}).toArray();
    if (users.length > 0) {
      await prodUsersConn.db.collection('users').insertMany(users);
      console.log(`✅ Cloned ${users.length} users`);
    }

    // Clonar tarjetas
    console.log('💳 Cloning cards...');
    const cards = await devCardsConn.db.collection('cards').find({}).toArray();
    if (cards.length > 0) {
      await prodCardsConn.db.collection('cards').insertMany(cards);
      console.log(`✅ Cloned ${cards.length} cards`);
    }

    // Clonar transacciones
    console.log('💰 Cloning transactions...');
    const transactions = await devTransactionsConn.db.collection('transactions').find({}).toArray();
    if (transactions.length > 0) {
      await prodTransactionsConn.db.collection('transactions').insertMany(transactions);
      console.log(`✅ Cloned ${transactions.length} transactions`);
    }

    // Cerrar conexiones
    await devUsersConn.close();
    await devCardsConn.close();
    await devTransactionsConn.close();
    await prodUsersConn.close();
    await prodCardsConn.close();
    await prodTransactionsConn.close();

    console.log('🎉 Clone completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Cards: ${cards.length}`);
    console.log(`   - Transactions: ${transactions.length}`);

  } catch (error) {
    console.error('❌ Error during clone:', error);
    process.exit(1);
  }
}

// Ejecutar el script
cloneDevToProd();