const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// ✅ FIXED: Import seeding function from correct path
const { seedDatabase } = require('./seed');

const app = express();

// ✅ ENHANCED: Middleware Configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:8081',
    'exp://localhost:8081',
    'http://192.168.1.100:8081',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ ENHANCED: Static files serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ ENHANCED: Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ✅ FIXED: Database Connection - Removed deprecated options
const connectDB = async () => {
  try {
    // ✅ UPDATED: Removed deprecated useNewUrlParser and useUnifiedTopology
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
    console.log('✅ Connected to MongoDB successfully');
    console.log('📊 Database Name:', mongoose.connection.db.databaseName);

    // ✅ AUTO-SEED: Check if database needs seeding
    await autoSeedIfNeeded();
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// ✅ AUTO-SEED: Function to check and seed if needed
const autoSeedIfNeeded = async () => {
  try {
    // ✅ FIXED: Import models with correct names
    const User = require('./models/User');
    const Product = require('./models/Product');
    const Category = require('./models/Category');

    // Check if database has any data
    const [userCount, productCount, categoryCount] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Category.countDocuments()
    ]);

    console.log('\n🔍 Checking database status...');
    console.log(`👥 Users: ${userCount}`);
    console.log(`🛍️  Products: ${productCount}`);
    console.log(`📂 Categories: ${categoryCount}`);

    // ✅ AUTO-SEED: If database is empty or missing critical data, seed it
    if (userCount === 0 || productCount === 0 || categoryCount === 0) {
      console.log('\n🌱 Database appears empty or incomplete. Auto-seeding...');
      
      // ✅ Use simplified seeding for auto-seed
      await runQuickSeed();
      
      console.log('✅ Auto-seeding completed successfully!');
    } else {
      console.log('✅ Database already has data. Skipping auto-seed.');
    }

    console.log(''); // Empty line for better formatting
    
  } catch (error) {
    console.error('❌ Error during auto-seed check:', error);
    console.log('⚠️  Continuing server startup without seeding...\n');
  }
};

