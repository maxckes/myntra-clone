import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  Dimensions,
  StatusBar,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Heart,
  Trash2,
  ShoppingBag,
  Star,
  ArrowRight,
  Grid3X3,
  List,
  Package,
  Sparkles,
  Filter,
  Search,
  TrendingUp,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { Product } from "@/types/product";

// ✅ UPDATED: Import centralized API functions
import {
  getUserWishlist,
  removeFromWishlist,
  addToBag,
  handleApiError
} from "@/utils/api";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Responsive helpers
const isTablet = screenWidth >= 768;
const isLargeTablet = screenWidth >= 1024;

const getResponsiveValue = (phone: number, tablet: number, largeTablet?: number) => {
  if (isLargeTablet && largeTablet) return largeTablet;
  if (isTablet) return tablet;
  return phone;
};

const wp = (percentage: number) => (screenWidth * percentage) / 100;
const hp = (percentage: number) => (screenHeight * percentage) / 100;

// Types
interface WishlistItem {
  _id: string;
  userId: string;
  productId: Product;
  addedAt: string;
  priority: 'low' | 'medium' | 'high';
  notes: string;
  priceAlertEnabled: boolean;
  originalPrice: number;
  daysInWishlist: number;
}

interface WishlistState {
  items: WishlistItem[];
  stats: any;
  isLoading: boolean;
  refreshing: boolean;
  error: string | null;
}

type ViewMode = 'grid' | 'list';
type SortOption = 'newest' | 'oldest' | 'price_low' | 'price_high' | 'priority';

const SORT_OPTIONS = [
  { label: 'Newest First', value: 'newest' as SortOption },
  { label: 'Oldest First', value: 'oldest' as SortOption },
  { label: 'Price: Low to High', value: 'price_low' as SortOption },
  { label: 'Price: High to Low', value: 'price_high' as SortOption },
  { label: 'Priority', value: 'priority' as SortOption },
];

