import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Image,
  FlatList,
  Alert,
} from "react-native";
import { router } from "expo-router";
import {
  Search,
  Filter,
  Heart,
  ShoppingBag,
  TrendingUp,
  Star,
  Tag,
  ArrowRight,
  Grid3X3,
  List,
  SlidersHorizontal,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { Product, Category, FilterState } from "@/types/product";

// ✅ UPDATED: Import enhanced API functions
import {
  getProducts,
  getCategories,
  getPopularProducts,
  getFeaturedProducts,
  getTrendingCategories,
  searchProducts,
  addToWishlist,
  removeFromWishlist,
  checkWishlistStatus,
  addToBag,
  handleApiError,
} from "@/utils/api";

// ✅ Import enhanced components
import SearchOverlay from "@/components/SearchOverlay";
import FilterModal from "@/components/FilterModal";

const { width: screenWidth } = Dimensions.get("window");

// ✅ Enhanced interface for home data
interface HomeData {
  categories: Category[];
  featuredProducts: Product[];
  popularProducts: Product[];
  newArrivals: Product[];
  trendingCategories: Category[];
  isLoading: boolean;
  error: string | null;
}

// ✅ Enhanced interface for product interactions
interface ProductCardProps {
  product: Product;
  onPress: (productId: string) => void;
  onWishlistPress: (productId: string) => void;
  onBagPress: (productId: string) => void;
  isWishlisted: boolean;
  inBag: boolean;
  style?: any;
}

export default function HomeScreen() {
  const { user } = useAuth();

  // ✅ ENHANCED: State management with comprehensive data
  const [homeData, setHomeData] = useState<HomeData>({
    categories: [],
    featuredProducts: [],
    popularProducts: [],
    newArrivals: [],
    trendingCategories: [],
    isLoading: true,
    error: null,
  });

  const [searchOverlayVisible, setSearchOverlayVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // ✅ NEW: Enhanced filter state
  const [currentFilters, setCurrentFilters] = useState<FilterState>({
    sortBy: 'relevance',
  });
  
  // ✅ NEW: Search and product states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [wishlistedProducts, setWishlistedProducts] = useState<Set<string>>(new Set());
  const [bagProducts, setBagProducts] = useState<Set<string>>(new Set());

  // ✅ ENHANCED: Load comprehensive home data
  const loadHomeData = useCallback(async () => {
    try {
      setHomeData(prev => ({ ...prev, isLoading: true, error: null }));

      console.log('🏠 Loading enhanced home data...');

      // ✅ Fetch all data in parallel for better performance
      const [
        categoriesResponse,
        featuredResponse,
        popularResponse,
        newArrivalsResponse,
        trendingCategoriesResponse,
      ] = await Promise.all([
        getCategories({ 
          limit: 12, 
          onlyActive: true, 
          includeStats: true,
          sortBy: 'popular'
        }),
        getFeaturedProducts({ limit: 10 }),
        getPopularProducts({ limit: 10, timeframe: 'weekly' }),
        getProducts({ 
          limit: 10, 
          filters: { isNew: true },
          sortBy: 'newest'
        }),
        getTrendingCategories(8),
      ]);

      // ✅ Handle responses with proper error checking
      const categories = categoriesResponse.success ? categoriesResponse.data || [] : [];
      const featured = featuredResponse.success ? featuredResponse.data || [] : [];
      const popular = popularResponse.success ? popularResponse.data || [] : [];
      
      // Handle different response formats for new arrivals
      let newArrivals: Product[] = [];
      if (newArrivalsResponse.success) {
        const data = newArrivalsResponse.data;
        if (Array.isArray(data)) {
          newArrivals = data;
        } else if (data && Array.isArray(data.products)) {
          newArrivals = data.products;
        }
      }

      const trending = trendingCategoriesResponse.success ? trendingCategoriesResponse.data || [] : [];

      console.log('✅ Home data loaded:', {
        categories: categories.length,
        featured: featured.length,
        popular: popular.length,
        newArrivals: newArrivals.length,
        trending: trending.length,
      });

      setHomeData({
        categories,
        featuredProducts: featured,
        popularProducts: popular,
        newArrivals,
        trendingCategories: trending,
        isLoading: false,
        error: null,
      });

      // ✅ Load wishlist status if user is logged in
      if (user) {
        loadWishlistStatus([...featured, ...popular, ...newArrivals]);
      }

    } catch (error: any) {
      console.error('❌ Error loading home data:', error);
      setHomeData(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to load home data',
      }));
    }
  }, [user]);

  // ✅ NEW: Load wishlist status for products
  const loadWishlistStatus = async (products: Product[]) => {
    if (!user || products.length === 0) return;

    try {
      const statusPromises = products.map(product => 
        checkWishlistStatus(user._id, product._id)
      );
      
      const statuses = await Promise.all(statusPromises);
      const wishlistedSet = new Set<string>();
      
      statuses.forEach((status, index) => {
        if (status.success && status.data?.isInWishlist) {
          wishlistedSet.add(products[index]._id);
        }
      });
      
      setWishlistedProducts(wishlistedSet);
    } catch (error) {
      console.error('❌ Error loading wishlist status:', error);
    }
  };

  // ✅ ENHANCED: Search functionality with real-time results
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchQuery('');
      return;
    }

    try {
      setIsSearching(true);
      setSearchQuery(query);

      console.log('🔍 Searching for:', query);

      const response = await searchProducts({
        q: query,
        page: 1,
        limit: 20,
        sort: currentFilters.sortBy || 'relevance',
        ...currentFilters,
      });

      if (response.success && response.data) {
        const products = Array.isArray(response.data) 
          ? response.data 
          : response.data.products || [];
        
        setSearchResults(products);
        
        // Load wishlist status for search results
        if (user) {
          loadWishlistStatus(products);
        }
      } else {
        setSearchResults([]);
        console.error('Search failed:', handleApiError(response));
      }
    } catch (error) {
      console.error('❌ Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // ✅ ENHANCED: Wishlist management with real-time updates
  const handleWishlistPress = async (productId: string) => {
    if (!user) {
      Alert.alert(
        "Login Required",
        "Please login to add items to wishlist",
        [
          { text: "Login", onPress: () => router.push("/login") },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    try {
      const isCurrentlyWishlisted = wishlistedProducts.has(productId);
      
      console.log('💝 Toggling wishlist for product:', productId, 'Currently wishlisted:', isCurrentlyWishlisted);

      if (isCurrentlyWishlisted) {
        // Find and remove from wishlist
        const statusResponse = await checkWishlistStatus(user._id, productId);
        if (statusResponse.success && statusResponse.data?.wishlistItemId) {
          const response = await removeFromWishlist(statusResponse.data.wishlistItemId);
          
          if (response.success) {
            setWishlistedProducts(prev => {
              const newSet = new Set(prev);
              newSet.delete(productId);
              return newSet;
            });
          } else {
            Alert.alert("Error", handleApiError(response));
          }
        }
      } else {
        // Add to wishlist
        const response = await addToWishlist({
          userId: user._id,
          productId,
          priority: 'medium',
        });
        
        if (response.success) {
          setWishlistedProducts(prev => new Set([...prev, productId]));
        } else {
          Alert.alert("Error", handleApiError(response));
        }
      }
    } catch (error) {
      console.error('❌ Wishlist error:', error);
      Alert.alert("Error", "Failed to update wishlist");
    }
  };

  // ✅ ENHANCED: Add to bag with comprehensive validation
  const handleAddToBag = async (productId: string) => {
    if (!user) {
      Alert.alert(
        "Login Required",
        "Please login to add items to bag",
        [
          { text: "Login", onPress: () => router.push("/login") },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    try {
      console.log('🛒 Adding to bag:', productId);

      const response = await addToBag({
        userId: user._id,
        productId,
        quantity: 1,
      });

      if (response.success) {
        setBagProducts(prev => new Set([...prev, productId]));
        
        Alert.alert(
          "Added to Bag",
          "Product has been added to your bag",
          [
            { text: "Continue Shopping", style: "cancel" },
            { text: "View Bag", onPress: () => router.push("/(tabs)/bag") },
          ]
        );
      } else {
        Alert.alert("Error", handleApiError(response));
      }
    } catch (error) {
      console.error('❌ Add to bag error:', error);
      Alert.alert("Error", "Failed to add item to bag");
    }
  };

  // ✅ ENHANCED: Filter application with real-time updates
  const handleApplyFilters = async (filters: FilterState) => {
    setCurrentFilters(filters);
    setFilterModalVisible(false);

    if (searchQuery) {
      // Re-run search with new filters
      handleSearch(searchQuery);
    } else {
      // Apply filters to home products (could reload featured/popular with filters)
      console.log('🔧 Filters applied:', filters);
    }
  };

  // ✅ Navigation handlers
  const handleProductPress = (productId: string) => {
    console.log('🔍 Navigating to product:', productId);
    router.push(`/product/${productId}`);
  };

  const handleCategoryPress = (categoryId: string) => {
    console.log('📂 Navigating to category:', categoryId);
    router.push(`/category/${categoryId}`);
  };

  // ✅ Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadHomeData();
    setRefreshing(false);
  };

  // ✅ Load data on mount
  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  // ✅ ENHANCED: Product Card Component with real-time status
  const ProductCard: React.FC<ProductCardProps> = ({ 
    product, 
    onPress, 
    onWishlistPress, 
    onBagPress, 
    isWishlisted,
    inBag,
    style 
  }) => {
    const discountPercentage = product.discount ? 
      parseInt(product.discount.replace('%', '')) : 0;

    return (
      <TouchableOpacity
        style={[styles.productCard, style]}
        onPress={() => onPress(product._id)}
        activeOpacity={0.8}
      >
        <View style={styles.productImageContainer}>
          <Image
            source={{ uri: product.images?.[0] }}
            style={styles.productImage}
            resizeMode="cover"
          />
          
          {/* Discount Badge */}
          {discountPercentage > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{discountPercentage}% OFF</Text>
            </View>
          )}
          
          {/* Wishlist Button */}
          <TouchableOpacity
            style={[styles.wishlistButton, isWishlisted && styles.wishlistButtonActive]}
            onPress={() => onWishlistPress(product._id)}
            activeOpacity={0.7}
          >
            <Heart
              size={16}
              color={isWishlisted ? "#fff" : "#333"}
              fill={isWishlisted ? "#fff" : "none"}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productBrand} numberOfLines={1}>
            {product.brand}
          </Text>
          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>
          
          <View style={styles.productPricing}>
            <Text style={styles.productPrice}>₹{product.price}</Text>
            {discountPercentage > 0 && (
              <Text style={styles.originalPrice}>
                ₹{Math.round(product.price / (1 - discountPercentage / 100))}
              </Text>
            )}
          </View>

          {product.rating && (
            <View style={styles.productRating}>
              <Star size={12} color="#ffa500" fill="#ffa500" />
              <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>

        {/* Add to Bag Button */}
        <TouchableOpacity
          style={[styles.addToBagButton, inBag && styles.addToBagButtonActive]}
          onPress={() => onBagPress(product._id)}
          activeOpacity={0.7}
        >
          <ShoppingBag size={14} color={inBag ? "#4caf50" : "#ff3f6c"} />
          <Text style={[styles.addToBagText, inBag && styles.addToBagTextActive]}>
            {inBag ? "In Bag" : "Add"}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // ✅ ENHANCED: Category Card Component
  const CategoryCard: React.FC<{ category: Category; onPress: () => void }> = ({ 
    category, 
    onPress 
  }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: category.image }}
        style={styles.categoryImage}
        resizeMode="cover"
      />
      <View style={styles.categoryOverlay}>
        <Text style={styles.categoryName} numberOfLines={2}>
          {category.name}
        </Text>
              {category.productCount && (
        <Text style={styles.categoryCount}>
          {category.productCount} items
        </Text>
      )}

      </View>
    </TouchableOpacity>
  );

  // ✅ ENHANCED: Section Header Component
  const SectionHeader: React.FC<{
    title: string;
    subtitle?: string;
    onSeeAll?: () => void;
    icon?: React.ReactNode;
  }> = ({ title, subtitle, onSeeAll, icon }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        {icon && <View style={styles.sectionHeaderIcon}>{icon}</View>}
        <View>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7}>
          <View style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>See All</Text>
            <ArrowRight size={16} color="#ff3f6c" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );

  // ✅ Loading state
  if (homeData.isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff3f6c" />
        <Text style={styles.loadingText}>Loading amazing products...</Text>
      </View>
    );
  }

  // ✅ Error state
  if (homeData.error && !refreshing) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{homeData.error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadHomeData}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* ✅ ENHANCED: Header with Search and Filter */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {searchQuery ? `Results for "${searchQuery}"` : 'Discover'}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={() => setSearchOverlayVisible(true)}
            activeOpacity={0.7}
          >
            <Search size={22} color="#333" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.7}
          >
            <Filter size={22} color="#333" />
            {Object.keys(currentFilters).length > 1 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>
                  {Object.keys(currentFilters).length - 1}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#ff3f6c"]}
            tintColor="#ff3f6c"
          />
        }
      >
        {/* ✅ Search Results or Regular Content */}
        {searchQuery && searchResults.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title={`${searchResults.length} Results`}
              subtitle={`for "${searchQuery}"`}
              icon={<Search size={20} color="#ff3f6c" />}
            />
            
            <FlatList
              data={searchResults}
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  onPress={handleProductPress}
                  onWishlistPress={handleWishlistPress}
                  onBagPress={handleAddToBag}
                  isWishlisted={wishlistedProducts.has(item._id)}
                  inBag={bagProducts.has(item._id)}
                  style={styles.searchResultCard}
                />
              )}
              keyExtractor={(item) => item._id}
              numColumns={2}
              columnWrapperStyle={styles.productRow}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          </View>
        ) : searchQuery && !isSearching ? (
          <View style={styles.noResultsContainer}>
            <Text style={styles.noResultsTitle}>No products found</Text>
            <Text style={styles.noResultsText}>
              Try different keywords or check spelling
            </Text>
          </View>
        ) : (
          <>
            {/* ✅ Trending Categories */}
            {homeData.trendingCategories.length > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  title="Trending Categories"
                  subtitle="What's popular right now"
                  icon={<TrendingUp size={20} color="#ff3f6c" />}
                  onSeeAll={() => router.push("/(tabs)/categories")}
                />
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.horizontalList}>
                    {homeData.trendingCategories.map((category) => (
                      <CategoryCard
                        key={category._id}
                        category={category}
                        onPress={() => handleCategoryPress(category._id)}
                      />
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* ✅ Featured Products */}
            {homeData.featuredProducts.length > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  title="Featured Products"
                  subtitle="Hand-picked for you"
                  icon={<Star size={20} color="#ff3f6c" />}
                />
                
                <FlatList
                  data={homeData.featuredProducts}
                  renderItem={({ item }) => (
                    <ProductCard
                      product={item}
                      onPress={handleProductPress}
                      onWishlistPress={handleWishlistPress}
                      onBagPress={handleAddToBag}
                      isWishlisted={wishlistedProducts.has(item._id)}
                      inBag={bagProducts.has(item._id)}
                    />
                  )}
                  keyExtractor={(item) => item._id}
                  numColumns={2}
                  columnWrapperStyle={styles.productRow}
                  scrollEnabled={false}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            )}

            {/* ✅ Popular Products */}
            {homeData.popularProducts.length > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  title="Popular This Week"
                  subtitle="Trending products"
                  icon={<TrendingUp size={20} color="#ff3f6c" />}
                />
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.horizontalList}>
                    {homeData.popularProducts.map((product) => (
                      <ProductCard
                        key={product._id}
                        product={product}
                        onPress={handleProductPress}
                        onWishlistPress={handleWishlistPress}
                        onBagPress={handleAddToBag}
                        isWishlisted={wishlistedProducts.has(product._id)}
                        inBag={bagProducts.has(product._id)}
                        style={styles.horizontalProductCard}
                      />
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* ✅ New Arrivals */}
            {homeData.newArrivals.length > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  title="New Arrivals"
                  subtitle="Fresh styles just in"
                  icon={<Tag size={20} color="#ff3f6c" />}
                />
                
                <FlatList
                  data={homeData.newArrivals.slice(0, 6)}
                  renderItem={({ item }) => (
                    <ProductCard
                      product={item}
                      onPress={handleProductPress}
                      onWishlistPress={handleWishlistPress}
                      onBagPress={handleAddToBag}
                      isWishlisted={wishlistedProducts.has(item._id)}
                      inBag={bagProducts.has(item._id)}
                    />
                  )}
                  keyExtractor={(item) => item._id}
                  numColumns={2}
                  columnWrapperStyle={styles.productRow}
                  scrollEnabled={false}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            )}
          </>
        )}

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ✅ ENHANCED: Search Overlay */}
      <SearchOverlay
        visible={searchOverlayVisible}
        onClose={() => {
          setSearchOverlayVisible(false);
          setSearchQuery('');
          setSearchResults([]);
        }}
        products={[...homeData.featuredProducts, ...homeData.popularProducts, ...homeData.newArrivals]}
        onProductPress={handleProductPress}
        onFilterPress={() => {
          setSearchOverlayVisible(false);
          setFilterModalVisible(true);
        }}
        initialQuery={searchQuery}
        showFilters={true}
        activeFilters={currentFilters}
        onWishlistPress={handleWishlistPress}
        onBagPress={handleAddToBag}
      />

      {/* ✅ ENHANCED: Filter Modal */}
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={handleApplyFilters}
        currentFilters={currentFilters}
        categories={homeData.categories}
        brands={[
          ...new Set([
            ...homeData.featuredProducts.map(p => p.brand),
            ...homeData.popularProducts.map(p => p.brand),
            ...homeData.newArrivals.map(p => p.brand),
          ])
        ]}
        priceRange={{ min: 0, max: 50000 }}
        totalProducts={homeData.featuredProducts.length + homeData.popularProducts.length + homeData.newArrivals.length}
      />
    </View>
  );
}

