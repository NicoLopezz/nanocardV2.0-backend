const mongoose = require('mongoose');
const { connectDatabases, getUsersConnection, getCardsConnection } = require('../config/database');
const { userSchema } = require('../models/User');
const { cardSchema } = require('../models/Card');

const config = require('../config/environment');

async function checkUserStatus() {
  try {
    console.log('🔍 Verificando estado del usuario...');
    
    await connectDatabases();
    
    const usersConnection = getUsersConnection();
    const cardsConnection = getCardsConnection();
    
    await new Promise((resolve) => {
      if (usersConnection.readyState === 1 && cardsConnection.readyState === 1) {
        resolve();
      } else {
        const checkConnections = () => {
          if (usersConnection.readyState === 1 && cardsConnection.readyState === 1) {
            resolve();
          } else {
            setTimeout(checkConnections, 100);
          }
        };
        checkConnections();
      }
    });
    
    const User = usersConnection.model('User', userSchema);
    const Card = cardsConnection.model('Card', cardSchema);
    
    const userId = '3tgy8OArdOY4q0BWWfDy91IPP9ZNxzrT';
    const email = 'Nicolasbeguiristain1994@gmail.com';
    
    console.log(`🔍 Buscando usuario por ID: ${userId}`);
    const userById = await User.findById(userId);
    
    console.log(`🔍 Buscando usuario por email: ${email}`);
    const userByEmail = await User.findOne({ email: email });
    
    console.log(`🔍 Buscando cards del usuario: ${userId}`);
    const userCards = await Card.find({ userId: userId });
    
    console.log('\n📊 RESULTADOS:');
    console.log(`👤 Usuario por ID: ${userById ? 'ENCONTRADO' : 'NO ENCONTRADO'}`);
    console.log(`👤 Usuario por email: ${userByEmail ? 'ENCONTRADO' : 'NO ENCONTRADO'}`);
    console.log(`💳 Cards del usuario: ${userCards.length}`);
    
    if (userById) {
      console.log(`   - Usuario encontrado: ${userById.username} (${userById.email})`);
      console.log(`   - Creado: ${userById.createdAt}`);
    }
    
    if (userByEmail) {
      console.log(`   - Email encontrado: ${userByEmail.username} (${userByEmail.email})`);
      console.log(`   - Creado: ${userByEmail.createdAt}`);
    }
    
    if (userCards.length > 0) {
      console.log(`   - Cards encontradas: ${userCards.length}`);
      userCards.forEach((card, index) => {
        console.log(`     ${index + 1}. ${card.name} (${card._id})`);
      });
    }
    
    // Verificar usuarios recientes
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentUsers = await User.find({
      createdAt: { $gte: yesterday }
    }).select('_id username email createdAt').sort({ createdAt: -1 });
    
    console.log(`\n📊 Usuarios creados en las últimas 24 horas: ${recentUsers.length}`);
    recentUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.username} (${user.email}) - ${user.createdAt}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  checkUserStatus();
}

module.exports = { checkUserStatus };
