const mongoose = require('mongoose');
const config = require('../config/environment');

// Función para limpiar una base de datos
const cleanupDatabase = async (dbName, dbUri) => {
  try {
    console.log(`🧹 Limpiando base de datos: ${dbName}`);
    
    const connection = await mongoose.createConnection(dbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // Esperar a que la conexión esté lista
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Obtener todas las colecciones
    const collections = await connection.db.listCollections().toArray();
    
    console.log(`📋 Colecciones encontradas en ${dbName}:`, collections.map(c => c.name));

    // Eliminar todas las colecciones
    for (const collection of collections) {
      try {
        console.log(`🗑️  Eliminando colección: ${collection.name}`);
        await connection.db.collection(collection.name).drop();
      } catch (dropError) {
        console.log(`⚠️  No se pudo eliminar ${collection.name}: ${dropError.message}`);
      }
    }

    await connection.close();
    console.log(`✅ Base de datos ${dbName} limpiada exitosamente`);
    
  } catch (error) {
    console.error(`❌ Error limpiando ${dbName}:`, error.message);
    throw error;
  }
};

// Función principal
const cleanupAllDevDatabases = async () => {
  try {
    console.log('🚀 Iniciando limpieza de bases de datos de desarrollo...\n');

    // Lista de bases de datos de desarrollo
    const devDatabases = [
      { name: 'Users Dev', uri: config.USERS_DB_URI },
      { name: 'Cards Dev', uri: config.CARDS_DB_URI },
      { name: 'Transactions Dev', uri: config.TRANSACTIONS_DB_URI },
      { name: 'History Dev', uri: config.HISTORY_DB_URI }
    ];

    // Limpiar cada base de datos
    for (const db of devDatabases) {
      await cleanupDatabase(db.name, db.uri);
      console.log(''); // Línea en blanco para separar
    }

    console.log('🎉 ¡Limpieza completada exitosamente!');
    console.log('📊 Todas las bases de datos de desarrollo han sido limpiadas');
    console.log('🔄 Ahora puedes regenerar los datos desde cero');

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    process.exit(1);
  }
};

// Ejecutar si es llamado directamente
if (require.main === module) {
  cleanupAllDevDatabases();
}

module.exports = { cleanupAllDevDatabases, cleanupDatabase };
