import React, { useState, useEffect, useCallback } from "react";
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
  Alert,
  RefreshControl,
  FlatList,
  Platform,
} from "react-native";
import { router } from "expo-router";
import {
  ArrowLeft,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  RotateCcw,
  Eye,
  Star,
  Calendar,
  MapPin,
  CreditCard,
  Filter,
  Search,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";

// ✅ UPDATED: Import enhanced API functions
import {
  getUserOrders,
  getOrderById,
  cancelOrder,
  trackOrder,
  handleApiError,
} from "@/utils/api";

const { width: screenWidth } = Dimensions.get("window");

// ✅ RESPONSIVE: Calculate dimensions based on device type
const isTablet = screenWidth >= 768;

// ✅ Enhanced interfaces
interface OrdersData {
  orders: any[];
  stats: {
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    statusBreakdown: any;
  } | null;
  pagination: any;
  isLoading: boolean;
  error: string | null;
}

interface OrderCardProps {
  order: any;
  onPress: (orderId: string) => void;
  onCancel: (orderId: string, orderNumber: string) => void;
  onTrack: (trackingNumber: string) => void;
}

export default function OrdersScreen() {
  const { user } = useAuth();

  // ✅ ENHANCED: State management
  const [ordersData, setOrdersData] = useState<OrdersData>({
    orders: [],
    stats: null,
    pagination: null,
    isLoading: true,
    error: null,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [cancellingOrders, setCancellingOrders] = useState<Set<string>>(new Set());

  // ✅ Status options
  const statusOptions = [
    { key: 'all', label: 'All Orders', color: '#666' },
    { key: 'confirmed', label: 'Confirmed', color: '#4caf50' },
    { key: 'processing', label: 'Processing', color: '#ff9800' },
    { key: 'shipped', label: 'Shipped', color: '#2196f3' },
    { key: 'delivered', label: 'Delivered', color: '#4caf50' },
    { key: 'cancelled', label: 'Cancelled', color: '#f44336' },
  ];

  // ✅ ENHANCED: Load orders data
  const loadOrdersData = useCallback(async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    try {
      setOrdersData(prev => ({ ...prev, isLoading: true, error: null }));

      console.log('📦 Loading orders for user:', user._id);

      const params: any = {
        page: 1,
        limit: 20,
        sortBy: 'newest',
      };

      if (selectedStatus !== 'all') {
        params.status = selectedStatus;
      }

      const response = await getUserOrders(user._id, params);

      if (response.success && response.data) {
        const responseData = response.data;
        
        let orders: any[] = [];
        let stats = null;
        let pagination = null;

        if (Array.isArray(responseData)) {
          orders = responseData;
        } else {
          orders = responseData.data || [];
          stats = responseData.stats || null;
          pagination = responseData.pagination || null;
        }

        console.log('✅ Orders loaded:', orders.length);

        setOrdersData({
          orders,
          stats,
          pagination,
          isLoading: false,
          error: null,
        });

      } else {
        throw new Error(handleApiError(response));
      }

    } catch (error: any) {
      console.error('❌ Error loading orders:', error);
      setOrdersData(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to load orders',
      }));
    }
  }, [user, selectedStatus]);

  // ✅ ENHANCED: Cancel order
  const handleCancelOrder = async (orderId: string, orderNumber: string) => {
    Alert.alert(
      "Cancel Order",
      `Are you sure you want to cancel order ${orderNumber}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              setCancellingOrders(prev => new Set([...prev, orderId]));

              console.log('❌ Cancelling order:', orderId);

              const response = await cancelOrder(orderId, 'Customer requested cancellation');

              if (response.success) {
                Alert.alert("Order Cancelled", `Order ${orderNumber} has been cancelled successfully`);
                loadOrdersData(); // Refresh orders
              } else {
                Alert.alert("Error", handleApiError(response));
              }

            } catch (error) {
              console.error('❌ Cancel order error:', error);
              Alert.alert("Error", "Failed to cancel order");
            } finally {
              setCancellingOrders(prev => {
                const newSet = new Set(prev);
                newSet.delete(orderId);
                return newSet;
              });
            }
          },
        },
      ]
    );
  };

  // ✅ ENHANCED: Track order
  const handleTrackOrder = async (trackingNumber: string) => {
    try {
      console.log('📍 Tracking order:', trackingNumber);

      const response = await trackOrder(trackingNumber);

      if (response.success && response.data) {
        const trackingInfo = response.data;
        
        Alert.alert(
          "Order Tracking",
          `Status: ${trackingInfo.status}\nLocation: ${trackingInfo.currentLocation}\nEstimated Delivery: ${new Date(trackingInfo.estimatedDelivery).toDateString()}`,
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Error", handleApiError(response));
      }

    } catch (error) {
      console.error('❌ Track order error:', error);
      Alert.alert("Error", "Failed to track order");
    }
  };

  // ✅ Navigation handlers
  const handleOrderPress = (orderId: string) => {
    console.log('📦 Viewing order details:', orderId);
    router.push({
  pathname: '/order/:orderId',
  params: { orderId },
});
  };

  const handleBackPress = () => {
    router.back();
  };

  // ✅ Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrdersData();
    setRefreshing(false);
  };

  // ✅ Load data on mount and when status changes
  useEffect(() => {
    loadOrdersData();
  }, [loadOrdersData]);

  // ✅ Get status color
  const getStatusColor = (status: string) => {
    const colors: any = {
      'confirmed': '#4caf50',
      'processing': '#ff9800',
      'shipped': '#2196f3',
      'delivered': '#4caf50',
      'cancelled': '#f44336',
      'returned': '#9c27b0'
    };
    return colors[status] || '#666';
  };

  // ✅ Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle size={16} color={getStatusColor(status)} />;
      case 'processing':
        return <Clock size={16} color={getStatusColor(status)} />;
      case 'shipped':
        return <Truck size={16} color={getStatusColor(status)} />;
      case 'delivered':
        return <Package size={16} color={getStatusColor(status)} />;
      case 'cancelled':
        return <XCircle size={16} color={getStatusColor(status)} />;
      default:
        return <Clock size={16} color={getStatusColor(status)} />;
    }
  };

  // ✅ RESPONSIVE: Order Card Component
  const OrderCard: React.FC<OrderCardProps> = ({ order, onPress, onCancel, onTrack }) => {
    const isCancelling = cancellingOrders.has(order._id);
    const canCancel = ['confirmed', 'processing'].includes(order.status);
    const canTrack = ['shipped', 'delivered'].includes(order.status);

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => onPress(order._id)}
        activeOpacity={0.8}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
            <View style={styles.orderStatus}>
              {getStatusIcon(order.status)}
              <Text style={[styles.orderStatusText, { color: getStatusColor(order.status) }]}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </Text>
            </View>
          </View>
          <Text style={styles.orderTotal}>₹{order.totalAmount}</Text>
        </View>

        <View style={styles.orderInfo}>
          <View style={styles.orderInfoRow}>
            <Calendar size={14} color="#666" />
            <Text style={styles.orderInfoText}>
              {new Date(order.orderDate).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.orderInfoRow}>
            <Package size={14} color="#666" />
            <Text style={styles.orderInfoText}>
              {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
            </Text>
          </View>
          {order.estimatedDelivery && (
            <View style={styles.orderInfoRow}>
              <Truck size={14} color="#666" />
              <Text style={styles.orderInfoText}>
                Est. delivery: {new Date(order.estimatedDelivery).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        {/* ✅ RESPONSIVE: Order Items Preview */}
        {order.items && order.items.length > 0 && (
          <View style={styles.orderItemsPreview}>
            <View style={styles.orderItemsImages}>
              {order.items.slice(0, 3).map((item: any, index: number) => (
                <Image
                  key={index}
                  source={{ uri: item.productSnapshot?.images?.[0] }}
                  style={[
                    styles.orderItemImage,
                    { marginLeft: index > 0 ? -10 : 0 }
                  ]}
                  resizeMode="cover"
                />
              ))}
              {order.items.length > 3 && (
                <View style={styles.moreItemsIndicator}>
                  <Text style={styles.moreItemsText}>+{order.items.length - 3}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ✅ RESPONSIVE: Action Buttons */}
        <View style={styles.orderActions}>
          <TouchableOpacity
            style={styles.orderActionButton}
            onPress={() => onPress(order._id)}
            activeOpacity={0.7}
          >
            <Eye size={14} color="#ff3f6c" />
            <Text style={styles.orderActionText}>View Details</Text>
          </TouchableOpacity>

          {canTrack && (
            <TouchableOpacity
              style={styles.orderActionButton}
              onPress={() => onTrack(order.trackingNumber)}
              activeOpacity={0.7}
            >
              <MapPin size={14} color="#2196f3" />
              <Text style={[styles.orderActionText, { color: '#2196f3' }]}>Track</Text>
            </TouchableOpacity>
          )}

          {canCancel && (
            <TouchableOpacity
              style={[styles.orderActionButton, isCancelling && styles.orderActionButtonDisabled]}
              onPress={() => onCancel(order._id, order.orderNumber)}
              disabled={isCancelling}
              activeOpacity={0.7}
            >
              {isCancelling ? (
                <ActivityIndicator size="small" color="#f44336" />
              ) : (
                <XCircle size={14} color="#f44336" />
              )}
              <Text style={[styles.orderActionText, { color: '#f44336' }]}>
                {isCancelling ? 'Cancelling...' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ✅ RESPONSIVE: Stats Card Component
  const StatsCard: React.FC = () => {
    if (!ordersData.stats) return null;

    const { stats } = ordersData;

    return (
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Order Summary</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalOrders}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>₹{stats.totalSpent}</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>₹{stats.averageOrderValue}</Text>
            <Text style={styles.statLabel}>Avg Order Value</Text>
          </View>
        </View>
      </View>
    );
  };

  // ✅ Empty state
  if (!user) {
    return (
      <View style={styles.emptyContainer}>
        <Package size={80} color="#ccc" />
        <Text style={styles.emptyTitle}>Login to view orders</Text>
        <Text style={styles.emptyText}>
          Track your orders and purchase history
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
  if (ordersData.isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff3f6c" />
        <Text style={styles.loadingText}>Loading your orders...</Text>
      </View>
    );
  }

  // ✅ Error state
  if (ordersData.error && !refreshing) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{ordersData.error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadOrdersData}
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
      
      {/* ✅ RESPONSIVE: Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackPress}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={styles.headerRight} />
      </View>

      {/* ✅ RESPONSIVE: Status Filter */}
      <View style={styles.statusFilterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusFilterContent}
        >
          {statusOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.statusFilterOption,
                selectedStatus === option.key && styles.selectedStatusFilterOption,
              ]}
              onPress={() => setSelectedStatus(option.key)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.statusFilterText,
                selectedStatus === option.key && styles.selectedStatusFilterText,
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
        {/* ✅ RESPONSIVE: Stats Card */}
        <StatsCard />

        {/* ✅ RESPONSIVE: Orders List */}
        {ordersData.orders.length > 0 ? (
          <View style={styles.ordersContainer}>
            <FlatList
              data={ordersData.orders}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <OrderCard
                  order={item}
                  onPress={handleOrderPress}
                  onCancel={handleCancelOrder}
                  onTrack={handleTrackOrder}
                />
              )}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          </View>
        ) : (
          <View style={styles.noOrdersContainer}>
            <Package size={80} color="#ccc" />
            <Text style={styles.noOrdersTitle}>No orders found</Text>
            <Text style={styles.noOrdersText}>
              {selectedStatus === 'all' 
                ? "You haven't placed any orders yet"
                : `No ${selectedStatus} orders found`
              }
            </Text>
            <TouchableOpacity
              style={styles.shopButton}
              onPress={() => router.push("/")}
              activeOpacity={0.8}
            >
              <Text style={styles.shopButtonText}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isTablet ? 24 : 16,
    paddingVertical: isTablet ? 20 : 16,
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
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: '700',
    color: '#333',
  },
  headerRight: {
    width: 40,
  },
  statusFilterContainer: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusFilterContent: {
    paddingHorizontal: isTablet ? 24 : 16,
  },
  statusFilterOption: {
    backgroundColor: '#fff',
    paddingHorizontal: isTablet ? 20 : 16,
    paddingVertical: isTablet ? 12 : 8,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedStatusFilterOption: {
    backgroundColor: '#ff3f6c',
    borderColor: '#ff3f6c',
  },
  statusFilterText: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedStatusFilterText: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    backgroundColor: '#f8f9fa',
    marginHorizontal: isTablet ? 24 : 16,
    marginTop: 16,
    borderRadius: 12,
    padding: isTablet ? 20 : 16,
  },
  statsTitle: {
    fontSize: isTablet ? 20 : 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: '700',
    color: '#ff3f6c',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: isTablet ? 14 : 12,
    color: '#666',
    textAlign: 'center',
  },
  ordersContainer: {
    paddingHorizontal: isTablet ? 24 : 16,
    paddingTop: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: isTablet ? 20 : 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderHeaderLeft: {
    flex: 1,
  },
  orderNumber: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  orderStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderStatusText: {
    fontSize: isTablet ? 14 : 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  orderTotal: {
    fontSize: isTablet ? 20 : 18,
    fontWeight: '700',
    color: '#333',
  },
  orderInfo: {
    marginBottom: 12,
    gap: 6,
  },
  orderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderInfoText: {
    fontSize: isTablet ? 14 : 12,
    color: '#666',
    marginLeft: 8,
  },
  orderItemsPreview: {
    marginBottom: 12,
  },
  orderItemsImages: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderItemImage: {
    width: isTablet ? 50 : 40,
    height: isTablet ? 50 : 40,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#fff',
  },
  moreItemsIndicator: {
    width: isTablet ? 50 : 40,
    height: isTablet ? 50 : 40,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  moreItemsText: {
    fontSize: isTablet ? 12 : 10,
    color: '#666',
    fontWeight: '600',
  },
  orderActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  orderActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  orderActionButtonDisabled: {
    opacity: 0.6,
  },
  orderActionText: {
    fontSize: 12,
    color: '#ff3f6c',
    fontWeight: '500',
    marginLeft: 4,
  },
  noOrdersContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  noOrdersTitle: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 24,
    marginBottom: 8,
  },
  noOrdersText: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
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
});
