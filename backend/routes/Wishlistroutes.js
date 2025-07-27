const express = require('express');
const router = express.Router();
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');

// ============================================================================
// ENHANCED WISHLIST ROUTES WITH REAL-TIME OPERATIONS
// ============================================================================

// ✅ FIXED: Route ordering - most specific routes first

// ✅ ENHANCED: Add product to wishlist with smart defaults
router.post('/', async (req, res) => {
  try {
    const { userId, productId, priority = 'medium', notes = '', priceAlertEnabled = false } = req.body;

    console.log('💝 Adding to wishlist:', { userId, productId, priority });

    // ✅ Validate required fields
    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Product ID are required'
      });
    }

    // ✅ Validate ObjectId formats
    if (!userId.match(/^[0-9a-fA-F]{24}$/) || !productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    // ✅ Check if product exists and is active
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or inactive'
      });
    }

    // ✅ Check if already in wishlist
    const existingItem = await Wishlist.findOne({ userId, productId });
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'Product already in wishlist',
        data: existingItem
      });
    }

    // ✅ Create new wishlist item with enhanced data
    const newWishlistItem = new Wishlist({
      userId,
      productId,
      priority,
      notes,
      priceAlertEnabled,
      originalPrice: product.price, // Store current price for price tracking
      addedAt: new Date()
    });

    const savedItem = await newWishlistItem.save();

    // ✅ Populate the product data for response
    const populatedItem = await Wishlist.findById(savedItem._id)
      .populate({
        path: 'productId',
        populate: {
          path: 'categoryId', // ✅ FIXED: Use categoryId instead of category
          select: 'name image'
        }
      });

    // ✅ Update product wishlist count (fire and forget)
    Product.findByIdAndUpdate(productId, { 
      $inc: { wishlistCount: 1 } 
    }).exec();

    console.log('✅ Product added to wishlist:', product.name);

    res.status(201).json({
      success: true,
      data: populatedItem,
      message: `${product.name} added to wishlist`
    });

  } catch (error) {
    console.error('❌ Add to Wishlist Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add product to wishlist',
      error: error.message
    });
  }
});

// ✅ NEW: Check if product is in user's wishlist - MOVED BEFORE /:userId
router.get('/check/:userId/:productId', async (req, res) => {
  try {
    const { userId, productId } = req.params;

    console.log('🔍 Checking wishlist status:', { userId, productId });

    if (!userId.match(/^[0-9a-fA-F]{24}$/) || !productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    const wishlistItem = await Wishlist.findOne({ userId, productId });
    
    res.status(200).json({
      success: true,
      data: {
        isInWishlist: !!wishlistItem,
        wishlistItemId: wishlistItem?._id || null,
        priority: wishlistItem?.priority || null,
        addedAt: wishlistItem?.addedAt || null,
        priceAlertEnabled: wishlistItem?.priceAlertEnabled || false
      },
      message: wishlistItem ? 'Product is in wishlist' : 'Product not in wishlist'
    });

  } catch (error) {
    console.error('❌ Check Wishlist Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check wishlist status',
      error: error.message
    });
  }
});

// ✅ NEW: Clear entire wishlist for user - MOVED BEFORE /:userId
router.delete('/user/:userId/clear', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const deletedCount = await Wishlist.deleteMany({ userId });

    res.status(200).json({
      success: true,
      data: {
        deletedCount: deletedCount.deletedCount
      },
      message: `Cleared ${deletedCount.deletedCount} items from wishlist`
    });

  } catch (error) {
    console.error('❌ Clear Wishlist Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear wishlist',
      error: error.message
    });
  }
});

// ✅ NEW: Update wishlist item priority - MOVED BEFORE /:id
router.put('/:id/priority', async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wishlist item ID format'
      });
    }

    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Priority must be low, medium, or high'
      });
    }

    const updatedItem = await Wishlist.findByIdAndUpdate(
      id,
      { priority },
      { new: true }
    ).populate('productId', 'name brand price images');

    if (!updatedItem) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: updatedItem,
      message: 'Wishlist priority updated successfully'
    });

  } catch (error) {
    console.error('❌ Update Priority Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update wishlist priority',
      error: error.message
    });
  }
});

// ✅ NEW: Toggle price alert for wishlist item - MOVED BEFORE /:id
router.put('/:id/price-alert', async (req, res) => {
  try {
    const { id } = req.params;
    const { priceAlertEnabled } = req.body;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wishlist item ID format'
      });
    }

    const updatedItem = await Wishlist.findByIdAndUpdate(
      id,
      { priceAlertEnabled: !!priceAlertEnabled },
      { new: true }
    ).populate('productId', 'name brand price images');

    if (!updatedItem) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: updatedItem,
      message: `Price alert ${priceAlertEnabled ? 'enabled' : 'disabled'} for ${updatedItem.productId.name}`
    });

  } catch (error) {
    console.error('❌ Toggle Price Alert Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle price alert',
      error: error.message
    });
  }
});

