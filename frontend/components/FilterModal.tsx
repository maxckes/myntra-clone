import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  TextInput,
} from 'react-native';
import {
  X,
  ChevronDown,
  ChevronUp,
  Star,
  Tag,
  DollarSign,
  SlidersHorizontal,
  Check,
  RotateCcw,
  Filter,
  TrendingUp,
  Calendar,
  Heart,
} from 'lucide-react-native';

// ✅ Import types from the shared types file
import { FilterState, SortOption, Category } from "@/types/product";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Enhanced Types
interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  currentFilters: FilterState;
  categories?: Category[];
  brands?: string[];
  priceRange?: { min: number; max: number };
  totalProducts?: number;
}

interface PriceRange {
  label: string;
  value: string;
  min: number;
  max: number;
}

// ✅ Updated SORT_OPTIONS with proper SortOption typing
const SORT_OPTIONS: { 
  label: string; 
  value: SortOption; 
  icon: string;
  description: string;
}[] = [
  { 
    label: 'Relevance', 
    value: 'relevance', 
    icon: '🎯',
    description: 'Best match for your search'
  },
  { 
    label: 'Price: Low to High', 
    value: 'price_asc', 
    icon: '📈',
    description: 'Cheapest first'
  },
  { 
    label: 'Price: High to Low', 
    value: 'price_desc', 
    icon: '📉',
    description: 'Most expensive first'
  },
  { 
    label: 'Customer Rating', 
    value: 'rating', 
    icon: '⭐',
    description: 'Highest rated first'
  },
  { 
    label: 'Newest First', 
    value: 'newest', 
    icon: '🆕',
    description: 'Latest arrivals'
  },
  { 
    label: 'Popularity', 
    value: 'popularity', 
    icon: '🔥',
    description: 'Most popular items'
  },
];

const QUICK_PRICE_RANGES: PriceRange[] = [
  { label: 'Under ₹500', value: '0-500', min: 0, max: 500 },
  { label: '₹500 - ₹1000', value: '500-1000', min: 500, max: 1000 },
  { label: '₹1000 - ₹2000', value: '1000-2000', min: 1000, max: 2000 },
  { label: '₹2000 - ₹5000', value: '2000-5000', min: 2000, max: 5000 },
  { label: 'Above ₹5000', value: '5000+', min: 5000, max: 100000 },
];

const RATING_OPTIONS = [
  { 
    label: '4.5+ stars', 
    value: 4.5, 
    stars: [1, 1, 1, 1, 0.5],
    description: 'Excellent products'
  },
  { 
    label: '4+ stars', 
    value: 4, 
    stars: [1, 1, 1, 1, 0],
    description: 'Very good products'
  },
  { 
    label: '3+ stars', 
    value: 3, 
    stars: [1, 1, 1, 0, 0],
    description: 'Good products'
  },
  { 
    label: '2+ stars', 
    value: 2, 
    stars: [1, 1, 0, 0, 0],
    description: 'Average products'
  },
];

const DISCOUNT_OPTIONS = [
  { label: '70% and above', value: 70, color: '#ff3f6c' },
  { label: '50% and above', value: 50, color: '#ff6b35' },
  { label: '30% and above', value: 30, color: '#ffa500' },
  { label: '20% and above', value: 20, color: '#32cd32' },
  { label: '10% and above', value: 10, color: '#1e90ff' },
];

