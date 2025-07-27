const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Bag = require('../models/Bag');
const Product = require('../models/Product');

// ============================================================================
// ENHANCED ORDER ROUTES WITH COMPLETE CHECKOUT FLOW
// ============================================================================

// ✅ FIXED: Route ordering - most specific routes first

// ✅ ENHANCED: Create order from bag with comprehensive validation
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      shippingAddress,
      billingAddress,
      paymentMethod,
      paymentGateway = null,
      customerNotes = '',
      deliveryPreferences = {},
      promoCode = null,
      useWalletBalance = false
    } = req.body;

    console.log('📦 Creating order for user:', userId);

    // ✅ Validate required fields
    if (!userId || !shippingAddress || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'User ID, shipping address, and payment method are required'
      });
    }

    // ✅ Validate user ID format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // ✅ Get active bag items with product data
    const bagItems = await Bag.find({ userId, isActive: true })
      .populate({
        path: 'productId',
        match: { isActive: true }
      })
      .lean();

    // ✅ Filter valid items and check stock
    const validBagItems = bagItems.filter(item => item.productId);
    
    if (validBagItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items in bag to create order'
      });
    }

    // ✅ Validate stock availability for all items
    const stockErrors = [];
    for (const item of validBagItems) {
      if (item.productId.stock < item.quantity) {
        stockErrors.push({
          productName: item.productId.name,
          requested: item.quantity,
          available: item.productId.stock
        });
      }
    }

    if (stockErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some items are out of stock',
        stockErrors
      });
    }

    // ✅ Calculate order totals
    let subtotal = 0;
    let totalDiscount = 0;
    let totalQuantity = 0;

    validBagItems.forEach(item => {
      const itemTotal = item.productId.price * item.quantity;
      const originalPrice = item.priceWhenAdded || item.productId.price;
      const itemDiscount = item.quantity * Math.max(0, originalPrice - item.productId.price);
      
      subtotal += itemTotal;
      totalDiscount += itemDiscount;
      totalQuantity += item.quantity;
    });

    // ✅ Apply promo code discount (placeholder logic)
    let promoDiscount = 0;
    if (promoCode) {
      switch (promoCode.toUpperCase()) {
        case 'FIRST10':
          promoDiscount = Math.min(subtotal * 0.1, 500);
          break;
        case 'SAVE20':
          promoDiscount = Math.min(subtotal * 0.2, 1000);
          break;
        default:
          console.log('Invalid promo code:', promoCode);
          break;
      }
    }

    // ✅ Calculate final amounts
    const deliveryCharge = subtotal >= 999 ? 0 : 99;
    const taxAmount = Math.round((subtotal - totalDiscount - promoDiscount) * 0.18);
    const finalTotal = subtotal + deliveryCharge + taxAmount - totalDiscount - promoDiscount;

    // ✅ Generate unique order number and tracking ID
    const orderNumber = `ORD${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const trackingNumber = `TRK${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // ✅ Prepare order items with complete product snapshots
    const orderItems = validBagItems.map(item => ({
      productId: item.productId._id,
      productSnapshot: {
        name: item.productId.name,
        brand: item.productId.brand,
        price: item.productId.price,
        images: item.productId.images,
        category: item.productId.categoryName || 'Unknown'
      },
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      priceAtOrder: item.productId.price,
      totalPrice: item.productId.price * item.quantity
    }));

    // ✅ Create order with comprehensive data
    const newOrder = new Order({
      userId,
      orderNumber,
      trackingNumber,
      items: orderItems,
      
      // ✅ Pricing breakdown
      subtotal: Math.round(subtotal),
      discount: Math.round(totalDiscount),
      promoDiscount: Math.round(promoDiscount),
      promoCode: promoCode || null,
      deliveryCharge,
      tax: taxAmount,
      totalAmount: Math.round(finalTotal),
      
      // ✅ Address information
      shippingAddress: {
        ...shippingAddress,
        type: shippingAddress.type || 'home'
      },
      billingAddress: billingAddress || shippingAddress,
      
      // ✅ Payment information
      paymentMethod,
      paymentGateway,
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'processing',
      
      // ✅ Order status and timestamps
      status: 'confirmed',
      orderDate: new Date(),
      estimatedDelivery: new Date(Date.now() + (paymentMethod === 'cod' ? 5 : 3) * 24 * 60 * 60 * 1000),
      
      // ✅ Additional details
      customerNotes,
      deliveryPreferences: {
        timeSlot: deliveryPreferences.timeSlot || 'anytime',
        instructions: deliveryPreferences.instructions || '',
        requireSignature: deliveryPreferences.requireSignature || false,
        allowPartialDelivery: deliveryPreferences.allowPartialDelivery || false
      },
      
      // ✅ Analytics and tracking
      analytics: {
        sourceChannel: 'web',
        campaign: req.headers['utm-campaign'] || 'direct',
        referrer: req.headers.referer || 'direct',
        deviceInfo: req.headers['user-agent'] || 'unknown'
      }
    });

    // ✅ Save order
    const savedOrder = await newOrder.save();

    // ✅ Update product stock and purchase counts (in parallel)
    const stockUpdatePromises = validBagItems.map(item => 
      Product.findByIdAndUpdate(item.productId._id, {
        $inc: { 
          stock: -item.quantity,
          purchaseCount: item.quantity
        }
      })
    );

    await Promise.all(stockUpdatePromises);

    // ✅ Clear user's bag after successful order
    await Bag.deleteMany({ userId, isActive: true });

    console.log('✅ Order created successfully:', orderNumber, 'Total:', finalTotal);

    res.status(201).json({
      success: true,
      data: {
        _id: savedOrder._id,
        orderNumber,
        trackingNumber,
        status: savedOrder.status,
        totalAmount: Math.round(finalTotal),
        estimatedDelivery: savedOrder.estimatedDelivery,
        paymentMethod,
        paymentStatus: savedOrder.paymentStatus,
        itemCount: orderItems.length,
        totalQuantity
      },
      message: `Order ${orderNumber} created successfully`
    });

  } catch (error) {
    console.error('❌ Create Order Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
});

