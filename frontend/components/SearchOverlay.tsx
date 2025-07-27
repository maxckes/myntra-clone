import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import {
  Search,
  X,
  Clock,
  TrendingUp,
  Star,
  Filter,
  ArrowUpRight,
  Mic,
  Camera,
  Tag,
  Heart,
  ShoppingBag,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product, SearchSuggestion, FilterState } from '@/types/product';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Types
interface SearchOverlayProps {
  visible: boolean;
  onClose: () => void;
  products: Product[];
  onProductPress?: (productId: string) => void;
  onFilterPress?: () => void;
  initialQuery?: string;
  showFilters?: boolean;
  activeFilters?: FilterState;
  onWishlistPress?: (productId: string) => void;
  onBagPress?: (productId: string) => void;
}

interface RecentSearch {
  id: string;
  query: string;
  timestamp: number;
}

// Constants
const RECENT_SEARCHES_KEY = '@recent_searches';
const MAX_RECENT_SEARCHES = 10;
const SEARCH_DELAY = 300; // Debounce delay

const TRENDING_SEARCHES = [
  { id: '1', text: 'T-Shirts', type: 'category' as const, count: 1250 },
  { id: '2', text: 'Sneakers', type: 'category' as const, count: 890 },
  { id: '3', text: 'Jeans', type: 'category' as const, count: 756 },
  { id: '4', text: 'Nike', type: 'brand' as const, count: 645 },
  { id: '5', text: 'Adidas', type: 'brand' as const, count: 523 },
  { id: '6', text: 'Dresses', type: 'category' as const, count: 434 },
];

