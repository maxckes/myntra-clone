// Import your comprehensive types
import {
  Product,
  Category,
  BagItem,
  WishlistItem,
  User,
  ApiResponse,
  FilterState,
  PaginationParams,
  SortParams
} from '@/types/product';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

// ============================================================================
// ENHANCED API FUNCTIONS WITH NEW BACKEND ENDPOINTS
// ============================================================================

// Generic API call function with enhanced error handling
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('🔗 API Call:', url);

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ API Response:', data);
    
    return {
      success: data.success !== false,
      data: data.data || data,
      message: data.message
    };
  } catch (error) {
    console.error('❌ API Error:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      }
    };
  }
}

// ============================================================================
// ENHANCED SEARCH & PRODUCT APIs
// ============================================================================

// ✅ NEW: Advanced search with all filters
export const searchProducts = async (params: {
  q?: string;
  page?: number;
  limit?: number;
  sort?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  discount?: number;
  inStock?: boolean;
  isNew?: boolean;
  isFeatured?: boolean;
  isBestseller?: boolean;
  isOnSale?: boolean;
  colors?: string[];
  sizes?: string[];
}): Promise<ApiResponse<{
  products: Product[];
  pagination: any;
  filters: any;
  searchQuery: string;
  appliedFilters: any;
}>> => {
  const queryParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        queryParams.append(key, value.join(','));
      } else {
        queryParams.append(key, value.toString());
      }
    }
  });

  const endpoint = `/api/product/search${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiCall(endpoint);
};

// ✅ NEW: Get search suggestions
export const getSearchSuggestions = async (query: string, limit = 10): Promise<ApiResponse<{
  suggestions: any[];
  trending: any[];
}>> => {
  const queryParams = new URLSearchParams();
  queryParams.append('q', query);
  queryParams.append('limit', limit.toString());

  return apiCall(`/api/product/search/suggestions?${queryParams.toString()}`);
};

// ✅ NEW: Get popular products
export const getPopularProducts = async (params?: {
  category?: string;
  limit?: number;
  timeframe?: string;
}): Promise<ApiResponse<Product[]>> => {
  const queryParams = new URLSearchParams();
  if (params?.category) queryParams.append('category', params.category);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.timeframe) queryParams.append('timeframe', params.timeframe);

  const endpoint = `/api/product/popular${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiCall<Product[]>(endpoint);
};
// ✅ NEW: Get featured products (ADD THIS FUNCTION)
export const getFeaturedProducts = async (params?: {
  limit?: number;
  categoryId?: string;
}): Promise<ApiResponse<Product[]>> => {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.categoryId) queryParams.append('categoryId', params.categoryId);

  const endpoint = `/api/product/featured${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiCall<Product[]>(endpoint);
};


// ✅ ENHANCED: Get products with all new filters
export const getProducts = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  rating?: number;
  inStock?: boolean;
  isNew?: boolean;
  isFeatured?: boolean;
  isBestseller?: boolean;
  isOnSale?: boolean;
  filters?: FilterState;
}): Promise<ApiResponse<{
  products?: Product[];
  pagination?: any;
} | Product[]>> => {
  // If search exists, use the enhanced search endpoint
  if (params?.search) {
    return searchProducts({ q: params.search, ...params });
  }

  const queryParams = new URLSearchParams();
  
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && key !== 'filters') {
      queryParams.append(key, value.toString());
    }
  });

  // Handle filters object
  if (params?.filters) {
    Object.entries(params.filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          queryParams.append(key, value.join(','));
        } else {
          queryParams.append(key, value.toString());
        }
      }
    });
  }

  const endpoint = `/api/product${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiCall(endpoint);
};

