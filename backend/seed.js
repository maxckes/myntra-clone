const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ✅ FIXED: Import models with correct names
const User = require('./models/User');
const Category = require('./models/Category');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Bag = require('./models/Bag');
const Wishlist = require('./models/Wishlist');

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
    console.log('✅ Connected to MongoDB for seeding');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

// ============================================================================
// JSON FILE LOADING UTILITY
// ============================================================================

const loadJSONFile = (filePath, fallbackData = []) => {
  try {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      console.log(`✅ Loaded data from ${filePath}: ${Array.isArray(data) ? data.length : 'N/A'} items`);
      return Array.isArray(data) ? data : fallbackData;
    } else {
      console.log(`⚠️  ${filePath} not found, using fallback data`);
      return fallbackData;
    }
  } catch (error) {
    console.error(`❌ Error loading ${filePath}:`, error.message);
    console.log(`⚠️  Using fallback data for ${filePath}`);
    return fallbackData;
  }
};

// ============================================================================
// SAMPLE DATA
// ============================================================================

// ✅ FIXED: Sample Users Data with fullName field
const sampleUsers = [
  {
    fullName: 'John Doe',
    email: 'john@example.com',
    password: 'password123',
    phone: '9876543210',
    isVerified: true,
    role: 'customer'
  },
  {
    fullName: 'Admin User',
    email: 'admin@example.com', 
    password: 'admin123',
    phone: '9876543211',
    isVerified: true,
    role: 'admin'
  },
  {
    fullName: 'Jane Smith',
    email: 'jane@example.com',
    password: 'password123',
    phone: '9876543212',
    isVerified: true,
    role: 'customer'
  },
  {
    fullName: 'Fashion Buyer',
    email: 'buyer@example.com',
    password: 'password123',
    phone: '9876543213',
    isVerified: true,
    role: 'customer'
  }
];

// ✅ Fallback categories if category.json not found
const fallbackCategories = [
  {
    name: 'Men',
    description: 'Trendy fashion for men including shirts, t-shirts, jeans, and accessories',
    image: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=500&auto=format&fit=crop',
    subcategory: ['T-Shirts', 'Shirts', 'Jeans', 'Trousers', 'Suits', 'Activewear'],
    isActive: true,
    displayOrder: 1
  },
  {
    name: 'Women',
    description: 'Beautiful collection of women\'s fashion and accessories',
    image: 'https://assets.ajio.com/medias/sys_master/root/20231016/L6FL/652c5051afa4cf41f5466bdf/-473Wx593H-466711316-blue-MODEL.jpg',
    subcategory: ['Dresses', 'Tops', 'Ethnic Wear', 'Western Wear', 'Activewear'],
    isActive: true,
    displayOrder: 2
  },
  {
    name: 'Kids',
    description: 'Fun and comfortable clothing for children',
    image: 'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=500&auto=format&fit=crop',
    subcategory: ['Boys Clothing', 'Girls Clothing', 'Infants', 'Toys', 'School Essentials'],
    isActive: true,
    displayOrder: 3
  },
  {
    name: 'Beauty',
    description: 'Premium beauty and personal care products',
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&auto=format&fit=crop',
    subcategory: ['Makeup', 'Skincare', 'Haircare', 'Fragrances', 'Personal Care'],
    isActive: true,
    displayOrder: 4
  }
];

// ============================================================================
// SEEDING FUNCTIONS
// ============================================================================

// ✅ Seed Users with duplicate prevention
const seedUsers = async () => {
  try {
    console.log('👥 Seeding users...');
    
    // Clear existing users
    await User.deleteMany({});
    console.log('🗑️  Cleared existing users');

    const hashedUsers = await Promise.all(
      sampleUsers.map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, 12)
      }))
    );

    const users = await User.insertMany(hashedUsers, { ordered: false });
    console.log(`✅ Created ${users.length} users`);
    return users;
  } catch (error) {
    if (error.code === 11000) {
      console.log('⚠️  Some users already exist, fetching existing users...');
      return await User.find({});
    }
    console.error('❌ Error seeding users:', error);
    throw error;
  }
};