// ✅ COMPREHENSIVE STYLES (keeping all existing styles + new ones)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    position: 'relative',
    padding: 8,
    marginLeft: 8,
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ff3f6c',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 14,
    color: '#ff3f6c',
    fontWeight: '500',
    marginRight: 4,
  },
  horizontalList: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  categoryCard: {
    width: 120,
    height: 160,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f8f9fa',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
  },
  categoryName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryCount: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
  },
  productRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  productCard: {
    width: (screenWidth - 48) / 2,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  horizontalProductCard: {
    width: 160,
    marginRight: 12,
  },
  searchResultCard: {
    marginBottom: 12,
  },
  productImageContainer: {
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  discountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  wishlistButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 6,
    borderRadius: 15,
  },
  wishlistButtonActive: {
    backgroundColor: '#ff3f6c',
  },
  productInfo: {
    padding: 12,
  },
  productBrand: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  productName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '400',
    marginTop: 2,
    lineHeight: 18,
  },
  productPricing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  productPrice: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
    marginLeft: 6,
  },
  productRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  addToBagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff0f3',
    marginHorizontal: 12,
    marginBottom: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff3f6c',
  },
  addToBagButtonActive: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4caf50',
  },
  addToBagText: {
    fontSize: 12,
    color: '#ff3f6c',
    fontWeight: '600',
    marginLeft: 4,
  },
  addToBagTextActive: {
    color: '#4caf50',
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