// ✅ SIMPLIFIED: Quick seed function that doesn't exit process
const runQuickSeed = async () => {
  try {
    // ✅ FIXED: Import models with correct names
    const User = require('./models/User');
    const Product = require('./models/Product');
    const Category = require('./models/Category');
    const Order = require('./models/Order');
    const Bag = require('./models/Bag');
    const Wishlist = require('./models/Wishlist');

    console.log('🌱 Starting quick database seeding...\n');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Product.deleteMany({}),
      Order.deleteMany({}),
      Bag.deleteMany({}),
      Wishlist.deleteMany({})
    ]);
    console.log('🗑️  Cleared existing data');

    // Create some basic seed data
    const bcrypt = require('bcrypt');
    
    // ✅ FIXED: Create users with fullName field instead of name
    const hashedPassword = await bcrypt.hash('password123', 10);
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    
    const users = await User.insertMany([
      {
        fullName: 'John Doe',           // ✅ FIXED: Changed from 'name' to 'fullName'
        email: 'john@example.com',
        password: hashedPassword,
        phone: '9876543210',
        isVerified: true,
        role: 'customer'
      },
      {
        fullName: 'Admin User',         // ✅ FIXED: Changed from 'name' to 'fullName'
        email: 'admin@example.com',
        password: hashedAdminPassword,
        phone: '9876543211',
        isVerified: true,
        role: 'admin'
      }
    ]);

    // ✅ ENHANCED: Load categories from category.json if it exists
    let categories;
    try {
      const fs = require('fs');
      const categoryData = JSON.parse(fs.readFileSync('./category.json', 'utf8'));
      console.log('📂 Loading categories from category.json...');
      categories = await Category.insertMany(categoryData);
      console.log(`✅ Loaded ${categories.length} categories from file`);
    } catch (fileError) {
      console.log('📂 category.json not found, using default categories...');
      // Fallback to default categories
      categories = await Category.insertMany([
        {
          name: 'Men\'s Clothing',
          description: 'Trendy fashion for men',
          image: 'https://images.unsplash.com/photo-1516826957135-700dedea698c?w=800',
          isActive: true,
          displayOrder: 1
        },
        {
          name: 'Women\'s Clothing',
          description: 'Beautiful women\'s fashion',
          image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800',
          isActive: true,
          displayOrder: 2
        },
        {
          name: 'Electronics',
          description: 'Latest gadgets and devices',
          image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
          isActive: true,
          displayOrder: 3
        }
      ]);
    }

    // ✅ ENHANCED: Load products from product.json if it exists
    let products;
    try {
      const fs = require('fs');
      const productData = JSON.parse(fs.readFileSync('./product.json', 'utf8'));
      console.log('🛍️  Loading products from product.json...');
      
      // Assign categories to products based on index or category name matching
      const productsWithCategories = productData.map((product, index) => {
        let categoryId;
        
        // Try to match by category name if product has categoryName field
        if (product.categoryName) {
          const matchedCategory = categories.find(cat => 
            cat.name.toLowerCase().includes(product.categoryName.toLowerCase()) ||
            product.categoryName.toLowerCase().includes(cat.name.toLowerCase())
          );
          categoryId = matchedCategory ? matchedCategory._id : categories[index % categories.length]._id;
        } else {
          // Fallback to round-robin assignment
          categoryId = categories[index % categories.length]._id;
        }
        
        return {
          ...product,
          categoryId,
          isActive: product.isActive !== undefined ? product.isActive : true,
          rating: product.rating || Math.round((Math.random() * 2 + 3) * 10) / 10, // 3.0-5.0
          ratingCount: product.ratingCount || Math.floor(Math.random() * 200) + 10,
          stock: product.stock || Math.floor(Math.random() * 50) + 10
        };
      });
      
      products = await Product.insertMany(productsWithCategories);
      console.log(`✅ Loaded ${products.length} products from file`);
    } catch (fileError) {
      console.log('🛍️  product.json not found, using default products...');
      // Fallback to default products
      products = await Product.insertMany([
        {
          name: 'Classic Cotton T-Shirt',
          description: 'Comfortable cotton t-shirt',
          brand: 'StyleCraft',
          price: 899,
          categoryId: categories[0]._id,
          images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800'],
          colors: ['Black', 'White', 'Navy'],
          sizes: ['S', 'M', 'L', 'XL'],
          stock: 50,
          isActive: true,
          isFeatured: true,
          rating: 4.3,
          ratingCount: 128
        },
        {
          name: 'Floral Summer Dress',
          description: 'Beautiful floral dress',
          brand: 'FloralFash',
          price: 1899,
          categoryId: categories[1]._id,
          images: ['https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800'],
          colors: ['Pink', 'Blue', 'White'],
          sizes: ['XS', 'S', 'M', 'L'],
          stock: 25,
          isActive: true,
          rating: 4.4,
          ratingCount: 67
        },
        {
          name: 'Wireless Bluetooth Headphones',
          description: 'Premium wireless headphones',
          brand: 'SoundMax',
          price: 4999,
          categoryId: categories[2]._id,
          images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'],
          colors: ['Black', 'White'],
          stock: 15,
          isActive: true,
          isFeatured: true,
          rating: 4.6,
          ratingCount: 234
        }
      ]);
    }

    // ✅ UPDATE: Category statistics after product creation
    for (const category of categories) {
      const categoryProducts = products.filter(p => p.categoryId.toString() === category._id.toString());
      await Category.findByIdAndUpdate(category._id, {
        $set: {
          productCount: categoryProducts.length,
          activeProductCount: categoryProducts.filter(p => p.isActive).length
        }
      });
    }

    console.log(`✅ Created ${users.length} users`);
    console.log(`✅ Created ${categories.length} categories`);
    console.log(`✅ Created ${products.length} products`);

    console.log('\n🎉 ================================');
    console.log('✅ Quick seeding completed successfully!');
    console.log('🔐 Test Accounts:');
    console.log('   Customer: john@example.com / password123');
    console.log('   Admin: admin@example.com / admin123');
    console.log('🎉 ================================\n');

  } catch (error) {
    console.error('❌ Quick seeding failed:', error);
    throw error;
  }
};

