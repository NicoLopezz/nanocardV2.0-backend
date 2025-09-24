const mongoose = require('mongoose');
const config = require('../config/environment');

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

const newDatabases = [
  'dev_users',
  'dev_cards',
  'dev_transactions', 
  'dev_history',
  'dev_reconciliations',
  'prod_users',
  'prod_cards',
  'prod_transactions',
  'prod_history', 
  'prod_reconciliations',
  'test_users',
  'test_cards',
  'test_transactions',
  'test_history',
  'test_reconciliations'
];

const reorganizeDatabases = async () => {
  try {
    console.log('🔄 Iniciando reorganización de bases de datos...');
    
    // Conectar a MongoDB
    const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/';
    const connection = await mongoose.connect(baseUri);
    console.log('✅ Conectado a MongoDB');
    
    const admin = connection.connection.db.admin();
    
    // Listar todas las bases de datos
    const dbs = await connection.connection.db.admin().listDatabases();
    console.log('📋 Bases de datos existentes:', dbs.databases.map(db => db.name));
    
    // Eliminar bases de datos antiguas
    console.log('\n🗑️ Eliminando bases de datos antiguas...');
    for (const dbName of oldDatabases) {
      try {
        const dbExists = dbs.databases.find(db => db.name === dbName);
        if (dbExists) {
          await connection.connection.db.admin().dropDatabase(dbName);
          console.log(`❌ Eliminada: ${dbName}`);
        } else {
          console.log(`⚠️ No existe: ${dbName}`);
        }
      } catch (error) {
        console.log(`❌ Error eliminando ${dbName}:`, error.message);
      }
    }
    
    // Crear nuevas bases de datos
    console.log('\n✨ Creando nuevas bases de datos...');
    for (const dbName of newDatabases) {
      try {
        const newDb = connection.connection.useDb(dbName);
        // Crear una colección temporal para inicializar la DB
        await newDb.createCollection('_init');
        await newDb.collection('_init').insertOne({ created: new Date() });
        await newDb.collection('_init').drop();
        console.log(`✅ Creada: ${dbName}`);
      } catch (error) {
        console.log(`❌ Error creando ${dbName}:`, error.message);
      }
    }
    
    // Verificar resultado final
    console.log('\n🔍 Verificando resultado final...');
    const finalDbs = await connection.connection.db.admin().listDatabases();
    const nanoDbs = finalDbs.databases.filter(db => 
      db.name.startsWith('dev_') || 
      db.name.startsWith('prod_') || 
      db.name.startsWith('test_')
    );
    
    console.log('📊 Nuevas bases de datos creadas:');
    nanoDbs.forEach(db => {
      console.log(`  - ${db.name}`);
    });
    
    console.log('\n🎉 Reorganización completada!');
    console.log('\n📝 Próximos pasos:');
    console.log('1. Ejecuta: npm run dev (para probar desarrollo)');
    console.log('2. Ejecuta: npm run start (para probar producción)');
    
  } catch (error) {
    console.error('❌ Error durante la reorganización:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  reorganizeDatabases();
}

module.exports = { reorganizeDatabases };
