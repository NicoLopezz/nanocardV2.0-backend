const mongoose = require('mongoose');
const { connectDatabases, getUsersConnection } = require('../config/database');
const { userSchema } = require('../models/User');

const config = require('../config/environment');

async function checkSpecificUser() {
  try {
    console.log('🔍 Verificando usuario específico...');
    
    await connectDatabases();
    
    const usersConnection = getUsersConnection();
    
    await new Promise((resolve) => {
      if (usersConnection.readyState === 1) {
        resolve();
      } else {
        const checkConnections = () => {
          if (usersConnection.readyState === 1) {
            resolve();
          } else {
            setTimeout(checkConnections, 100);
          }
        };
        checkConnections();
      }
    });
    
    const User = usersConnection.model('User', userSchema);
    
    const userId = '139be3d6-6355-11f0-a30c-4f597792ce2a';
    
    console.log(`🔍 Buscando usuario: ${userId}`);
    const user = await User.findById(userId);
    
    if (user) {
      console.log('✅ Usuario encontrado:');
      console.log(`   - ID: ${user._id}`);
      console.log(`   - Username: ${user.username}`);
      console.log(`   - Email: ${user.email}`);
      console.log(`   - Role: ${user.role}`);
      console.log(`   - Creado: ${user.createdAt}`);
      console.log(`   - Actualizado: ${user.updatedAt}`);
    } else {
      console.log('❌ Usuario NO encontrado');
      
      // Buscar usuarios similares
      console.log('\n🔍 Buscando usuarios con ID similar...');
      const similarUsers = await User.find({
        _id: { $regex: userId.substring(0, 8) }
      }).select('_id username email createdAt');
      
      if (similarUsers.length > 0) {
        console.log(`📊 Usuarios similares encontrados: ${similarUsers.length}`);
        similarUsers.forEach((u, index) => {
          console.log(`  ${index + 1}. ${u.username} (${u._id}) - ${u.email}`);
        });
      } else {
        console.log('❌ No se encontraron usuarios similares');
      }
      
      // Buscar todos los usuarios Mercury
      console.log('\n🔍 Buscando todos los usuarios Mercury...');
      const mercuryUsers = await User.find({
        email: { $regex: /mercury/i }
      }).select('_id username email createdAt');
      
      if (mercuryUsers.length > 0) {
        console.log(`📊 Usuarios Mercury encontrados: ${mercuryUsers.length}`);
        mercuryUsers.forEach((u, index) => {
          console.log(`  ${index + 1}. ${u.username} (${u._id}) - ${u.email}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  checkSpecificUser();
}

module.exports = { checkSpecificUser };