// ✅ FIXED: Import route files with correct names
const userRoutes = require('./routes/Userroutes');
const productRoutes = require('./routes/Productroutes');
const categoryRoutes = require('./routes/Categoryroutes');
const orderRoutes = require('./routes/OrderRoutes');
const bagRoutes = require('./routes/Bagroutes');
const wishlistRoutes = require('./routes/Wishlistroutes');

// ✅ ENHANCED: Mount all routes with proper prefixes
app.use('/api/users', userRoutes);
app.use('/api/product', productRoutes);
app.use('/api/category', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/bag', bagRoutes);
app.use('/api/wishlist', wishlistRoutes);

// ✅ ENHANCED: Authentication endpoints with better error handling
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    const User = require('./models/User');
    const bcrypt = require('bcrypt');
    const jwt = require('jsonwebtoken');

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    const token = jwt.sign(
      { id: user._id }, 
      process.env.JWT_SECRET || 'your-secret-key', 
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.fullName,        // ✅ FIXED: Use fullName from database
        fullName: user.fullName,    // ✅ ADDED: Include fullName for compatibility
        email: user.email,
        role: user.role || 'customer'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, fullName, email, password, phone } = req.body;

    // ✅ ENHANCED: Accept both name and fullName for compatibility
    const userFullName = fullName || name;

    if (!userFullName || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email, and password are required' 
      });
    }

    const User = require('./models/User');
    const bcrypt = require('bcrypt');
    const jwt = require('jsonwebtoken');

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'User already exists with this email' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      fullName: userFullName,       // ✅ FIXED: Use fullName field
      email,
      password: hashedPassword,
      phone,
      isVerified: true,
      role: 'customer'
    });

    const token = jwt.sign(
      { id: user._id }, 
      process.env.JWT_SECRET || 'your-secret-key', 
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.fullName,        // ✅ FIXED: Use fullName from database
        fullName: user.fullName,    // ✅ ADDED: Include fullName for compatibility
        email: user.email,
        role: user.role
      },
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// ✅ ENHANCED: Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'E-commerce API is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// ✅ ENHANCED: API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'E-commerce API v2.0',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register'
      },
      users: '/api/users',
      products: '/api/product',
      categories: '/api/category',
      orders: '/api/orders',
      bag: '/api/bag',
      wishlist: '/api/wishlist',
      health: '/api/health'
    },
    features: [
      'Advanced Search & Filtering',
      'Real-time Wishlist Management',
      'Enhanced Shopping Bag',
      'Complete Order Management',
      'User Authentication',
      'Responsive Design Support',
      'Auto-Seeding from JSON files',
      'Production Ready Error Handling'
    ]
  });
});

// ✅ ENHANCED: Global error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Global Error:', error);
  
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }
  
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0];
    return res.status(409).json({
      success: false,
      message: `${field || 'Field'} already exists`
    });
  }
  
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// ✅ ENHANCED: 404 handler for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      'POST /api/auth/login',
      'POST /api/auth/register',
      'GET /api/users',
      'GET /api/product',
      'GET /api/category',
      'GET /api/orders',
      'GET /api/bag',
      'GET /api/wishlist',
      'GET /api/health',
      'GET /api'
    ]
  });
});

// ✅ ENHANCED: Server startup with auto-seeding
const startServer = async () => {
  try {
    // Connect to database and auto-seed
    await connectDB();
    
    // Start server after database is ready
    const PORT = process.env.PORT || 5000;
    
    app.listen(PORT, () => {
      console.log('🚀 =================================');
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Local: http://localhost:${PORT}`);
      console.log(`📱 API Base: http://localhost:${PORT}/api`);
      console.log(`❤️  Health Check: http://localhost:${PORT}/api/health`);
      console.log(`🔐 Test Accounts:`);
      console.log(`   Customer: john@example.com / password123`);
      console.log(`   Admin: admin@example.com / admin123`);
      console.log('🚀 =================================\n');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// ✅ ENHANCED: Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});

// ✅ Start the server
startServer();

module.exports = app;
