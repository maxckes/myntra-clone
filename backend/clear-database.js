const mongoose = require('mongoose');
require('dotenv').config();

// ============================================================================
// COMPLETE DATABASE CLEANUP SCRIPT
// ============================================================================

const clearDatabase = async () => {
  try {
    console.log('🚀 Starting database cleanup...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
    console.log('✅ Connected to MongoDB successfully');
    console.log('📊 Database Name:', mongoose.connection.db.databaseName);

    // Get all collection names
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    console.log('\n📋 Found collections:', collectionNames);

    if (collectionNames.length === 0) {
      console.log('⚠️  No collections found - database is already clean');
      return;
    }

    // Drop all collections to remove old schemas and indexes
    console.log('\n🗑️  Dropping all collections...');
    
    const dropPromises = collectionNames.map(async (name) => {
      try {
        await mongoose.connection.db.collection(name).drop();
        console.log(`   ✅ Dropped: ${name}`);
      } catch (error) {
        console.log(`   ⚠️  Could not drop ${name}:`, error.message);
      }
    });

    await Promise.all(dropPromises);

    // Verify cleanup
    const remainingCollections = await mongoose.connection.db.listCollections().toArray();
    
    console.log('\n🎉 ================================');
    console.log('✅ Database cleanup completed!');
    console.log('📊 Final Status:');
    console.log(`   🗑️  Collections dropped: ${collectionNames.length}`);
    console.log(`   📂 Remaining collections: ${remainingCollections.length}`);
    
    if (remainingCollections.length === 0) {
      console.log('✨ Database is completely clean!');
    } else {
      console.log('⚠️  Some collections remain:', remainingCollections.map(c => c.name));
    }
    
    console.log('🎉 ================================\n');
    
    console.log('🚀 Next Steps:');
    console.log('   1. Run: node server.js');
    console.log('   2. Your server will auto-seed with fresh data');
    console.log('   3. All old schema conflicts resolved\n');

  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
    throw error;
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('📊 Database connection closed');
    process.exit(0);
  }
};

// ============================================================================
// ALTERNATIVE: SELECTIVE CLEANUP (Uncomment if needed)
// ============================================================================

const clearSpecificCollections = async () => {
  try {
    console.log('🚀 Starting selective cleanup...\n');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
    console.log('✅ Connected to MongoDB successfully');

    // Define collections to clear (problematic ones)
    const collectionsToClean = [
      'categories',    // Has slug index issues
      'products',      // Has field name changes
      'users',         // Has duplicate email index
      'orders',        // Clean slate
      'bags',          // Clean slate  
      'wishlists'      // Clean slate
    ];

    console.log('🗑️  Cleaning specific collections...');
    
    for (const collectionName of collectionsToClean) {
      try {
        await mongoose.connection.db.collection(collectionName).drop();
        console.log(`   ✅ Dropped: ${collectionName}`);
      } catch (error) {
        console.log(`   ⚠️  Collection ${collectionName} does not exist or already dropped`);
      }
    }

    console.log('\n✅ Selective cleanup completed!');

  } catch (error) {
    console.error('❌ Selective cleanup failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('📊 Database connection closed');
    process.exit(0);
  }
};

// ============================================================================
// EXECUTION
// ============================================================================

// Run the cleanup
if (require.main === module) {
  console.log('🧹 MongoDB Database Cleanup Tool');
  console.log('=====================================\n');
  
  // You can choose which cleanup method to use:
  
  // Option 1: Complete cleanup (recommended)
  clearDatabase();
  
  // Option 2: Selective cleanup (uncomment if you prefer)
  // clearSpecificCollections();
}

module.exports = { clearDatabase, clearSpecificCollections };
