const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');

// ✅ CONDITIONAL: Import SearchController only if it exists
let SearchController;
try {
  SearchController = require('../controllers/SearchController');
  console.log('✅ SearchController loaded');
} catch (error) {
  console.log('⚠️  SearchController not found, using fallback search');
  SearchController = null;
}

// ============================================================================
// ENHANCED PRODUCT ROUTES WITH ADVANCED SEARCH
// ============================================================================

// ✅ FIXED: Most specific routes first, proper route ordering

// ✅ NEW: Search suggestions endpoint - MOVED BEFORE /search
router.get('/search/suggestions', async (req, res) => {
  if (SearchController) {
    return SearchController.getSearchSuggestions(req, res);
  }
  
  // ✅ FALLBACK: Simple suggestions
  try {
    const brands = await Product.distinct('brand', { isActive: true });
    const categories = await Category.find({ isActive: true }, 'name');
    
    res.json({
      success: true,
      data: {
        brands: brands.slice(0, 10),
        categories: categories.slice(0, 10)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get suggestions',
      error: error.message
    });
  }
});

// ✅ NEW: Advanced search endpoint - AFTER /search/suggestions
router.get('/search', async (req, res) => {
  if (SearchController) {
    return SearchController.searchProducts(req, res);
  }
  
  // ✅ FALLBACK: Simple search if SearchController doesn't exist
  try {
    const { q, category, page = 1, limit = 20 } = req.query;
    
    const filterConditions = { isActive: true };
    
    if (q && q.trim()) {
      filterConditions.$or = [
        { name: new RegExp(q, 'i') },
        { brand: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') }
      ];
    }
    
    if (category) {
      // ✅ FIXED: Use categoryId instead of category
      if (category.match(/^[0-9a-fA-F]{24}$/)) {
        filterConditions.categoryId = category;
      } else {
        const categoryDoc = await Category.findOne({ 
          name: new RegExp(category, 'i') 
        });
        if (categoryDoc) {
          filterConditions.categoryId = categoryDoc._id;
        }
      }
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const products = await Product.find(filterConditions)
      .populate('categoryId', 'name')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: products,
      message: `Found ${products.length} products`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message
    });
  }
});

// ✅ NEW: Popular products endpoint
router.get('/popular', async (req, res) => {
  if (SearchController) {
    return SearchController.getPopularProducts(req, res);
  }
  
  // ✅ FALLBACK: Get popular products
  try {
    const { limit = 10 } = req.query;
    
    const products = await Product.find({ isActive: true, isFeatured: true })
      .populate('categoryId', 'name')
      .sort({ rating: -1, ratingCount: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      data: products,
      message: `Found ${products.length} popular products`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get popular products',
      error: error.message
    });
  }
});

// ✅ NEW: Featured products endpoint
router.get('/featured', async (req, res) => {
  if (SearchController) {
    return SearchController.getFeaturedProducts(req, res);
  }
  
  // ✅ FALLBACK: Get featured products
  try {
    const { limit = 8 } = req.query;
    
    const products = await Product.find({ 
      isActive: true, 
      isFeatured: true 
    })
    .populate('categoryId', 'name')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));
    
    res.json({
      success: true,
      data: products,
      message: `Found ${products.length} featured products`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get featured products',
      error: error.message
    });
  }
});

// ✅ FIXED: Get products by category - MOVED BEFORE /:id to avoid conflicts
router.get('/category/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const {
      page = 1,
      limit = 20,
      sort = 'popularity',
      order = 'desc',
      search,
      brand,
      minPrice,
      maxPrice,
      rating,
      inStock
    } = req.query;

    console.log('📂 Getting products for category:', categoryId);

    // ✅ Find category first (support both ObjectId and name)
    let category;
    if (categoryId.match(/^[0-9a-fA-F]{24}$/)) {
      category = await Category.findById(categoryId);
    } else {
      category = await Category.findOne({ 
        name: new RegExp(categoryId, 'i')
      });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // ✅ Build filter conditions - FIXED: Use categoryId
    const filterConditions = {
      categoryId: category._id,
      isActive: true
    };

    // Search filter
    if (search && search.trim()) {
      filterConditions.$or = [
        { name: new RegExp(search, 'i') },
        { brand: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    // Brand filter
    if (brand) {
      filterConditions.brand = new RegExp(brand, 'i');
    }

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      filterConditions.price = {};
      if (minPrice !== undefined) filterConditions.price.$gte = parseFloat(minPrice);
      if (maxPrice !== undefined) filterConditions.price.$lte = parseFloat(maxPrice);
    }

    // Rating filter
    if (rating) {
      filterConditions.rating = { $gte: parseFloat(rating) };
    }

    // Stock filter
    if (inStock === 'true') {
      filterConditions.stock = { $gt: 0 };
    }

    // ✅ Build sort options
    const sortOptions = {};
    switch (sort) {
      case 'price':
        sortOptions.price = order === 'desc' ? -1 : 1;
        break;
      case 'rating':
        sortOptions.rating = -1;
        sortOptions.ratingCount = -1;
        break;
      case 'name':
        sortOptions.name = 1;
        break;
      case 'newest':
        sortOptions.createdAt = -1;
        break;
      case 'popularity':
      default:
        sortOptions.createdAt = -1;
        break;
    }

    // ✅ Execute query
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [products, totalCount] = await Promise.all([
      Product.find(filterConditions)
        .populate('categoryId', 'name image')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(filterConditions)
    ]);

    console.log('✅ Found category products:', products.length);

    res.status(200).json({
      success: true,
      data: products,
      category: {
        _id: category._id,
        name: category.name,
        image: category.image,
        description: category.description
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalResults: totalCount,
        hasNextPage: parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1,
        resultsPerPage: parseInt(limit)
      },
      message: `Found ${totalCount} products in ${category.name}`
    });

  } catch (error) {
    console.error('❌ Get Category Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category products',
      error: error.message
    });
  }
});

