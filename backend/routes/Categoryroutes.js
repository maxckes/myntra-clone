const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Product = require('../models/Product');

// ✅ CONDITIONAL: Import SearchController only if it exists
let SearchController;
try {
  SearchController = require('../controllers/SearchController');
  console.log('✅ SearchController loaded for categories');
} catch (error) {
  console.log('⚠️  SearchController not found, using fallback for categories');
  SearchController = null;
}

// ============================================================================
// ENHANCED CATEGORY ROUTES WITH SEARCH INTEGRATION
// ============================================================================

// ✅ FIXED: Proper route ordering - most specific routes first

// ✅ NEW: Get categories with product filters - MOVED BEFORE /:id
router.get('/with-products', async (req, res) => {
  try {
    const {
      minPrice,
      maxPrice,
      brand,
      rating,
      limit = 20
    } = req.query;

    console.log('🔍 Getting categories with product filters:', req.query);

    // Build product filter conditions
    const productFilters = { isActive: true };
    if (minPrice !== undefined || maxPrice !== undefined) {
      productFilters.price = {};
      if (minPrice !== undefined) productFilters.price.$gte = parseFloat(minPrice);
      if (maxPrice !== undefined) productFilters.price.$lte = parseFloat(maxPrice);
    }
    if (brand) productFilters.brand = new RegExp(brand, 'i');
    if (rating) productFilters.rating = { $gte: parseFloat(rating) };

    // Get categories that have products matching the filters
    const categoriesWithFilteredProducts = await Category.aggregate([
      {
        $lookup: {
          from: 'products',
          let: { categoryId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$categoryId', '$$categoryId'] },
                ...productFilters
              }
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                avgPrice: { $avg: '$price' },
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' }
              }
            }
          ],
          as: 'filteredProductStats'
        }
      },
      {
        $match: {
          isActive: true,
          'filteredProductStats.0.count': { $gt: 0 }
        }
      },
      {
        $addFields: {
          filteredProductCount: { $arrayElemAt: ['$filteredProductStats.count', 0] },
          filteredAvgPrice: { $arrayElemAt: ['$filteredProductStats.avgPrice', 0] },
          filteredPriceRange: {
            min: { $arrayElemAt: ['$filteredProductStats.minPrice', 0] },
            max: { $arrayElemAt: ['$filteredProductStats.maxPrice', 0] }
          }
        }
      },
      {
        $project: {
          filteredProductStats: 0
        }
      },
      {
        $sort: { filteredProductCount: -1, name: 1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    res.status(200).json({
      success: true,
      data: categoriesWithFilteredProducts,
      appliedFilters: { minPrice, maxPrice, brand, rating },
      message: `Found ${categoriesWithFilteredProducts.length} categories with matching products`
    });

  } catch (error) {
    console.error('❌ Categories with Products Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories with product filters',
      error: error.message
    });
  }
});