const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  onClose,
  onApply,
  currentFilters,
  categories = [],
  brands = [],
  priceRange = { min: 0, max: 50000 },
  totalProducts = 0,
}) => {
  // State Management
  const [localFilters, setLocalFilters] = useState<FilterState>(currentFilters);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    sort: true,
    price: false,
    category: false,
    brand: false,
    rating: false,
    discount: false,
  });
  const [slideAnim] = useState(new Animated.Value(screenHeight));
  const [customPriceMin, setCustomPriceMin] = useState<string>('');
  const [customPriceMax, setCustomPriceMax] = useState<string>('');
  const [searchBrand, setSearchBrand] = useState<string>('');

  // Filtered brands for search
  const filteredBrands = useMemo(() => {
    if (!searchBrand) return brands.slice(0, 15); // Limit initial display
    return brands.filter(brand => 
      brand.toLowerCase().includes(searchBrand.toLowerCase())
    ).slice(0, 20);
  }, [brands, searchBrand]);

  // Active filters count with detailed breakdown
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (localFilters.category) count++;
    if (localFilters.subcategory) count++;
    if (localFilters.priceMin !== undefined || localFilters.priceMax !== undefined) count++;
    if (localFilters.rating) count++;
    if (localFilters.brands && localFilters.brands.length > 0) count++;
    if (localFilters.discount) count++;
    if (localFilters.sortBy && localFilters.sortBy !== 'relevance') count++;
    return count;
  }, [localFilters]);

  // Get filter summary for display
  const getFilterSummary = useMemo(() => {
    const summary = [];
    if (localFilters.category) {
      const cat = categories.find(c => c._id === localFilters.category);
      summary.push(cat?.name || 'Category');
    }
    if (localFilters.priceMin || localFilters.priceMax) {
      const min = localFilters.priceMin || 0;
      const max = localFilters.priceMax || '∞';
      summary.push(`₹${min}-${max}`);
    }
    if (localFilters.rating) {
      summary.push(`${localFilters.rating}+ ⭐`);
    }
    if (localFilters.brands && localFilters.brands.length > 0) {
      summary.push(`${localFilters.brands.length} brands`);
    }
    if (localFilters.discount) {
      summary.push(`${localFilters.discount}%+ off`);
    }
    return summary.join(', ');
  }, [localFilters, categories]);

  // Effects
  useEffect(() => {
    if (visible) {
      setLocalFilters(currentFilters);
      setCustomPriceMin(currentFilters.priceMin?.toString() || '');
      setCustomPriceMax(currentFilters.priceMax?.toString() || '');
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: screenHeight,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, currentFilters]);

  // Pan responder for swipe to close
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return gestureState.dy > 0 && gestureState.dy > Math.abs(gestureState.dx);
    },
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dy > 0) {
        slideAnim.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > 100 || gestureState.vy > 0.5) {
        handleClose();
      } else {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      }
    },
  });

  // Handlers
  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const updateFilter = (key: keyof FilterState, value: any) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleBrandToggle = (brand: string) => {
    const currentBrands = localFilters.brands || [];
    const newBrands = currentBrands.includes(brand)
      ? currentBrands.filter(b => b !== brand)
      : [...currentBrands, brand];
    
    updateFilter('brands', newBrands.length > 0 ? newBrands : undefined);
  };

  const handlePriceRangeSelect = (range: PriceRange) => {
    const isSelected = localFilters.priceMin === range.min && 
                      localFilters.priceMax === (range.max === 100000 ? undefined : range.max);
    
    if (isSelected) {
      updateFilter('priceMin', undefined);
      updateFilter('priceMax', undefined);
    } else {
      updateFilter('priceMin', range.min);
      updateFilter('priceMax', range.max === 100000 ? undefined : range.max);
    }
  };

  const handleCustomPriceApply = () => {
    const min = customPriceMin ? parseInt(customPriceMin) : undefined;
    const max = customPriceMax ? parseInt(customPriceMax) : undefined;
    
    if (min !== undefined) updateFilter('priceMin', min);
    if (max !== undefined) updateFilter('priceMax', max);
    
    if (!min && !max) {
      updateFilter('priceMin', undefined);
      updateFilter('priceMax', undefined);
    }
  };

  const handleClearAll = () => {
    setLocalFilters({ sortBy: 'relevance' });
    setCustomPriceMin('');
    setCustomPriceMax('');
    setSearchBrand('');
  };

  const handleApply = () => {
    onApply(localFilters);
    handleClose();
  };

  // Enhanced Star Rating Component
  const StarRating: React.FC<{ stars: number[]; size?: number }> = ({ stars, size = 16 }) => (
    <View style={styles.starContainer}>
      {stars.map((star, index) => (
        <View key={index} style={styles.starWrapper}>
          <Star 
            size={size} 
            color="#ffa500" 
            fill={star === 1 ? "#ffa500" : star === 0.5 ? "#ffa500" : "none"} 
          />
          {star === 0.5 && (
            <View style={[styles.halfStarMask, { width: size / 2 }]}>
              <Star size={size} color="#ffa500" fill="#ffa500" />
            </View>
          )}
        </View>
      ))}
    </View>
  );

  // Section Header Component
  const renderSectionHeader = (title: string, key: string, icon: React.ReactNode, count?: number) => (
    <TouchableOpacity
      style={styles.sectionHeader}
      onPress={() => toggleSection(key)}
      activeOpacity={0.7}
    >
      <View style={styles.sectionHeaderLeft}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
        {count !== undefined && count > 0 && (
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{count}</Text>
          </View>
        )}
      </View>
      {expandedSections[key] ? (
        <ChevronUp size={20} color="#666" />
      ) : (
        <ChevronDown size={20} color="#666" />
      )}
    </TouchableOpacity>
  );

  // Sort Section
  const renderSortSection = () => (
    <View style={styles.section}>
      {renderSectionHeader(
        'Sort By', 
        'sort', 
        <SlidersHorizontal size={20} color="#ff3f6c" />,
        localFilters.sortBy && localFilters.sortBy !== 'relevance' ? 1 : 0
      )}
      {expandedSections.sort && (
        <View style={styles.sectionContent}>
          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionItem,
                localFilters.sortBy === option.value && styles.selectedOption,
              ]}
              onPress={() => updateFilter('sortBy', option.value)}
              activeOpacity={0.7}
            >
              <View style={styles.optionLeft}>
                <Text style={styles.optionEmoji}>{option.icon}</Text>
                <View style={styles.optionTextContainer}>
                  <Text style={[
                    styles.optionText,
                    localFilters.sortBy === option.value && styles.selectedOptionText,
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
              </View>
              {localFilters.sortBy === option.value && (
                <Check size={18} color="#ff3f6c" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  // Price Section
  const renderPriceSection = () => (
    <View style={styles.section}>
      {renderSectionHeader(
        'Price Range', 
        'price', 
        <DollarSign size={20} color="#ff3f6c" />,
        (localFilters.priceMin !== undefined || localFilters.priceMax !== undefined) ? 1 : 0
      )}
      {expandedSections.price && (
        <View style={styles.sectionContent}>
          <Text style={styles.subsectionTitle}>Quick Select</Text>
          <View style={styles.priceRangeGrid}>
            {QUICK_PRICE_RANGES.map((range) => {
              const isSelected = localFilters.priceMin === range.min && 
                               localFilters.priceMax === (range.max === 100000 ? undefined : range.max);
              return (
                <TouchableOpacity
                  key={range.value}
                  style={[
                    styles.priceRangeChip,
                    isSelected && styles.selectedPriceRange,
                  ]}
                  onPress={() => handlePriceRangeSelect(range)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.priceRangeText,
                    isSelected && styles.selectedPriceRangeText,
                  ]}>
                    {range.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.subsectionTitle}>Custom Range</Text>
          <View style={styles.customPriceContainer}>
            <View style={styles.customPriceInputContainer}>
              <Text style={styles.customPriceLabel}>Min Price</Text>
              <TextInput
                style={styles.customPriceInput}
                value={customPriceMin}
                onChangeText={setCustomPriceMin}
                placeholder="₹0"
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>
            <Text style={styles.customPriceSeparator}>to</Text>
            <View style={styles.customPriceInputContainer}>
              <Text style={styles.customPriceLabel}>Max Price</Text>
              <TextInput
                style={styles.customPriceInput}
                value={customPriceMax}
                onChangeText={setCustomPriceMax}
                placeholder="₹50000"
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>
            <TouchableOpacity
              style={styles.customPriceApplyButton}
              onPress={handleCustomPriceApply}
              activeOpacity={0.7}
            >
              <Text style={styles.customPriceApplyText}>Apply</Text>
            </TouchableOpacity>
          </View>

          {(localFilters.priceMin !== undefined || localFilters.priceMax !== undefined) && (
            <View style={styles.selectedPriceDisplay}>
              <Text style={styles.selectedPriceText}>
                Selected: ₹{localFilters.priceMin || 0} - ₹{localFilters.priceMax || '50000+'}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  // Enhanced Rating Section with Visual Stars
  const renderRatingSection = () => (
    <View style={styles.section}>
      {renderSectionHeader(
        'Customer Rating', 
        'rating', 
        <Star size={20} color="#ff3f6c" />,
        localFilters.rating ? 1 : 0
      )}
      {expandedSections.rating && (
        <View style={styles.sectionContent}>
          <Text style={styles.subsectionTitle}>Minimum Rating</Text>
          {RATING_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionItem,
                localFilters.rating === option.value && styles.selectedOption,
              ]}
              onPress={() => updateFilter('rating', 
                localFilters.rating === option.value ? undefined : option.value
              )}
              activeOpacity={0.7}
            >
              <View style={styles.optionLeft}>
                <StarRating stars={option.stars} size={18} />
                <View style={styles.ratingTextContainer}>
                  <Text style={[
                    styles.optionText,
                    localFilters.rating === option.value && styles.selectedOptionText,
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={styles.ratingDescription}>{option.description}</Text>
                </View>
              </View>
              {localFilters.rating === option.value && (
                <Check size={18} color="#ff3f6c" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  // Category Section
  const renderCategorySection = () => (
    <View style={styles.section}>
      {renderSectionHeader(
        'Category', 
        'category', 
        <Tag size={20} color="#ff3f6c" />,
        localFilters.category ? 1 : 0
      )}
      {expandedSections.category && (
        <View style={styles.sectionContent}>
          <TouchableOpacity
            style={[
              styles.optionItem,
              !localFilters.category && styles.selectedOption,
            ]}
            onPress={() => {
              updateFilter('category', undefined);
              updateFilter('subcategory', undefined);
            }}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.optionText,
              !localFilters.category && styles.selectedOptionText,
            ]}>
              All Categories
            </Text>
            {!localFilters.category && <Check size={18} color="#ff3f6c" />}
          </TouchableOpacity>

          {categories.map((category) => (
            <View key={category._id}>
              <TouchableOpacity
                style={[
                  styles.optionItem,
                  localFilters.category === category._id && styles.selectedOption,
                ]}
                onPress={() => {
                  updateFilter('category', category._id);
                  updateFilter('subcategory', undefined);
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.optionText,
                  localFilters.category === category._id && styles.selectedOptionText,
                ]}>
                  {category.name}
                </Text>
                {localFilters.category === category._id && (
                  <Check size={18} color="#ff3f6c" />
                )}
              </TouchableOpacity>

              {localFilters.category === category._id && category.subcategory && (
                <View style={styles.subcategoryContainer}>
                  <Text style={styles.subcategoryTitle}>Subcategories:</Text>
                  <View style={styles.subcategoryGrid}>
                    {category.subcategory.map((sub) => (
                      <TouchableOpacity
                        key={sub}
                        style={[
                          styles.subcategoryChip,
                          localFilters.subcategory === sub && styles.selectedSubcategory,
                        ]}
                        onPress={() => updateFilter('subcategory', 
                          localFilters.subcategory === sub ? undefined : sub
                        )}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.subcategoryText,
                          localFilters.subcategory === sub && styles.selectedSubcategoryText,
                        ]}>
                          {sub}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  // Enhanced Brand Section with Search
  const renderBrandSection = () => (
    <View style={styles.section}>
      {renderSectionHeader(
        'Brand', 
        'brand', 
        <Tag size={20} color="#ff3f6c" />,
        localFilters.brands?.length || 0
      )}
      {expandedSections.brand && (
        <View style={styles.sectionContent}>
          <TextInput
            style={styles.brandSearchInput}
            value={searchBrand}
            onChangeText={setSearchBrand}
            placeholder="Search brands..."
            placeholderTextColor="#999"
          />
          
          <ScrollView style={styles.brandList} nestedScrollEnabled>
            {filteredBrands.map((brand) => (
              <TouchableOpacity
                key={brand}
                style={[
                  styles.optionItem,
                  localFilters.brands?.includes(brand) && styles.selectedOption,
                ]}
                onPress={() => handleBrandToggle(brand)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.optionText,
                  localFilters.brands?.includes(brand) && styles.selectedOptionText,
                ]}>
                  {brand}
                </Text>
                {localFilters.brands?.includes(brand) && (
                  <Check size={18} color="#ff3f6c" />
                )}
              </TouchableOpacity>
            ))}
            
            {brands.length > filteredBrands.length && !searchBrand && (
              <Text style={styles.moreBrandsText}>
                + {brands.length - filteredBrands.length} more brands available
              </Text>
            )}
          </ScrollView>

          {localFilters.brands && localFilters.brands.length > 0 && (
            <View style={styles.selectedBrandsContainer}>
              <Text style={styles.selectedBrandsLabel}>
                Selected ({localFilters.brands.length}):
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.selectedBrandsList}>
                  {localFilters.brands.map((brand) => (
                    <TouchableOpacity
                      key={brand}
                      style={styles.selectedBrandChip}
                      onPress={() => handleBrandToggle(brand)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.selectedBrandText}>{brand}</Text>
                      <X size={14} color="#fff" />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </View>
  );

  // Enhanced Discount Section
  const renderDiscountSection = () => (
    <View style={styles.section}>
      {renderSectionHeader(
        'Discount', 
        'discount', 
        <Tag size={20} color="#ff3f6c" />,
        localFilters.discount ? 1 : 0
      )}
      {expandedSections.discount && (
        <View style={styles.sectionContent}>
          {DISCOUNT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionItem,
                localFilters.discount === option.value && styles.selectedOption,
              ]}
              onPress={() => updateFilter('discount', 
                localFilters.discount === option.value ? undefined : option.value
              )}
              activeOpacity={0.7}
            >
              <View style={styles.optionLeft}>
                <View style={[styles.discountBadge, { backgroundColor: option.color }]}>
                  <Text style={styles.discountBadgeText}>{option.value}%</Text>
                </View>
                <Text style={[
                  styles.optionText,
                  localFilters.discount === option.value && styles.selectedOptionText,
                ]}>
                  {option.label}
                </Text>
              </View>
              {localFilters.discount === option.value && (
                <Check size={18} color="#ff3f6c" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
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
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Handle Bar */}
          <View style={styles.handleBar} />
          
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.headerTitle}>Filters & Sort</Text>
                <Text style={styles.headerSubtitle}>{totalProducts} products</Text>
              </View>
              {activeFiltersCount > 0 && (
                <View style={styles.filterCountBadge}>
                  <Text style={styles.filterCountText}>{activeFiltersCount}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <X size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Active Filters Summary */}
          {activeFiltersCount > 0 && (
            <View style={styles.activeFilteSummary}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text style={styles.filterSummaryText}>{getFilterSummary}</Text>
              </ScrollView>
            </View>
          )}

          {/* Content */}
          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {renderSortSection()}
            {renderPriceSection()}
            {renderRatingSection()}
            {renderCategorySection()}
            {renderBrandSection()}
            {renderDiscountSection()}
            
            {/* Bottom spacing */}
            <View style={{ height: 120 }} />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearAll}
              activeOpacity={0.7}
            >
              <RotateCcw size={18} color="#666" />
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApply}
              activeOpacity={0.7}
            >
              <Filter size={18} color="#fff" />
              <Text style={styles.applyButtonText}>
                Apply {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.9,
    minHeight: screenHeight * 0.6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleContainer: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  filterCountBadge: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  filterCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  activeFilteSummary: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterSummaryText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  sectionBadge: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  sectionBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  sectionContent: {
    paddingTop: 12,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 12,
    marginTop: 8,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
  },
  selectedOption: {
    backgroundColor: '#fff0f3',
    borderWidth: 1,
    borderColor: '#ff3f6c',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  selectedOptionText: {
    color: '#ff3f6c',
    fontWeight: '500',
  },
  optionDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  starContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  starWrapper: {
    position: 'relative',
  },
  halfStarMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  ratingTextContainer: {
    flex: 1,
  },
  ratingDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  priceRangeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  priceRangeChip: {
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedPriceRange: {
    backgroundColor: '#ff3f6c',
    borderColor: '#ff3f6c',
  },
  priceRangeText: {
    fontSize: 13,
    color: '#666',
  },
  selectedPriceRangeText: {
    color: '#fff',
    fontWeight: '500',
  },
  customPriceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  customPriceInputContainer: {
    flex: 1,
  },
  customPriceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  customPriceInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
  },
  customPriceSeparator: {
    fontSize: 16,
    color: '#666',
    marginHorizontal: 12,
    marginBottom: 10,
    fontWeight: '500',
  },
  customPriceApplyButton: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  customPriceApplyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedPriceDisplay: {
    backgroundColor: '#e8f5e8',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  selectedPriceText: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '500',
  },
  subcategoryContainer: {
    paddingLeft: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  subcategoryTitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  subcategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  subcategoryChip: {
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedSubcategory: {
    backgroundColor: '#ff3f6c',
    borderColor: '#ff3f6c',
  },
  subcategoryText: {
    fontSize: 12,
    color: '#666',
  },
  selectedSubcategoryText: {
    color: '#fff',
    fontWeight: '500',
  },
  brandSearchInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  brandList: {
    maxHeight: 200,
  },
  moreBrandsText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 8,
    fontStyle: 'italic',
  },
  selectedBrandsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  selectedBrandsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  selectedBrandsList: {
    flexDirection: 'row',
  },
  selectedBrandChip: {
    backgroundColor: '#ff3f6c',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  selectedBrandText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginRight: 6,
  },
  discountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  discountBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  clearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
    backgroundColor: '#f8f9fa',
  },
  clearButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    marginLeft: 6,
  },
  applyButton: {
    flex: 2,
    backgroundColor: '#ff3f6c',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#ff3f6c',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
});

export default FilterModal;
