require('dotenv').config();
const { MongoClient } = require('mongodb');

const copyDevToProd = async () => {
  const startTime = Date.now();
  let devClient = null;
  let prodClient = null;
  
  try {
    console.log('🚀 Starting copy from DEV to PROD databases...');
    console.log('='.repeat(70));
    
    const devMongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const prodMongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    
    const databases = [
      { name: 'users', devDb: 'dev_users', prodDb: 'prod_users' },
      { name: 'cards', devDb: 'dev_cards', prodDb: 'prod_cards' },
      { name: 'transactions', devDb: 'dev_transactions', prodDb: 'prod_transactions' },
      { name: 'history', devDb: 'dev_history', prodDb: 'prod_history' },
      { name: 'reconciliations', devDb: 'dev_reconciliations', prodDb: 'prod_reconciliations' },
      { name: 'synclog', devDb: 'dev_synclog', prodDb: 'prod_synclog' }
    ];
    
    console.log('🔗 Connecting to databases...');
    devClient = new MongoClient(devMongoUri);
    prodClient = new MongoClient(prodMongoUri);
    
    await devClient.connect();
    console.log('✅ Connected to DEV MongoDB');
    
    await prodClient.connect();
    console.log('✅ Connected to PROD MongoDB');
    
    const totalStats = {
      databases: 0,
      collections: 0,
      documents: 0,
      errors: 0
    };
    
    for (const dbConfig of databases) {
      try {
        console.log(`\n📦 Processing ${dbConfig.name} database...`);
        console.log(`   DEV: ${dbConfig.devDb} → PROD: ${dbConfig.prodDb}`);
        
        const devDb = devClient.db(dbConfig.devDb);
        const prodDb = prodClient.db(dbConfig.prodDb);
        
        const collections = await devDb.listCollections().toArray();
        console.log(`   📋 Found ${collections.length} collections in DEV`);
        
        if (collections.length === 0) {
          console.log(`   ⚠️  No collections found in ${dbConfig.devDb}, skipping...`);
          continue;
        }
        
        for (const collectionInfo of collections) {
          const collectionName = collectionInfo.name;
          
          try {
            console.log(`   🔄 Copying collection: ${collectionName}...`);
            
            const devCollection = devDb.collection(collectionName);
            const prodCollection = prodDb.collection(collectionName);
            
            const count = await devCollection.countDocuments();
            console.log(`      📊 Found ${count} documents in DEV`);
            
            if (count === 0) {
              console.log(`      ⚠️  Collection is empty, skipping...`);
              continue;
            }
            
            const documents = await devCollection.find({}).toArray();
            
            console.log(`      🗑️  Clearing PROD collection...`);
            await prodCollection.deleteMany({});
            
            if (documents.length > 0) {
              console.log(`      📥 Inserting ${documents.length} documents into PROD...`);
              
              const BATCH_SIZE = 1000;
              for (let i = 0; i < documents.length; i += BATCH_SIZE) {
                const batch = documents.slice(i, i + BATCH_SIZE);
                await prodCollection.insertMany(batch, { ordered: false });
                console.log(`         ✅ Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(documents.length / BATCH_SIZE)}`);
              }
              
              const prodCount = await prodCollection.countDocuments();
              console.log(`      ✅ Successfully copied ${prodCount} documents to PROD`);
              
              totalStats.collections++;
              totalStats.documents += prodCount;
            }
            
          } catch (collectionError) {
            console.error(`      ❌ Error copying collection ${collectionName}:`, collectionError.message);
            totalStats.errors++;
          }
        }
        
        totalStats.databases++;
        console.log(`   ✅ Completed ${dbConfig.name} database`);
        
      } catch (dbError) {
        console.error(`   ❌ Error processing ${dbConfig.name} database:`, dbError.message);
        totalStats.errors++;
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 COPY SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Databases processed: ${totalStats.databases}/${databases.length}`);
    console.log(`✅ Collections copied: ${totalStats.collections}`);
    console.log(`✅ Documents copied: ${totalStats.documents.toLocaleString()}`);
    console.log(`❌ Errors: ${totalStats.errors}`);
    console.log(`⏱️  Total time: ${totalTime}s`);
    console.log('='.repeat(70));
    
    if (totalStats.errors === 0) {
      console.log('🎉 All databases copied successfully!');
    } else {
      console.log('⚠️  Copy completed with some errors. Please review the log above.');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    if (devClient) {
      await devClient.close();
      console.log('\n🔌 DEV connection closed');
    }
    if (prodClient) {
      await prodClient.close();
      console.log('🔌 PROD connection closed');
    }
  }
};

if (require.main === module) {
  copyDevToProd()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { copyDevToProd };

