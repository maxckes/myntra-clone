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
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from "react-native";
import { router } from "expo-router";
import {
  ArrowLeft,
  MapPin,
  CreditCard,
  Truck,
  Shield,
  Plus,
  Check,
  Clock,
  Gift,
  ChevronDown,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";

// ✅ Import enhanced API functions
import {
  getUserBag,
  createOrder,
  handleApiError,
} from "@/utils/api";

const { width: screenWidth } = Dimensions.get("window");

// ✅ RESPONSIVE: Calculate dimensions based on device type
const isTablet = screenWidth >= 768;

// ✅ Enhanced interfaces
interface CheckoutData {
  bagItems: any[];
  summary: {
    subtotal: number;
    discount: number;
    deliveryCharge: number;
    tax: number;
    total: number;
    itemCount: number;
    totalQuantity: number;
    savings: number;
  };
  isLoading: boolean;
  error: string | null;
}

interface Address {
  id?: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  type: 'home' | 'office' | 'other';
  isDefault?: boolean;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'upi' | 'netbanking' | 'cod' | 'wallet';
  name: string;
  icon: string;
  description: string;
  enabled: boolean;
}

export default function CheckoutScreen() {
  const { user } = useAuth();

  // ✅ State management
  const [checkoutData, setCheckoutData] = useState<CheckoutData>({
    bagItems: [],
    summary: {
      subtotal: 0,
      discount: 0,
      deliveryCharge: 0,
      tax: 0,
      total: 0,
      itemCount: 0,
      totalQuantity: 0,
      savings: 0,
    },
    isLoading: true,
    error: null,
  });

  // ✅ Address management
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);

  // ✅ Payment management
  const [paymentMethods] = useState<PaymentMethod[]>([
    {
      id: 'cod',
      type: 'cod',
      name: 'Cash on Delivery',
      icon: '💰',
      description: 'Pay when your order arrives',
      enabled: true,
    },
    {
      id: 'upi',
      type: 'upi',
      name: 'UPI',
      icon: '📱',
      description: 'Pay using UPI apps',
      enabled: true,
    },
    {
      id: 'card',
      type: 'card',
      name: 'Credit/Debit Card',
      icon: '💳',
      description: 'Visa, Mastercard, Rupay',
      enabled: true,
    },
    {
      id: 'netbanking',
      type: 'netbanking',
      name: 'Net Banking',
      icon: '🏦',
      description: 'Pay using your bank account',
      enabled: true,
    }
  ]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);

  // ✅ Form states
  const [newAddress, setNewAddress] = useState<Address>({
  name: user?.name || '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
  type: 'home',
});

  // ✅ UI states
  const [placingOrder, setPlacingOrder] = useState(false);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);

  // ✅ Animation
  const [placeOrderScale] = useState(new Animated.Value(1));

  // ✅ Load checkout data
  const loadCheckoutData = useCallback(async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    try {
      setCheckoutData(prev => ({ ...prev, isLoading: true, error: null }));

      console.log('💳 Loading checkout data for user:', user._id);

      const bagResponse = await getUserBag(user._id, {
        includeSaved: false,
        includeStats: false,
      });

      if (bagResponse.success && bagResponse.data) {
        const responseData = bagResponse.data;
        
        let bagItems: any[] = [];
        let summary = {
          subtotal: 0,
          discount: 0,
          deliveryCharge: 0,
          tax: 0,
          total: 0,
          itemCount: 0,
          totalQuantity: 0,
          savings: 0,
        };

        if (Array.isArray(responseData)) {
          bagItems = responseData;
        } else if (responseData.data && Array.isArray(responseData.data)) {
          bagItems = responseData.data;
          summary = responseData.summary || summary;
        } else if (responseData.summary) {
          bagItems = responseData.data || [];
          summary = responseData.summary;
        }

        if (bagItems.length === 0) {
          Alert.alert(
            "Empty Bag",
            "Your bag is empty. Add some items first.",
            [{ text: "Go Shopping", onPress: () => router.push("/") }]
          );
          return;
        }

        console.log('✅ Checkout data loaded:', bagItems.length, 'items, Total:', summary.total);

        setCheckoutData({
          bagItems,
          summary,
          isLoading: false,
          error: null,
        });

        loadSavedAddresses();

      } else {
        throw new Error(handleApiError(bagResponse));
      }

    } catch (error: any) {
      console.error('❌ Error loading checkout data:', error);
      setCheckoutData(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to load checkout data',
      }));
    }
  }, [user]);

  // ✅ Load saved addresses
  const loadSavedAddresses = () => {
    const mockAddresses: Address[] = [
  {
    id: '1',
    name: user?.name || 'User Name',
    phone: '9876543210',
    addressLine1: '123 Main Street',
    addressLine2: 'Near Central Mall',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    type: 'home',
    isDefault: true,
  }
];

    setAddresses(mockAddresses);
    setSelectedAddress(mockAddresses[0]);
  };

  // ✅ Add new address
  const handleAddAddress = () => {
    if (!newAddress.name || !newAddress.phone || !newAddress.addressLine1 || 
        !newAddress.city || !newAddress.state || !newAddress.pincode) {
      Alert.alert("Incomplete Address", "Please fill all required fields");
      return;
    }

    const address: Address = {
      ...newAddress,
      id: Date.now().toString(),
      isDefault: addresses.length === 0,
    };

    setAddresses([...addresses, address]);
    setSelectedAddress(address);
    setShowAddressForm(false);
    
    setNewAddress({
  name: user?.name || '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
  type: 'home',
});

    Alert.alert("Success", "Address added successfully");
  };

  // ✅ Place order
  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      Alert.alert("Address Required", "Please select a delivery address");
      return;
    }

    if (!selectedPaymentMethod) {
      Alert.alert("Payment Method Required", "Please select a payment method");
      return;
    }

    try {
      setPlacingOrder(true);

      Animated.sequence([
        Animated.timing(placeOrderScale, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(placeOrderScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      console.log('📦 Placing order...');

      const orderData = {
        userId: user!._id,
        shippingAddress: selectedAddress,
        billingAddress: selectedAddress,
        paymentMethod: selectedPaymentMethod.type,
        paymentGateway: selectedPaymentMethod.id,
        customerNotes: '',
        deliveryPreferences: {
          timeSlot: 'anytime',
          instructions: '',
          requireSignature: false,
          allowPartialDelivery: false,
        },
        useWalletBalance: false,
      };

      const response = await createOrder(orderData);

      if (response.success && response.data) {
        const orderInfo = response.data;
        
        console.log('✅ Order placed successfully:', orderInfo.orderNumber);

        Alert.alert(
          "Order Placed Successfully!",
          `Your order ${orderInfo.orderNumber} has been placed successfully.`,
          [
            {
              text: "View Orders",
              onPress: () => router.push("/(tabs)/profile")
            },
            {
              text: "Continue Shopping",
              onPress: () => router.push("/")
            }
          ]
        );

        setTimeout(() => {
          router.push("/");
        }, 2000);

      } else {
        throw new Error(handleApiError(response));
      }

    } catch (error: any) {
      console.error('❌ Place order error:', error);
      Alert.alert(
        "Order Failed",
        error.message || "Failed to place order. Please try again."
      );
    } finally {
      setPlacingOrder(false);
    }
  };

  // ✅ Navigation
  const handleBackPress = () => {
    router.back();
  };

  // ✅ Load data on mount
  useEffect(() => {
    loadCheckoutData();
  }, [loadCheckoutData]);

  // ✅ Address Card Component
  const AddressCard: React.FC<{ address: Address; selected: boolean; onSelect: () => void }> = ({
    address,
    selected,
    onSelect,
  }) => (
    <TouchableOpacity
      style={[styles.addressCard, selected && styles.selectedAddressCard]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <View style={styles.addressHeader}>
        <View style={styles.addressType}>
          <Text style={styles.addressTypeText}>{address.type.toUpperCase()}</Text>
        </View>
        <View style={[styles.radioButton, selected && styles.radioButtonSelected]}>
          {selected && <Check size={12} color="#fff" />}
        </View>
      </View>
      
      <Text style={styles.addressName}>{address.name}</Text>
      <Text style={styles.addressText}>
        {address.addressLine1}
        {address.addressLine2 ? `, ${address.addressLine2}` : ''}
        {`\n${address.city}, ${address.state} - ${address.pincode}`}
      </Text>
      <Text style={styles.addressPhone}>Phone: {address.phone}</Text>
    </TouchableOpacity>
  );

  // ✅ Payment Method Card Component
  const PaymentMethodCard: React.FC<{ method: PaymentMethod; selected: boolean; onSelect: () => void }> = ({
    method,
    selected,
    onSelect,
  }) => (
    <TouchableOpacity
      style={[styles.paymentMethodCard, selected && styles.selectedPaymentMethodCard]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <View style={styles.paymentMethodLeft}>
        <Text style={styles.paymentMethodIcon}>{method.icon}</Text>
        <View style={styles.paymentMethodInfo}>
          <Text style={styles.paymentMethodName}>{method.name}</Text>
          <Text style={styles.paymentMethodDescription}>{method.description}</Text>
        </View>
      </View>
      <View style={[styles.radioButton, selected && styles.radioButtonSelected]}>
        {selected && <Check size={12} color="#fff" />}
      </View>
    </TouchableOpacity>
  );

  // ✅ Order Summary Component
  const OrderSummary: React.FC = () => (
    <View style={styles.orderSummaryContainer}>
      <Text style={styles.orderSummaryTitle}>Order Summary</Text>
      
      <View style={styles.orderSummaryContent}>
        {checkoutData.bagItems.slice(0, 3).map((item) => (
          <View key={item._id} style={styles.summaryItem}>
            <Image
              source={{ uri: item.productId?.images?.[0] }}
              style={styles.summaryItemImage}
              resizeMode="cover"
            />
            <View style={styles.summaryItemInfo}>
              <Text style={styles.summaryItemName} numberOfLines={1}>
                {item.productId?.name}
              </Text>
              <Text style={styles.summaryItemDetails}>
                Qty: {item.quantity} | ₹{item.productId?.price}
              </Text>
            </View>
          </View>
        ))}
        
        {checkoutData.bagItems.length > 3 && (
          <Text style={styles.moreItemsText}>
            +{checkoutData.bagItems.length - 3} more items
          </Text>
        )}
      </View>
    </View>
  );

  // ✅ Loading state
  if (checkoutData.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff3f6c" />
        <Text style={styles.loadingText}>Loading checkout...</Text>
      </View>
    );
  }

  // ✅ Error state
  if (checkoutData.error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Checkout Error</Text>
        <Text style={styles.errorText}>{checkoutData.error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadCheckoutData}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* ✅ Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackPress}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* ✅ Delivery Address Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <MapPin size={20} color="#ff3f6c" />
              <Text style={styles.sectionTitle}>Delivery Address</Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddressForm(true)}
              activeOpacity={0.7}
            >
              <Plus size={16} color="#ff3f6c" />
              <Text style={styles.addButtonText}>Add New</Text>
            </TouchableOpacity>
          </View>

          {addresses.length > 0 ? (
            <View style={styles.addressList}>
              {addresses.map((address) => (
                <AddressCard
                  key={address.id}
                  address={address}
                  selected={selectedAddress?.id === address.id}
                  onSelect={() => setSelectedAddress(address)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.noAddressContainer}>
              <Text style={styles.noAddressText}>No saved addresses</Text>
              <TouchableOpacity
                style={styles.addFirstAddressButton}
                onPress={() => setShowAddressForm(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.addFirstAddressButtonText}>Add Address</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ✅ Add Address Form */}
        {showAddressForm && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Add New Address</Text>
              <TouchableOpacity
                onPress={() => setShowAddressForm(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.addressForm}>
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.formInput, styles.formInputHalf]}
                  value={newAddress.name}
                  onChangeText={(text) => setNewAddress({...newAddress, name: text})}
                  placeholder="Full Name"
                  placeholderTextColor="#999"
                />
                <TextInput
                  style={[styles.formInput, styles.formInputHalf]}
                  value={newAddress.phone}
                  onChangeText={(text) => setNewAddress({...newAddress, phone: text})}
                  placeholder="Phone Number"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              </View>

              <TextInput
                style={styles.formInput}
                value={newAddress.addressLine1}
                onChangeText={(text) => setNewAddress({...newAddress, addressLine1: text})}
                placeholder="Address Line 1"
                placeholderTextColor="#999"
              />

              <TextInput
                style={styles.formInput}
                value={newAddress.addressLine2}
                onChangeText={(text) => setNewAddress({...newAddress, addressLine2: text})}
                placeholder="Address Line 2 (Optional)"
                placeholderTextColor="#999"
              />

              <View style={styles.formRow}>
                <TextInput
                  style={[styles.formInput, styles.formInputHalf]}
                  value={newAddress.city}
                  onChangeText={(text) => setNewAddress({...newAddress, city: text})}
                  placeholder="City"
                  placeholderTextColor="#999"
                />
                <TextInput
                  style={[styles.formInput, styles.formInputHalf]}
                  value={newAddress.state}
                  onChangeText={(text) => setNewAddress({...newAddress, state: text})}
                  placeholder="State"
                  placeholderTextColor="#999"
                />
              </View>

              <TextInput
                style={[styles.formInput, styles.formInputSmall]}
                value={newAddress.pincode}
                onChangeText={(text) => setNewAddress({...newAddress, pincode: text})}
                placeholder="Pincode"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />

              <View style={styles.addressTypeSelector}>
                {(['home', 'office', 'other'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.addressTypeOption,
                      newAddress.type === type && styles.selectedAddressTypeOption,
                    ]}
                    onPress={() => setNewAddress({...newAddress, type})}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.addressTypeOptionText,
                      newAddress.type === type && styles.selectedAddressTypeOptionText,
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.saveAddressButton}
                onPress={handleAddAddress}
                activeOpacity={0.8}
              >
                <Text style={styles.saveAddressButtonText}>Save Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ✅ Payment Method Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowPaymentMethods(!showPaymentMethods)}
            activeOpacity={0.8}
          >
            <View style={styles.sectionHeaderLeft}>
              <CreditCard size={20} color="#ff3f6c" />
              <Text style={styles.sectionTitle}>Payment Method</Text>
            </View>
            <ChevronDown 
              size={20} 
              color="#666" 
              style={{
                transform: [{ rotate: showPaymentMethods ? '180deg' : '0deg' }]
              }}
            />
          </TouchableOpacity>

          {selectedPaymentMethod && !showPaymentMethods && (
            <View style={styles.selectedPaymentPreview}>
              <Text style={styles.selectedPaymentIcon}>{selectedPaymentMethod.icon}</Text>
              <Text style={styles.selectedPaymentName}>{selectedPaymentMethod.name}</Text>
            </View>
          )}

          {showPaymentMethods && (
            <View style={styles.paymentMethodsList}>
              {paymentMethods.map((method) => (
                <PaymentMethodCard
                  key={method.id}
                  method={method}
                  selected={selectedPaymentMethod?.id === method.id}
                  onSelect={() => {
                    setSelectedPaymentMethod(method);
                    setShowPaymentMethods(false);
                  }}
                />
              ))}
            </View>
          )}
        </View>

        {/* ✅ Order Summary */}
        <OrderSummary />

        {/* ✅ Price Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price Details</Text>
          
          <View style={styles.priceBreakdown}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Subtotal ({checkoutData.summary.itemCount} items)</Text>
              <Text style={styles.priceValue}>₹{checkoutData.summary.subtotal}</Text>
            </View>

            {checkoutData.summary.discount > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Discount</Text>
                <Text style={[styles.priceValue, styles.discountValue]}>-₹{checkoutData.summary.discount}</Text>
              </View>
            )}

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Delivery Charges</Text>
              {checkoutData.summary.deliveryCharge > 0 ? (
                <Text style={styles.priceValue}>₹{checkoutData.summary.deliveryCharge}</Text>
              ) : (
                <Text style={[styles.priceValue, styles.freeValue]}>FREE</Text>
              )}
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Taxes</Text>
              <Text style={styles.priceValue}>₹{checkoutData.summary.tax}</Text>
            </View>

            <View style={styles.priceDivider} />

            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>₹{checkoutData.summary.total}</Text>
            </View>

            {checkoutData.summary.savings > 0 && (
              <View style={styles.savingsContainer}>
                <Gift size={16} color="#4caf50" />
                <Text style={styles.savingsText}>
                  You saved ₹{checkoutData.summary.savings} on this order
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ✅ Delivery Information */}
        <View style={styles.section}>
          <View style={styles.deliveryInfo}>
            <View style={styles.deliveryInfoItem}>
              <Clock size={16} color="#666" />
              <Text style={styles.deliveryInfoText}>
                Estimated delivery: 3-5 business days
              </Text>
            </View>
            <View style={styles.deliveryInfoItem}>
              <Shield size={16} color="#666" />
              <Text style={styles.deliveryInfoText}>
                100% secure payments
              </Text>
            </View>
            <View style={styles.deliveryInfoItem}>
              <Truck size={16} color="#666" />
              <Text style={styles.deliveryInfoText}>
                Free returns within 30 days
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ✅ Fixed Place Order Button */}
      <View style={styles.placeOrderContainer}>
        <View style={styles.placeOrderSummary}>
          <Text style={styles.placeOrderTotal}>₹{checkoutData.summary.total}</Text>
          <Text style={styles.placeOrderItems}>
            {checkoutData.summary.itemCount} items
          </Text>
        </View>

        <Animated.View style={{ transform: [{ scale: placeOrderScale }] }}>
          <TouchableOpacity
            style={[styles.placeOrderButton, placingOrder && styles.placeOrderButtonDisabled]}
            onPress={handlePlaceOrder}
            disabled={placingOrder}
            activeOpacity={0.8}
          >
            {placingOrder ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Check size={20} color="#fff" />
            )}
            <Text style={styles.placeOrderButtonText}>
              {placingOrder ? "Placing Order..." : "Place Order"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ✅ RESPONSIVE STYLES
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
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 8,
    paddingHorizontal: isTablet ? 24 : 16,
    paddingVertical: isTablet ? 20 : 16,
    borderBottomWidth: 8,
    borderBottomColor: '#f8f9fa',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: isTablet ? 20 : 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff0f3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ff3f6c',
  },
  addButtonText: {
    fontSize: 14,
    color: '#ff3f6c',
    fontWeight: '500',
    marginLeft: 4,
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  addressList: {
    gap: 12,
  },
  addressCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: isTablet ? 20 : 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedAddressCard: {
    backgroundColor: '#fff0f3',
    borderColor: '#ff3f6c',
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressType: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  addressTypeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    backgroundColor: '#ff3f6c',
    borderColor: '#ff3f6c',
  },
  addressName: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  addressText: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
    lineHeight: isTablet ? 22 : 20,
    marginBottom: 8,
  },
  addressPhone: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
    fontWeight: '500',
  },
  noAddressContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noAddressText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  addFirstAddressButton: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstAddressButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addressForm: {
    gap: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: isTablet ? 16 : 12,
    paddingVertical: isTablet ? 16 : 12,
    fontSize: isTablet ? 16 : 14,
    color: '#333',
  },
  formInputHalf: {
    flex: 1,
  },
  formInputSmall: {
    width: isTablet ? 200 : 150,
  },
  addressTypeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  addressTypeOption: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  selectedAddressTypeOption: {
    backgroundColor: '#fff0f3',
    borderColor: '#ff3f6c',
  },
  addressTypeOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedAddressTypeOptionText: {
    color: '#ff3f6c',
  },
  saveAddressButton: {
    backgroundColor: '#ff3f6c',
    borderRadius: 8,
    paddingVertical: isTablet ? 16 : 14,
    alignItems: 'center',
  },
  saveAddressButtonText: {
    color: '#fff',
    fontSize: isTablet ? 18 : 16,
    fontWeight: '600',
  },
  selectedPaymentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  selectedPaymentIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  selectedPaymentName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  paymentMethodsList: {
    gap: 12,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: isTablet ? 20 : 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPaymentMethodCard: {
    backgroundColor: '#fff0f3',
    borderColor: '#ff3f6c',
  },
  paymentMethodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paymentMethodDescription: {
    fontSize: isTablet ? 14 : 12,
    color: '#666',
  },
  orderSummaryContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: isTablet ? 20 : 16,
    marginVertical: 8,
  },
  orderSummaryTitle: {
    fontSize: isTablet ? 20 : 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  orderSummaryContent: {
    gap: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItemImage: {
    width: isTablet ? 60 : 50,
    height: isTablet ? 60 : 50,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginRight: 12,
  },
  summaryItemInfo: {
    flex: 1,
  },
  summaryItemName: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  summaryItemDetails: {
    fontSize: isTablet ? 14 : 12,
    color: '#666',
  },
  moreItemsText: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  priceBreakdown: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: isTablet ? 20 : 16,
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
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: isTablet ? 20 : 18,
    color: '#333',
    fontWeight: '600',
  },
  totalValue: {
    fontSize: isTablet ? 22 : 20,
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
  deliveryInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: isTablet ? 20 : 16,
    gap: 12,
  },
  deliveryInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryInfoText: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  placeOrderContainer: {
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
  placeOrderSummary: {
    flex: 1,
    marginRight: 16,
  },
  placeOrderTotal: {
    fontSize: isTablet ? 24 : 20,
    color: '#333',
    fontWeight: '700',
  },
  placeOrderItems: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
    marginTop: 2,
  },
  placeOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff3f6c',
    paddingHorizontal: isTablet ? 32 : 24,
    paddingVertical: isTablet ? 16 : 14,
    borderRadius: 8,
    minWidth: isTablet ? 180 : 140,
  },
  placeOrderButtonDisabled: {
    backgroundColor: '#ccc',
  },
  placeOrderButtonText: {
    fontSize: isTablet ? 18 : 16,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
});
