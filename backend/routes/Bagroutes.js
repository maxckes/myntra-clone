const express = require('express');
const router = express.Router();
const Bag = require('../models/Bag');
const Product = require('../models/Product');
const Wishlist = require('../models/Wishlist');

// ============================================================================
// ENHANCED BAG ROUTES WITH REAL-TIME SHOPPING CART
// ============================================================================

// ✅ ENHANCED: Get user's complete bag with detailed calculations
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { includeSaved = false, includeStats = false } = req.query;

    console.log('🛒 Getting bag for user:', userId);

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // ✅ Build filter conditions
    const filterConditions = { userId };
    if (includeSaved !== 'true') {
      filterConditions.isActive = true; // Only active items (not saved for later)
    }

    // ✅ Get bag items with populated product data
    const bagItems = await Bag.find(filterConditions)
      .populate({
        path: 'productId',
        match: { isActive: true }, // Only include active products
        populate: {
          path: 'category',
          select: 'name image'
        }
      })
      .sort({ addedAt: -1 }) // Newest first
      .lean();

    // ✅ Filter out items where product was deleted or inactive
    const validBagItems = bagItems.filter(item => item.productId);

    // ✅ Calculate comprehensive bag totals
    let subtotal = 0;
    let totalDiscount = 0;
    let totalItems = 0;
    let totalQuantity = 0;

    const enhancedItems = validBagItems.map(item => {
      const product = item.productId;
      const itemTotal = product.price * item.quantity;
      const originalPrice = item.priceWhenAdded || product.price;
      const itemDiscount = item.quantity * Math.max(0, originalPrice - product.price);

      subtotal += itemTotal;
      totalDiscount += itemDiscount;
      totalItems += 1;
      totalQuantity += item.quantity;

      return {
        ...item,
        itemTotal,
        originalItemPrice: originalPrice,
        discountAmount: itemDiscount,
        priceChanged: originalPrice !== product.price,
        priceDropped: originalPrice > product.price,
        inStock: product.stock >= item.quantity,
        maxAvailable: product.stock
      };
    });

    // ✅ Calculate delivery and tax
    const deliveryCharge = subtotal >= 999 ? 0 : 99; // Free delivery above ₹999
    const taxRate = 0.18; // 18% GST
    const taxAmount = Math.round(subtotal * taxRate);
    const finalTotal = subtotal + deliveryCharge + taxAmount - totalDiscount;

    // ✅ Generate bag statistics if requested
    let stats = null;
    if (includeStats === 'true') {
      const brands = [...new Set(enhancedItems.map(item => item.productId.brand))];
      const categories = [...new Set(enhancedItems.map(item => item.productId.categoryName))];
      
      stats = {
        totalItems,
        totalQuantity,
        uniqueBrands: brands.length,
        uniqueCategories: categories.length,
        averageItemPrice: totalItems > 0 ? Math.round(subtotal / totalQuantity) : 0,
        savedAmount: totalDiscount,
        itemsInStock: enhancedItems.filter(item => item.inStock).length,
        itemsOutOfStock: enhancedItems.filter(item => !item.inStock).length
      };
    }

    console.log('✅ Bag items found:', enhancedItems.length, 'Total:', finalTotal);

    res.status(200).json({
      success: true,
      data: enhancedItems,
      summary: {
        subtotal: Math.round(subtotal),
        discount: Math.round(totalDiscount),
        deliveryCharge,
        tax: taxAmount,
        total: Math.round(finalTotal),
        itemCount: totalItems,
        totalQuantity,
        savings: Math.round(totalDiscount),
        freeDeliveryEligible: subtotal >= 999,
        freeDeliveryRemaining: subtotal < 999 ? Math.round(999 - subtotal) : 0
      },
      stats,
      message: `Found ${enhancedItems.length} items in bag`
    });

  } catch (error) {
    console.error('❌ Get Bag Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bag',
      error: error.message
    });
  }
});

