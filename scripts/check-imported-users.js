const mongoose = require('mongoose');
const { connectDatabases, getUsersConnection } = require('../config/database');
const { userSchema } = require('../models/User');

const config = require('../config/environment');

async function checkImportedUsers() {
  try {
    console.log('🔍 Verificando usuarios importados...');
    
    await connectDatabases();
    
    const usersConnection = getUsersConnection();
    
    await new Promise((resolve) => {
      if (usersConnection.readyState === 1) {
        resolve();
      } else {
        usersConnection.once('connected', resolve);
      }
    });
    
    const User = usersConnection.model('User', userSchema);
    
    // Buscar usuarios creados en las últimas 24 horas
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const recentUsers = await User.find({
      createdAt: { $gte: yesterday }
    }).select('_id username email createdAt').sort({ createdAt: -1 });
    
    console.log(`📊 Usuarios creados en las últimas 24 horas: ${recentUsers.length}`);
    
    if (recentUsers.length > 0) {
      console.log('\n📋 Usuarios recientes:');
      recentUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.username} (${user.email}) - ${user.createdAt}`);
      });
    } else {
      console.log('⚠️ No se encontraron usuarios recientes');
    }
    
    // Contar total de usuarios
    const totalUsers = await User.countDocuments();
    console.log(`\n📊 Total de usuarios en la base de datos: ${totalUsers}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  checkImportedUsers();
}

module.exports = { checkImportedUsers };
