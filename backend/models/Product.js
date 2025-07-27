const mongoose = require('mongoose');

// ============================================================================
// SIMPLIFIED PRODUCT SCHEMA - ALIGNED WITH YOUR DATA STRUCTURE
// ============================================================================

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters'],
    index: true
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true,
    maxlength: [100, 'Brand name cannot exceed 100 characters'],
    index: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
    index: true
  },
  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative']
  },
  discount: {
    type: String,
    default: null,
    match: [/^\d+%$/, 'Discount must be in format like "20%"']
  },
  description: {
    type: String,
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
    default: ''
  },
  images: [{
    type: String,
    required: true
  }],
  
  // ✅ FIXED: Use categoryId to match your updated Category model
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required'],
    index: true
  },
  categoryName: {
    type: String,
    default: '',
    index: true
  },
  subcategory: {
    type: String,
    default: '',
    index: true
  },
  
  rating: {
    type: Number,
    min: [0, 'Rating cannot be less than 0'],
    max: [5, 'Rating cannot be more than 5'],
    default: 0,
    index: true
  },
  ratingCount: {
    type: Number,
    min: [0, 'Rating count cannot be negative'],
    default: 0
  },
  
  // ✅ FLEXIBLE: Support various size formats
  sizes: [{
    type: String
    // Removed enum to be flexible with your JSON data
  }],
  colors: [{
    type: String
  }],
  
  // ✅ SEARCH: Enhanced fields for search and filtering
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  searchTags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
  // ✅ ANALYTICS: Performance tracking
  viewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  purchaseCount: {
    type: Number,
    default: 0,
    min: 0
  },
  wishlistCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // ✅ INVENTORY: Stock and status fields
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // ✅ FIXED: Renamed from isNew to avoid mongoose reserved keyword warning
  isNewProduct: {
    type: Boolean,
    default: false,
    index: true
  },
  isFeatured: {
    type: Boolean,
    default: false,
    index: true
  },
  isBestseller: {
    type: Boolean,
    default: false,
    index: true
  },
  isOnSale: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // ✅ OPTIONAL: SEO fields (minimal)
  seoData: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  },
  
  // ✅ CALCULATED: Discount percentage (auto-calculated)
  discountPercentage: {
    type: Number,
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100'],
    default: 0
  },
  
  // ✅ OPTIONAL: Product specifications (flexible object)
  specifications: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  suppressReservedKeysWarning: true, // ✅ Suppress mongoose warnings
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================================================
// ESSENTIAL INDEXES FOR SEARCH OPTIMIZATION
// ============================================================================

// ✅ Basic compound indexes for common queries
productSchema.index({ categoryId: 1, isActive: 1 });
productSchema.index({ categoryId: 1, price: 1 });
productSchema.index({ brand: 1, isActive: 1 });
productSchema.index({ price: 1, isActive: 1 });
productSchema.index({ rating: -1, isActive: 1 });
productSchema.index({ isActive: 1, stock: 1 });
productSchema.index({ isFeatured: 1, isActive: 1 });
productSchema.index({ isNewProduct: 1, isActive: 1 });
productSchema.index({ isOnSale: 1, isActive: 1 });

// ✅ TEXT INDEX for full-text search
productSchema.index({
  name: 'text',
  brand: 'text',
  description: 'text',
  categoryName: 'text',
  subcategory: 'text',
  searchTags: 'text'
}, {
  weights: {
    name: 10,
    brand: 8,
    categoryName: 6,
    searchTags: 5,
    subcategory: 3,
    description: 1
  },
  name: 'product_search_index'
});

// ============================================================================
// VIRTUAL FIELDS (SIMPLIFIED)
// ============================================================================

// ✅ Virtual for checking if product is in stock
productSchema.virtual('inStock').get(function() {
  return this.stock > 0;
});

// ✅ Virtual for discount amount calculation
productSchema.virtual('discountAmount').get(function() {
  if (this.originalPrice && this.price) {
    return this.originalPrice - this.price;
  }
  return 0;
});

// ✅ Virtual for final price (considering discounts)
productSchema.virtual('finalPrice').get(function() {
  return this.price;
});

// ✅ Virtual for formatted price display
productSchema.virtual('priceDisplay').get(function() {
  return `₹${this.price.toLocaleString('en-IN')}`;
});

// ============================================================================
// MIDDLEWARE (SIMPLIFIED)
// ============================================================================

// ✅ Pre-save middleware for auto-calculations
productSchema.pre('save', function(next) {
  // Calculate discount percentage if original price is set
  if (this.originalPrice && this.price && this.originalPrice > this.price) {
    this.discountPercentage = Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
    this.isOnSale = true;
    
    // Auto-generate discount string if not provided
    if (!this.discount) {
      this.discount = `${this.discountPercentage}%`;
    }
  } else {
    this.discountPercentage = 0;
    this.isOnSale = false;
  }
  
  // Auto-populate categoryName from category if not set
  if (this.categoryId && !this.categoryName && this.populated('categoryId')) {
    this.categoryName = this.categoryId.name;
  }
  
  next();
});