// ✅ ENHANCED: Get user orders with filtering and sorting - SPECIFIC ROUTE FIRST
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'newest',
      dateFrom,
      dateTo,
      minAmount,
      maxAmount
    } = req.query;

    console.log('📋 Getting orders for user:', userId);

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // ✅ Build filter conditions
    const filterConditions = { userId };

    if (status) {
      filterConditions.status = status;
    }

    if (dateFrom || dateTo) {
      filterConditions.orderDate = {};
      if (dateFrom) filterConditions.orderDate.$gte = new Date(dateFrom);
      if (dateTo) filterConditions.orderDate.$lte = new Date(dateTo);
    }

    if (minAmount !== undefined || maxAmount !== undefined) {
      filterConditions.totalAmount = {};
      if (minAmount !== undefined) filterConditions.totalAmount.$gte = parseFloat(minAmount);
      if (maxAmount !== undefined) filterConditions.totalAmount.$lte = parseFloat(maxAmount);
    }

    // ✅ Build sort options
    let sortOptions = {};
    switch (sortBy) {
      case 'oldest':
        sortOptions = { orderDate: 1 };
        break;
      case 'amount_high':
        sortOptions = { totalAmount: -1 };
        break;
      case 'amount_low':
        sortOptions = { totalAmount: 1 };
        break;
      case 'status':
        sortOptions = { status: 1, orderDate: -1 };
        break;
      case 'newest':
      default:
        sortOptions = { orderDate: -1 };
        break;
    }

    // ✅ Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [orders, totalCount] = await Promise.all([
      Order.find(filterConditions)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Order.countDocuments(filterConditions)
    ]);

    // ✅ Enhance orders with computed fields
    const enhancedOrders = orders.map(order => {
      const daysAgo = Math.floor((Date.now() - new Date(order.orderDate).getTime()) / (1000 * 60 * 60 * 24));
      const canCancel = ['confirmed', 'processing'].includes(order.status) && daysAgo < 1;
      const canReturn = order.status === 'delivered' && daysAgo <= 7;
      
      return {
        ...order,
        daysAgo,
        canCancel,
        canReturn,
        statusColor: getStatusColor(order.status),
        deliveryStatus: getDeliveryStatus(order)
      };
    });

    // ✅ Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    // ✅ Generate order statistics
    const stats = await Order.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' },
          averageOrderValue: { $avg: '$totalAmount' },
          statusBreakdown: {
            $push: '$status'
          }
        }
      }
    ]);

    const orderStats = stats.length > 0 ? {
      totalOrders: stats[0].totalOrders,
      totalSpent: Math.round(stats[0].totalSpent),
      averageOrderValue: Math.round(stats[0].averageOrderValue),
      statusBreakdown: getStatusBreakdown(stats[0].statusBreakdown)
    } : {
      totalOrders: 0,
      totalSpent: 0,
      averageOrderValue: 0,
      statusBreakdown: {}
    };

    console.log('✅ Found orders:', enhancedOrders.length);

    res.status(200).json({
      success: true,
      data: enhancedOrders,
      stats: orderStats,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalResults: totalCount,
        hasNextPage,
        hasPrevPage,
        resultsPerPage: parseInt(limit)
      },
      message: `Found ${enhancedOrders.length} orders`
    });

  } catch (error) {
    console.error('❌ Get User Orders Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// ✅ NEW: Track order with detailed status - MOVED BEFORE /:orderId
router.get('/track/:trackingNumber', async (req, res) => {
  try {
    const { trackingNumber } = req.params;

    console.log('📍 Tracking order:', trackingNumber);

    const order = await Order.findOne({ trackingNumber }).lean();
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found with this tracking number'
      });
    }

    // ✅ Generate detailed tracking information
    const trackingInfo = {
      trackingNumber: order.trackingNumber,
      orderNumber: order.orderNumber,
      status: order.status,
      currentLocation: getCurrentLocation(order),
      estimatedDelivery: order.estimatedDelivery,
      actualDelivery: order.deliveredAt || null,
      carrier: 'Express Delivery',
      trackingHistory: generateTrackingHistory(order),
      deliveryInstructions: order.deliveryPreferences?.instructions || '',
      contactInfo: {
        phone: '+91-1800-123-4567',
        email: 'support@yourstore.com'
      }
    };

    res.status(200).json({
      success: true,
      data: trackingInfo,
      message: `Tracking information for ${trackingNumber}`
    });

  } catch (error) {
    console.error('❌ Track Order Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track order',
      error: error.message
    });
  }
});

