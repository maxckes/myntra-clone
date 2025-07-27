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
  TextInput,
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
  ChevronDown,
  X,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { Product, Category, FilterState } from "@/types/product";

// ✅ UPDATED: Import enhanced API functions
import {
  getProducts,
  getCategories,
  getCategoriesWithProducts,
  getProductsByCategory,
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

// ✅ Enhanced interfaces
interface CategoryData {
  allCategories: Category[];
  filteredCategories: Category[];
  selectedCategory: Category | null;
  categoryProducts: Product[];
  isLoading: boolean;
  error: string | null;
}

interface ProductCardProps {
  product: Product;
  onPress: (productId: string) => void;
  onWishlistPress: (productId: string) => void;
  onBagPress: (productId: string) => void;
  isWishlisted: boolean;
  inBag: boolean;
  style?: any;
}

export default function CategoriesScreen() {
  const { user } = useAuth();

  // ✅ ENHANCED: State management
  const [categoryData, setCategoryData] = useState<CategoryData>({
    allCategories: [],
    filteredCategories: [],
    selectedCategory: null,
    categoryProducts: [],
    isLoading: true,
    error: null,
  });

  const [searchOverlayVisible, setSearchOverlayVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // ✅ NEW: Enhanced states
  const [searchQuery, setSearchQuery] = useState('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [currentFilters, setCurrentFilters] = useState<FilterState>({
    sortBy: 'relevance',
  });
  const [wishlistedProducts, setWishlistedProducts] = useState<Set<string>>(new Set());
  const [bagProducts, setBagProducts] = useState<Set<string>>(new Set());
  const [showCategorySearch, setShowCategorySearch] = useState(false);

  // ✅ ENHANCED: Load comprehensive category data
  const loadCategoryData = useCallback(async () => {
    try {
      setCategoryData(prev => ({ ...prev, isLoading: true, error: null }));

      console.log('📂 Loading enhanced category data...');

      // ✅ Fetch categories with statistics
      const categoriesResponse = await getCategories({
        onlyActive: true,
        includeStats: true,
        sortBy: 'popular',
        includeEmpty: false,
      });

      if (categoriesResponse.success && categoriesResponse.data) {
        const categories = categoriesResponse.data;
        
        console.log('✅ Categories loaded:', categories.length);

        setCategoryData(prev => ({
          ...prev,
          allCategories: categories,
          filteredCategories: categories,
          isLoading: false,
          error: null,
        }));
      } else {
        throw new Error(handleApiError(categoriesResponse));
      }

    } catch (error: any) {
      console.error('❌ Error loading category data:', error);
      setCategoryData(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to load categories',
      }));
    }
  }, []);

  // ✅ NEW: Load products for selected category
  const loadCategoryProducts = useCallback(async (categoryId: string, filters?: FilterState) => {
    try {
      console.log('📦 Loading products for category:', categoryId);

      // Find the selected category
      const selectedCategory = categoryData.allCategories.find(cat => cat._id === categoryId);
      if (!selectedCategory) return;

      setCategoryData(prev => ({ 
        ...prev, 
        selectedCategory,
        isLoading: true 
      }));

      // ✅ Load products with filters
      const productsResponse = await getProductsByCategory(categoryId, {
        page: 1,
        limit: 50,
        sortBy: filters?.sortBy || 'popularity',
        search: searchQuery || undefined,
        filters,
      });

      if (productsResponse.success && productsResponse.data) {
        let products: Product[] = [];
        
        if (Array.isArray(productsResponse.data)) {
          products = productsResponse.data;
        } else if (productsResponse.data.products) {
          products = productsResponse.data.products;
        }

        console.log('✅ Category products loaded:', products.length);

        setCategoryData(prev => ({
          ...prev,
          categoryProducts: products,
          isLoading: false,
        }));

        // ✅ Load wishlist status if user is logged in
        if (user && products.length > 0) {
          loadWishlistStatus(products);
        }
      }

    } catch (error: any) {
      console.error('❌ Error loading category products:', error);
      setCategoryData(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to load products',
      }));
    }
  }, [categoryData.allCategories, searchQuery, user]);

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

  // ✅ NEW: Filter categories based on search
  const filterCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) {
      return categoryData.allCategories;
    }

    return categoryData.allCategories.filter(category =>
      category.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
    );
  }, [categoryData.allCategories, categorySearchQuery]);

  // ✅ ENHANCED: Product search within category
  const handleProductSearch = async (query: string) => {
    setSearchQuery(query);

    if (!categoryData.selectedCategory) return;

    if (!query.trim()) {
      // Reload original category products
      loadCategoryProducts(categoryData.selectedCategory._id, currentFilters);
      return;
    }

    try {
      console.log('🔍 Searching products in category:', query);

      const response = await searchProducts({
        q: query,
        category: categoryData.selectedCategory._id,
        page: 1,
        limit: 50,
        sort: currentFilters.sortBy || 'relevance',
        ...currentFilters,
      });

      if (response.success && response.data) {
        const products = Array.isArray(response.data) 
          ? response.data 
          : response.data.products || [];
        
        setCategoryData(prev => ({
          ...prev,
          categoryProducts: products,
        }));

        if (user && products.length > 0) {
          loadWishlistStatus(products);
        }
      }
    } catch (error) {
      console.error('❌ Product search error:', error);
    }
  };

  // ✅ ENHANCED: Wishlist management
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
      
      console.log('💝 Toggling wishlist for product:', productId);

      if (isCurrentlyWishlisted) {
        const statusResponse = await checkWishlistStatus(user._id, productId);
        if (statusResponse.success && statusResponse.data?.wishlistItemId) {
          const response = await removeFromWishlist(statusResponse.data.wishlistItemId);
          
          if (response.success) {
            setWishlistedProducts(prev => {
              const newSet = new Set(prev);
              newSet.delete(productId);
              return newSet;
            });
          }
        }
      } else {
        const response = await addToWishlist({
          userId: user._id,
          productId,
          priority: 'medium',
        });
        
        if (response.success) {
          setWishlistedProducts(prev => new Set([...prev, productId]));
        }
      }
    } catch (error) {
      console.error('❌ Wishlist error:', error);
      Alert.alert("Error", "Failed to update wishlist");
    }
  };

  // ✅ ENHANCED: Add to bag functionality
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

  // ✅ ENHANCED: Filter application
  const handleApplyFilters = async (filters: FilterState) => {
    setCurrentFilters(filters);
    setFilterModalVisible(false);

    if (categoryData.selectedCategory) {
      loadCategoryProducts(categoryData.selectedCategory._id, filters);
    }
  };

  // ✅ Navigation handlers
  const handleProductPress = (productId: string) => {
    console.log('🔍 Navigating to product:', productId);
    router.push(`/product/${productId}`);
  };

  const handleCategoryPress = (category: Category) => {
    console.log('📂 Selecting category:', category.name);
    loadCategoryProducts(category._id, currentFilters);
  };

  const handleBackToCategories = () => {
    setCategoryData(prev => ({
      ...prev,
      selectedCategory: null,
      categoryProducts: [],
    }));
    setSearchQuery('');
  };

  // ✅ Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadCategoryData();
    setRefreshing(false);
  };

  // ✅ Load data on mount
  useEffect(() => {
    loadCategoryData();
  }, [loadCategoryData]);

  // ✅ ENHANCED: Product Card Component
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

    if (viewMode === 'list') {
      return (
        <TouchableOpacity
          style={[styles.productListCard, style]}
          onPress={() => onPress(product._id)}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: product.images?.[0] }}
            style={styles.productListImage}
            resizeMode="cover"
          />
          
          <View style={styles.productListInfo}>
            <Text style={styles.productBrand} numberOfLines={1}>
              {product.brand}
            </Text>
            <Text style={styles.productName} numberOfLines={2}>
              {product.name}
            </Text>
            
            <View style={styles.productPricing}>
              <Text style={styles.productPrice}>₹{product.price}</Text>
              {discountPercentage > 0 && (
                <>
                  <Text style={styles.originalPrice}>
                    ₹{Math.round(product.price / (1 - discountPercentage / 100))}
                  </Text>
                  <Text style={styles.discountPercentage}>({discountPercentage}% OFF)</Text>
                </>
              )}
            </View>

            {product.rating && (
              <View style={styles.productRating}>
                <Star size={12} color="#ffa500" fill="#ffa500" />
                <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
              </View>
            )}
          </View>

          <View style={styles.productListActions}>
            <TouchableOpacity
              style={[styles.listActionButton, isWishlisted && styles.listActionButtonActive]}
              onPress={() => onWishlistPress(product._id)}
              activeOpacity={0.7}
            >
              <Heart
                size={16}
                color={isWishlisted ? "#ff3f6c" : "#666"}
                fill={isWishlisted ? "#ff3f6c" : "none"}
              />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.listActionButton, inBag && styles.listActionButtonActive]}
              onPress={() => onBagPress(product._id)}
              activeOpacity={0.7}
            >
              <ShoppingBag
                size={16}
                color={inBag ? "#4caf50" : "#666"}
              />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    }

    // Grid view (same as home page)
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
          
          {discountPercentage > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{discountPercentage}% OFF</Text>
            </View>
          )}
          
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

  // ✅ Loading state
  if (categoryData.isLoading && !refreshing && !categoryData.selectedCategory) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff3f6c" />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  // ✅ Error state
  if (categoryData.error && !refreshing) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{categoryData.error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadCategoryData}
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
      
      {/* ✅ ENHANCED: Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {categoryData.selectedCategory && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackToCategories}
              activeOpacity={0.7}
            >
              <ArrowRight size={20} color="#333" style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>
          )}
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              {categoryData.selectedCategory ? categoryData.selectedCategory.name : 'Categories'}
            </Text>
            {categoryData.selectedCategory && (
              <Text style={styles.headerSubtitle}>
                {categoryData.categoryProducts.length} products
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.headerActions}>
          {!categoryData.selectedCategory && (
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={() => setShowCategorySearch(!showCategorySearch)}
              activeOpacity={0.7}
            >
              <Search size={22} color="#333" />
            </TouchableOpacity>
          )}
          
          {categoryData.selectedCategory && (
            <>
              <TouchableOpacity
                style={styles.headerActionButton}
                onPress={() => setSearchOverlayVisible(true)}
                activeOpacity={0.7}
              >
                <Search size={22} color="#333" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.headerActionButton}
                onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                activeOpacity={0.7}
              >
                {viewMode === 'grid' ? (
                  <List size={22} color="#333" />
                ) : (
                  <Grid3X3 size={22} color="#333" />
                )}
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
            </>
          )}
        </View>
      </View>

      {/* ✅ Category Search Bar */}
      {showCategorySearch && !categoryData.selectedCategory && (
        <View style={styles.categorySearchContainer}>
          <View style={styles.categorySearchInputContainer}>
            <Search size={18} color="#666" />
            <TextInput
              style={styles.categorySearchInput}
              value={categorySearchQuery}
              onChangeText={setCategorySearchQuery}
              placeholder="Search categories..."
              placeholderTextColor="#999"
            />
            {categorySearchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setCategorySearchQuery('')}
                activeOpacity={0.7}
              >
                <X size={18} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

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
        {/* ✅ Categories Grid or Product List */}
        {!categoryData.selectedCategory ? (
          <View style={styles.categoriesContainer}>
            <FlatList
              data={filterCategories}
              renderItem={({ item }) => (
                <CategoryCard
                  category={item}
                  onPress={() => handleCategoryPress(item)}
                />
              )}
              keyExtractor={(item) => item._id}
              numColumns={2}
              columnWrapperStyle={styles.categoryRow}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          </View>
        ) : (
          <View style={styles.productsContainer}>
            {categoryData.isLoading ? (
              <View style={styles.productsLoadingContainer}>
                <ActivityIndicator size="large" color="#ff3f6c" />
                <Text style={styles.loadingText}>Loading products...</Text>
              </View>
            ) : categoryData.categoryProducts.length > 0 ? (
              <FlatList
                data={categoryData.categoryProducts}
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
                numColumns={viewMode === 'grid' ? 2 : 1}
                columnWrapperStyle={viewMode === 'grid' ? styles.productRow : undefined}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.noProductsContainer}>
                <Text style={styles.noProductsTitle}>No products found</Text>
                <Text style={styles.noProductsText}>
                  Try adjusting your search or filters
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ✅ ENHANCED: Search Overlay for Products */}
      <SearchOverlay
        visible={searchOverlayVisible}
        onClose={() => {
          setSearchOverlayVisible(false);
          setSearchQuery('');
        }}
        products={categoryData.categoryProducts}
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
        categories={categoryData.allCategories}
        brands={[
          ...new Set(categoryData.categoryProducts.map(p => p.brand))
        ]}
        priceRange={{ min: 0, max: 50000 }}
        totalProducts={categoryData.categoryProducts.length}
      />
    </View>
  );
}

// ✅ COMPREHENSIVE STYLES
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
  productsLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
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
  categorySearchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categorySearchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categorySearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  categoryRow: {
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: (screenWidth - 48) / 2,
    height: 200,
    marginBottom: 16,
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
    padding: 12,
  },
  categoryName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  categoryCount: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    opacity: 0.8,
  },
  productsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  productRow: {
    justifyContent: 'space-between',
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
  productListCard: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
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
  productListImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
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
  productListInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
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
    flexWrap: 'wrap',
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
  discountPercentage: {
    fontSize: 12,
    color: '#ff3f6c',
    fontWeight: '500',
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
  productListActions: {
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingLeft: 12,
  },
  listActionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginVertical: 4,
  },
  listActionButtonActive: {
    backgroundColor: '#fff0f3',
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
  noProductsContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  noProductsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  noProductsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
