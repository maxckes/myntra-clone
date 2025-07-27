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
  Modal,
  Animated,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Heart,
  ShoppingBag,
  Star,
  Share2,
  ChevronRight,
  Minus,
  Plus,
  Truck,
  Shield,
  RotateCcw,
  Check,
  X,
  Info,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { Product } from "@/types/product";

// ✅ UPDATED: Import enhanced API functions
import {
  getProductById,
  getProductRecommendations,
  addToWishlist,
  removeFromWishlist,
  checkWishlistStatus,
  addToBag,
  handleApiError,
} from "@/utils/api";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// ✅ RESPONSIVE: Calculate dimensions based on device type
const isTablet = screenWidth >= 768;
const isLargePhone = screenWidth >= 414;
const cardWidth = isTablet ? (screenWidth - 60) / 3 : isLargePhone ? (screenWidth - 48) / 2 : (screenWidth - 32) / 2;

// ✅ Enhanced interfaces for mobile/tablet optimization
interface ProductData {
  product: Product | null;
  recommendations: Product[];
  isLoading: boolean;
  error: string | null;
}

interface SizeOption {
  size: string;
  available: boolean;
  stock?: number;
}

interface ColorOption {
  color: string;
  available: boolean;
  colorCode?: string;
}

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  // ✅ ENHANCED: State management optimized for mobile
  const [productData, setProductData] = useState<ProductData>({
    product: null,
    recommendations: [],
    isLoading: true,
    error: null,
  });

  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistItemId, setWishlistItemId] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [addingToBag, setAddingToBag] = useState(false);
  const [toggleWishlist, setToggleWishlist] = useState(false);

  // ✅ RESPONSIVE: Animation for mobile interactions
  const [scaleAnim] = useState(new Animated.Value(1));
  const [imageScaleAnim] = useState(new Animated.Value(1));

  // ✅ ENHANCED: Load comprehensive product data
  const loadProductData = useCallback(async () => {
    if (!id) return;

    try {
      setProductData(prev => ({ ...prev, isLoading: true, error: null }));

      console.log('📦 Loading product data for:', id);

      // ✅ Fetch product and recommendations in parallel
      const [productResponse, recommendationsResponse] = await Promise.all([
        getProductById(id),
        getProductRecommendations(id, 8),
      ]);

      if (productResponse.success && productResponse.data) {
        const product = productResponse.data;
        const recommendations = recommendationsResponse.success ? recommendationsResponse.data || [] : [];

        console.log('✅ Product loaded:', product.name);
        console.log('✅ Recommendations loaded:', recommendations.length);

        setProductData({
          product,
          recommendations,
          isLoading: false,
          error: null,
        });

        // ✅ Load wishlist status if user is logged in
        if (user) {
          loadWishlistStatus(product._id);
        }

        // ✅ Auto-select first available size
        if (product.sizes && product.sizes.length > 0) {
          setSelectedSize(product.sizes[0]);
        }

        // ✅ Auto-select first available color
        if (product.colors && product.colors.length > 0) {
          setSelectedColor(product.colors[0]);
        }

      } else {
        throw new Error(handleApiError(productResponse));
      }

    } catch (error: any) {
      console.error('❌ Error loading product data:', error);
      setProductData({
        product: null,
        recommendations: [],
        isLoading: false,
        error: error.message || 'Failed to load product',
      });
    }
  }, [id, user]);

  // ✅ NEW: Load wishlist status
  const loadWishlistStatus = async (productId: string) => {
    if (!user) return;

    try {
      const response = await checkWishlistStatus(user._id, productId);
      if (response.success && response.data) {
        setIsWishlisted(response.data.isInWishlist);
        setWishlistItemId(response.data.wishlistItemId);
      }
    } catch (error) {
      console.error('❌ Error loading wishlist status:', error);
    }
  };

  // ✅ ENHANCED: Wishlist management with animation
  const handleWishlistPress = async () => {
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

    if (!productData.product) return;

    try {
      setToggleWishlist(true);

      // ✅ RESPONSIVE: Add touch feedback animation
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      console.log('💝 Toggling wishlist for product:', productData.product._id);

      if (isWishlisted && wishlistItemId) {
        // Remove from wishlist
        const response = await removeFromWishlist(wishlistItemId);
        
        if (response.success) {
          setIsWishlisted(false);
          setWishlistItemId(null);
          
          // ✅ MOBILE: Show brief success feedback
          Alert.alert("Removed", "Removed from wishlist", [{ text: "OK" }]);
        } else {
          Alert.alert("Error", handleApiError(response));
        }
      } else {
        // Add to wishlist
        const response = await addToWishlist({
          userId: user._id,
          productId: productData.product._id,
          priority: 'medium',
        });
        
        if (response.success) {
          setIsWishlisted(true);
          setWishlistItemId(response.data?._id || null);
          
          // ✅ MOBILE: Show brief success feedback
          Alert.alert("Added", "Added to wishlist", [{ text: "OK" }]);
        } else {
          Alert.alert("Error", handleApiError(response));
        }
      }
    } catch (error) {
      console.error('❌ Wishlist error:', error);
      Alert.alert("Error", "Failed to update wishlist");
    } finally {
      setToggleWishlist(false);
    }
  };

  // ✅ ENHANCED: Add to bag with comprehensive validation
  const handleAddToBag = async () => {
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

    if (!productData.product) return;

    // ✅ MOBILE: Validate size selection for products with sizes
    if (productData.product.sizes && productData.product.sizes.length > 0 && !selectedSize) {
      Alert.alert("Select Size", "Please select a size before adding to bag");
      return;
    }

    // ✅ MOBILE: Validate color selection for products with colors
    if (productData.product.colors && productData.product.colors.length > 0 && !selectedColor) {
      Alert.alert("Select Color", "Please select a color before adding to bag");
      return;
    }

    try {
      setAddingToBag(true);

      console.log('🛒 Adding to bag:', {
        productId: productData.product._id,
        size: selectedSize,
        color: selectedColor,
        quantity,
      });

      const response = await addToBag({
        userId: user._id,
        productId: productData.product._id,
        quantity,
        size: selectedSize || undefined,
        color: selectedColor || undefined,
      });

      if (response.success) {
        // ✅ MOBILE: Optimized success dialog
        Alert.alert(
          "Added to Bag",
          `${productData.product.name} has been added to your bag`,
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
    } finally {
      setAddingToBag(false);
    }
  };

  // ✅ RESPONSIVE: Navigation handlers
  const handleBackPress = () => {
    router.back();
  };

  const handleRecommendationPress = (productId: string) => {
    router.push(`/product/${productId}`);
  };

  const handleSharePress = () => {
    // ✅ MOBILE: Share functionality (placeholder)
    Alert.alert("Share", "Share functionality coming soon!");
  };

  // ✅ Load data on mount
  useEffect(() => {
    loadProductData();
  }, [loadProductData]);

  // ✅ RESPONSIVE: Product Image Carousel optimized for mobile/tablet
  const ProductImageCarousel: React.FC<{ images: string[] }> = ({ images }) => (
    <View style={styles.imageCarouselContainer}>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const newIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
          setSelectedImageIndex(newIndex);
        }}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              // ✅ MOBILE: Image zoom animation
              Animated.sequence([
                Animated.timing(imageScaleAnim, {
                  toValue: 1.05,
                  duration: 200,
                  useNativeDriver: true,
                }),
                Animated.timing(imageScaleAnim, {
                  toValue: 1,
                  duration: 200,
                  useNativeDriver: true,
                }),
              ]).start();
            }}
          >
            <Animated.View style={{ transform: [{ scale: imageScaleAnim }] }}>
              <Image
                source={{ uri: item }}
                style={styles.productMainImage}
                resizeMode="cover"
              />
            </Animated.View>
          </TouchableOpacity>
        )}
        keyExtractor={(item, index) => index.toString()}
      />
      
      {/* ✅ RESPONSIVE: Image indicators */}
      <View style={styles.imageIndicators}>
        {images.map((_, index) => (
          <View
            key={index}
            style={[
              styles.imageIndicator,
              selectedImageIndex === index && styles.activeImageIndicator,
            ]}
          />
        ))}
      </View>
    </View>
  );

  // ✅ RESPONSIVE: Size Selection optimized for touch
  const SizeSelection: React.FC<{ sizes: string[] }> = ({ sizes }) => (
    <View style={styles.selectionContainer}>
      <Text style={styles.selectionTitle}>Size</Text>
      <View style={styles.sizeGrid}>
        {sizes.map((size) => (
          <TouchableOpacity
            key={size}
            style={[
              styles.sizeOption,
              selectedSize === size && styles.selectedSizeOption,
            ]}
            onPress={() => setSelectedSize(size)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.sizeOptionText,
              selectedSize === size && styles.selectedSizeOptionText,
            ]}>
              {size}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <TouchableOpacity
        style={styles.sizeGuideButton}
        onPress={() => setShowSizeGuide(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.sizeGuideText}>Size Guide</Text>
        <ChevronRight size={16} color="#ff3f6c" />
      </TouchableOpacity>
    </View>
  );

  // ✅ RESPONSIVE: Color Selection optimized for mobile
  const ColorSelection: React.FC<{ colors: string[] }> = ({ colors }) => (
    <View style={styles.selectionContainer}>
      <Text style={styles.selectionTitle}>Color</Text>
      <View style={styles.colorGrid}>
        {colors.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorOption,
              selectedColor === color && styles.selectedColorOption,
            ]}
            onPress={() => setSelectedColor(color)}
            activeOpacity={0.7}
          >
            <View style={[styles.colorSwatch, { backgroundColor: color.toLowerCase() }]} />
            <Text style={[
              styles.colorOptionText,
              selectedColor === color && styles.selectedColorOptionText,
            ]}>
              {color}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ✅ RESPONSIVE: Quantity Selector optimized for touch
  const QuantitySelector: React.FC = () => (
    <View style={styles.selectionContainer}>
      <Text style={styles.selectionTitle}>Quantity</Text>
      <View style={styles.quantityContainer}>
        <TouchableOpacity
          style={[styles.quantityButton, quantity <= 1 && styles.quantityButtonDisabled]}
          onPress={() => quantity > 1 && setQuantity(quantity - 1)}
          disabled={quantity <= 1}
          activeOpacity={0.7}
        >
          <Minus size={18} color={quantity <= 1 ? "#ccc" : "#333"} />
        </TouchableOpacity>
        
        <View style={styles.quantityDisplay}>
          <Text style={styles.quantityText}>{quantity}</Text>
        </View>
        
        <TouchableOpacity
          style={[styles.quantityButton, quantity >= 10 && styles.quantityButtonDisabled]}
          onPress={() => quantity < 10 && setQuantity(quantity + 1)}
          disabled={quantity >= 10}
          activeOpacity={0.7}
        >
          <Plus size={18} color={quantity >= 10 ? "#ccc" : "#333"} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ✅ RESPONSIVE: Product Card for recommendations
  const RecommendationCard: React.FC<{ product: Product }> = ({ product }) => {
    const discountPercentage = product.discount ? parseInt(product.discount.replace('%', '')) : 0;

    return (
      <TouchableOpacity
        style={[styles.recommendationCard, { width: cardWidth }]}
        onPress={() => handleRecommendationPress(product._id)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: product.images?.[0] }}
          style={styles.recommendationImage}
          resizeMode="cover"
        />
        
        {discountPercentage > 0 && (
          <View style={styles.recommendationDiscount}>
            <Text style={styles.recommendationDiscountText}>{discountPercentage}% OFF</Text>
          </View>
        )}
        
        <View style={styles.recommendationInfo}>
          <Text style={styles.recommendationBrand} numberOfLines={1}>
            {product.brand}
          </Text>
          <Text style={styles.recommendationName} numberOfLines={2}>
            {product.name}
          </Text>
          <Text style={styles.recommendationPrice}>₹{product.price}</Text>
          
          {product.rating && (
            <View style={styles.recommendationRating}>
              <Star size={12} color="#ffa500" fill="#ffa500" />
              <Text style={styles.recommendationRatingText}>{product.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ✅ Loading state
  if (productData.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff3f6c" />
        <Text style={styles.loadingText}>Loading product...</Text>
      </View>
    );
  }

  // ✅ Error state
  if (productData.error || !productData.product) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Product not found</Text>
        <Text style={styles.errorText}>
          {productData.error || "The product you're looking for doesn't exist"}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleBackPress}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { product } = productData;
  const discountPercentage = product.discount ? parseInt(product.discount.replace('%', '')) : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* ✅ RESPONSIVE: Header optimized for mobile */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleBackPress}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleSharePress}
            activeOpacity={0.7}
          >
            <Share2 size={22} color="#333" />
          </TouchableOpacity>
          
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={[styles.headerButton, styles.wishlistHeaderButton]}
              onPress={handleWishlistPress}
              disabled={toggleWishlist}
              activeOpacity={0.7}
            >
              <Heart
                size={22}
                color={isWishlisted ? "#ff3f6c" : "#333"}
                fill={isWishlisted ? "#ff3f6c" : "none"}
              />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* ✅ RESPONSIVE: Product Images */}
        <ProductImageCarousel images={product.images} />

        {/* ✅ RESPONSIVE: Product Info */}
        <View style={styles.productInfoContainer}>
          <View style={styles.productHeader}>
            <View style={styles.productTitleContainer}>
              <Text style={styles.productBrand}>{product.brand}</Text>
              <Text style={styles.productName}>{product.name}</Text>
            </View>
            
            {product.rating && (
              <View style={styles.productRatingContainer}>
                <View style={styles.productRating}>
                  <Star size={16} color="#ffa500" fill="#ffa500" />
                  <Text style={styles.productRatingText}>{product.rating.toFixed(1)}</Text>
                </View>
                {product.ratingCount && (
                  <Text style={styles.productRatingCount}>
                    ({product.ratingCount} reviews)
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* ✅ RESPONSIVE: Pricing */}
          <View style={styles.pricingContainer}>
            <Text style={styles.currentPrice}>₹{product.price}</Text>
            {discountPercentage > 0 && (
              <>
                <Text style={styles.originalPrice}>
                  ₹{Math.round(product.price / (1 - discountPercentage / 100))}
                </Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>{discountPercentage}% OFF</Text>
                </View>
              </>
            )}
          </View>

          {/* ✅ RESPONSIVE: Product Description */}
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionTitle}>Product Details</Text>
            <Text style={styles.descriptionText}>
              {product.description || `${product.brand} ${product.name} - Premium quality product with excellent craftsmanship and attention to detail. Perfect for everyday wear with superior comfort and style.`}
            </Text>
          </View>

          {/* ✅ RESPONSIVE: Size Selection */}
          {product.sizes && product.sizes.length > 0 && (
            <SizeSelection sizes={product.sizes} />
          )}

          {/* ✅ RESPONSIVE: Color Selection */}
          {product.colors && product.colors.length > 0 && (
            <ColorSelection colors={product.colors} />
          )}

          {/* ✅ RESPONSIVE: Quantity Selection */}
          <QuantitySelector />

          {/* ✅ RESPONSIVE: Product Features */}
          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <Truck size={20} color="#4caf50" />
              <Text style={styles.featureText}>Free delivery above ₹999</Text>
            </View>
            <View style={styles.featureItem}>
              <RotateCcw size={20} color="#2196f3" />
              <Text style={styles.featureText}>30-day return policy</Text>
            </View>
            <View style={styles.featureItem}>
              <Shield size={20} color="#ff9800" />
              <Text style={styles.featureText}>100% authentic products</Text>
            </View>
          </View>

          {/* ✅ RESPONSIVE: Stock Status */}
          <View style={styles.stockContainer}>
            {product.stock && product.stock > 0 ? (
              <View style={styles.stockInStock}>
                <Check size={16} color="#4caf50" />
                <Text style={styles.stockText}>
                  {product.stock > 10 ? 'In Stock' : `Only ${product.stock} left!`}
                </Text>
              </View>
            ) : (
              <View style={styles.stockOutOfStock}>
                <X size={16} color="#f44336" />
                <Text style={styles.stockTextOut}>Out of Stock</Text>
              </View>
            )}
          </View>
        </View>

        {/* ✅ RESPONSIVE: Recommendations */}
        {productData.recommendations.length > 0 && (
          <View style={styles.recommendationsContainer}>
            <Text style={styles.recommendationsTitle}>You might also like</Text>
            <FlatList
              data={productData.recommendations}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => <RecommendationCard product={item} />}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.recommendationsList}
            />
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ✅ RESPONSIVE: Bottom Action Bar - Fixed for mobile */}
      <View style={styles.bottomActionBar}>
        <TouchableOpacity
          style={styles.wishlistButton}
          onPress={handleWishlistPress}
          disabled={toggleWishlist}
          activeOpacity={0.7}
        >
          <Heart
            size={20}
            color={isWishlisted ? "#ff3f6c" : "#666"}
            fill={isWishlisted ? "#ff3f6c" : "none"}
          />
          <Text style={[styles.wishlistButtonText, isWishlisted && styles.wishlistButtonTextActive]}>
            {isWishlisted ? "Wishlisted" : "Wishlist"}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.addToBagButton, addingToBag && styles.addToBagButtonDisabled]}
          onPress={handleAddToBag}
          disabled={addingToBag || (product.stock !== undefined && product.stock <= 0)}
          activeOpacity={0.8}
        >
          {addingToBag ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ShoppingBag size={20} color="#fff" />
          )}
          <Text style={styles.addToBagButtonText}>
            {addingToBag ? "Adding..." : "Add to Bag"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ✅ RESPONSIVE: Size Guide Modal */}
      <Modal
        visible={showSizeGuide}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSizeGuide(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sizeGuideModal}>
            <View style={styles.sizeGuideHeader}>
              <Text style={styles.sizeGuideTitle}>Size Guide</Text>
              <TouchableOpacity
                onPress={() => setShowSizeGuide(false)}
                activeOpacity={0.7}
              >
                <X size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.sizeGuideContent}>
              <Text style={styles.sizeGuideText}>
                Choose the right size for the perfect fit:
              </Text>
              
              <View style={styles.sizeGuideTable}>
                <View style={styles.sizeGuideRow}>
                  <Text style={styles.sizeGuideLabel}>XS</Text>
                  <Text style={styles.sizeGuideValue}>28-30 inches</Text>
                </View>
                <View style={styles.sizeGuideRow}>
                  <Text style={styles.sizeGuideLabel}>S</Text>
                  <Text style={styles.sizeGuideValue}>30-32 inches</Text>
                </View>
                <View style={styles.sizeGuideRow}>
                  <Text style={styles.sizeGuideLabel}>M</Text>
                  <Text style={styles.sizeGuideValue}>32-34 inches</Text>
                </View>
                <View style={styles.sizeGuideRow}>
                  <Text style={styles.sizeGuideLabel}>L</Text>
                  <Text style={styles.sizeGuideValue}>34-36 inches</Text>
                </View>
                <View style={styles.sizeGuideRow}>
                  <Text style={styles.sizeGuideLabel}>XL</Text>
                  <Text style={styles.sizeGuideValue}>36-38 inches</Text>
                </View>
                <View style={styles.sizeGuideRow}>
                  <Text style={styles.sizeGuideLabel}>XXL</Text>
                  <Text style={styles.sizeGuideValue}>38-40 inches</Text>
                </View>
              </View>
              
              <View style={styles.sizeGuideNote}>
                <Info size={16} color="#ff3f6c" />
                <Text style={styles.sizeGuideNoteText}>
                  Measurements are approximate and may vary by brand
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    ...Platform.select({
      ios: {
        paddingTop: 50,
      },
      android: {
        paddingTop: StatusBar.currentHeight || 24,
      },
    }),
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
  },
  wishlistHeaderButton: {
    backgroundColor: '#f8f9fa',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  
  // ✅ RESPONSIVE: Image Carousel
  imageCarouselContainer: {
    position: 'relative',
  },
  productMainImage: {
    width: screenWidth,
    height: isTablet ? 500 : screenWidth * 1.2,
    backgroundColor: '#f8f9fa',
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  activeImageIndicator: {
    backgroundColor: '#fff',
    width: 24,
  },

  // ✅ RESPONSIVE: Product Info
  productInfoContainer: {
    padding: isTablet ? 24 : 16,
  },
  productHeader: {
    marginBottom: 16,
  },
  productTitleContainer: {
    marginBottom: 8,
  },
  productBrand: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productName: {
    fontSize: isTablet ? 24 : 20,
    color: '#333',
    fontWeight: '400',
    marginTop: 4,
    lineHeight: isTablet ? 32 : 28,
  },
  productRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  productRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  productRatingText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginLeft: 4,
  },
  productRatingCount: {
    fontSize: 14,
    color: '#666',
  },

  // ✅ RESPONSIVE: Pricing
  pricingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  currentPrice: {
    fontSize: isTablet ? 32 : 28,
    color: '#333',
    fontWeight: '700',
    marginRight: 12,
  },
  originalPrice: {
    fontSize: isTablet ? 20 : 16,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  discountBadge: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // ✅ RESPONSIVE: Description
  descriptionContainer: {
    marginBottom: 24,
  },
  descriptionTitle: {
    fontSize: isTablet ? 20 : 18,
    color: '#333',
    fontWeight: '600',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
    lineHeight: isTablet ? 24 : 20,
  },

  // ✅ RESPONSIVE: Selection Components
  selectionContainer: {
    marginBottom: 24,
  },
  selectionTitle: {
    fontSize: isTablet ? 18 : 16,
    color: '#333',
    fontWeight: '600',
    marginBottom: 12,
  },
  
  // Size Selection
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  sizeOption: {
    minWidth: isTablet ? 60 : 50,
    height: isTablet ? 50 : 40,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginBottom: 8,
  },
  selectedSizeOption: {
    backgroundColor: '#ff3f6c',
    borderColor: '#ff3f6c',
  },
  sizeOptionText: {
    fontSize: isTablet ? 16 : 14,
    color: '#333',
    fontWeight: '500',
  },
  selectedSizeOptionText: {
    color: '#fff',
  },
  sizeGuideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  sizeGuideText: {
    fontSize: 14,
    color: '#ff3f6c',
    fontWeight: '500',
    marginRight: 4,
  },

  // Color Selection
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  colorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
    marginBottom: 8,
  },
  selectedColorOption: {
    backgroundColor: '#fff0f3',
    borderColor: '#ff3f6c',
  },
  colorSwatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  colorOptionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  selectedColorOptionText: {
    color: '#ff3f6c',
  },

  // Quantity Selection
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: isTablet ? 50 : 40,
    height: isTablet ? 50 : 40,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonDisabled: {
    backgroundColor: '#f0f0f0',
    borderColor: '#e0e0e0',
  },
  quantityDisplay: {
    minWidth: isTablet ? 80 : 60,
    height: isTablet ? 50 : 40,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  quantityText: {
    fontSize: isTablet ? 18 : 16,
    color: '#333',
    fontWeight: '600',
  },

  // ✅ RESPONSIVE: Features
  featuresContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: isTablet ? 20 : 16,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: isTablet ? 16 : 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },

  // ✅ RESPONSIVE: Stock Status
  stockContainer: {
    marginBottom: 24,
  },
  stockInStock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    padding: 12,
    borderRadius: 8,
  },
  stockOutOfStock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
  },
  stockText: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '500',
    marginLeft: 8,
  },
  stockTextOut: {
    fontSize: 14,
    color: '#c62828',
    fontWeight: '500',
    marginLeft: 8,
  },

  // ✅ RESPONSIVE: Recommendations
  recommendationsContainer: {
    paddingVertical: 24,
    borderTopWidth: 8,
    borderTopColor: '#f8f9fa',
  },
  recommendationsTitle: {
    fontSize: isTablet ? 22 : 20,
    color: '#333',
    fontWeight: '600',
    marginBottom: 16,
    paddingHorizontal: isTablet ? 24 : 16,
  },
  recommendationsList: {
    paddingHorizontal: isTablet ? 24 : 16,
  },
  recommendationCard: {
    marginRight: 12,
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
  recommendationImage: {
    width: '100%',
    height: cardWidth * 1.2,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  recommendationDiscount: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  recommendationDiscountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  recommendationInfo: {
    padding: 12,
  },
  recommendationBrand: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  recommendationName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '400',
    marginTop: 2,
    lineHeight: 18,
  },
  recommendationPrice: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginTop: 4,
  },
  recommendationRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  recommendationRatingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },

  // ✅ RESPONSIVE: Bottom Action Bar
  bottomActionBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: isTablet ? 24 : 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    ...Platform.select({
      ios: {
        paddingBottom: 32,
      },
    }),
  },
  wishlistButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingVertical: isTablet ? 16 : 12,
    marginRight: 12,
  },
  wishlistButtonText: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
    fontWeight: '500',
    marginLeft: 8,
  },
  wishlistButtonTextActive: {
    color: '#ff3f6c',
  },
  addToBagButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff3f6c',
    borderRadius: 8,
    paddingVertical: isTablet ? 16 : 12,
  },
  addToBagButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addToBagButtonText: {
    fontSize: isTablet ? 16 : 14,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },

  // ✅ RESPONSIVE: Size Guide Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sizeGuideModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.8,
    minHeight: 300,
  },
  sizeGuideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isTablet ? 24 : 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sizeGuideTitle: {
    fontSize: isTablet ? 22 : 20,
    fontWeight: '600',
    color: '#333',
  },
  sizeGuideContent: {
    flex: 1,
    padding: isTablet ? 24 : 20,
  },
  // sizeGuideText duplicate removed
  sizeGuideTable: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  sizeGuideRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sizeGuideLabel: {
    fontSize: isTablet ? 16 : 14,
    color: '#333',
    fontWeight: '600',
  },
  sizeGuideValue: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
  },
  sizeGuideNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff0f3',
    padding: 16,
    borderRadius: 8,
  },
  sizeGuideNoteText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
});
