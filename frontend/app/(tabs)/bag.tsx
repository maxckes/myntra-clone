import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Image,
  FlatList,
  Alert,
  RefreshControl,
  Animated,
  Platform,
} from "react-native";
import { router } from "expo-router";
import {
  ShoppingBag,
  Heart,
  Trash2,
  Plus,
  Minus,
  Truck,
  Tag,
  ArrowRight,
  BookmarkPlus,
  Gift,
  CreditCard,
  Clock,
  CheckCircle,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { BagItem } from "@/types/product";

// ✅ UPDATED: Import enhanced API functions
import {
  getUserBag,
  getBagSummary,
  updateBagItemQuantity,
  removeBagItem,
  moveBagItemToWishlist,
  saveBagItemForLater,
  clearUserBag,
  handleApiError,
} from "@/utils/api";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// ✅ RESPONSIVE: Calculate dimensions based on device type
const isTablet = screenWidth >= 768;
const isLargePhone = screenWidth >= 414;

// ✅ Enhanced interfaces for mobile/tablet optimization
interface BagData {
  items: BagItem[];
  summary: {
    subtotal: number;
    discount: number;
    deliveryCharge: number;
    tax: number;
    total: number;
    itemCount: number;
    totalQuantity: number;
    savings: number;
    freeDeliveryEligible: boolean;
    freeDeliveryRemaining: number;
  };
  stats?: any;
  isLoading: boolean;
  error: string | null;
}

interface BagItemCardProps {
  item: BagItem;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  onMoveToWishlist: (itemId: string, productName: string) => void;
  onSaveForLater: (itemId: string, productName: string) => void;
  isUpdating: boolean;
}

export default function BagScreen() {
  const { user } = useAuth();

  // ✅ ENHANCED: State management optimized for mobile
  const [bagData, setBagData] = useState<BagData>({
    items: [],
    summary: {
      subtotal: 0,
      discount: 0,
      deliveryCharge: 0,
      tax: 0,
      total: 0,
      itemCount: 0,
      totalQuantity: 0,
      savings: 0,
      freeDeliveryEligible: false,
      freeDeliveryRemaining: 0,
    },
    isLoading: true,
    error: null,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [processingCheckout, setProcessingCheckout] = useState(false);

  // ✅ RESPONSIVE: Animation for mobile interactions
  const [checkoutButtonScale] = useState(new Animated.Value(1));

  // ✅ ENHANCED: Load comprehensive bag data
  const loadBagData = useCallback(async () => {
    if (!user) {
      setBagData(prev => ({
        ...prev,
        isLoading: false,
        error: null,
        items: [],
      }));
      return;
    }

    try {
      setBagData(prev => ({ ...prev, isLoading: true, error: null }));

      console.log('🛒 Loading bag data for user:', user._id);

      // ✅ Fetch bag with comprehensive totals
      const bagResponse = await getUserBag(user._id, {
        includeSaved: false,
        includeStats: true,
      });

      if (bagResponse.success && bagResponse.data) {
        const responseData = bagResponse.data;
        
        // Handle different response structures
        let items: BagItem[] = [];
        let summary = {
          subtotal: 0,
          discount: 0,
          deliveryCharge: 0,
          tax: 0,
          total: 0,
          itemCount: 0,
          totalQuantity: 0,
          savings: 0,
          freeDeliveryEligible: false,
          freeDeliveryRemaining: 0,
        };

        if (Array.isArray(responseData)) {
          items = responseData;
        } else if (responseData.data && Array.isArray(responseData.data)) {
          items = responseData.data;
          summary = responseData.summary || summary;
        } else if (responseData.summary) {
          items = responseData.data || [];
          summary = responseData.summary;
        }

        console.log('✅ Bag loaded:', items.length, 'items, Total:', summary.total);

        setBagData({
          items,
          summary,
          stats: responseData.stats || null,
          isLoading: false,
          error: null,
        });

      } else {
        throw new Error(handleApiError(bagResponse));
      }

    } catch (error: any) {
      console.error('❌ Error loading bag data:', error);
      setBagData(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to load bag',
      }));
    }
  }, [user]);

  // ✅ ENHANCED: Update quantity with optimistic updates
  const handleQuantityChange = async (itemId: string, quantity: number) => {
    if (quantity < 1 || quantity > 10) return;

    try {
      setUpdatingItems(prev => new Set([...prev, itemId]));

      // ✅ MOBILE: Optimistic update for better UX
      setBagData(prev => ({
        ...prev,
        items: prev.items.map(item => 
          item._id === itemId 
            ? { ...item, quantity }
            : item
        ),
      }));

      console.log('🔄 Updating quantity for item:', itemId, 'New quantity:', quantity);

      const response = await updateBagItemQuantity(itemId, quantity);

      if (response.success) {
        // ✅ Reload bag data to get updated totals
        await loadBagData();
      } else {
        // ✅ Revert optimistic update on error
        await loadBagData();
        Alert.alert("Error", handleApiError(response));
      }

    } catch (error) {
      console.error('❌ Update quantity error:', error);
      await loadBagData(); // Revert on error
      Alert.alert("Error", "Failed to update quantity");
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  // ✅ ENHANCED: Remove item with confirmation
  const handleRemoveItem = async (itemId: string, productName: string) => {
    Alert.alert(
      "Remove Item",
      `Remove ${productName} from your bag?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setUpdatingItems(prev => new Set([...prev, itemId]));

              console.log('🗑️ Removing item from bag:', itemId);

              const response = await removeBagItem(itemId);

              if (response.success) {
                await loadBagData();
                // ✅ MOBILE: Brief success feedback
                Alert.alert("Removed", `${productName} removed from bag`);
              } else {
                Alert.alert("Error", handleApiError(response));
              }

            } catch (error) {
              console.error('❌ Remove item error:', error);
              Alert.alert("Error", "Failed to remove item");
            } finally {
              setUpdatingItems(prev => {
                const newSet = new Set(prev);
                newSet.delete(itemId);
                return newSet;
              });
            }
          },
        },
      ]
    );
  };

  // ✅ ENHANCED: Move to wishlist
  const handleMoveToWishlist = async (itemId: string, productName: string) => {
    if (!user) return;

    try {
      setUpdatingItems(prev => new Set([...prev, itemId]));

      console.log('💝 Moving item to wishlist:', itemId);

      const response = await moveBagItemToWishlist(itemId, user._id);

      if (response.success) {
        await loadBagData();
        Alert.alert("Moved to Wishlist", `${productName} moved to wishlist`);
      } else {
        Alert.alert("Error", handleApiError(response));
      }

    } catch (error) {
      console.error('❌ Move to wishlist error:', error);
      Alert.alert("Error", "Failed to move item to wishlist");
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  // ✅ ENHANCED: Save for later
  const handleSaveForLater = async (itemId: string, productName: string) => {
    try {
      setUpdatingItems(prev => new Set([...prev, itemId]));

      console.log('💾 Saving item for later:', itemId);

      const response = await saveBagItemForLater(itemId);

      if (response.success) {
        await loadBagData();
        Alert.alert("Saved for Later", `${productName} saved for later`);
      } else {
        Alert.alert("Error", handleApiError(response));
      }

    } catch (error) {
      console.error('❌ Save for later error:', error);
      Alert.alert("Error", "Failed to save item for later");
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  // ✅ ENHANCED: Checkout with animation
  const handleCheckout = async () => {
    if (!user) {
      Alert.alert(
        "Login Required",
        "Please login to proceed with checkout",
        [
          { text: "Login", onPress: () => router.push("/login") },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    if (bagData.items.length === 0) {
      Alert.alert("Empty Bag", "Add some items to your bag first");
      return;
    }

    try {
      setProcessingCheckout(true);

      // ✅ RESPONSIVE: Button press animation
      Animated.sequence([
        Animated.timing(checkoutButtonScale, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(checkoutButtonScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      console.log('💳 Proceeding to checkout...');

      // ✅ Navigate to checkout
      router.push("/checkout");

    } catch (error) {
      console.error('❌ Checkout error:', error);
      Alert.alert("Error", "Failed to proceed to checkout");
    } finally {
      setProcessingCheckout(false);
    }
  };

  // ✅ Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadBagData();
    setRefreshing(false);
  };

  // ✅ Load data on mount and when user changes
  useEffect(() => {
    loadBagData();
  }, [loadBagData]);

  // ✅ RESPONSIVE: Bag Item Card Component
  const BagItemCard: React.FC<BagItemCardProps> = ({
    item,
    onQuantityChange,
    onRemove,
    onMoveToWishlist,
    onSaveForLater,
    isUpdating,
  }) => {
    const product = item.productId;
    if (!product) return null;

    const discountPercentage = product.discount ? 
      parseInt(product.discount.replace('%', '')) : 0;

    return (
      <View style={styles.bagItemCard}>
        <TouchableOpacity
          onPress={() => router.push(`/product/${product._id}`)}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: product.images?.[0] }}
            style={styles.bagItemImage}
            resizeMode="cover"
          />
        </TouchableOpacity>

        <View style={styles.bagItemInfo}>
          <TouchableOpacity
            onPress={() => router.push(`/product/${product._id}`)}
            activeOpacity={0.8}
          >
            <Text style={styles.bagItemBrand} numberOfLines={1}>
              {product.brand}
            </Text>
            <Text style={styles.bagItemName} numberOfLines={2}>
              {product.name}
            </Text>
          </TouchableOpacity>

          {/* ✅ RESPONSIVE: Size and Color Display */}
          <View style={styles.bagItemVariants}>
            {item.size && (
              <View style={styles.variantChip}>
                <Text style={styles.variantText}>Size: {item.size}</Text>
              </View>
            )}
            {item.color && (
              <View style={styles.variantChip}>
                <Text style={styles.variantText}>Color: {item.color}</Text>
              </View>
            )}
          </View>

          {/* ✅ RESPONSIVE: Pricing */}
          <View style={styles.bagItemPricing}>
            <Text style={styles.bagItemPrice}>₹{product.price}</Text>
            {discountPercentage > 0 && (
              <>
                <Text style={styles.bagItemOriginalPrice}>
                  ₹{Math.round(product.price / (1 - discountPercentage / 100))}
                </Text>
                <Text style={styles.bagItemDiscount}>({discountPercentage}% OFF)</Text>
              </>
            )}
          </View>

          {/* ✅ RESPONSIVE: Quantity Controls */}
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={[
                styles.quantityButton,
                (item.quantity <= 1 || isUpdating) && styles.quantityButtonDisabled,
              ]}
              onPress={() => onQuantityChange(item._id, item.quantity - 1)}
              disabled={item.quantity <= 1 || isUpdating}
              activeOpacity={0.7}
            >
              <Minus size={16} color={item.quantity <= 1 || isUpdating ? "#ccc" : "#333"} />
            </TouchableOpacity>

            <View style={styles.quantityDisplay}>
              {isUpdating ? (
                <ActivityIndicator size="small" color="#ff3f6c" />
              ) : (
                <Text style={styles.quantityText}>{item.quantity}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.quantityButton,
                (item.quantity >= 10 || isUpdating) && styles.quantityButtonDisabled,
              ]}
              onPress={() => onQuantityChange(item._id, item.quantity + 1)}
              disabled={item.quantity >= 10 || isUpdating}
              activeOpacity={0.7}
            >
              <Plus size={16} color={item.quantity >= 10 || isUpdating ? "#ccc" : "#333"} />
            </TouchableOpacity>
          </View>

          {/* ✅ RESPONSIVE: Action Buttons */}
          <View style={styles.bagItemActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onMoveToWishlist(item._id, product.name)}
              disabled={isUpdating}
              activeOpacity={0.7}
            >
              <Heart size={14} color="#666" />
              <Text style={styles.actionButtonText}>Wishlist</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onSaveForLater(item._id, product.name)}
              disabled={isUpdating}
              activeOpacity={0.7}
            >
              <BookmarkPlus size={14} color="#666" />
              <Text style={styles.actionButtonText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onRemove(item._id)}
              disabled={isUpdating}
              activeOpacity={0.7}
            >
              <Trash2 size={14} color="#f44336" />
              <Text style={[styles.actionButtonText, styles.removeButtonText]}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ✅ RESPONSIVE: Price Breakdown Component
  const PriceBreakdown: React.FC = () => (
    <View style={styles.priceBreakdownContainer}>
      <Text style={styles.priceBreakdownTitle}>Price Details ({bagData.summary.itemCount} items)</Text>
      
      <View style={styles.priceBreakdownContent}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Total MRP</Text>
          <Text style={styles.priceValue}>₹{bagData.summary.subtotal}</Text>
        </View>

        {bagData.summary.discount > 0 && (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Discount on MRP</Text>
            <Text style={[styles.priceValue, styles.discountValue]}>-₹{bagData.summary.discount}</Text>
          </View>
        )}

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Delivery Charges</Text>
          {bagData.summary.deliveryCharge > 0 ? (
            <Text style={styles.priceValue}>₹{bagData.summary.deliveryCharge}</Text>
          ) : (
            <Text style={[styles.priceValue, styles.freeValue]}>FREE</Text>
          )}
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Taxes</Text>
          <Text style={styles.priceValue}>₹{bagData.summary.tax}</Text>
        </View>

        <View style={styles.priceDivider} />

        <View style={styles.priceRow}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalValue}>₹{bagData.summary.total}</Text>
        </View>

        {bagData.summary.savings > 0 && (
          <View style={styles.savingsContainer}>
            <Gift size={16} color="#4caf50" />
            <Text style={styles.savingsText}>
              You saved ₹{bagData.summary.savings} on this order
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  // ✅ RESPONSIVE: Free Delivery Banner
  const FreeDeliveryBanner: React.FC = () => {
    if (bagData.summary.freeDeliveryEligible) {
      return (
        <View style={styles.freeDeliveryBanner}>
          <CheckCircle size={16} color="#4caf50" />
          <Text style={styles.freeDeliveryText}>
            Yay! You get FREE delivery on this order
          </Text>
        </View>
      );
    }

    if (bagData.summary.freeDeliveryRemaining > 0) {
      return (
        <View style={styles.freeDeliveryBanner}>
          <Truck size={16} color="#ff9800" />
          <Text style={styles.freeDeliveryText}>
            Add ₹{bagData.summary.freeDeliveryRemaining} more for FREE delivery
          </Text>
        </View>
      );
    }

    return null;
  };

  // ✅ Empty bag state
  if (!user) {
    return (
      <View style={styles.emptyContainer}>
        <ShoppingBag size={80} color="#ccc" />
        <Text style={styles.emptyTitle}>Login to view your bag</Text>
        <Text style={styles.emptyText}>
          Save your favorite items and shop from anywhere
        </Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => router.push("/login")}
          activeOpacity={0.8}
        >
          <Text style={styles.loginButtonText}>Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ✅ Loading state
  if (bagData.isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff3f6c" />
        <Text style={styles.loadingText}>Loading your bag...</Text>
      </View>
    );
  }

  // ✅ Error state
  if (bagData.error && !refreshing) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{bagData.error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadBagData}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ✅ Empty bag state
  if (bagData.items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <ShoppingBag size={80} color="#ccc" />
        <Text style={styles.emptyTitle}>Your bag is empty</Text>
        <Text style={styles.emptyText}>
          Add some items to get started
        </Text>
        <TouchableOpacity
          style={styles.shopButton}
          onPress={() => router.push("/(tabs)/categories")}
          activeOpacity={0.8}
        >
          <Text style={styles.shopButtonText}>Start Shopping</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* ✅ RESPONSIVE: Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          My Bag ({bagData.summary.itemCount} {bagData.summary.itemCount === 1 ? 'item' : 'items'})
        </Text>
        <Text style={styles.headerSubtitle}>
          {bagData.summary.totalQuantity} {bagData.summary.totalQuantity === 1 ? 'piece' : 'pieces'}
        </Text>
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
        {/* ✅ RESPONSIVE: Free Delivery Banner */}
        <FreeDeliveryBanner />

        {/* ✅ RESPONSIVE: Bag Items */}
        <View style={styles.bagItemsContainer}>
          <FlatList
            data={bagData.items}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <BagItemCard
                item={item}
                onQuantityChange={handleQuantityChange}
                onRemove={(itemId) => {
                  const productName = item.productId?.name || "this item";
                  handleRemoveItem(itemId, productName);
                }}
                onMoveToWishlist={handleMoveToWishlist}
                onSaveForLater={(itemId) => {
                  const productName = item.productId?.name || "this item";
                  handleSaveForLater(itemId, productName);
                }}
                isUpdating={updatingItems.has(item._id)}
              />
            )}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* ✅ RESPONSIVE: Price Breakdown */}
        <PriceBreakdown />

        {/* ✅ RESPONSIVE: Delivery Information */}
        <View style={styles.deliveryInfoContainer}>
          <View style={styles.deliveryInfoItem}>
            <Clock size={16} color="#666" />
            <Text style={styles.deliveryInfoText}>
              Estimated delivery: 3-5 business days
            </Text>
          </View>
          <View style={styles.deliveryInfoItem}>
            <Truck size={16} color="#666" />
            <Text style={styles.deliveryInfoText}>
              Free returns within 30 days
            </Text>
          </View>
        </View>

        {/* Bottom Spacing for Fixed Button */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ✅ RESPONSIVE: Fixed Checkout Button */}
      <View style={styles.checkoutContainer}>
        <View style={styles.checkoutSummary}>
          <Text style={styles.checkoutTotal}>₹{bagData.summary.total}</Text>
          <Text style={styles.checkoutItems}>
            {bagData.summary.itemCount} {bagData.summary.itemCount === 1 ? 'item' : 'items'}
          </Text>
        </View>

        <Animated.View style={{ transform: [{ scale: checkoutButtonScale }] }}>
          <TouchableOpacity
            style={[styles.checkoutButton, processingCheckout && styles.checkoutButtonDisabled]}
            onPress={handleCheckout}
            disabled={processingCheckout}
            activeOpacity={0.8}
          >
            {processingCheckout ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <CreditCard size={20} color="#fff" />
            )}
            <Text style={styles.checkoutButtonText}>
              {processingCheckout ? "Processing..." : "Place Order"}
            </Text>
            {!processingCheckout && <ArrowRight size={16} color="#fff" />}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

// ✅ RESPONSIVE STYLES - Optimized for Mobile & Tablet
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  loginButton: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: isTablet ? 32 : 24,
    paddingVertical: isTablet ? 16 : 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: isTablet ? 18 : 16,
    fontWeight: '600',
  },
  shopButton: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: isTablet ? 32 : 24,
    paddingVertical: isTablet ? 16 : 12,
    borderRadius: 8,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: isTablet ? 18 : 16,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: isTablet ? 24 : 16,
    paddingVertical: isTablet ? 20 : 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: '700',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },

  // ✅ RESPONSIVE: Free Delivery Banner
  freeDeliveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: isTablet ? 24 : 16,
    paddingVertical: isTablet ? 16 : 12,
    marginHorizontal: isTablet ? 24 : 16,
    marginTop: 16,
    borderRadius: 8,
  },
  freeDeliveryText: {
    fontSize: isTablet ? 16 : 14,
    color: '#2e7d32',
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },

  // ✅ RESPONSIVE: Bag Items
  bagItemsContainer: {
    paddingHorizontal: isTablet ? 24 : 16,
    paddingTop: 16,
  },
  bagItemCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: isTablet ? 20 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  bagItemImage: {
    width: isTablet ? 120 : 100,
    height: isTablet ? 150 : 120,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  bagItemInfo: {
    flex: 1,
    marginLeft: isTablet ? 20 : 16,
    justifyContent: 'space-between',
  },
  bagItemBrand: {
    fontSize: isTablet ? 14 : 12,
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bagItemName: {
    fontSize: isTablet ? 18 : 16,
    color: '#333',
    fontWeight: '400',
    marginTop: 4,
    lineHeight: isTablet ? 24 : 20,
  },
  bagItemVariants: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  variantChip: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  variantText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  bagItemPricing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  bagItemPrice: {
    fontSize: isTablet ? 20 : 18,
    color: '#333',
    fontWeight: '700',
    marginRight: 12,
  },
  bagItemOriginalPrice: {
    fontSize: isTablet ? 16 : 14,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  bagItemDiscount: {
    fontSize: isTablet ? 14 : 12,
    color: '#ff3f6c',
    fontWeight: '500',
  },

  // ✅ RESPONSIVE: Quantity Controls
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  quantityButton: {
    width: isTablet ? 40 : 32,
    height: isTablet ? 40 : 32,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonDisabled: {
    backgroundColor: '#f0f0f0',
    borderColor: '#e0e0e0',
  },
  quantityDisplay: {
    minWidth: isTablet ? 60 : 50,
    height: isTablet ? 40 : 32,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  quantityText: {
    fontSize: isTablet ? 16 : 14,
    color: '#333',
    fontWeight: '600',
  },

  // ✅ RESPONSIVE: Action Buttons
  bagItemActions: {
    flexDirection: 'row',
    marginTop: 12,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
    marginRight: 8,
    marginBottom: 4,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginLeft: 4,
  },
  removeButtonText: {
    color: '#f44336',
  },

  // ✅ RESPONSIVE: Price Breakdown
  priceBreakdownContainer: {
    backgroundColor: '#f8f9fa',
    marginHorizontal: isTablet ? 24 : 16,
    marginTop: 24,
    borderRadius: 12,
    padding: isTablet ? 20 : 16,
  },
  priceBreakdownTitle: {
    fontSize: isTablet ? 18 : 16,
    color: '#333',
    fontWeight: '600',
    marginBottom: 16,
  },
  priceBreakdownContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: isTablet ? 16 : 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  priceLabel: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
  },
  priceValue: {
    fontSize: isTablet ? 16 : 14,
    color: '#333',
    fontWeight: '500',
  },
  discountValue: {
    color: '#4caf50',
  },
  freeValue: {
    color: '#4caf50',
    fontWeight: '600',
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: isTablet ? 18 : 16,
    color: '#333',
    fontWeight: '600',
  },
  totalValue: {
    fontSize: isTablet ? 20 : 18,
    color: '#333',
    fontWeight: '700',
  },
  savingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  savingsText: {
    fontSize: isTablet ? 16 : 14,
    color: '#2e7d32',
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },

  // ✅ RESPONSIVE: Delivery Information
  deliveryInfoContainer: {
    paddingHorizontal: isTablet ? 24 : 16,
    paddingVertical: 20,
  },
  deliveryInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  deliveryInfoText: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },

  // ✅ RESPONSIVE: Checkout Container
  checkoutContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: isTablet ? 24 : 16,
    paddingVertical: isTablet ? 20 : 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    ...Platform.select({
      ios: {
        paddingBottom: 32,
      },
    }),
  },
  checkoutSummary: {
    flex: 1,
    marginRight: 16,
  },
  checkoutTotal: {
    fontSize: isTablet ? 24 : 20,
    color: '#333',
    fontWeight: '700',
  },
  checkoutItems: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
    marginTop: 2,
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff3f6c',
    paddingHorizontal: isTablet ? 32 : 24,
    paddingVertical: isTablet ? 16 : 14,
    borderRadius: 8,
    minWidth: isTablet ? 200 : 160,
  },
  checkoutButtonDisabled: {
    backgroundColor: '#ccc',
  },
  checkoutButtonText: {
    fontSize: isTablet ? 18 : 16,
    color: '#fff',
    fontWeight: '600',
    marginHorizontal: 8,
  },
});
