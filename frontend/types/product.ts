// ============================================================================
// PRODUCT & CATEGORY INTERFACES
// ============================================================================

export interface Product {
  _id: string;
  name: string;
  brand: string;
  price: number;
  discount?: string;
  description?: string;
  images: string[];
  category?: {
    _id: string;
    name: string;
    subcategory: string[];
  };
  categoryName?: string;
  subcategory?: string;
  rating?: number;
  ratingCount?: number; // Number of reviews/ratings
  sizes?: string[];
  createdAt?: string;
  updatedAt?: string;
  popularity?: number; // For popularity-based sorting
  tags?: string[]; // Additional product tags
  isNew?: boolean; // For "New Arrivals" badge
  isBestseller?: boolean; // For bestseller badge
  isFeatured?: boolean; // ✅ ADD THIS LINE - For featured products
  stock?: number; // Inventory count
  colors?: string[]; // Available colors
}


export interface Category {
  _id: string;
  name: string;
  subcategory: string[];
  image: string;
  productId?: Product[];
  productCount?: number; // Total products in category
  createdAt?: string;
  updatedAt?: string;
  isPopular?: boolean; // For featuring popular categories
  description?: string; // Category description
}

// ============================================================================
// RATING SYSTEM INTERFACES
// ============================================================================

export interface RatingDisplayProps {
  rating?: number;
  size?: 'small' | 'medium' | 'large';
  showCount?: boolean;
  reviewCount?: number;
  showText?: boolean;
  color?: string;
  style?: any;
}

export interface RatingBreakdown {
  average: number;
  total: number;
  breakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  percentages: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export interface Review {
  _id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  productId: string;
  rating: number;
  title?: string;
  comment: string;
  helpful: number; // Number of helpful votes
  verified: boolean; // Verified purchase
  createdAt: string;
  updatedAt?: string;
  images?: string[]; // Review images
  size?: string; // Size purchased (if applicable)
}

// ============================================================================
// FILTER & SEARCH INTERFACES
// ============================================================================

export interface FilterState {
  category?: string;
  subcategory?: string;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  brands?: string[];
  discount?: number;
  sortBy?: SortOption;
  colors?: string[];
  sizes?: string[];
  isNew?: boolean;
  isBestseller?: boolean;
  inStock?: boolean;
}

export interface FilterOptions {
  category?: string;
  subcategory?: string;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  brands?: string[];
  sortBy?: SortOption;
}

export type SortOption = 
  | 'relevance' 
  | 'price_asc' 
  | 'price_desc' 
  | 'rating' 
  | 'newest' 
  | 'popularity' 
  | 'discount'
  | 'name_asc'
  | 'name_desc';

export interface PriceRange {
  min: number;
  max: number;
  label?: string;
}

export interface SearchFilters extends FilterState {
  query?: string;
  searchIn?: ('name' | 'brand' | 'description' | 'tags')[];
}

export interface SearchResult extends Product {
  relevanceScore?: number;
  matchedTerms?: string[];
  highlightedName?: string;
  highlightedBrand?: string;
  highlightedDescription?: string;
}

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'product' | 'brand' | 'category' | 'recent';
  count?: number; // Number of results for this suggestion
  image?: string; // Thumbnail for visual suggestions
}

// ============================================================================
// API RESPONSE INTERFACES
// ============================================================================

export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  totalPages: number;
  filters: {
    availableBrands: string[];
    priceRange: PriceRange;
    availableColors: string[];
    availableSizes: string[];
    categories: Category[];
  };
}

export interface CategoryListResponse {
  categories: Category[];
  total: number;
  featured: Category[]; // Featured categories
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  suggestions: SearchSuggestion[];
  filters: {
    availableBrands: string[];
    priceRange: PriceRange;
    categories: Category[];
    appliedFilters: FilterState;
  };
  query: string;
  page: number;
  limit: number;
}

// ============================================================================
// COMPONENT PROP INTERFACES
// ============================================================================

export interface ProductCardProps {
  product: Product;
  onPress?: (productId: string) => void;
  onWishlistPress?: (productId: string) => void;
  onBagPress?: (productId: string) => void;
  showWishlistButton?: boolean;
  showBagButton?: boolean;
  style?: any;
  imageStyle?: any;
  cardWidth?: number;
  isWishlisted?: boolean;
  inBag?: boolean;
}

export interface CategoryCardProps {
  category: Category;
  onPress?: (categoryId: string) => void;
  style?: any;
  imageStyle?: any;
  showProductCount?: boolean;
}

export interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  currentFilters: FilterState;
  categories?: Category[];
  brands?: string[];
  priceRange?: PriceRange;
  totalProducts?: number;
  colors?: string[];
  sizes?: string[];
}

export interface SearchOverlayProps {
  visible: boolean;
  onClose: () => void;
  products: Product[];
  onProductPress?: (productId: string) => void;
  initialQuery?: string;
  showFilters?: boolean;
}

// ============================================================================
// SHOPPING CART & WISHLIST INTERFACES
// ============================================================================

export interface BagItem {
  _id: string;
  productId: Product;
  userId: string;
  quantity: number;
  size?: string;
  color?: string;
  addedAt: string;
  updatedAt?: string;
}

export interface WishlistItem {
  _id: string;
  productId: Product;
  userId: string;
  addedAt: string;
}