// ✅ ENHANCED: Get products by category with search
export const getProductsByCategory = async (
  categoryId: string,
  params?: PaginationParams & SortParams & {
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    brand?: string;
    filters?: FilterState;
  }
): Promise<ApiResponse<{
  products?: Product[];
  category?: any;
  pagination?: any;
} | Product[]>> => {
  // If search exists, use search with category filter
  if (params?.search) {
    return searchProducts({ q: params.search, category: categoryId, ...params });
  }

  const queryParams = new URLSearchParams();
  
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && key !== 'filters') {
      queryParams.append(key, value.toString());
    }
  });

  const endpoint = `/api/product/category/${categoryId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiCall(endpoint);
};

// ✅ ENHANCED: Get product by ID with recommendations
export const getProductById = async (productId: string): Promise<ApiResponse<Product>> => {
  return apiCall<Product>(`/api/product/${productId}`);
};

// ✅ NEW: Get product recommendations
export const getProductRecommendations = async (productId: string, limit = 6): Promise<ApiResponse<Product[]>> => {
  return apiCall<Product[]>(`/api/product/${productId}/recommendations?limit=${limit}`);
};

// ============================================================================
// ENHANCED CATEGORY APIs
// ============================================================================

// ✅ ENHANCED: Get categories with all new options
export const getCategories = async (params?: {
  page?: number;
  limit?: number | 'all';
  search?: string;
  includeEmpty?: boolean;
  onlyActive?: boolean;
  sortBy?: string;
  includeStats?: boolean;
}): Promise<ApiResponse<Category[]>> => {
  const queryParams = new URLSearchParams();
  
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value.toString());
    }
  });

  const endpoint = `/api/category${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiCall<Category[]>(endpoint);
};

// ✅ NEW: Get categories with product filters
export const getCategoriesWithProducts = async (params?: {
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  rating?: number;
  limit?: number;
}): Promise<ApiResponse<Category[]>> => {
  const queryParams = new URLSearchParams();
  
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value.toString());
    }
  });

  return apiCall<Category[]>(`/api/category/with-products${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
};

// ✅ ENHANCED: Get category by ID with stats
export const getCategoryById = async (categoryId: string, params?: {
  includeProducts?: boolean;
  productLimit?: number;
}): Promise<ApiResponse<Category & { statistics?: any; sampleProducts?: Product[] }>> => {
  const queryParams = new URLSearchParams();
  
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value.toString());
    }
  });

  const endpoint = `/api/category/${categoryId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiCall(endpoint);
};

// ✅ NEW: Get trending categories
export const getTrendingCategories = async (limit = 10): Promise<ApiResponse<Category[]>> => {
  return apiCall<Category[]>(`/api/category/trending/categories?limit=${limit}`);
};

// ============================================================================
// ENHANCED WISHLIST APIs WITH REAL-TIME STATUS
// ============================================================================

// ✅ ENHANCED: Get user wishlist with stats
export const getUserWishlist = async (
  userId: string,
  params?: PaginationParams & {
    sortBy?: string;
    includeStats?: boolean;
  }
): Promise<ApiResponse<{
  data?: WishlistItem[];
  stats?: any;
  pagination?: any;
} | WishlistItem[]>> => {
  const queryParams = new URLSearchParams();
  
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value.toString());
    }
  });

  const endpoint = `/api/wishlist/${userId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiCall(endpoint);
};

// ✅ ENHANCED: Add to wishlist with options
export const addToWishlist = async (wishlistData: {
  userId: string;
  productId: string;
  priority?: 'low' | 'medium' | 'high';
  notes?: string;
  priceAlertEnabled?: boolean;
}): Promise<ApiResponse<WishlistItem>> => {
  return apiCall<WishlistItem>('/api/wishlist', {
    method: 'POST',
    body: JSON.stringify(wishlistData),
  });
};

// ✅ NEW: Check wishlist status (for product page)
export const checkWishlistStatus = async (
  userId: string,
  productId: string
): Promise<ApiResponse<{
  isInWishlist: boolean;
  wishlistItemId: string | null;
  priority?: string;
  addedAt?: string;
  priceAlertEnabled?: boolean;
}>> => {
  return apiCall(`/api/wishlist/check/${userId}/${productId}`);
};

// ✅ ENHANCED: Remove from wishlist
export const removeFromWishlist = async (itemId: string): Promise<ApiResponse<any>> => {
  return apiCall<any>(`/api/wishlist/${itemId}`, {
    method: 'DELETE',
  });
};

// ✅ NEW: Update wishlist priority
export const updateWishlistPriority = async (
  itemId: string,
  priority: 'low' | 'medium' | 'high'
): Promise<ApiResponse<WishlistItem>> => {
  return apiCall<WishlistItem>(`/api/wishlist/${itemId}/priority`, {
    method: 'PUT',
    body: JSON.stringify({ priority }),
  });
};

// ============================================================================
// ENHANCED BAG APIs WITH REAL-TIME TOTALS
// ============================================================================

// ✅ ENHANCED: Get user bag with comprehensive totals
export const getUserBag = async (
  userId: string,
  params?: {
    includeSaved?: boolean;
    includeStats?: boolean;
  }
): Promise<ApiResponse<{
  data?: BagItem[];
  summary?: {
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
}>> => {
  const queryParams = new URLSearchParams();
  
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value.toString());
    }
  });

  const endpoint = `/api/bag/${userId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiCall(endpoint);
};