// ✅ FIXED: Trending categories route - MOVED BEFORE /:id
router.get('/trending', async (req, res) => {
  try {
    const { limit = 10, timeframe = 'weekly' } = req.query;

    // ✅ SIMPLIFIED: Basic trending based on product count and activity
    const trendingCategories = await Category.aggregate([
      {
        $match: {
          isActive: true
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'categoryId',
          as: 'products'
        }
      },
      {
        $addFields: {
          activeProductCount: {
            $size: {
              $filter: {
                input: '$products',
                cond: { $eq: ['$$this.isActive', true] }
              }
            }
          },
          trendingScore: {
            $multiply: [
              { $size: '$products' },
              { $ifNull: ['$displayOrder', 1] }
            ]
          }
        }
      },
      {
        $match: {
          activeProductCount: { $gt: 0 }
        }
      },
      {
        $sort: { trendingScore: -1, activeProductCount: -1 }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $project: {
          _id: 1,
          name: 1,
          image: 1,
          activeProductCount: 1,
          trendingScore: 1,
          description: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: trendingCategories,
      message: `Found ${trendingCategories.length} trending categories`
    });

  } catch (error) {
    console.error('❌ Trending Categories Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trending categories',
      error: error.message
    });
  }
});

// ✅ NEW: Update all category statistics - MOVED BEFORE /:id
router.post('/update-all-stats', async (req, res) => {
  try {
    console.log('📊 Updating all category statistics...');

    const categories = await Category.find({ isActive: true });
    
    for (const category of categories) {
      const productCount = await Product.countDocuments({
        categoryId: category._id,
        isActive: true
      });
      
      await Category.findByIdAndUpdate(category._id, {
        $set: {
          productCount: productCount,
          activeProductCount: productCount
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'All category statistics updated successfully'
    });

  } catch (error) {
    console.error('❌ Batch Update Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update all category statistics',
      error: error.message
    });
  }
});

// ✅ FIXED: Get category hierarchy - MOVED BEFORE /:id
router.get('/:id/hierarchy', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format'
      });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // ✅ SIMPLIFIED: Basic hierarchy (no parent-child for now)
    const children = await Category.find({
      parentCategory: category._id,
      isActive: true
    })
    .sort({ displayOrder: 1, name: 1 })
    .select('_id name image');

    res.status(200).json({
      success: true,
      data: {
        current: {
          _id: category._id,
          name: category.name
        },
        parents: [], // ✅ SIMPLIFIED: No parents for now
        children,
        breadcrumb: [
          { _id: category._id, name: category.name }
        ]
      },
      message: 'Category hierarchy retrieved successfully'
    });

  } catch (error) {
    console.error('❌ Category Hierarchy Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get category hierarchy',
      error: error.message
    });
  }
});

// ✅ NEW: Update category statistics - MOVED BEFORE /:id
router.post('/:id/update-stats', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format'
      });
    }

    console.log('📊 Updating category statistics for:', id);

    const productCount = await Product.countDocuments({
      categoryId: id,
      isActive: true
    });

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      {
        $set: {
          productCount: productCount,
          activeProductCount: productCount
        }
      },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.status(200).json({
      success: true,
      data: updatedCategory,
      message: 'Category statistics updated successfully'
    });

  } catch (error) {
    console.error('❌ Update Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category statistics',
      error: error.message
    });
  }
});

