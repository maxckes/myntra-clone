#!/usr/bin/env node

/**
 * ============================================================================
 * E-COMMERCE SETUP TEST SCRIPT
 * ============================================================================
 * This script tests database connection and seeding functionality
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Category = require('./models/Category');
const Product = require('./models/Product');
const { seedDatabase } = require('./seed');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = (color, message) => console.log(`${colors[color]}${message}${colors.reset}`);

async function testDatabaseConnection() {
  try {
    log('cyan', '\n🔍 Testing Database Connection...');
    
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';
    log('blue', `   Connecting to: ${mongoUri}`);
    
    await mongoose.connect(mongoUri);
    log('green', '✅ Database connection successful!');
    
    // Test basic operations
    const dbStats = await mongoose.connection.db.admin().serverStatus();
    log('green', `✅ MongoDB version: ${dbStats.version}`);
    log('green', `✅ Database name: ${mongoose.connection.db.databaseName}`);
    
    return true;
  } catch (error) {
    log('red', `❌ Database connection failed: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      log('yellow', '💡 MongoDB is not running. Please start MongoDB service.');
    }
    
    return false;
  }
}

async function testModels() {
  try {
    log('cyan', '\n🧪 Testing Model Schemas...');
    
    // Test User model
    const testUser = new User({
      fullName: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      phone: '1234567890',
      isVerified: true,
      role: 'customer'
    });
    
    const userValidation = testUser.validateSync();
    if (userValidation) {
      log('red', `❌ User model validation failed: ${userValidation.message}`);
      return false;
    }
    log('green', '✅ User model validation passed');
    
    // Test Category model
    const testCategory = new Category({
      name: 'Test Category',
      description: 'Test description',
      image: 'https://example.com/image.jpg',
      subcategory: ['Test Subcategory'],
      isActive: true,
      displayOrder: 1
    });
    
    const categoryValidation = testCategory.validateSync();
    if (categoryValidation) {
      log('red', `❌ Category model validation failed: ${categoryValidation.message}`);
      return false;
    }
    log('green', '✅ Category model validation passed');
    
    // Test Product model
    const testProduct = new Product({
      name: 'Test Product',
      brand: 'Test Brand',
      price: 999,
      description: 'Test description',
      images: ['https://example.com/image.jpg'],
      categoryId: testCategory._id,
      categoryName: 'Test Category',
      rating: 4.5,
      sizes: ['M', 'L'],
      colors: ['Black', 'White'],
      stock: 10,
      isActive: true
    });
    
    const productValidation = testProduct.validateSync();
    if (productValidation) {
      log('red', `❌ Product model validation failed: ${productValidation.message}`);
      return false;
    }
    log('green', '✅ Product model validation passed');
    
    return true;
  } catch (error) {
    log('red', `❌ Model testing failed: ${error.message}`);
    return false;
  }
}

async function testSeeding() {
  try {
    log('cyan', '\n🌱 Testing Seed Functionality...');
    
    // Count existing data
    const [userCount, categoryCount, productCount] = await Promise.all([
      User.countDocuments(),
      Category.countDocuments(),
      Product.countDocuments()
    ]);
    
    log('blue', `   Current data: ${userCount} users, ${categoryCount} categories, ${productCount} products`);
    
    if (userCount === 0 && categoryCount === 0 && productCount === 0) {
      log('yellow', '   Database is empty - seeding is needed');
    } else {
      log('green', '   Database has data - seeding may have already run');
    }
    
    return true;
  } catch (error) {
    log('red', `❌ Seed testing failed: ${error.message}`);
    return false;
  }
}

async function testJSONFiles() {
  try {
    log('cyan', '\n📁 Testing JSON Data Files...');
    
    const fs = require('fs');
    const path = require('path');
    
    // Check category.json
    const categoryPath = path.join(__dirname, 'category.json');
    if (fs.existsSync(categoryPath)) {
      const categoryData = JSON.parse(fs.readFileSync(categoryPath, 'utf8'));
      log('green', `✅ category.json found with ${categoryData.length} categories`);
    } else {
      log('yellow', '⚠️  category.json not found - will use fallback data');
    }
    
    // Check product.json
    const productPath = path.join(__dirname, 'product.json');
    if (fs.existsSync(productPath)) {
      const productData = JSON.parse(fs.readFileSync(productPath, 'utf8'));
      log('green', `✅ product.json found with ${productData.length} products`);
    } else {
      log('yellow', '⚠️  product.json not found - will use fallback data');
    }
    
    return true;
  } catch (error) {
    log('red', `❌ JSON file testing failed: ${error.message}`);
    return false;
  }
}

async function runTests() {
  log('magenta', '🚀 E-COMMERCE SETUP DIAGNOSTIC');
  log('magenta', '================================\n');
  
  try {
    // Test 1: Database Connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      log('red', '\n❌ Setup failed at database connection. Please fix MongoDB connection and try again.');
      process.exit(1);
    }
    
    // Test 2: Model Validation
    const modelsValid = await testModels();
    if (!modelsValid) {
      log('red', '\n❌ Setup failed at model validation. Please check model schemas.');
      process.exit(1);
    }
    
    // Test 3: JSON Files
    await testJSONFiles();
    
    // Test 4: Seeding Status
    await testSeeding();
    
    // Summary
    log('green', '\n🎉 ================================');
    log('green', '✅ All tests passed!');
    log('green', '✅ Your e-commerce backend is ready');
    log('green', '🎉 ================================\n');
    
    log('blue', '📝 Next Steps:');
    log('blue', '1. Run: npm start (to start the server)');
    log('blue', '2. Visit: http://localhost:5000/api/health');
    log('blue', '3. Test: http://localhost:5000/api/product');
    log('blue', '4. Login: john@example.com / password123\n');
    
  } catch (error) {
    log('red', `\n💥 Test execution failed: ${error.message}`);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      log('blue', '📊 Database connection closed');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(error => {
    log('red', `💥 Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runTests, testDatabaseConnection, testModels, testSeeding, testJSONFiles }; 