// ============================================================================
// STATIC METHODS (SIMPLIFIED)
// ============================================================================

// ✅ Search products with filters
productSchema.statics.searchProducts = function(query, filters = {}) {
  const {
    page = 1,
    limit = 20,
    sort = 'relevance',
    minPrice,
    maxPrice,
    category,
    brand,
    rating,
    inStock,
    isNewProduct,
    isFeatured,
    isBestseller,
    isOnSale
  } = filters;

  // Build match conditions
  const matchConditions = { isActive: true };
  
  // Text search
  if (query && query.trim()) {
    matchConditions.$text = { $search: query };
  }
  
  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    matchConditions.price = {};
    if (minPrice !== undefined) matchConditions.price.$gte = minPrice;
    if (maxPrice !== undefined) matchConditions.price.$lte = maxPrice;
  }
  
  // Category filter
  if (category) {
    if (mongoose.Types.ObjectId.isValid(category)) {
      matchConditions.categoryId = category;
    } else {
      matchConditions.categoryName = new RegExp(category, 'i');
    }
  }
  
  // Other filters
  if (brand) matchConditions.brand = new RegExp(brand, 'i');
  if (rating) matchConditions.rating = { $gte: rating };
  if (inStock) matchConditions.stock = { $gt: 0 };
  if (isNewProduct) matchConditions.isNewProduct = true;
  if (isFeatured) matchConditions.isFeatured = true;
  if (isBestseller) matchConditions.isBestseller = true;
  if (isOnSale) matchConditions.isOnSale = true;

  // Build sort options
  let sortOptions = {};
  switch (sort) {
    case 'price_low':
      sortOptions = { price: 1 };
      break;
    case 'price_high':
      sortOptions = { price: -1 };
      break;
    case 'rating':
      sortOptions = { rating: -1, ratingCount: -1 };
      break;
    case 'newest':
      sortOptions = { createdAt: -1 };
      break;
    case 'popular':
      sortOptions = { purchaseCount: -1, rating: -1 };
      break;
    case 'name':
      sortOptions = { name: 1 };
      break;
    case 'relevance':
    default:
      if (query && query.trim()) {
        sortOptions = { score: { $meta: 'textScore' }, rating: -1 };
      } else {
        sortOptions = { createdAt: -1 };
      }
      break;
  }

  // Execute query
  const skip = (page - 1) * limit;
  
  let queryBuilder = this.find(matchConditions);
  
  // Add text score for relevance sorting
  if (query && query.trim() && sort === 'relevance') {
    queryBuilder = queryBuilder.select({ score: { $meta: 'textScore' } });
  }
  
  return queryBuilder
    .populate('categoryId', 'name image')
    .sort(sortOptions)
    .skip(skip)
    .limit(limit);
};

// ✅ Get products by category
productSchema.statics.getByCategory = function(categoryId, options = {}) {
  const { limit = 20, sortBy = 'createdAt', onlyActive = true } = options;
  
  const matchConditions = { categoryId };
  if (onlyActive) matchConditions.isActive = true;
  
  const sortOptions = {};
  switch (sortBy) {
    case 'price':
      sortOptions.price = 1;
      break;
    case 'rating':
      sortOptions.rating = -1;
      break;
    case 'popular':
      sortOptions.purchaseCount = -1;
      break;
    default:
      sortOptions.createdAt = -1;
  }
  
  return this.find(matchConditions)
    .populate('categoryId', 'name')
    .sort(sortOptions)
    .limit(limit);
};

// ✅ Get featured products
productSchema.statics.getFeatured = function(limit = 10) {
  return this.find({
    isActive: true,
    isFeatured: true,
    stock: { $gt: 0 }
  })
  .populate('categoryId', 'name')
  .sort({ createdAt: -1 })
  .limit(limit);
};

// ✅ Get new products
productSchema.statics.getNewProducts = function(limit = 10) {
  return this.find({
    isActive: true,
    isNewProduct: true,
    stock: { $gt: 0 }
  })
  .populate('categoryId', 'name')
  .sort({ createdAt: -1 })
  .limit(limit);
};

// ✅ Get products on sale
productSchema.statics.getOnSale = function(limit = 10) {
  return this.find({
    isActive: true,
    isOnSale: true,
    stock: { $gt: 0 }
  })
  .populate('categoryId', 'name')
  .sort({ discountPercentage: -1 })
  .limit(limit);
};

// ============================================================================
// EXPORT MODEL
// ============================================================================

module.exports = mongoose.model('Product', productSchema);
