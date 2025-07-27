const mongoose = require('mongoose');

// ============================================================================
// SIMPLIFIED CATEGORY SCHEMA - NO SLUG, OPTIMIZED FOR YOUR DATA
// ============================================================================

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters'],
    index: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  image: {
    type: String,
    required: [true, 'Category image is required']
  },
  
  // ✅ MATCHES YOUR JSON: subcategory array
  subcategory: [{
    type: String,
    trim: true,
    maxlength: [50, 'Subcategory name cannot exceed 50 characters']
  }],
  
  // ✅ MATCHES YOUR JSON: productId array (for tracking products)
  productId: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  
  // ✅ SIMPLIFIED: Essential fields only
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  displayOrder: {
    type: Number,
    default: 0,
    index: true
  },
  
  // ✅ SIMPLIFIED: Basic statistics (auto-calculated)
  productCount: {
    type: Number,
    default: 0,
    min: 0
  },
  activeProductCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // ✅ OPTIONAL: SEO fields (minimal)
  seoData: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  }
}, {
  timestamps: true,
  suppressReservedKeysWarning: true, // ✅ Suppress mongoose warnings
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================================================
// ESSENTIAL INDEXES ONLY
// ============================================================================

// ✅ Basic indexes for common queries
categorySchema.index({ isActive: 1, displayOrder: 1 });
categorySchema.index({ name: 1, isActive: 1 });
categorySchema.index({ productCount: -1, isActive: 1 });

// ✅ Text search index for category names
categorySchema.index({
  name: 'text',
  description: 'text',
  'subcategory': 'text'
}, {
  weights: {
    name: 10,
    subcategory: 5,
    description: 1
  },
  name: 'category_search_index'
});

// ============================================================================
// VIRTUAL FIELDS (SIMPLIFIED)
// ============================================================================

// ✅ Virtual for getting products in this category
categorySchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'categoryId' // ✅ Matches your product schema
});

// ✅ Virtual for category URL (simple)
categorySchema.virtual('url').get(function() {
  return `/category/${this._id}`;
});

// ✅ Virtual for checking if category has products
categorySchema.virtual('hasProducts').get(function() {
  return this.activeProductCount > 0;
});

// ============================================================================
// MIDDLEWARE (MINIMAL)
// ============================================================================

// ✅ Pre-save middleware - update timestamps only
categorySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// ============================================================================
// STATIC METHODS (SIMPLIFIED)
// ============================================================================

// ✅ Get all active categories with basic stats
categorySchema.statics.getActiveCategories = function(options = {}) {
  const {
    includeStats = false,
    sortBy = 'displayOrder',
    limit = null
  } = options;

  let query = this.find({ isActive: true });

  // Add product count if stats requested
  if (includeStats) {
    query = query.populate({
      path: 'products',
      match: { isActive: true },
      select: '_id price',
      options: { limit: 1 } // Just to check if products exist
    });
  }

  // Sorting
  switch (sortBy) {
    case 'name':
      query = query.sort({ name: 1 });
      break;
    case 'productCount':
      query = query.sort({ productCount: -1, name: 1 });
      break;
    case 'displayOrder':
    default:
      query = query.sort({ displayOrder: 1, name: 1 });
      break;
  }

  if (limit) {
    query = query.limit(limit);
  }

  return query;
};

// ✅ Search categories by name or subcategory
categorySchema.statics.searchCategories = function(searchQuery, options = {}) {
  const { onlyActive = true } = options;

  const matchConditions = {};
  if (onlyActive) matchConditions.isActive = true;

  if (searchQuery && searchQuery.trim()) {
    matchConditions.$or = [
      { name: { $regex: searchQuery, $options: 'i' } },
      { subcategory: { $in: [new RegExp(searchQuery, 'i')] } },
      { description: { $regex: searchQuery, $options: 'i' } }
    ];
  }

  return this.find(matchConditions).sort({ name: 1 });
};

// ✅ Update category product counts
categorySchema.statics.updateProductCounts = async function() {
  try {
    const Product = mongoose.model('Product');
    
    // Get product counts for each category
    const productCounts = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$categoryId',
          activeCount: { $sum: 1 }
        }
      }
    ]);

    // Update each category
    const updatePromises = productCounts.map(({ _id, activeCount }) => {
      return this.findByIdAndUpdate(_id, {
        $set: {
          activeProductCount: activeCount,
          productCount: activeCount
        }
      });
    });

    await Promise.all(updatePromises);
    
    // Reset counts for categories with no products
    await this.updateMany(
      { _id: { $nin: productCounts.map(p => p._id) } },
      { $set: { activeProductCount: 0, productCount: 0 } }
    );

    console.log('✅ Category product counts updated');
  } catch (error) {
    console.error('❌ Error updating category product counts:', error);
  }
};

// ============================================================================
// EXPORT MODEL
// ============================================================================

module.exports = mongoose.model('Category', categorySchema);
