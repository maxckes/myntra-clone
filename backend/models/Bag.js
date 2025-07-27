const mongoose = require("mongoose");

// ============================================================================
// ENHANCED BAG/CART MODEL WITH PROFESSIONAL FEATURES
// ============================================================================

const BagItemSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true,
      index: true // For faster user-based queries
    },
    productId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Product",
      required: true,
      index: true // For faster product-based queries
    },
    // ✅ Enhanced size handling with validation
    size: {
      type: String,
      required: false,
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36', '38', '40', '42', 'Free Size'],
      default: 'M'
    },
    // ✅ Enhanced quantity with validation
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      max: [10, 'Quantity cannot exceed 10'],
      default: 1
    },
    // ✅ Additional professional fields
    color: {
      type: String,
      required: false,
      maxlength: 50
    },
    // ✅ Track price when added (for price change detection)
    priceWhenAdded: {
      type: Number,
      required: true,
      min: 0
    },
    // ✅ Track any applied discounts
    discountWhenAdded: {
      type: String,
      default: ''
    },
    // ✅ Save for later functionality
    savedForLater: {
      type: Boolean,
      default: false
    },
    // ✅ Track when item was moved to saved
    savedAt: {
      type: Date
    },
    // ✅ User preferences for this item
    preferences: {
      giftWrap: {
        type: Boolean,
        default: false
      },
      giftMessage: {
        type: String,
        maxlength: 200,
        default: ''
      }
    },
    // ✅ Track item source for analytics
    addedFrom: {
      type: String,
      enum: ['product_page', 'wishlist', 'home', 'category', 'search', 'recommendations'],
      default: 'product_page'
    }
  },
  { 
    timestamps: true,
    // ✅ Add indexes for better performance
    indexes: [
      { userId: 1, createdAt: -1 }, // User's bag items by newest
      { userId: 1, savedForLater: 1 }, // Separate saved items
      { productId: 1 }, // Product-based queries
      { userId: 1, productId: 1, size: 1, color: 1 } // Prevent duplicates
    ]
  }
);

// ✅ Prevent duplicate entries for same user-product-size-color combination
BagItemSchema.index(
  { userId: 1, productId: 1, size: 1, color: 1 }, 
  { 
    unique: true,
    partialFilterExpression: { savedForLater: { $ne: true } } // Allow duplicates in saved items
  }
);

// ✅ Virtual field for total price of this item
BagItemSchema.virtual('totalPrice').get(function() {
  return this.quantity * this.priceWhenAdded;
});

// ✅ Virtual field for days in bag
BagItemSchema.virtual('daysInBag').get(function() {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// ✅ Instance methods for better functionality
BagItemSchema.methods.toJSON = function() {
  const bagItem = this.toObject({ virtuals: true });
  
  // Add computed fields
  bagItem.isStale = this.daysInBag > 7; // Mark items older than 7 days
  bagItem.priceChanged = false; // Will be computed in route with current product price
  
  return bagItem;
};

// ✅ Instance method to update quantity safely
BagItemSchema.methods.updateQuantity = function(newQuantity) {
  if (newQuantity < 1 || newQuantity > 10) {
    throw new Error('Quantity must be between 1 and 10');
  }
  this.quantity = newQuantity;
  return this.save();
};

// ✅ Instance method to move to saved for later
BagItemSchema.methods.saveForLater = function() {
  this.savedForLater = true;
  this.savedAt = new Date();
  return this.save();
};

// ✅ Instance method to move back to bag
BagItemSchema.methods.moveToBag = function() {
  this.savedForLater = false;
  this.savedAt = null;
  return this.save();
};

// ✅ Static methods for common operations
BagItemSchema.statics.getUserBagCount = function(userId, includeSaved = false) {
  const query = { userId };
  if (!includeSaved) query.savedForLater = { $ne: true };
  
  return this.countDocuments(query);
};

BagItemSchema.statics.getUserBagTotal = async function(userId) {
  const pipeline = [
    { $match: { userId: mongoose.Types.ObjectId(userId), savedForLater: { $ne: true } } },
    { $group: { _id: null, total: { $sum: { $multiply: ['$quantity', '$priceWhenAdded'] } } } }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0]?.total || 0;
};

BagItemSchema.statics.getUserBagWithProducts = function(userId, options = {}) {
  const {
    includeSaved = false,
    limit = 50,
    skip = 0,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options;

  let query = { userId };
  if (!includeSaved) query.savedForLater = { $ne: true };

  return this.find(query)
    .populate({
      path: 'productId',
      select: 'name brand price discount images rating ratingCount stock colors sizes isNew isFeatured',
      match: { $ne: null } // Only populate if product exists
    })
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .lean();
};

BagItemSchema.statics.getSavedItems = function(userId, options = {}) {
  const {
    limit = 20,
    skip = 0,
    sortBy = 'savedAt',
    sortOrder = -1
  } = options;

  return this.find({ userId, savedForLater: true })
    .populate({
      path: 'productId',
      select: 'name brand price discount images rating ratingCount stock',
      match: { $ne: null }
    })
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .lean();
};

BagItemSchema.statics.findByUserAndProduct = function(userId, productId, size, color) {
  const query = { userId, productId, savedForLater: { $ne: true } };
  if (size) query.size = size;
  if (color) query.color = color;
  
  return this.findOne(query);
};

BagItemSchema.statics.clearUserBag = function(userId) {
  return this.deleteMany({ userId, savedForLater: { $ne: true } });
};

// ✅ Pre-save middleware for data validation and processing
BagItemSchema.pre('save', async function(next) {
  // Ensure priceWhenAdded is set
  if (!this.priceWhenAdded && this.productId) {
    // This will be handled in the route where we have access to product data
  }
  
  // Update savedAt when moving to saved
  if (this.savedForLater && !this.savedAt) {
    this.savedAt = new Date();
  }
  
  // Clear savedAt when moving back to bag
  if (!this.savedForLater && this.savedAt) {
    this.savedAt = null;
  }
  
  next();
});

// ✅ Pre-remove middleware for cleanup
BagItemSchema.pre('remove', function(next) {
  // Add any cleanup logic here if needed
  console.log(`Removing bag item: ${this._id} for user: ${this.userId}`);
  next();
});

// ✅ Post-save middleware for analytics tracking
BagItemSchema.post('save', function(doc) {
  // Track analytics events (can be expanded)
  if (this.isNew) {
    console.log(`Item added to bag: ${doc.productId} by user: ${doc.userId}`);
  }
});

module.exports = mongoose.model("Bag", BagItemSchema);