export interface Order {
  _id: string;
  userId: string;
  items: BagItem[];
  totalAmount: number;
  discount?: number;
  shippingCost: number;
  finalAmount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
  shippingAddress: Address;
  paymentMethod: 'cod' | 'card' | 'upi' | 'wallet';
  trackingId?: string;
  createdAt: string;
  updatedAt?: string;
  estimatedDelivery?: string;
}

export interface Address {
  _id?: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  isDefault?: boolean;
}

// ============================================================================
// USER & AUTH INTERFACES
// ============================================================================

export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  addresses: Address[];
  preferences: {
    notifications: boolean;
    newsletter: boolean;
    recommendations: boolean;
    theme: 'light' | 'dark' | 'auto';
  };
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string;
  isVerified: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// ============================================================================
// UTILITY & HELPER INTERFACES
// ============================================================================

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  field?: string; // For validation errors
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
}

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  lastUpdated?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortParams {
  sortBy?: SortOption;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// SCREEN & NAVIGATION INTERFACES
// ============================================================================

export interface HomeScreenData {
  categories: Category[];
  featuredProducts: Product[];
  newArrivals: Product[];
  bestDeals: Product[];
  banners: Banner[];
  isLoading: boolean;
  error: string | null;
}

export interface CategoryScreenData {
  categories: Category[];
  selectedCategory: Category | null;
  products: Product[];
  filters: FilterState;
  isLoading: boolean;
  error: string | null;
}

export interface ProductScreenData {
  product: Product | null;
  relatedProducts: Product[];
  reviews: Review[];
  ratingBreakdown: RatingBreakdown;
  isLoading: boolean;
  error: string | null;
  isWishlisted: boolean;
  inBag: boolean;
}

export interface Banner {
  _id: string;
  title: string;
  subtitle?: string;
  image: string;
  link?: string;
  type: 'promotion' | 'category' | 'product' | 'brand';
  isActive: boolean;
  order: number;
  startDate?: string;
  endDate?: string;
}

// ============================================================================
// RESPONSIVE & UI INTERFACES
// ============================================================================

export interface ResponsiveConfig {
  isPhone: boolean;
  isTablet: boolean;
  isLargeTablet: boolean;
  screenWidth: number;
  screenHeight: number;
  columns: number;
  cardWidth: number;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  success: string;
  warning: string;
  info: string;
}

// ============================================================================
// ANALYTICS & TRACKING INTERFACES
// ============================================================================

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  userId?: string;
  timestamp?: string;
}

export interface ProductView extends AnalyticsEvent {
  name: 'product_view';
  properties: {
    productId: string;
    productName: string;
    brand: string;
    category: string;
    price: number;
    source: 'search' | 'category' | 'home' | 'recommendation';
  };
}

export interface SearchEvent extends AnalyticsEvent {
  name: 'search';
  properties: {
    query: string;
    resultsCount: number;
    filters?: FilterState;
  };
}

export interface FilterApplied extends AnalyticsEvent {
  name: 'filter_applied';
  properties: {
    filters: FilterState;
    resultCount: number;
    screen: 'home' | 'category' | 'search';
  };
}

// ============================================================================
// EXPORT COMMONLY USED TYPES
// ============================================================================

export type {
  Product as ProductType,
  Category as CategoryType,
  FilterState as Filters,
  User as UserType,
  BagItem as CartItem,
  WishlistItem as WishlistType,
};

// ============================================================================
// CONSTANTS & ENUMS
// ============================================================================

export const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Customer Rating', value: 'rating' },
  { label: 'Newest First', value: 'newest' },
  { label: 'Popularity', value: 'popularity' },
  { label: 'Best Discount', value: 'discount' },
];

export const RATING_LABELS: Record<number, string> = {
  5: 'Excellent',
  4: 'Very Good',
  3: 'Good',
  2: 'Fair',
  1: 'Poor',
};

export const PRICE_RANGES: PriceRange[] = [
  { label: 'Under ₹500', min: 0, max: 500 },
  { label: '₹500 - ₹1000', min: 500, max: 1000 },
  { label: '₹1000 - ₹2000', min: 1000, max: 2000 },
  { label: '₹2000 - ₹5000', min: 2000, max: 5000 },
  { label: 'Above ₹5000', min: 5000, max: Infinity },
];

export const DEFAULT_FILTER_STATE: FilterState = {
  sortBy: 'relevance',
};

// ============================================================================
// TYPE GUARDS & UTILITY FUNCTIONS
// ============================================================================

export const isProduct = (item: any): item is Product => {
  return item && typeof item === 'object' && 
         typeof item._id === 'string' && 
         typeof item.name === 'string' && 
         typeof item.price === 'number';
};

export const isCategory = (item: any): item is Category => {
  return item && typeof item === 'object' && 
         typeof item._id === 'string' && 
         typeof item.name === 'string' && 
         Array.isArray(item.subcategory);
};

export const hasValidRating = (product: Product): boolean => {
  return typeof product.rating === 'number' && 
         product.rating >= 0 && 
         product.rating <= 5;
};

export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price);
};

export const formatRating = (rating?: number): string => {
  if (!rating) return '0.0';
  return rating.toFixed(1);
};

export const getDiscountPercentage = (originalPrice: number, discountedPrice: number): number => {
  return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
};

export const isValidDiscountString = (discount?: string): boolean => {
  if (!discount) return false;
  const regex = /(\d+)%/;
  return regex.test(discount);
};

export const extractDiscountPercentage = (discount?: string): number => {
  if (!discount) return 0;
  const match = discount.match(/(\d+)%/);
  return match ? parseInt(match[1], 10) : 0;
};