// ✅ ENHANCED: Remove from wishlist with product info - MOVED BEFORE /:userId
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('💔 Removing from wishlist:', id);

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wishlist item ID format'
      });
    }

    // ✅ Find and populate the item before deletion
    const wishlistItem = await Wishlist.findById(id).populate('productId', 'name brand _id');
    
    if (!wishlistItem) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist item not found'
      });
    }

    // ✅ Delete the wishlist item
    await Wishlist.findByIdAndDelete(id);

    // ✅ Update product wishlist count (fire and forget)
    if (wishlistItem.productId) {
      Product.findByIdAndUpdate(wishlistItem.productId._id, { 
        $inc: { wishlistCount: -1 } 
      }).exec();
    }

    console.log('✅ Removed from wishlist:', wishlistItem.productId?.name || 'Unknown product');

    res.status(200).json({
      success: true,
      data: {
        removedItem: {
          _id: wishlistItem._id,
          productName: wishlistItem.productId?.name || 'Unknown product',
          productId: wishlistItem.productId?._id
        }
      },
      message: `${wishlistItem.productId?.name || 'Product'} removed from wishlist`
    });

  } catch (error) {
    console.error('❌ Remove from Wishlist Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove product from wishlist',
      error: error.message
    });
  }
});

// ✅ MOVED TO END: Get user's complete wishlist - MOST GENERIC ROUTE LAST
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      page = 1, 
      limit = 20,
      sortBy = 'newest',
      includeStats = false 
    } = req.query;

    console.log('💝 Getting wishlist for user:', userId);

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // ✅ Build sort options
    let sortOptions = {};
    switch (sortBy) {
      case 'oldest':
        sortOptions = { addedAt: 1 };
        break;
      case 'price_low':
        sortOptions = { 'productId.price': 1 };
        break;
      case 'price_high':
        sortOptions = { 'productId.price': -1 };
        break;
      case 'priority':
        sortOptions = { priority: -1, addedAt: -1 };
        break;
      case 'newest':
      default:
        sortOptions = { addedAt: -1 };
        break;
    }

    // ✅ Execute wishlist query with populated product data
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [wishlistItems, totalCount] = await Promise.all([
      Wishlist.find({ userId })
        .populate({
          path: 'productId',
          match: { isActive: true }, // Only include active products
          populate: {
            path: 'categoryId', // ✅ FIXED: Use categoryId instead of category
            select: 'name image'
          }
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Wishlist.countDocuments({ userId })
    ]);

    // ✅ Filter out items where product was deleted or inactive
    const validWishlistItems = wishlistItems.filter(item => item.productId);

    // ✅ Add computed fields to each wishlist item
    const enhancedItems = validWishlistItems.map(item => {
      const daysInWishlist = Math.floor(
        (Date.now() - new Date(item.addedAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        ...item,
        daysInWishlist,
        originalPrice: item.originalPrice || item.productId.price,
        priceChanged: item.originalPrice && item.originalPrice !== item.productId.price,
        priceDrop: item.originalPrice && item.originalPrice > item.productId.price ? 
          item.originalPrice - item.productId.price : 0
      };
    });

    // ✅ Generate wishlist statistics if requested
    let stats = null;
    if (includeStats === 'true' && enhancedItems.length > 0) {
      const productPrices = enhancedItems.map(item => item.productId.price);
      const brands = [...new Set(enhancedItems.map(item => item.productId.brand))];
      
      stats = {
        totalItems: enhancedItems.length,
        totalValue: productPrices.reduce((sum, price) => sum + price, 0),
        averagePrice: Math.round(productPrices.reduce((sum, price) => sum + price, 0) / productPrices.length),
        uniqueBrands: brands.length,
        priceAlertsEnabled: enhancedItems.filter(item => item.priceAlertEnabled).length,
        priorityBreakdown: {
          high: enhancedItems.filter(item => item.priority === 'high').length,
          medium: enhancedItems.filter(item => item.priority === 'medium').length,
          low: enhancedItems.filter(item => item.priority === 'low').length
        },
        oldestItem: enhancedItems.length > 0 ? 
          Math.max(...enhancedItems.map(item => item.daysInWishlist)) : 0
      };
    }

    // ✅ Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    console.log('✅ Wishlist items found:', enhancedItems.length);

    res.status(200).json({
      success: true,
      data: enhancedItems,
      stats,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalResults: totalCount,
        hasNextPage,
        hasPrevPage,
        resultsPerPage: parseInt(limit)
      },
      message: `Found ${enhancedItems.length} items in wishlist`
    });

  } catch (error) {
    console.error('❌ Get Wishlist Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wishlist',
      error: error.message
    });
  }
});

module.exports = router;