// ✅ ENHANCED: Cancel order with reason tracking - MOVED BEFORE /:orderId
router.post('/:orderId/cancel', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason = 'Customer requested cancellation', refundMethod = 'original' } = req.body;

    console.log('❌ Cancelling order:', orderId, 'Reason:', reason);

    if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // ✅ Check if order can be cancelled
    if (!['confirmed', 'processing'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${order.status}`
      });
    }

    // ✅ Update order status and add cancellation details
    order.status = 'cancelled';
    order.cancellationReason = reason;
    order.cancelledAt = new Date();
    order.refundMethod = refundMethod;
    order.refundStatus = 'pending';
    order.refundAmount = order.totalAmount;

    await order.save();

    // ✅ Restore product stock (in parallel)
    const stockRestorePromises = order.items.map(item => 
      Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity }
      })
    );

    await Promise.all(stockRestorePromises);

    console.log('✅ Order cancelled successfully:', order.orderNumber);

    res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        cancellationReason: reason,
        refundAmount: order.totalAmount,
        refundStatus: 'pending',
        processingTime: '3-5 business days'
      },
      message: `Order ${order.orderNumber} cancelled successfully`
    });

  } catch (error) {
    console.error('❌ Cancel Order Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message
    });
  }
});

// ✅ MOVED TO END: Get single order by ID (most generic route)
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log('📦 Getting order details:', orderId);

    if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    const order = await Order.findById(orderId).lean();
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // ✅ Enhance order with computed fields and tracking info
    const enhancedOrder = {
      ...order,
      daysAgo: Math.floor((Date.now() - new Date(order.orderDate).getTime()) / (1000 * 60 * 60 * 24)),
      canCancel: ['confirmed', 'processing'].includes(order.status),
      canReturn: order.status === 'delivered',
      statusColor: getStatusColor(order.status),
      deliveryStatus: getDeliveryStatus(order),
      trackingHistory: generateTrackingHistory(order)
    };

    res.status(200).json({
      success: true,
      data: enhancedOrder,
      message: 'Order details retrieved successfully'
    });

  } catch (error) {
    console.error('❌ Get Order Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: error.message
    });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// ✅ Get status color for UI
function getStatusColor(status) {
  const colors = {
    'confirmed': '#4caf50',
    'processing': '#ff9800',
    'shipped': '#2196f3',
    'delivered': '#4caf50',
    'cancelled': '#f44336',
    'returned': '#9c27b0'
  };
  return colors[status] || '#666';
}

// ✅ Get delivery status description
function getDeliveryStatus(order) {
  const now = new Date();
  const orderDate = new Date(order.orderDate);
  const estimatedDelivery = new Date(order.estimatedDelivery);
  
  switch (order.status) {
    case 'confirmed':
      return 'Order confirmed, preparing for shipment';
    case 'processing':
      return 'Order is being processed';
    case 'shipped':
      if (now > estimatedDelivery) {
        return 'Package is delayed, arriving soon';
      }
      return `Package is on the way, arriving by ${estimatedDelivery.toDateString()}`;
    case 'delivered':
      return `Delivered on ${order.deliveredAt?.toDateString() || 'Unknown date'}`;
    case 'cancelled':
      return 'Order has been cancelled';
    default:
      return 'Status unknown';
  }
}

// ✅ Generate status breakdown
function getStatusBreakdown(statusArray) {
  const breakdown = {};
  statusArray.forEach(status => {
    breakdown[status] = (breakdown[status] || 0) + 1;
  });
  return breakdown;
}

// ✅ Get current location for tracking
function getCurrentLocation(order) {
  switch (order.status) {
    case 'confirmed':
      return 'Warehouse - Order Processing';
    case 'processing':
      return 'Warehouse - Preparing Shipment';
    case 'shipped':
      return 'In Transit - Distribution Center';
    case 'delivered':
      return `Delivered - ${order.shippingAddress.city}`;
    case 'cancelled':
      return 'Order Cancelled';
    default:
      return 'Unknown';
  }
}

// ✅ Generate tracking history
function generateTrackingHistory(order) {
  const history = [];
  const orderDate = new Date(order.orderDate);
  
  history.push({
    status: 'Order Placed',
    location: 'Online Store',
    timestamp: orderDate,
    description: `Order ${order.orderNumber} has been placed successfully`
  });

  if (['processing', 'shipped', 'delivered'].includes(order.status)) {
    history.push({
      status: 'Order Confirmed',
      location: 'Warehouse',
      timestamp: new Date(orderDate.getTime() + 30 * 60 * 1000),
      description: 'Payment verified and order confirmed'
    });
  }

  if (['shipped', 'delivered'].includes(order.status)) {
    history.push({
      status: 'Shipped',
      location: 'Distribution Center',
      timestamp: new Date(orderDate.getTime() + 24 * 60 * 60 * 1000),
      description: 'Package dispatched from warehouse'
    });
  }

  if (order.status === 'delivered') {
    history.push({
      status: 'Delivered',
      location: order.shippingAddress.city,
      timestamp: order.deliveredAt || new Date(orderDate.getTime() + 3 * 24 * 60 * 60 * 1000),
      description: 'Package delivered successfully'
    });
  }

  return history;
}

module.exports = router;