// ✅ Seed Categories from JSON with duplicate prevention
const seedCategories = async () => {
  try {
    console.log('📂 Seeding categories...');
    
    // Clear existing categories
    await Category.deleteMany({});
    console.log('🗑️  Cleared existing categories');

    // Load categories from JSON file
    const categoryData = loadJSONFile('./category.json', fallbackCategories);

    const categories = [];
    for (let i = 0; i < categoryData.length; i++) {
      const categoryInfo = categoryData[i];
      
      try {
        // Check if category already exists
        const existingCategory = await Category.findOne({ name: categoryInfo.name });
        
        if (!existingCategory) {
          const categoryToInsert = {
            name: categoryInfo.name,
            description: categoryInfo.description || `${categoryInfo.name} collection`,
            image: categoryInfo.image || 'https://via.placeholder.com/500x300?text=Category+Image',
            subcategory: categoryInfo.subcategory || [],
            productId: categoryInfo.productId || [],
            isActive: categoryInfo.isActive !== undefined ? categoryInfo.isActive : true,
            displayOrder: categoryInfo.displayOrder || (i + 1),
            seoData: categoryInfo.seoData || {
              metaTitle: `${categoryInfo.name} Collection`,
              metaDescription: `Shop the latest ${categoryInfo.name.toLowerCase()} fashion`,
              keywords: [categoryInfo.name.toLowerCase(), 'fashion', 'clothing']
            }
          };
          
          const newCategory = await Category.create(categoryToInsert);
          categories.push(newCategory);
          console.log(`✅ Created category: ${categoryInfo.name}`);
        } else {
          categories.push(existingCategory);
          console.log(`⚠️  Category already exists: ${categoryInfo.name}`);
        }
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⚠️  Duplicate category skipped: ${categoryInfo.name}`);
          const existingCategory = await Category.findOne({ name: categoryInfo.name });
          if (existingCategory) categories.push(existingCategory);
        } else {
          console.error(`❌ Error creating category ${categoryInfo.name}:`, error.message);
        }
      }
    }

    console.log(`✅ Total categories: ${categories.length}`);
    return categories;
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    throw error;
  }
};

// ✅ Seed Products from JSON with smart category mapping
const seedProducts = async (categories) => {
  try {
    console.log('🛍️  Seeding products...');
    
    // Clear existing products
    await Product.deleteMany({});
    console.log('🗑️  Cleared existing products');

    // Load products from JSON file
    const productData = loadJSONFile('./product.json', []);

    if (productData.length === 0) {
      console.log('⚠️  No products found in product.json, creating fallback products...');
      return await createFallbackProducts(categories);
    }

    const products = [];
    for (let i = 0; i < productData.length; i++) {
      const product = productData[i];
      
      try {
        // Check if product already exists
        const existingProduct = await Product.findOne({ 
          name: product.name,
          brand: product.brand 
        });
        
        if (!existingProduct) {
          // ✅ SMART CATEGORY ASSIGNMENT: Match products to categories
          let categoryId;
          let matchedCategory = null;
          
          if (product.categoryName) {
            matchedCategory = categories.find(cat => 
              cat.name.toLowerCase().includes(product.categoryName.toLowerCase()) ||
              product.categoryName.toLowerCase().includes(cat.name.toLowerCase())
            );
          }
          
          categoryId = matchedCategory ? matchedCategory._id : categories[i % categories.length]._id;
          
          // ✅ ENHANCED: Map your JSON structure to model fields
          const productToInsert = {
            name: product.name,
            brand: product.brand,
            price: product.price,
            originalPrice: product.originalPrice || Math.round(product.price * 1.67), // Calculate original price
            discount: product.discount,
            description: product.description || `Premium ${product.name} from ${product.brand}. Perfect for everyday wear.`,
            images: product.images && product.images.length > 0 ? product.images : [
              'https://via.placeholder.com/800x600?text=Product+Image'
            ],
            categoryId,
            categoryName: product.categoryName,
            subcategory: product.subcategory,
            rating: product.rating || Math.round((Math.random() * 2 + 3) * 10) / 10, // 3.0-5.0
            ratingCount: product.ratingCount || Math.floor(Math.random() * 200) + 10,
            sizes: product.sizes || ['M', 'L', 'XL'],
            colors: product.colors || ['Black', 'White', 'Blue', 'Grey'],
            stock: product.stock !== undefined ? product.stock : Math.floor(Math.random() * 50) + 10,
            isActive: product.isActive !== undefined ? product.isActive : true,
            isFeatured: product.isFeatured !== undefined ? product.isFeatured : Math.random() > 0.7,
            isNewProduct: product.isNew !== undefined ? product.isNew : Math.random() > 0.8,
            isBestseller: product.isBestseller !== undefined ? product.isBestseller : Math.random() > 0.8,
            isOnSale: product.discount ? true : Math.random() > 0.6,
            searchTags: [
              product.categoryName, 
              product.subcategory, 
              product.brand, 
              'fashion', 
              'clothing',
              ...(product.sizes || []),
              ...(product.colors || [])
            ].filter(Boolean),
            
            // Auto-calculate discount percentage
            discountPercentage: product.discount ? 
              parseInt(product.discount.replace(/\D/g, '')) || 0 : 0,
              
            // Optional specifications
            specifications: product.specifications || {
              material: 'Premium Quality',
              care: 'Machine Wash',
              fit: 'Regular Fit',
              origin: 'India'
            },
            
            // SEO data
            seoData: {
              metaTitle: `${product.name} - ${product.brand}`,
              metaDescription: `Buy ${product.name} from ${product.brand}. ${product.description}`,
              keywords: [product.name, product.brand, product.categoryName, product.subcategory].filter(Boolean)
            }
          };
          
          const newProduct = await Product.create(productToInsert);
          products.push(newProduct);
          console.log(`✅ Created product: ${product.name}`);
        } else {
          products.push(existingProduct);
          console.log(`⚠️  Product already exists: ${product.name}`);
        }
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⚠️  Duplicate product skipped: ${product.name}`);
          const existingProduct = await Product.findOne({ 
            name: product.name,
            brand: product.brand 
          });
          if (existingProduct) products.push(existingProduct);
        } else {
          console.error(`❌ Error creating product ${product.name}:`, error.message);
          // Continue with next product instead of failing
        }
      }
    }

    console.log(`✅ Total products created: ${products.length}`);
    return products;
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    throw error;
  }
};

