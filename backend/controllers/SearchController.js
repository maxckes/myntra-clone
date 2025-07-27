const Product = require('../models/Product');
const Category = require('../models/Category');

// ============================================================================
// ADVANCED SEARCH CONTROLLER WITH PROFESSIONAL ALGORITHMS
// ============================================================================

class SearchController {
  
  // ✅ MAIN SEARCH FUNCTION - Advanced search with relevance scoring
  static async searchProducts(req, res) {
    try {
      const {
        q: query = '',
        page = 1,
        limit = 20,
        sort = 'relevance',
        category,
        brand,
        minPrice,
        maxPrice,
        rating,
        discount,
        inStock,
        isNew,
        isFeatured,
        isBestseller,
        isOnSale,
        colors,
        sizes
      } = req.query;

      console.log('🔍 Search Query:', query);
      console.log('🔧 Filters:', req.query);

      // ✅ Build search filters object
      const filters = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        ...(category && { category }),
        ...(brand && { brand }),
        ...(minPrice && { minPrice: parseFloat(minPrice) }),
        ...(maxPrice && { maxPrice: parseFloat(maxPrice) }),
        ...(rating && { rating: parseFloat(rating) }),
        ...(discount && { discount: parseInt(discount) }),
        ...(inStock !== undefined && { inStock: inStock === 'true' }),
        ...(isNew !== undefined && { isNew: isNew === 'true' }),
        ...(isFeatured !== undefined && { isFeatured: isFeatured === 'true' }),
        ...(isBestseller !== undefined && { isBestseller: isBestseller === 'true' }),
        ...(isOnSale !== undefined && { isOnSale: isOnSale === 'true' }),
        ...(colors && { colors: colors.split(',') }),
        ...(sizes && { sizes: sizes.split(',') })
      };

      // ✅ UPDATED: Build MongoDB query conditions
      const searchConditions = { isActive: true };

      // Add text search if query exists
      if (query.trim()) {
        searchConditions.$or = [
          { name: { $regex: query.trim(), $options: 'i' } },
          { brand: { $regex: query.trim(), $options: 'i' } },
          { description: { $regex: query.trim(), $options: 'i' } },
          { searchTags: { $in: [new RegExp(query.trim(), 'i')] } }
        ];
      }

      // Add category filter
      if (filters.category) {
        if (filters.category.match(/^[0-9a-fA-F]{24}$/)) {
          searchConditions.categoryId = filters.category;
        } else {
          // Find category by name first
          const categoryDoc = await Category.findOne({ 
            name: new RegExp(filters.category, 'i') 
          });
          if (categoryDoc) {
            searchConditions.categoryId = categoryDoc._id;
          }
        }
      }

      // Add brand filter
      if (filters.brand) {
        searchConditions.brand = new RegExp(filters.brand, 'i');
      }

      // Add price range filter
      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        searchConditions.price = {};
        if (filters.minPrice !== undefined) searchConditions.price.$gte = filters.minPrice;
        if (filters.maxPrice !== undefined) searchConditions.price.$lte = filters.maxPrice;
      }

      // Add rating filter
      if (filters.rating) {
        searchConditions.rating = { $gte: filters.rating };
      }

      // Add stock filter
      if (filters.inStock) {
        searchConditions.stock = { $gt: 0 };
      }

      // ✅ FIXED: Updated status filters to use correct field names
      if (filters.isNew) searchConditions.isNewProduct = true; // ✅ CHANGED: isNew → isNewProduct
      if (filters.isFeatured) searchConditions.isFeatured = true;
      if (filters.isBestseller) searchConditions.isBestseller = true;
      if (filters.isOnSale) searchConditions.isOnSale = true;

      // Add color filter
      if (filters.colors && filters.colors.length > 0) {
        searchConditions.colors = { $in: filters.colors };
      }

      // Add size filter
      if (filters.sizes && filters.sizes.length > 0) {
        searchConditions.sizes = { $in: filters.sizes };
      }

      console.log('🔍 Search Conditions:', searchConditions);

      // ✅ UPDATED: Build sort options
      let sortOptions = {};
      switch (filters.sort) {
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
          sortOptions = { ratingCount: -1, rating: -1 };
          break;
        case 'name':
          sortOptions = { name: 1 };
          break;
        case 'relevance':
        default:
          if (query.trim()) {
            // For text search, sort by relevance (can be enhanced with scoring)
            sortOptions = { rating: -1, ratingCount: -1, createdAt: -1 };
          } else {
            sortOptions = { createdAt: -1 };
          }
          break;
      }

      // ✅ UPDATED: Execute search query
      const skip = (filters.page - 1) * filters.limit;
      
      const [products, total] = await Promise.all([
        Product.find(searchConditions)
          .populate('categoryId', 'name image')
          .sort(sortOptions)
          .skip(skip)
          .limit(filters.limit)
          .lean(),
        Product.countDocuments(searchConditions)
      ]);

      console.log('✅ Found products:', products.length, 'Total:', total);

      // ✅ Calculate pagination info
      const totalPages = Math.ceil(total / filters.limit);
      const hasNextPage = filters.page < totalPages;
      const hasPrevPage = filters.page > 1;