// ✅ NEW: Get bag summary (for quick totals in header/checkout)
export const getBagSummary = async (userId: string): Promise<ApiResponse<{
  itemCount: number;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  savings: number;
  items: Array<{
    _id: string;
    productName: string;
    quantity: number;
    price: number;
    image?: string;
  }>;
}>> => {
  return apiCall(`/api/bag/${userId}/summary`);
};

// ✅ ENHANCED: Add to bag with size/color validation
export const addToBag = async (bagData: {
  userId: string;
  productId: string;
  size?: string;
  color?: string;
  quantity?: number;
}): Promise<ApiResponse<BagItem>> => {
  return apiCall<BagItem>('/api/bag', {
    method: 'POST',
    body: JSON.stringify(bagData),
  });
};

// ✅ ENHANCED: Update bag item quantity with stock validation
export const updateBagItemQuantity = async (
  itemId: string,
  quantity: number
): Promise<ApiResponse<BagItem>> => {
  return apiCall<BagItem>(`/api/bag/${itemId}/quantity`, {
    method: 'PUT',
    body: JSON.stringify({ quantity }),
  });
};

// ✅ ENHANCED: Remove bag item
export const removeBagItem = async (itemId: string): Promise<ApiResponse<any>> => {
  return apiCall<any>(`/api/bag/${itemId}`, {
    method: 'DELETE',
  });
};

// ✅ NEW: Move bag item to wishlist
export const moveBagItemToWishlist = async (
  itemId: string,
  userId: string
): Promise<ApiResponse<any>> => {
  return apiCall<any>(`/api/bag/${itemId}/move-to-wishlist`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
};

// ✅ NEW: Save bag item for later
export const saveBagItemForLater = async (itemId: string): Promise<ApiResponse<BagItem>> => {
  return apiCall<BagItem>(`/api/bag/${itemId}/save`, {
    method: 'PUT',
  });
};

// ✅ NEW: Clear entire bag
export const clearUserBag = async (userId: string): Promise<ApiResponse<any>> => {
  return apiCall<any>(`/api/bag/user/${userId}/clear`, {
    method: 'DELETE',
  });
};

// ============================================================================
// ENHANCED ORDER APIs WITH COMPLETE CHECKOUT
// ============================================================================

// ✅ ENHANCED: Create order with comprehensive checkout data
export const createOrder = async (orderData: {
  userId: string;
  shippingAddress: any;
  billingAddress?: any;
  paymentMethod: string;
  paymentGateway?: string;
  customerNotes?: string;
  deliveryPreferences?: {
    timeSlot?: string;
    instructions?: string;
    requireSignature?: boolean;
    allowPartialDelivery?: boolean;
  };
  promoCode?: string;
  useWalletBalance?: boolean;
}): Promise<ApiResponse<{
  _id: string;
  orderNumber: string;
  trackingNumber: string;
  status: string;
  totalAmount: number;
  estimatedDelivery: string;
  paymentMethod: string;
  paymentStatus: string;
  itemCount: number;
  totalQuantity: number;
}>> => {
  return apiCall('/api/order', {
    method: 'POST',
    body: JSON.stringify(orderData),
  });
};

// ✅ ENHANCED: Get user orders with filtering
export const getUserOrders = async (
  userId: string,
  params?: {
    page?: number;
    limit?: number;
    status?: string;
    sortBy?: string;
    dateFrom?: string;
    dateTo?: string;
    minAmount?: number;
    maxAmount?: number;
  }
): Promise<ApiResponse<{
  data?: any[];
  stats?: {
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    statusBreakdown: any;
  };
  pagination?: any;
} | any[]>> => {
  const queryParams = new URLSearchParams();
  
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value.toString());
    }
  });

  const endpoint = `/api/order/user/${userId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiCall(endpoint);
};

// ✅ ENHANCED: Get order by ID
export const getOrderById = async (orderId: string): Promise<ApiResponse<any>> => {
  return apiCall<any>(`/api/order/${orderId}`);
};

// ✅ ENHANCED: Cancel order with reason
export const cancelOrder = async (
  orderId: string,
  reason?: string,
  refundMethod?: string
): Promise<ApiResponse<{
  orderId: string;
  orderNumber: string;
  status: string;
  cancellationReason: string;
  refundAmount: number;
  refundStatus: string;
  processingTime: string;
}>> => {
  return apiCall(`/api/order/${orderId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason, refundMethod }),
  });
};