// ✅ ENHANCED: Get all categories with advanced options
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      includeEmpty = false,
      onlyActive = true,
      sortBy = 'displayOrder',
      includeStats = false
    } = req.query;

    console.log('📂 Getting categories with options:', req.query);

    // ✅ SIMPLIFIED: Basic search if SearchController not available
    if (search && search.trim()) {
      const searchConditions = {
        $or: [
          { name: new RegExp(search, 'i') },
          { description: new RegExp(search, 'i') }
        ]
      };
      
      if (onlyActive === 'true') searchConditions.isActive = true;

      const searchResults = await Category.find(searchConditions)
        .sort({ name: 1 })
        .limit(parseInt(limit));

      return res.status(200).json({
        success: true,
        data: searchResults,
        message: `Found ${searchResults.length} categories for "${search}"`
      });
    }

    // ✅ SIMPLIFIED: Get categories with basic stats if requested
    if (includeStats === 'true') {
      const categoriesWithStats = await Category.aggregate([
        {
          $match: {
            ...(onlyActive === 'true' && { isActive: true })
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: 'categoryId',
            as: 'products'
          }
        },
        {
          $addFields: {
            productCount: { $size: '$products' },
            activeProductCount: {
              $size: {
                $filter: {
                  input: '$products',
                  cond: { $eq: ['$$this.isActive', true] }
                }
              }
            }
          }
        },
        {
          $project: {
            products: 0
          }
        },
        {
          $sort: { displayOrder: 1, name: 1 }
        },
        {
          $limit: limit === 'all' ? 1000 : parseInt(limit)
        }
      ]);

      return res.status(200).json({
        success: true,
        data: categoriesWithStats,
        message: `Found ${categoriesWithStats.length} categories with statistics`
      });
    }

    // ✅ Regular category fetch with filtering
    const filterConditions = {};
    if (onlyActive === 'true') filterConditions.isActive = true;

    // Build sort options
    let sortOptions = {};
    switch (sortBy) {
      case 'name':
        sortOptions = { name: 1 };
        break;
      case 'productCount':
        sortOptions = { productCount: -1, name: 1 };
        break;
      case 'displayOrder':
      default:
        sortOptions = { displayOrder: 1, name: 1 };
        break;
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitValue = limit === 'all' ? 0 : parseInt(limit);

    const [categories, totalCount] = await Promise.all([
      Category.find(filterConditions)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitValue)
        .lean(),
      Category.countDocuments(filterConditions)
    ]);

    // Calculate pagination info
    const totalPages = limitValue > 0 ? Math.ceil(totalCount / limitValue) : 1;
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    console.log('✅ Found categories:', categories.length);

    res.status(200).json({
      success: true,
      data: categories,
      pagination: limitValue > 0 ? {
        currentPage: parseInt(page),
        totalPages,
        totalResults: totalCount,
        hasNextPage,
        hasPrevPage,
        resultsPerPage: limitValue
      } : null,
      message: `Found ${totalCount} categories`
    });

  } catch (error) {
    console.error('❌ Get Categories Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

// ✅ MOVED TO END: Get single category by ID (most generic route)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { includeProducts = false, productLimit = 12 } = req.query;

    console.log('📂 Getting category:', id);

    // Find category (support both ObjectId and name)
    let category;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      category = await Category.findById(id);
    } else {
      category = await Category.findOne({
        name: new RegExp(`^${id}$`, 'i')
      });
    }

    if (!category || !category.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // ✅ FIXED: Get category statistics with updated field names
    const categoryStats = await Product.aggregate([
      {
        $match: {
          categoryId: category._id,
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          avgRating: { $avg: '$rating' },
          brands: { $addToSet: '$brand' },
          newArrivals: {
            $sum: { $cond: ['$isNewProduct', 1, 0] } // ✅ CHANGED: $isNew → $isNewProduct
          },
          onSale: {
            $sum: { $cond: ['$isOnSale', 1, 0] }
          }
        }
      }
    ]);

    const stats = categoryStats.length > 0 ? categoryStats[0] : {
      totalProducts: 0,
      avgPrice: 0,
      minPrice: 0,
      maxPrice: 0,
      avgRating: 0,
      brands: [],
      newArrivals: 0,
      onSale: 0
    };

    // ✅ FIXED: Include sample products with updated field names
    let sampleProducts = [];
    if (includeProducts === 'true') {
      sampleProducts = await Product.find({
        categoryId: category._id,
        isActive: true
      })
      .sort({ createdAt: -1, rating: -1 })
      .limit(parseInt(productLimit))
      .select('name brand price images rating isNewProduct isOnSale discount') // ✅ CHANGED: isNew → isNewProduct
      .lean();
    }

    console.log('✅ Category found with stats:', stats.totalProducts, 'products');

    res.status(200).json({
      success: true,
      data: {
        ...category.toObject(),
        statistics: {
          totalProducts: stats.totalProducts,
          averagePrice: Math.round(stats.avgPrice || 0),
          priceRange: {
            min: stats.minPrice || 0,
            max: stats.maxPrice || 0
          },
          averageRating: parseFloat((stats.avgRating || 0).toFixed(1)),
          brandsCount: stats.brands.length,
          newArrivals: stats.newArrivals,
          onSale: stats.onSale
        },
        ...(includeProducts === 'true' && { sampleProducts })
      },
      message: 'Category retrieved successfully'
    });

  } catch (error) {
    console.error('❌ Get Category Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: error.message
    });
  }
});

module.exports = router;
