require('dotenv').config();
const mongoose = require('mongoose');

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

const createNewDatabases = async () => {
  try {
    console.log('✨ Creando nuevas bases de datos...');
    
    // Conectar a MongoDB Atlas
    const connection = await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
    
    // Crear cada base de datos
    for (const dbName of newDatabases) {
      try {
        console.log(`📝 Creando: ${dbName}`);
        const db = connection.connection.useDb(dbName);
        
        // Crear una colección temporal para inicializar la DB
        await db.createCollection('_init');
        await db.collection('_init').insertOne({ 
          created: new Date(),
          environment: dbName.split('_')[0],
          type: dbName.split('_')[1]
        });
        
        // Eliminar la colección temporal
        await db.collection('_init').drop();
        
        console.log(`✅ Creada: ${dbName}`);
      } catch (error) {
        console.log(`❌ Error creando ${dbName}:`, error.message);
      }
    }
    
    // Verificar resultado final
    console.log('\n🔍 Verificando bases de datos creadas...');
    const admin = connection.connection.db.admin();
    const dbs = await admin.listDatabases();
    
    const appDbs = dbs.databases.filter(db => 
      db.name.startsWith('dev_') || 
      db.name.startsWith('prod_') || 
      db.name.startsWith('test_')
    );
    
    console.log('📊 Bases de datos de la aplicación:');
    appDbs.forEach(db => {
      console.log(`  - ${db.name}`);
    });
    
    console.log('\n🎉 Creación completada!');
    
  } catch (error) {
    console.error('❌ Error durante la creación:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  createNewDatabases();
}

module.exports = { createNewDatabases };