// ✅ NEW: Track order with detailed status
export const trackOrder = async (trackingNumber: string): Promise<ApiResponse<{
  trackingNumber: string;
  orderNumber: string;
  status: string;
  currentLocation: string;
  estimatedDelivery: string;
  actualDelivery?: string;
  carrier: string;
  trackingHistory: Array<{
    status: string;
    location: string;
    timestamp: string;
    description: string;
  }>;
  deliveryInstructions: string;
  contactInfo: {
    phone: string;
    email: string;
  };
}>> => {
  return apiCall(`/api/order/track/${trackingNumber}`);
};

// ============================================================================
// USER AUTHENTICATION (EXISTING)
// ============================================================================

export const registerUser = async (userData: {
  fullName: string;
  email: string;
  password: string;
}): Promise<ApiResponse<User>> => {
  return apiCall<User>('/api/user/signup', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
};

export const loginUser = async (credentials: {
  email: string;
  password: string;
}): Promise<ApiResponse<User>> => {
  return apiCall<User>('/api/user/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
};

export const getUserById = async (userId: string): Promise<ApiResponse<User>> => {
  return apiCall<User>(`/api/user/${userId}`);
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const handleApiError = (error: any): string => {
  if (error?.error?.message) {
    return error.error.message;
  }
  if (error?.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Something went wrong. Please try again.';
};

// ✅ ENHANCED: Cache management
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

export const getCachedData = <T>(key: string): T | null => {
  const cached = cache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > cached.ttl) {
    cache.delete(key);
    return null;
  }
  
  return cached.data as T;
};

export const setCachedData = <T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void => {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs
  });
};

export const clearCache = (): void => {
  cache.clear();
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const isApiSuccess = <T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: true } => {
  return response.success === true;
};

export const extractApiData = <T>(response: ApiResponse<T>): T | null => {
  return isApiSuccess(response) ? response.data || null : null;
};

export const getApiErrorMessage = <T>(response: ApiResponse<T>): string => {
  if (isApiSuccess(response)) return '';
  return handleApiError(response.error);
};

// Re-export utility functions from types
export {
  formatPrice,
  formatRating,
  getDiscountPercentage,
  extractDiscountPercentage,
  isValidDiscountString,
  isProduct,
  isCategory,
  hasValidRating
} from '@/types/product';

// ============================================================================
// EXPORT ALL ENHANCED FUNCTIONS
// ============================================================================

export default {
  // Enhanced Search & Products
  searchProducts,
  getSearchSuggestions,
  getPopularProducts,
  getFeaturedProducts,        // ✅ ADD THIS LINE
  getProducts,
  getProductsByCategory,
  getProductById,
  getProductRecommendations,
  
  // Enhanced Categories
  getCategories,
  getCategoriesWithProducts,
  getCategoryById,
  getTrendingCategories,
  
  // Enhanced Wishlist
  getUserWishlist,
  addToWishlist,
  checkWishlistStatus,
  removeFromWishlist,
  updateWishlistPriority,
  
  // Enhanced Bag
  getUserBag,
  getBagSummary,
  addToBag,
  updateBagItemQuantity,
  removeBagItem,
  moveBagItemToWishlist,
  saveBagItemForLater,
  clearUserBag,
  
  // Enhanced Orders
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  trackOrder,
  
  // User Management
  registerUser,
  loginUser,
  getUserById,
  
  // Utilities
  handleApiError,
  getCachedData,
  setCachedData,
  clearCache,
  isApiSuccess,
  extractApiData,
  getApiErrorMessage,
};