// ✅ Create fallback products if JSON not found
const createFallbackProducts = async (categories) => {
  const fallbackProducts = [
    {
      name: 'Classic Cotton T-Shirt',
      brand: 'StyleCraft',
      price: 899,
      categoryName: 'Men',
      subcategory: 'T-Shirts'
    },
    {
      name: 'Floral Summer Dress',
      brand: 'FloralFash',
      price: 1899,
      categoryName: 'Women',
      subcategory: 'Dresses'
    },
    {
      name: 'Kids Cotton Tee',
      brand: 'KidsWear',
      price: 599,
      categoryName: 'Kids',
      subcategory: 'T-Shirts'
    }
  ];

  const products = [];
  for (let i = 0; i < fallbackProducts.length; i++) {
    const product = fallbackProducts[i];
    const categoryId = categories[i % categories.length]._id;
    
    const productToInsert = {
      ...product,
      categoryId,
      originalPrice: Math.round(product.price * 1.5),
      description: `Premium ${product.name} from ${product.brand}`,
      images: ['https://via.placeholder.com/800x600?text=Product+Image'],
      rating: 4.0,
      ratingCount: 50,
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Black', 'White'],
      stock: 25,
      isActive: true,
      isFeatured: true,
      searchTags: [product.categoryName, product.subcategory, product.brand]
    };
    
    const newProduct = await Product.create(productToInsert);
    products.push(newProduct);
  }
  
  return products;
};

// ✅ Update category statistics after product creation
const updateCategoryStats = async (categories, products) => {
  try {
    console.log('📊 Updating category statistics...');
    
    for (const category of categories) {
      const categoryProducts = products.filter(p => 
        p.categoryId && p.categoryId.toString() === category._id.toString()
      );
      
      const activeProducts = categoryProducts.filter(p => p.isActive);
      const avgPrice = activeProducts.length > 0 ? 
        activeProducts.reduce((sum, p) => sum + p.price, 0) / activeProducts.length : 0;
      
      await Category.findByIdAndUpdate(category._id, {
        $set: {
          productCount: categoryProducts.length,
          activeProductCount: activeProducts.length,
          // Update productId array with actual product IDs
          productId: categoryProducts.map(p => p._id)
        }
      });
      
      console.log(`✅ Updated stats for ${category.name}: ${activeProducts.length} active products`);
    }
    
    console.log('✅ Category statistics updated successfully');
  } catch (error) {
    console.error('❌ Error updating category stats:', error);
    throw error;
  }
};

