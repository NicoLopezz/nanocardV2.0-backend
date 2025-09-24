require('dotenv').config();
const mongoose = require('mongoose');

const oldDatabases = [
  'nano_users_dev',
  'nano_cards_dev', 
  'nano_transactions_dev',
  'nano_history_dev',
  'nano_reconciliations_dev',
  'nano_users_prod',
  'nano_cards_prod',
  'nano_transactions_prod', 
  'nano_history_prod',
  'nano_reconciliations_prod',
  'nano_users_test',
  'nano_cards_test',
  'nano_transactions_test',
  'nano_history_test',
  'nano_reconciliations_test'
];

const cleanupOldDatabases = async () => {
  try {
    console.log('🗑️ Iniciando limpieza de bases de datos antiguas...');
    
    // Conectar a MongoDB Atlas
    const baseUri = process.env.MONGODB_URI;
    if (!baseUri) {
      console.error('❌ MONGODB_URI no está definida en las variables de entorno');
      process.exit(1);
    }
    const connection = await mongoose.connect(baseUri);
    console.log('✅ Conectado a MongoDB');
    
    // Listar todas las bases de datos
    const admin = connection.connection.db.admin();
    const dbs = await admin.listDatabases();
    console.log('📋 Bases de datos existentes:', dbs.databases.map(db => db.name));
    
    // Eliminar bases de datos antiguas una por una
    for (const dbName of oldDatabases) {
      try {
        const dbExists = dbs.databases.find(db => db.name === dbName);
        if (dbExists) {
          console.log(`🗑️ Eliminando: ${dbName}`);
          const db = connection.connection.useDb(dbName);
          await db.dropDatabase();
          console.log(`✅ Eliminada: ${dbName}`);
        } else {
          console.log(`⚠️ No existe: ${dbName}`);
        }
      } catch (error) {
        console.log(`❌ Error eliminando ${dbName}:`, error.message);
      }
    }
    
    // Verificar resultado final
    console.log('\n🔍 Verificando resultado final...');
    const finalDbs = await admin.listDatabases();
    const nanoDbs = finalDbs.databases.filter(db => 
      db.name.startsWith('nano_')
    );
    
    if (nanoDbs.length === 0) {
      console.log('✅ Todas las bases de datos antiguas han sido eliminadas');
    } else {
      console.log('⚠️ Bases de datos antiguas que aún existen:');
      nanoDbs.forEach(db => {
        console.log(`  - ${db.name}`);
      });
    }
    
    console.log('\n🎉 Limpieza completada!');
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  cleanupOldDatabases();
}

module.exports = { cleanupOldDatabases };