// ✅ NEW: Get bag summary only (for quick totals)
router.get('/:userId/summary', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('📊 Getting bag summary for user:', userId);

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // ✅ Get active bag items with basic product info
    const bagItems = await Bag.find({ userId, isActive: true })
      .populate('productId', 'price name images')
      .lean();

    // ✅ Filter valid items and calculate totals
    const validItems = bagItems.filter(item => item.productId);
    
    let subtotal = 0;
    let totalQuantity = 0;

    validItems.forEach(item => {
      subtotal += item.productId.price * item.quantity;
      totalQuantity += item.quantity;
    });

    const deliveryCharge = subtotal >= 999 ? 0 : 99;
    const taxAmount = Math.round(subtotal * 0.18);
    const total = subtotal + deliveryCharge + taxAmount;

    res.status(200).json({
      success: true,
      data: {
        itemCount: validItems.length,
        subtotal: Math.round(subtotal),
        discount: 0,
        shipping: deliveryCharge,
        tax: taxAmount,
        total: Math.round(total),
        savings: 0,
        items: validItems.map(item => ({
          _id: item._id,
          productName: item.productId.name,
          quantity: item.quantity,
          price: item.productId.price,
          image: item.productId.images?.[0]
        }))
      },
      message: `Bag summary: ${validItems.length} items, ₹${Math.round(total)} total`
    });

  } catch (error) {
    console.error('❌ Get Bag Summary Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bag summary',
      error: error.message
    });
  }
});

// ✅ ENHANCED: Add product to bag with comprehensive validation
router.post('/', async (req, res) => {
  try {
    const { userId, productId, quantity = 1, size, color } = req.body;

    console.log('🛒 Adding to bag:', { userId, productId, quantity, size, color });

    // ✅ Validate required fields
    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Product ID are required'
      });
    }

    // ✅ Validate quantity
    if (quantity < 1 || quantity > 10) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be between 1 and 10'
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

    // ✅ Check stock availability
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} units available in stock`,
        availableStock: product.stock
      });
    }

    // ✅ Validate size if product has sizes
    if (product.sizes && product.sizes.length > 0 && !size) {
      return res.status(400).json({
        success: false,
        message: 'Size selection is required for this product',
        availableSizes: product.sizes
      });
    }

    if (size && product.sizes && !product.sizes.includes(size)) {
      return res.status(400).json({
        success: false,
        message: 'Selected size is not available',
        availableSizes: product.sizes
      });
    }

    // ✅ Check if item already exists in bag with same specifications
    const existingItem = await Bag.findOne({
      userId,
      productId,
      ...(size && { size }),
      ...(color && { color }),
      isActive: true
    });

    if (existingItem) {
      // ✅ Update quantity if item exists
      const newQuantity = existingItem.quantity + quantity;
      
      if (newQuantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add ${quantity} more. Maximum ${product.stock - existingItem.quantity} can be added`,
          currentQuantity: existingItem.quantity,
          availableStock: product.stock
        });
      }

      existingItem.quantity = newQuantity;
      existingItem.updatedAt = new Date();
      const updatedItem = await existingItem.save();

      // ✅ Populate and return updated item
      const populatedItem = await Bag.findById(updatedItem._id)
        .populate({
          path: 'productId',
          populate: {
            path: 'category',
            select: 'name image'
          }
        });

      console.log('✅ Bag quantity updated:', product.name, 'New quantity:', newQuantity);

      return res.status(200).json({
        success: true,
        data: populatedItem,
        message: `Updated ${product.name} quantity to ${newQuantity}`
      });
    }

    // ✅ Create new bag item
    const newBagItem = new Bag({
      userId,
      productId,
      quantity,
      size,
      color,
      priceWhenAdded: product.price, // Store price at time of adding
      addedAt: new Date(),
      isActive: true
    });

    const savedItem = await newBagItem.save();

    // ✅ Populate the product data for response
    const populatedItem = await Bag.findById(savedItem._id)
      .populate({
        path: 'productId',
        populate: {
          path: 'category',
          select: 'name image'
        }
      });

    // ✅ Update product purchase count (fire and forget)
    Product.findByIdAndUpdate(productId, { 
      $inc: { purchaseCount: quantity } 
    }).exec();

    console.log('✅ Product added to bag:', product.name, 'Quantity:', quantity);

    res.status(201).json({
      success: true,
      data: populatedItem,
      message: `${product.name} added to bag`
    });

  } catch (error) {
    console.error('❌ Add to Bag Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add product to bag',
      error: error.message
    });
  }
});