      // ✅ Get available filter options for frontend
      const filterOptions = await SearchController.getFilterOptions(query, category);

      // ✅ Track search analytics
      if (query.trim()) {
        await SearchController.trackSearch(query, total, req.user?.id);
      }

      res.status(200).json({
        success: true,
        data: {
          products,
          pagination: {
            currentPage: filters.page,
            totalPages,
            totalResults: total,
            hasNextPage,
            hasPrevPage,
            resultsPerPage: filters.limit
          },
          filters: filterOptions,
          searchQuery: query,
          appliedFilters: filters
        },
        message: `Found ${total} products${query ? ` for "${query}"` : ''}`
      });

    } catch (error) {
      console.error('❌ Search Error:', error);
      res.status(500).json({
        success: false,
        message: 'Search failed',
        error: error.message
      });
    }
  }

  // ✅ GET SEARCH SUGGESTIONS - Auto-complete functionality
  static async getSearchSuggestions(req, res) {
    try {
      const { q: query = '', limit = 10 } = req.query;

      if (!query || query.length < 2) {
        return res.status(200).json({
          success: true,
          data: {
            suggestions: [],
            trending: await SearchController.getTrendingSearches()
          }
        });
      }

      console.log('💡 Getting suggestions for:', query);

      const suggestions = [];
      
      // ✅ Product name suggestions
      const productSuggestions = await Product.aggregate([
        {
          $match: {
            $and: [
              { isActive: true },
              {
                $or: [
                  { name: { $regex: query, $options: 'i' } },
                  { brand: { $regex: query, $options: 'i' } },
                  { searchTags: { $regex: query, $options: 'i' } }
                ]
              }
            ]
          }
        },
        {
          $addFields: {
            relevanceScore: {
              $add: [
                { $cond: [{ $regexMatch: { input: '$name', regex: new RegExp(`^${query}`, 'i') } }, 10, 0] },
                { $cond: [{ $regexMatch: { input: '$name', regex: new RegExp(query, 'i') } }, 5, 0] },
                { $cond: [{ $regexMatch: { input: '$brand', regex: new RegExp(`^${query}`, 'i') } }, 8, 0] },
                { $cond: [{ $regexMatch: { input: '$brand', regex: new RegExp(query, 'i') } }, 3, 0] }
              ]
            }
          }
        },
        { $sort: { relevanceScore: -1, rating: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 1,
            name: 1,
            brand: 1,
            price: 1,
            images: { $arrayElemAt: ['$images', 0] },
            type: { $literal: 'product' }
          }
        }
      ]);

      suggestions.push(...productSuggestions);

      // ✅ Brand suggestions
      const brandSuggestions = await Product.aggregate([
        {
          $match: {
            isActive: true,
            brand: { $regex: query, $options: 'i' }
          }
        },
        {
          $group: {
            _id: '$brand',
            count: { $sum: 1 },
            avgPrice: { $avg: '$price' },
            image: { $first: { $arrayElemAt: ['$images', 0] } }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 3 },
        {
          $project: {
            _id: 0,
            text: '$_id',
            count: 1,
            avgPrice: { $round: '$avgPrice' },
            image: 1,
            type: { $literal: 'brand' }
          }
        }
      ]);

      suggestions.push(...brandSuggestions);

      // ✅ Category suggestions
      const categorySuggestions = await Category.aggregate([
        {
          $match: {
            isActive: true,
            name: { $regex: query, $options: 'i' }
          }
        },
        { $sort: { productCount: -1 } },
        { $limit: 3 },
        {
          $project: {
            _id: 1,
            text: '$name',
            count: '$productCount',
            image: 1,
            type: { $literal: 'category' }
          }
        }
      ]);

      suggestions.push(...categorySuggestions);

      // ✅ Sort all suggestions by relevance
      const finalSuggestions = suggestions
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .slice(0, parseInt(limit));

      res.status(200).json({
        success: true,
        data: {
          suggestions: finalSuggestions,
          query,
          trending: suggestions.length === 0 ? await SearchController.getTrendingSearches() : []
        }
      });

    } catch (error) {
      console.error('❌ Suggestions Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get suggestions',
        error: error.message
      });
    }
  }

  // ✅ GET FILTER OPTIONS - Dynamic filter options based on search results
  static async getFilterOptions(query = '', category = null) {
    try {
      const matchConditions = { isActive: true };
      
      // Add text search condition if query exists
      if (query && query.trim()) {
        matchConditions.$or = [
          { name: { $regex: query.trim(), $options: 'i' } },
          { brand: { $regex: query.trim(), $options: 'i' } },
          { description: { $regex: query.trim(), $options: 'i' } }
        ];
      }
      
      // Add category filter if specified
      if (category) {
        if (category.match(/^[0-9a-fA-F]{24}$/)) {
          matchConditions.categoryId = category;
        } else {
          const categoryDoc = await Category.findOne({ 
            name: new RegExp(category, 'i') 
          });
          if (categoryDoc) {
            matchConditions.categoryId = categoryDoc._id;
          }
        }
      }

      const filterOptions = await Product.aggregate([
        { $match: matchConditions },
        {
          $group: {
            _id: null,
            brands: { $addToSet: '$brand' },
            colors: { $addToSet: { $arrayElemAt: ['$colors', 0] } },
            sizes: { $addToSet: { $arrayElemAt: ['$sizes', 0] } },
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' },
            avgRating: { $avg: '$rating' },
            totalProducts: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            brands: { $filter: { input: '$brands', cond: { $ne: ['$$this', null] } } },
            colors: { $filter: { input: '$colors', cond: { $ne: ['$$this', null] } } },
            sizes: { $filter: { input: '$sizes', cond: { $ne: ['$$this', null] } } },
            priceRange: { min: '$minPrice', max: '$maxPrice' },
            avgRating: { $round: ['$avgRating', 1] },
            totalProducts: 1
          }
        }
      ]);

      // ✅ Get categories separately
      const categories = await Category.find({ isActive: true })
        .select('_id name productCount')
        .sort({ name: 1 })
        .lean();

      const result = filterOptions.length > 0 ? filterOptions[0] : {
        brands: [],
        colors: [],
        sizes: [],
        priceRange: { min: 0, max: 50000 },
        avgRating: 0,
        totalProducts: 0
      };

      result.categories = categories;

      return result;

    } catch (error) {
      console.error('❌ Filter Options Error:', error);
      return {
        brands: [],
        categories: [],
        colors: [],
        sizes: [],
        priceRange: { min: 0, max: 50000 },
        avgRating: 0,
        totalProducts: 0
      };
    }
  }

  // ✅ GET TRENDING SEARCHES - Popular search terms
  static async getTrendingSearches(limit = 10) {
    try {
      // This would typically come from a search analytics collection
      // For now, return some static trending searches based on categories
      const trending = await Category.aggregate([
        { $match: { isActive: true, productCount: { $gt: 0 } } },
        { $sort: { productCount: -1 } },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            text: '$name',
            count: '$productCount',
            type: { $literal: 'category' }
          }
        }
      ]);

      return trending;
    } catch (error) {
      console.error('❌ Trending Searches Error:', error);
      return [];
    }
  }

  // ✅ TRACK SEARCH ANALYTICS - Track search queries for analytics
  static async trackSearch(query, resultCount, userId = null) {
    try {
      // This would typically save to a SearchAnalytics collection
      // For now, we'll just log it
      console.log('📊 Search Analytics:', {
        query,
        resultCount,
        userId,
        timestamp: new Date()
      });

      // Update product view counts for searched terms (simplified)
      if (resultCount > 0) {
        await Product.updateMany(
          {
            $or: [
              { name: { $regex: query, $options: 'i' } },
              { brand: { $regex: query, $options: 'i' } }
            ],
            isActive: true
          },
          {
            $inc: { viewCount: 1 }
          }
        );
      }

    } catch (error) {
      console.error('❌ Search Tracking Error:', error);
    }
  }

  // ✅ GET POPULAR PRODUCTS - Most viewed/purchased products
  static async getPopularProducts(req, res) {
    try {
      const { 
        category,
        limit = 20,
        timeframe = 'all' // daily, weekly, monthly, all
      } = req.query;

      const matchConditions = { isActive: true };
      if (category) {
        if (category.match(/^[0-9a-fA-F]{24}$/)) {
          matchConditions.categoryId = category;
        } else {
          const categoryDoc = await Category.findOne({ 
            name: new RegExp(category, 'i') 
          });
          if (categoryDoc) {
            matchConditions.categoryId = categoryDoc._id;
          }
        }
      }

      const products = await Product.find(matchConditions)
        .populate('categoryId', 'name image')
        .sort({ 
          rating: -1, 
          ratingCount: -1, 
          purchaseCount: -1,
          viewCount: -1 
        })
        .limit(parseInt(limit))
        .lean();

      res.status(200).json({
        success: true,
        data: products,
        message: `Found ${products.length} popular products`
      });

    } catch (error) {
      console.error('❌ Popular Products Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get popular products',
        error: error.message
      });
    }
  }

  // ✅ GET FEATURED PRODUCTS - Curated featured products
  static async getFeaturedProducts(req, res) {
    try {
      const { category, limit = 20 } = req.query;

      const matchConditions = { isActive: true, isFeatured: true };
      if (category) {
        if (category.match(/^[0-9a-fA-F]{24}$/)) {
          matchConditions.categoryId = category;
        } else {
          const categoryDoc = await Category.findOne({ 
            name: new RegExp(category, 'i') 
          });
          if (categoryDoc) {
            matchConditions.categoryId = categoryDoc._id;
          }
        }
      }

      const products = await Product.find(matchConditions)
        .populate('categoryId', 'name image')
        .sort({ createdAt: -1, rating: -1 })
        .limit(parseInt(limit))
        .lean();

      res.status(200).json({
        success: true,
        data: products,
        message: `Found ${products.length} featured products`
      });

    } catch (error) {
      console.error('❌ Featured Products Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get featured products',
        error: error.message
      });
    }
  }
}

module.exports = SearchController;