// ✅ NEW: Get recommended products - MOVED BEFORE /:id to avoid conflicts
router.get('/:id/recommendations', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 6 } = req.query;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // ✅ Find similar products based on category and brand - FIXED: Use categoryId
    const recommendations = await Product.find({
      _id: { $ne: id },
      $or: [
        { categoryId: product.categoryId },
        { brand: product.brand }
      ],
      isActive: true
    })
    .sort({ createdAt: -1, rating: -1 })
    .limit(parseInt(limit))
    .populate('categoryId', 'name');

    res.status(200).json({
      success: true,
      data: recommendations,
      message: `Found ${recommendations.length} recommendations`
    });

  } catch (error) {
    console.error('❌ Recommendations Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recommendations',
      error: error.message
    });
  }
});

// ✅ ENHANCED: Get all products with advanced filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = 'createdAt',
      order = 'desc',
      category,
      brand,
      minPrice,
      maxPrice,
      rating,
      inStock,
      isNew,
      isFeatured,
      isBestseller,
      isOnSale,
      search
    } = req.query;

    console.log('📦 Getting products with filters:', req.query);

    // ✅ If search query exists and SearchController available, use it
    if (search && search.trim() && SearchController) {
      return SearchController.searchProducts(req, res);
    }

    // ✅ Build filter conditions
    const filterConditions = {
      isActive: true // Only show active products
    };

    // Search filter (fallback)
    if (search && search.trim()) {
      filterConditions.$or = [
        { name: new RegExp(search, 'i') },
        { brand: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    // Category filter - FIXED: Use categoryId
    if (category) {
      if (category.match(/^[0-9a-fA-F]{24}$/)) {
        filterConditions.categoryId = category;
      } else {
        // Find category by name first
        const categoryDoc = await Category.findOne({ name: new RegExp(category, 'i') });
        if (categoryDoc) {
          filterConditions.categoryId = categoryDoc._id;
        }
      }
    }

    // Brand filter
    if (brand) {
      if (typeof brand === 'string') {
        filterConditions.brand = new RegExp(brand, 'i');
      } else if (Array.isArray(brand)) {
        filterConditions.brand = { $in: brand.map(b => new RegExp(b, 'i')) };
      }
    }

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      filterConditions.price = {};
      if (minPrice !== undefined) filterConditions.price.$gte = parseFloat(minPrice);
      if (maxPrice !== undefined) filterConditions.price.$lte = parseFloat(maxPrice);
    }

    // Rating filter
    if (rating) {
      filterConditions.rating = { $gte: parseFloat(rating) };
    }

    // Stock filter
    if (inStock === 'true') {
      filterConditions.stock = { $gt: 0 };
    }

    // ✅ FIXED: Status filters - Updated isNew to isNewProduct
    if (isNew === 'true') filterConditions.isNewProduct = true; // ✅ CHANGED: isNew → isNewProduct
    if (isFeatured === 'true') filterConditions.isFeatured = true;
    if (isBestseller === 'true') filterConditions.isBestseller = true;
    if (isOnSale === 'true') filterConditions.isOnSale = true;

    console.log('🔍 Filter conditions:', filterConditions);

    // ✅ Build sort options
    const sortOptions = {};
    switch (sort) {
      case 'price':
        sortOptions.price = order === 'desc' ? -1 : 1;
        break;
      case 'rating':
        sortOptions.rating = order === 'desc' ? -1 : 1;
        sortOptions.ratingCount = -1;
        break;
      case 'name':
        sortOptions.name = order === 'desc' ? -1 : 1;
        break;
      case 'createdAt':
      default:
        sortOptions.createdAt = order === 'desc' ? -1 : 1;
        break;
    }

    // ✅ Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [products, totalCount] = await Promise.all([
      Product.find(filterConditions)
        .populate('categoryId', 'name image')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(filterConditions)
    ]);

    // ✅ Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    console.log('✅ Found products:', products.length);

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalResults: totalCount,
        hasNextPage,
        hasPrevPage,
        resultsPerPage: parseInt(limit)
      },
      message: `Found ${totalCount} products`
    });

  } catch (error) {
    console.error('❌ Get Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
});

// ✅ MOVED TO END: Get single product by ID (most generic route)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    const product = await Product.findById(id).populate('categoryId');

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    console.log('👁 Product viewed:', product.name);

    res.status(200).json({
      success: true,
      data: product,
      message: 'Product retrieved successfully'
    });

  } catch (error) {
    console.error('❌ Get Product Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: error.message
    });
  }
});

module.exports = router;