// ✅ ENHANCED: Update bag item quantity with validation
router.put('/:id/quantity', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    console.log('🔄 Updating bag quantity:', id, 'New quantity:', quantity);

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bag item ID format'
      });
    }

    if (!quantity || quantity < 1 || quantity > 10) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be between 1 and 10'
      });
    }

    // ✅ Find bag item with product data
    const bagItem = await Bag.findById(id).populate('productId');
    if (!bagItem) {
      return res.status(404).json({
        success: false,
        message: 'Bag item not found'
      });
    }

    // ✅ Check stock availability
    if (bagItem.productId.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${bagItem.productId.stock} units available in stock`,
        availableStock: bagItem.productId.stock,
        currentQuantity: bagItem.quantity
      });
    }

    // ✅ Update quantity
    bagItem.quantity = quantity;
    bagItem.updatedAt = new Date();
    const updatedItem = await bagItem.save();

    // ✅ Populate complete data for response
    const populatedItem = await Bag.findById(updatedItem._id)
      .populate({
        path: 'productId',
        populate: {
          path: 'category',
          select: 'name image'
        }
      });

    console.log('✅ Bag quantity updated:', bagItem.productId.name, 'Quantity:', quantity);

    res.status(200).json({
      success: true,
      data: populatedItem,
      message: `Updated ${bagItem.productId.name} quantity to ${quantity}`
    });

  } catch (error) {
    console.error('❌ Update Bag Quantity Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bag quantity',
      error: error.message
    });
  }
});

// ✅ ENHANCED: Remove item from bag with product info
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Removing from bag:', id);

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bag item ID format'
      });
    }

    // ✅ Find and populate the item before deletion
    const bagItem = await Bag.findById(id).populate('productId', 'name brand _id');
    
    if (!bagItem) {
      return res.status(404).json({
        success: false,
        message: 'Bag item not found'
      });
    }

    // ✅ Delete the bag item
    await Bag.findByIdAndDelete(id);

    console.log('✅ Removed from bag:', bagItem.productId?.name || 'Unknown product');

    res.status(200).json({
      success: true,
      data: {
        removedItem: {
          _id: bagItem._id,
          productName: bagItem.productId?.name || 'Unknown product',
          productId: bagItem.productId?._id,
          quantity: bagItem.quantity
        }
      },
      message: `${bagItem.productId?.name || 'Product'} removed from bag`
    });

  } catch (error) {
    console.error('❌ Remove from Bag Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item from bag',
      error: error.message
    });
  }
});

// ✅ NEW: Move bag item to wishlist
router.post('/:id/move-to-wishlist', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    console.log('💝 Moving bag item to wishlist:', id);

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bag item ID format'
      });
    }

    // ✅ Find bag item
    const bagItem = await Bag.findById(id).populate('productId');
    if (!bagItem) {
      return res.status(404).json({
        success: false,
        message: 'Bag item not found'
      });
    }

    // ✅ Check if already in wishlist
    const existingWishlistItem = await Wishlist.findOne({
      userId: userId || bagItem.userId,
      productId: bagItem.productId._id
    });

    if (existingWishlistItem) {
      // ✅ Just remove from bag if already in wishlist
      await Bag.findByIdAndDelete(id);
      
      return res.status(200).json({
        success: true,
        message: `${bagItem.productId.name} was already in wishlist. Removed from bag.`
      });
    }

    // ✅ Create wishlist item
    const wishlistItem = new Wishlist({
      userId: userId || bagItem.userId,
      productId: bagItem.productId._id,
      priority: 'medium',
      originalPrice: bagItem.priceWhenAdded,
      addedAt: new Date()
    });

    await wishlistItem.save();

    // ✅ Remove from bag
    await Bag.findByIdAndDelete(id);

    // ✅ Update product counts
    Product.findByIdAndUpdate(bagItem.productId._id, { 
      $inc: { wishlistCount: 1 } 
    }).exec();

    console.log('✅ Moved to wishlist:', bagItem.productId.name);

    res.status(200).json({
      success: true,
      data: {
        movedItem: {
          productName: bagItem.productId.name,
          productId: bagItem.productId._id
        }
      },
      message: `${bagItem.productId.name} moved to wishlist`
    });

  } catch (error) {
    console.error('❌ Move to Wishlist Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to move item to wishlist',
      error: error.message
    });
  }
});

// ✅ NEW: Save bag item for later (move to saved items)
router.put('/:id/save', async (req, res) => {
  try {
    const { id } = req.params;

    const bagItem = await Bag.findByIdAndUpdate(
      id,
      { 
        isActive: false, // Mark as saved for later
        savedAt: new Date()
      },
      { new: true }
    ).populate('productId', 'name brand price images');

    if (!bagItem) {
      return res.status(404).json({
        success: false,
        message: 'Bag item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: bagItem,
      message: `${bagItem.productId.name} saved for later`
    });

  } catch (error) {
    console.error('❌ Save for Later Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save item for later',
      error: error.message
    });
  }
});

// ✅ NEW: Clear entire bag for user
router.delete('/user/:userId/clear', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const deletedCount = await Bag.deleteMany({ userId, isActive: true });

    res.status(200).json({
      success: true,
      data: {
        deletedCount: deletedCount.deletedCount
      },
      message: `Cleared ${deletedCount.deletedCount} items from bag`
    });

  } catch (error) {
    console.error('❌ Clear Bag Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear bag',
      error: error.message
    });
  }
});

module.exports = router;