const SearchOverlay: React.FC<SearchOverlayProps> = ({
  visible,
  onClose,
  products,
  onProductPress,
  onFilterPress,
  initialQuery = '',
  showFilters = true,
  activeFilters = {},
  onWishlistPress,
  onBagPress,
}) => {
  // State
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));
  
  // Refs
  const searchInputRef = useRef<TextInput>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (activeFilters.category) count++;
    if (activeFilters.priceMin || activeFilters.priceMax) count++;
    if (activeFilters.rating) count++;
    if (activeFilters.brands?.length) count++;
    if (activeFilters.discount) count++;
    if (activeFilters.sortBy && activeFilters.sortBy !== 'relevance') count++;
    return count;
  }, [activeFilters]);

  // Search results with debouncing
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase().trim();
    const results = products.filter(product => {
      const searchableText = [
        product.name,
        product.brand,
        product.description,
        product.categoryName,
        product.subcategory,
      ].join(' ').toLowerCase();
      
      return searchableText.includes(query);
    });

    // Sort by relevance (exact matches first, then partial matches)
    return results.sort((a, b) => {
      const aText = `${a.name} ${a.brand}`.toLowerCase();
      const bText = `${b.name} ${b.brand}`.toLowerCase();
      
      const aExactMatch = aText.includes(query);
      const bExactMatch = bText.includes(query);
      
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;
      
      // Secondary sort by rating
      return (b.rating || 0) - (a.rating || 0);
    });
  }, [searchQuery, products]);

  // Search suggestions
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    
    const query = searchQuery.toLowerCase();
    const suggestions: SearchSuggestion[] = [];
    
    // Product name suggestions
    const productSuggestions = products
      .filter(p => p.name.toLowerCase().includes(query))
      .slice(0, 3)
      .map(p => ({
        id: `product-${p._id}`,
        text: p.name,
        type: 'product' as const,
        image: p.images?.[0],
      }));
    
    // Brand suggestions
    const brandSuggestions = Array.from(
      new Set(products
        .filter(p => p.brand.toLowerCase().includes(query))
        .map(p => p.brand)
      )
    ).slice(0, 3).map(brand => ({
      id: `brand-${brand}`,
      text: brand,
      type: 'brand' as const,
      count: products.filter(p => p.brand === brand).length,
    }));
    
    suggestions.push(...productSuggestions, ...brandSuggestions);
    return suggestions.slice(0, 6);
  }, [searchQuery, products]);

  // Effects
  useEffect(() => {
    if (visible) {
      setSearchQuery(initialQuery);
      loadRecentSearches();
      
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      
      // Focus search input with delay
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, initialQuery]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setIsSearching(true);
      setShowSuggestions(false);
      
      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      // Set new timeout for search
      searchTimeoutRef.current = setTimeout(() => {
        setIsSearching(false);
      }, SEARCH_DELAY);
    } else {
      setShowSuggestions(true);
      setIsSearching(false);
    }
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Handlers
  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const recent: RecentSearch[] = JSON.parse(stored);
        setRecentSearches(recent.sort((a, b) => b.timestamp - a.timestamp));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  const saveRecentSearch = async (query: string) => {
    if (!query.trim()) return;
    
    try {
      const newSearch: RecentSearch = {
        id: Date.now().toString(),
        query: query.trim(),
        timestamp: Date.now(),
      };
      
      const existing = recentSearches.filter(item => 
        item.query.toLowerCase() !== query.toLowerCase()
      );
      
      const updated = [newSearch, ...existing].slice(0, MAX_RECENT_SEARCHES);
      
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      setRecentSearches(updated);
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  };

  const clearRecentSearches = async () => {
    try {
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
      setRecentSearches([]);
    } catch (error) {
      console.error('Error clearing recent searches:', error);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      saveRecentSearch(query);
    }
  };

  const handleSuggestionPress = (suggestion: SearchSuggestion) => {
    setSearchQuery(suggestion.text);
    saveRecentSearch(suggestion.text);
    setShowSuggestions(false);
  };

  const handleProductPress = (productId: string) => {
    if (onProductPress) {
      onProductPress(productId);
    }
    onClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    setShowSuggestions(true);
    onClose();
  };

  // Rating Component
  const RatingDisplay: React.FC<{ rating?: number; size?: number; showText?: boolean }> = ({ 
    rating, 
    size = 14,
    showText = true 
  }) => {
    if (!rating) return null;
    
    return (
      <View style={styles.ratingContainer}>
        <Star size={size} color="#ffa500" fill="#ffa500" />
        {showText && (
          <Text style={[styles.ratingText, { fontSize: size - 2 }]}>
            {rating.toFixed(1)}
          </Text>
        )}
      </View>
    );
  };

  // Product Card Component
  const ProductCard: React.FC<{ product: Product; onPress: () => void }> = ({ 
    product, 
    onPress 
  }) => (
    <TouchableOpacity 
      style={styles.productCard} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: product.images?.[0] || 'https://via.placeholder.com/100' }}
        style={styles.productImage}
        defaultSource={{ uri: 'https://via.placeholder.com/100' }}
      />
      <View style={styles.productInfo}>
        <Text style={styles.productBrand} numberOfLines={1}>
          {product.brand}
        </Text>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.productDetails}>
          <Text style={styles.productPrice}>₹{product.price}</Text>
          {product.discount && (
            <Text style={styles.productDiscount}>{product.discount}</Text>
          )}
        </View>
        <View style={styles.productMeta}>
          <RatingDisplay rating={product.rating} size={12} />
          {product.categoryName && (
            <Text style={styles.productCategory}>{product.categoryName}</Text>
          )}
        </View>
      </View>
      <View style={styles.productActions}>
        {onWishlistPress && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onWishlistPress(product._id)}
            activeOpacity={0.7}
          >
            <Heart size={16} color="#666" />
          </TouchableOpacity>
        )}
        {onBagPress && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onBagPress(product._id)}
            activeOpacity={0.7}
          >
            <ShoppingBag size={16} color="#666" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  // Suggestion Item Component
  const SuggestionItem: React.FC<{ 
    suggestion: SearchSuggestion; 
    onPress: () => void;
    icon: React.ReactNode;
  }> = ({ suggestion, onPress, icon }) => (
    <TouchableOpacity 
      style={styles.suggestionItem} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.suggestionLeft}>
        {suggestion.image ? (
          <Image 
            source={{ uri: suggestion.image }} 
            style={styles.suggestionImage} 
          />
        ) : (
          <View style={styles.suggestionIcon}>
            {icon}
          </View>
        )}
        <View style={styles.suggestionTextContainer}>
          <Text style={styles.suggestionText}>{suggestion.text}</Text>
          {suggestion.count && (
            <Text style={styles.suggestionCount}>
              {suggestion.count} products
            </Text>
          )}
        </View>
      </View>
      <ArrowUpRight size={16} color="#999" />
    </TouchableOpacity>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View 
          style={[styles.overlay, { opacity: fadeAnim }]}
        >
          <TouchableOpacity 
            style={styles.backdrop} 
            activeOpacity={1} 
            onPress={handleClose} 
          />
          
          <Animated.View 
            style={[
              styles.content,
              { 
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-50, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                  <Search size={20} color="#666" style={styles.searchIcon} />
                  <TextInput
                    ref={searchInputRef}
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={handleSearch}
                    placeholder="Search for products, brands and more"
                    placeholderTextColor="#999"
                    returnKeyType="search"
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={() => setSearchQuery('')}
                      activeOpacity={0.7}
                    >
                      <X size={18} color="#666" />
                    </TouchableOpacity>
                  )}
                  <View style={styles.searchActions}>
                    <TouchableOpacity style={styles.voiceButton} activeOpacity={0.7}>
                      <Mic size={18} color="#666" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cameraButton} activeOpacity={0.7}>
                      <Camera size={18} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              
              <View style={styles.headerActions}>
                {showFilters && onFilterPress && (
                  <TouchableOpacity
                    style={styles.filterButton}
                    onPress={onFilterPress}
                    activeOpacity={0.7}
                  >
                    <Filter size={20} color="#ff3f6c" />
                    {activeFiltersCount > 0 && (
                      <View style={styles.filterBadge}>
                        <Text style={styles.filterBadgeText}>
                          {activeFiltersCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleClose}
                  activeOpacity={0.7}
                >
                  <X size={24} color="#333" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Content */}
            <ScrollView 
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Loading State */}
              {isSearching && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#ff3f6c" />
                  <Text style={styles.loadingText}>Searching...</Text>
                </View>
              )}

              {/* Search Results */}
              {!isSearching && searchQuery.trim() && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                      Results ({searchResults.length})
                    </Text>
                  </View>
                  {searchResults.length > 0 ? (
                    <FlatList
                      data={searchResults}
                      keyExtractor={(item) => item._id}
                      renderItem={({ item }) => (
                        <ProductCard
                          product={item}
                          onPress={() => handleProductPress(item._id)}
                        />
                      )}
                      scrollEnabled={false}
                      showsVerticalScrollIndicator={false}
                    />
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyTitle}>No products found</Text>
                      <Text style={styles.emptyText}>
                        Try different keywords or check spelling
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Search Suggestions */}
              {!isSearching && searchQuery.trim() && searchSuggestions.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Suggestions</Text>
                  </View>
                  {searchSuggestions.map((suggestion) => (
                    <SuggestionItem
                      key={suggestion.id}
                      suggestion={suggestion}
                      onPress={() => handleSuggestionPress(suggestion)}
                      icon={
                        suggestion.type === 'brand' ? (
                          <Tag size={16} color="#666" />
                        ) : suggestion.type === 'category' ? (
                          <Tag size={16} color="#666" />
                        ) : (
                          <Search size={16} color="#666" />
                        )
                      }
                    />
                  ))}
                </View>
              )}

              {/* Recent Searches */}
              {showSuggestions && !searchQuery.trim() && recentSearches.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Searches</Text>
                    <TouchableOpacity 
                      onPress={clearRecentSearches}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.clearText}>Clear All</Text>
                    </TouchableOpacity>
                  </View>
                  {recentSearches.map((search) => (
                    <TouchableOpacity
                      key={search.id}
                      style={styles.recentItem}
                      onPress={() => handleSearch(search.query)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.recentLeft}>
                        <Clock size={16} color="#999" />
                        <Text style={styles.recentText}>{search.query}</Text>
                      </View>
                      <ArrowUpRight size={16} color="#999" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Trending Searches */}
              {showSuggestions && !searchQuery.trim() && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Trending</Text>
                  </View>
                  {TRENDING_SEARCHES.map((trend) => (
                    <TouchableOpacity
                      key={trend.id}
                      style={styles.trendingItem}
                      onPress={() => handleSearch(trend.text)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.trendingLeft}>
                        <TrendingUp size={16} color="#ff3f6c" />
                        <View style={styles.trendingTextContainer}>
                          <Text style={styles.trendingText}>{trend.text}</Text>
                          <Text style={styles.trendingCount}>
                            {trend.count} products
                          </Text>
                        </View>
                      </View>
                      <ArrowUpRight size={16} color="#999" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Bottom Spacing */}
              <View style={{ height: 50 }} />
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: Platform.OS === 'ios' ? 44 : 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  searchContainer: {
    flex: 1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
    marginRight: 8,
  },
  searchActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceButton: {
    padding: 6,
    marginRight: 4,
  },
  cameraButton: {
    padding: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  filterButton: {
    position: 'relative',
    padding: 8,
    marginRight: 8,
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
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    flex: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  clearText: {
    fontSize: 14,
    color: '#ff3f6c',
    fontWeight: '500',
  },
  productCard: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  productInfo: {
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
  },
  productDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  productPrice: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  productDiscount: {
    fontSize: 12,
    color: '#ff3f6c',
    marginLeft: 8,
    fontWeight: '500',
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  ratingText: {
    marginLeft: 4,
    color: '#666',
    fontWeight: '500',
  },
  productCategory: {
    fontSize: 12,
    color: '#999',
  },
  productActions: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  actionButton: {
    padding: 8,
    marginVertical: 2,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  suggestionImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
  },
  suggestionIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  suggestionText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '400',
  },
  suggestionCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  recentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recentText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
  },
  trendingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  trendingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  trendingTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  trendingText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  trendingCount: {
    fontSize: 12,
    color: '#ff3f6c',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default SearchOverlay;
