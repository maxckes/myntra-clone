const mongoose = require("mongoose");

// ============================================================================
// ENHANCED WISHLIST MODEL WITH PROFESSIONAL FEATURES
// ============================================================================

const WishlistSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true,
      index: true // For faster queries
    },
    productId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Product",
      required: true,
      index: true // For faster queries
    },
    // ✅ Additional fields for better functionality
    addedAt: {
      type: Date,
      default: Date.now
    },
    // ✅ Track user preferences
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    // ✅ User notes for the wishlist item
    notes: {
      type: String,
      maxlength: 500,
      default: ''
    },
    // ✅ Track if user was notified about price drops
    priceAlertEnabled: {
      type: Boolean,
      default: false
    },
    // ✅ Track original price when added (for price drop alerts)
    originalPrice: {
      type: Number,
      min: 0
    }
  },
  { 
    timestamps: true,
    // ✅ Add indexes for better performance
    indexes: [
      { userId: 1, productId: 1 }, // Compound index for faster lookups
      { addedAt: -1 }, // For sorting by newest first
      { priority: 1 }
    ]
  }
);

// ✅ Prevent duplicate entries for same user-product combination
WishlistSchema.index({ userId: 1, productId: 1 }, { unique: true });

// ✅ Instance methods for better functionality
WishlistSchema.methods.toJSON = function() {
  const wishlistItem = this.toObject();
  // Add computed fields
  wishlistItem.daysInWishlist = Math.floor(
    (new Date() - this.addedAt) / (1000 * 60 * 60 * 24)
  );
  return wishlistItem;
};

// ✅ Static methods for common operations
WishlistSchema.statics.getUserWishlistCount = function(userId) {
  return this.countDocuments({ userId });
};

WishlistSchema.statics.findByUserAndProduct = function(userId, productId) {
  return this.findOne({ userId, productId });
};

WishlistSchema.statics.getUserWishlistWithProducts = function(userId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    sortBy = 'addedAt',
    sortOrder = -1,
    priority
  } = options;

  let query = { userId };
  if (priority) query.priority = priority;

  return this.find(query)
    .populate({
      path: 'productId',
      select: 'name brand price discount images rating ratingCount isNew isFeatured',
      match: { $ne: null } // Only populate if product exists
    })
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .lean();
};

// ✅ Pre-save middleware for data validation
WishlistSchema.pre('save', function(next) {
  // Set original price if not set
  if (!this.originalPrice && this.productId) {
    // This will be handled in the route where we have access to product data
  }
  next();
});

// ✅ Pre-remove middleware for cleanup
WishlistSchema.pre('remove', function(next) {
  // Add any cleanup logic here if needed
  next();
});

module.exports = mongoose.model("Wishlist", WishlistSchema);