// ============================================================================
// MAIN SEEDING FUNCTION
// ============================================================================

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting comprehensive database seeding...\n');
    console.log('📁 Looking for JSON files: category.json and product.json\n');

    // Connect to database
    await connectDB();

    // Clear existing operational data (keep users and products/categories)
    console.log('🗑️  Clearing operational data...');
    await Promise.all([
      Order.deleteMany({}),
      Bag.deleteMany({}),
      Wishlist.deleteMany({})
    ]);
    console.log('✅ Cleared existing orders, bag items, and wishlists\n');

    // Seed data in order
    const users = await seedUsers();
    console.log('');
    
    const categories = await seedCategories();
    console.log('');
    
    const products = await seedProducts(categories);
    console.log('');
    
    // Update category statistics
    await updateCategoryStats(categories, products);
    console.log('');

    // Generate some sample operational data
    await generateSampleOperationalData(users, products);

    console.log('\n🎉 ================================================');
    console.log('✅ Database seeding completed successfully!');
    console.log('📊 Final Summary:');
    console.log(`   👥 Users: ${users.length}`);
    console.log(`   📂 Categories: ${categories.length}`);
    console.log(`   🛍️  Products: ${products.length}`);
    console.log(`   🏪 Total Items in Store: ${products.filter(p => p.isActive).length}`);
    console.log('🎉 ================================================\n');

    console.log('🔐 Test Accounts:');
    console.log('   👤 Customer: john@example.com / password123');
    console.log('   👤 Admin: admin@example.com / admin123');
    console.log('   👤 Customer 2: jane@example.com / password123');
    console.log('   👤 Fashion Buyer: buyer@example.com / password123\n');

    console.log('📁 Data Sources Used:');
    console.log('   📂 Categories: Loaded from category.json or fallback data');
    console.log('   🛍️  Products: Loaded from product.json or fallback data');
    console.log('   👥 Users: Generated sample data');
    console.log('   📊 Stats: Auto-calculated from products\n');

    console.log('🚀 Ready to start your e-commerce server!');
    console.log('   Run: node server.js\n');

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  } finally {
    mongoose.connection.close();
    console.log('📊 Database connection closed');
    process.exit(0);
  }
};

// ✅ Generate some sample operational data for testing
const generateSampleOperationalData = async (users, products) => {
  try {
    console.log('🎲 Generating sample operational data...');
    
    if (users.length === 0 || products.length === 0) {
      console.log('⚠️  Skipping operational data - no users or products');
      return;
    }

    const customer = users.find(u => u.role === 'customer');
    if (!customer) {
      console.log('⚠️  No customer found for operational data');
      return;
    }

    // Add some products to wishlist
    const sampleWishlistItems = products.slice(0, 3).map(product => ({
      userId: customer._id,
      productId: product._id,
      addedAt: new Date()
    }));

    if (sampleWishlistItems.length > 0) {
      await Wishlist.insertMany(sampleWishlistItems);
      console.log(`✅ Added ${sampleWishlistItems.length} items to sample wishlist`);
    }

    // Add some products to bag
    const sampleBagItems = products.slice(1, 3).map(product => ({
      userId: customer._id,
      productId: product._id,
      quantity: Math.floor(Math.random() * 3) + 1,
      addedAt: new Date()
    }));

    if (sampleBagItems.length > 0) {
      await Bag.insertMany(sampleBagItems);
      console.log(`✅ Added ${sampleBagItems.length} items to sample bag`);
    }

    console.log('✅ Sample operational data generated');
  } catch (error) {
    console.error('❌ Error generating operational data:', error);
    // Don't throw - this is optional
  }
};

// ============================================================================
// EXPORT AND EXECUTION
// ============================================================================

// ✅ Run seeding if called directly
if (require.main === module) {
  seedDatabase().catch(error => {
    console.error('💥 Fatal seeding error:', error);
    process.exit(1);
  });
}

module.exports = { 
  seedDatabase,
  loadJSONFile,
  seedUsers,
  seedCategories,
  seedProducts,
  updateCategoryStats
};