export default function Wishlist() {
  const router = useRouter();
  const { user } = useAuth();

  // State
  const [state, setState] = useState<WishlistState>({
    items: [],
    stats: null,
    isLoading: false,
    refreshing: false,
    error: null,
  });

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [movingToBag, setMovingToBag] = useState<Set<string>>(new Set());
  const [selectedPriority, setSelectedPriority] = useState<string>('all');

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const headerHeight = useRef(new Animated.Value(0)).current;

  // Responsive calculations
  const itemWidth = viewMode === 'grid' 
    ? (screenWidth - wp(6)) / getResponsiveValue(2, 3, 4) - wp(2)
    : screenWidth - wp(8);

  // Effects
  useEffect(() => {
    if (user) {
      fetchWishlist();
      initializeAnimations();
    }
  }, [user]);

  useEffect(() => {
    if (user && state.items.length > 0) {
      // Re-sort when sort option changes
      sortItems();
    }
  }, [sortBy]);

  // Animations
  const initializeAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(headerHeight, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false,
      }),
    ]).start();
  };

  // ✅ UPDATED: API calls using centralized functions
  const fetchWishlist = async (showLoading = true) => {
    if (!user) return;

    try {
      if (showLoading) {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
      }
      
      // ✅ UPDATED: Use centralized getUserWishlist function
      const wishlistResponse = await getUserWishlist(user._id, {
        includeStats: true
      });

      if (wishlistResponse.success) {
        // Extract items and stats from response
        const items = Array.isArray(wishlistResponse.data) ? wishlistResponse.data : [];
        
        // Mock stats calculation since the backend might not provide this
        const stats = {
          totalItems: items.length,
          totalValue: items.reduce((sum: number, item: any) => 
            sum + (item.productId?.price || 0), 0),
          uniqueBrands: new Set(items.map((item: any) => item.productId?.brand)).size,
          priceAlertsEnabled: items.filter((item: any) => item.priceAlertEnabled).length,
        };

        setState(prev => ({
          ...prev,
          items: items.map((item: any) => ({
            ...item,
            // Add computed fields if missing
            originalPrice: item.originalPrice || item.productId?.price || 0,
            daysInWishlist: item.daysInWishlist || 
              Math.floor((Date.now() - new Date(item.addedAt).getTime()) / (1000 * 60 * 60 * 24)),
            priority: item.priority || 'medium',
            priceAlertEnabled: item.priceAlertEnabled || false,
            notes: item.notes || '',
          })),
          stats,
          isLoading: false,
          error: null,
        }));
      } else {
        const errorMessage = handleApiError(wishlistResponse.error);
        setState(prev => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
          items: [],
        }));
      }
    } catch (error: any) {
      console.error("Error fetching wishlist:", error);
      const errorMessage = "Failed to load wishlist";
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
        items: [],
      }));
    }
  };

  const sortItems = () => {
    setState(prev => ({
      ...prev,
      items: [...prev.items].sort((a, b) => {
        switch (sortBy) {
          case 'newest':
            return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
          case 'oldest':
            return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
          case 'price_low':
            return a.productId.price - b.productId.price;
          case 'price_high':
            return b.productId.price - a.productId.price;
          case 'priority':
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          default:
            return 0;
        }
      })
    }));
  };

  // ✅ UPDATED: Remove from wishlist using centralized API
  const handleRemoveFromWishlist = async (itemId: string, productName: string) => {
    Alert.alert(
      "Remove from Wishlist",
      `Remove "${productName}" from your wishlist?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              // ✅ UPDATED: Use centralized removeFromWishlist function
              const response = await removeFromWishlist(itemId);
              
              if (response.success) {
                setState(prev => ({
                  ...prev,
                  items: prev.items.filter(item => item._id !== itemId),
                }));
                
                // Show success message
                Alert.alert("Removed", `${productName} removed from wishlist`);
              } else {
                Alert.alert("Error", handleApiError(response.error));
              }
            } catch (error) {
              console.error("Error removing from wishlist:", error);
              Alert.alert("Error", "Failed to remove item from wishlist");
            }
          },
        },
      ]
    );
  };

  // ✅ UPDATED: Move to bag using centralized API
  const handleMoveToBag = async (item: WishlistItem) => {
    if (!user) return;

    const productId = item.productId._id;
    setMovingToBag(prev => new Set([...prev, productId]));

    try {
      // ✅ UPDATED: Use centralized addToBag function
      const bagResponse = await addToBag({
        userId: user._id,
        productId: productId,
        quantity: 1,
        // Note: These additional fields might need to be added to the centralized API
        // priceWhenAdded: item.productId.price,
        // addedFrom: 'wishlist'
      });

      if (bagResponse.success) {
        // ✅ UPDATED: Remove from wishlist using centralized function
        const wishlistResponse = await removeFromWishlist(item._id);

        if (wishlistResponse.success) {
          // Update state
          setState(prev => ({
            ...prev,
            items: prev.items.filter(wishlistItem => wishlistItem._id !== item._id),
          }));

          Alert.alert(
            "Moved to Bag",
            `${item.productId.name} has been moved to your bag`,
            [
              { text: "Continue Shopping", style: "cancel" },
              { text: "View Bag", onPress: () => router.push("/(tabs)/bag") },
            ]
          );
        } else {
          Alert.alert("Error", "Item added to bag but couldn't remove from wishlist");
        }
      } else {
        Alert.alert("Error", handleApiError(bagResponse.error));
      }
    } catch (error) {
      console.error("Error moving to bag:", error);
      Alert.alert("Error", "Failed to move item to bag");
    } finally {
      setMovingToBag(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  const onRefresh = async () => {
    setState(prev => ({ ...prev, refreshing: true }));
    await fetchWishlist(false);
    setState(prev => ({ ...prev, refreshing: false }));
  };

  // Filter items by priority
  const filteredItems = useMemo(() => {
    if (selectedPriority === 'all') return state.items;
    return state.items.filter(item => item.priority === selectedPriority);
  }, [state.items, selectedPriority]);

  // Components (keeping all existing components unchanged)
  const RatingDisplay: React.FC<{ 
    rating?: number; 
    size?: number;
    ratingCount?: number;
  }> = ({ rating, size = 14, ratingCount }) => {
    if (!rating) return null;
    
    return (
      <View style={styles.ratingContainer}>
        <Star size={size} color="#ffa500" fill="#ffa500" />
        <Text style={[styles.ratingText, { fontSize: size - 2 }]}>
          {rating.toFixed(1)}
        </Text>
        {ratingCount && (
          <Text style={[styles.ratingCount, { fontSize: size - 4 }]}>
            ({ratingCount})
          </Text>
        )}
      </View>
    );
  };

  const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
    const colors = {
      high: '#ff3f6c',
      medium: '#ffa500', 
      low: '#666'
    };

    return (
      <View style={[styles.priorityBadge, { backgroundColor: colors[priority as keyof typeof colors] }]}>
        <Text style={styles.priorityText}>{priority.toUpperCase()}</Text>
      </View>
    );
  };

  const WishlistItemCard: React.FC<{ 
    item: WishlistItem; 
    onRemove: () => void;
    onMoveToBag: () => void;
    isMoving: boolean;
  }> = ({ item, onRemove, onMoveToBag, isMoving }) => {
    const product = item.productId;
    const cardStyle = viewMode === 'grid' ? styles.gridCard : styles.listCard;
    const imageStyle = viewMode === 'grid' ? styles.gridImage : styles.listImage;
    const infoStyle = viewMode === 'grid' ? styles.gridInfo : styles.listInfo;

    const priceChanged = item.originalPrice !== product.price;
    const priceSavings = item.originalPrice - product.price;

    return (
      <Animated.View 
        style={[
          cardStyle,
          { width: itemWidth },
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.productTouchable}
          onPress={() => router.push(`/product/${product._id}`)}
          activeOpacity={0.8}
        >
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: product.images?.[0] || "https://via.placeholder.com/200" }}
              style={imageStyle}
              defaultSource={{ uri: "https://via.placeholder.com/200" }}
            />
            
            {/* Product Badges */}
            <View style={styles.productBadges}>
              {product.isNew && (
                <View style={styles.newBadge}>
                  <Text style={styles.badgeText}>NEW</Text>
                </View>
              )}
              {product.discount && (
                <View style={styles.discountBadge}>
                  <Text style={styles.badgeText}>{product.discount}</Text>
                </View>
              )}
              {priceChanged && priceSavings > 0 && (
                <View style={styles.priceDrop}>
                  <Text style={styles.badgeText}>↓₹{priceSavings}</Text>
                </View>
              )}
            </View>

            {/* Wishlist Actions */}
            <View style={styles.wishlistActions}>
              <PriorityBadge priority={item.priority} />
            </View>
          </View>

          <View style={infoStyle}>
            <Text style={styles.brandName} numberOfLines={1}>
              {product.brand}
            </Text>
            <Text style={styles.productName} numberOfLines={viewMode === 'grid' ? 2 : 1}>
              {product.name}
            </Text>
            
            <View style={styles.priceContainer}>
              <Text style={styles.price}>₹{product.price}</Text>
              {priceChanged && (
                <Text style={[
                  styles.originalPrice, 
                  priceSavings > 0 ? styles.priceDown : styles.priceUp
                ]}>
                  ₹{item.originalPrice}
                </Text>
              )}
            </View>

            <RatingDisplay 
              rating={product.rating} 
              size={12}
              ratingCount={product.ratingCount}
            />

            <View style={styles.itemMeta}>
              <Text style={styles.daysInWishlist}>
                Added {item.daysInWishlist} day{item.daysInWishlist !== 1 ? 's' : ''} ago
              </Text>
              {item.priceAlertEnabled && (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertText}>🔔</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.moveToBagButton]}
            onPress={onMoveToBag}
            disabled={isMoving}
            activeOpacity={0.7}
          >
            {isMoving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <ShoppingBag size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Move to Bag</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.removeButton]}
            onPress={onRemove}
            activeOpacity={0.7}
          >
            <Trash2 size={16} color="#ff6b6b" />
            <Text style={[styles.actionButtonText, { color: "#ff6b6b" }]}>Remove</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const EmptyWishlistState: React.FC = () => (
    <Animated.View 
      style={[
        styles.emptyState,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.emptyIconContainer}>
        <Heart size={80} color="#ff3f6c" />
        <Sparkles size={32} color="#ffa500" style={styles.sparkleIcon} />
      </View>
      <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
      <Text style={styles.emptySubtitle}>
        Add items you love to your wishlist and never lose track of them
      </Text>
      <TouchableOpacity
        style={styles.browseButton}
        onPress={() => router.push("/(tabs)/categories")}
        activeOpacity={0.8}
      >
        <Package size={20} color="#fff" />
        <Text style={styles.browseButtonText}>Browse Products</Text>
        <ArrowRight size={16} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );

  const WishlistStats: React.FC = () => {
    if (!state.stats) return null;

    return (
      <Animated.View 
        style={[
          styles.statsContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{state.stats.totalItems}</Text>
          <Text style={styles.statLabel}>Items</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>₹{state.stats.totalValue}</Text>
          <Text style={styles.statLabel}>Total Value</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{state.stats.uniqueBrands}</Text>
          <Text style={styles.statLabel}>Brands</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{state.stats.priceAlertsEnabled}</Text>
          <Text style={styles.statLabel}>Alerts</Text>
        </View>
      </Animated.View>
    );
  };

  const FilterBar: React.FC = () => (
    <Animated.View 
      style={[
        styles.filterBar,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      {/* Priority Filter */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Priority:</Text>
        <View style={styles.filterChips}>
          {['all', 'high', 'medium', 'low'].map((priority) => (
            <TouchableOpacity
              key={priority}
              style={[
                styles.filterChip,
                selectedPriority === priority && styles.activeFilterChip,
              ]}
              onPress={() => setSelectedPriority(priority)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterChipText,
                selectedPriority === priority && styles.activeFilterChipText,
              ]}>
                {priority === 'all' ? 'All' : priority.charAt(0).toUpperCase() + priority.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Sort Filter */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Sort:</Text>
        <View style={styles.filterChips}>
          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.filterChip,
                sortBy === option.value && styles.activeFilterChip,
              ]}
              onPress={() => setSortBy(option.value)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterChipText,
                sortBy === option.value && styles.activeFilterChipText,
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Animated.View>
  );

  // Login required state
  if (!user) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Wishlist</Text>
        </View>
        
        <View style={styles.emptyState}>
          <Heart size={80} color="#ff3f6c" />
          <Text style={styles.emptyTitle}>Please login to view your wishlist</Text>
          <Text style={styles.emptySubtitle}>
            Save your favorite items and access them anytime
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("/login")}
            activeOpacity={0.8}
          >
            <Text style={styles.loginButtonText}>LOGIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Enhanced Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: fadeAnim,
          }
        ]}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Wishlist</Text>
          {filteredItems.length > 0 && (
            <View style={styles.itemCount}>
              <Text style={styles.itemCountText}>{filteredItems.length}</Text>
            </View>
          )}
        </View>
        
        {state.items.length > 0 && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'grid' && styles.activeViewMode]}
              onPress={() => setViewMode('grid')}
              activeOpacity={0.7}
            >
              <Grid3X3 size={18} color={viewMode === 'grid' ? "#ff3f6c" : "#666"} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'list' && styles.activeViewMode]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.7}
            >
              <List size={18} color={viewMode === 'list' ? "#ff3f6c" : "#666"} />
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Content */}
      {state.isLoading && state.items.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff3f6c" />
          <Text style={styles.loadingText}>Loading your wishlist...</Text>
        </View>
      ) : state.error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{state.error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => fetchWishlist()}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : state.items.length === 0 ? (
        <EmptyWishlistState />
      ) : (
        <>
          {/* Stats */}
          <WishlistStats />

          {/* Filters */}
          <FilterBar />

          {/* Items List */}
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item._id}
            numColumns={viewMode === 'grid' ? getResponsiveValue(2, 3, 4) : 1}
            key={`${viewMode}-${getResponsiveValue(2, 3, 4)}`}
            renderItem={({ item, index }) => (
              <WishlistItemCard
                item={item}
                onRemove={() => handleRemoveFromWishlist(item._id, item.productId.name)}
                onMoveToBag={() => handleMoveToBag(item)}
                isMoving={movingToBag.has(item.productId._id)}
              />
            )}
            contentContainerStyle={[
              styles.listContainer,
              viewMode === 'list' && styles.listModeContainer,
            ]}
            refreshControl={
              <RefreshControl
                refreshing={state.refreshing}
                onRefresh={onRefresh}
                colors={["#ff3f6c"]}
                tintColor="#ff3f6c"
              />
            }
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => 
              viewMode === 'list' ? <View style={styles.listSeparator} /> : null
            }
          />
        </>
      )}
    </View>
  );
}

// ✅ KEEPING ALL EXISTING STYLES UNCHANGED
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
    fontWeight: '500',
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
    paddingTop: hp(6),
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  itemCount: {
    backgroundColor: '#ff3f6c',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  itemCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    padding: 2,
  },
  viewModeButton: {
    padding: 8,
    borderRadius: 4,
  },
  activeViewMode: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8f9fa',
    paddingVertical: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ff3f6c',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterSection: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeFilterChip: {
    backgroundColor: '#ff3f6c',
    borderColor: '#ff3f6c',
  },
  filterChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#fff',
  },
  listContainer: {
    padding: 16,
  },
  listModeContainer: {
    paddingHorizontal: 16,
  },
  gridCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  listCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  productTouchable: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#f8f9fa',
  },
  listImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f8f9fa',
  },
  productBadges: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'column',
  },
  newBadge: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  discountBadge: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  priceDrop: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
  },
  wishlistActions: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
  },
  gridInfo: {
    padding: 12,
    paddingBottom: 0,
  },
  listInfo: {
    padding: 12,
    paddingBottom: 0,
  },
  brandName: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 2,
  },
  productName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 6,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  price: {
    fontSize: 16,
    color: '#333',
    fontWeight: '700',
  },
  originalPrice: {
    fontSize: 12,
    marginLeft: 6,
    textDecorationLine: 'line-through',
  },
  priceDown: {
    color: '#4caf50',
  },
  priceUp: {
    color: '#ff6b6b',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingText: {
    marginLeft: 4,
    color: '#666',
    fontWeight: '500',
  },
  ratingCount: {
    marginLeft: 2,
    color: '#999',
  },
  itemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  daysInWishlist: {
    fontSize: 10,
    color: '#999',
  },
  alertBadge: {
    backgroundColor: '#ffa500',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  alertText: {
    fontSize: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 12,
    paddingTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginHorizontal: 2,
  },
  moveToBagButton: {
    backgroundColor: '#ff3f6c',
  },
  removeButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ff6b6b',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    color: '#fff',
  },
  listSeparator: {
    height: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  sparkleIcon: {
    position: 'absolute',
    top: -10,
    right: -10,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#ff3f6c',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  loginButton: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 10,
    shadowColor: '#ff3f6c',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
