import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal, FlatList, Keyboard, Dimensions, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS, GRADIENTS } from '../../theme/colors';
import { ordersAPI } from '../../services/api';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import ThemedAlert from '../../components/common/ThemedAlert';
import { getData, storeData } from '../../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../../utils/constants';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Islamabad Areas with Food Points
const ISLAMABAD_AREAS = {
  'F-6': ['KFC F-6', 'Hardees F-6', 'Tehzeeb Bakers'],
  'F-7': ['KFC F-7', 'Pizza Hut F-7', 'Subway F-7'],
  'F-8': ['McDonald\'s F-8', 'Domino\'s Pizza', 'Ginyaki'],
  'F-10': ['KFC F-10', 'Pizza Hut F-10', 'Gloria Jeans'],
  'F-11': ['McDonald\'s F-11', 'Hardees F-11'],
  'G-6': ['Tehzeeb Bakers', 'Loafology'],
  'G-7': ['KFC G-7', 'Subway'],
  'G-8': ['McDonald\'s G-8', 'Pizza Hut'],
  'G-9': ['KFC G-9', 'Hardees', 'Ginyaki'],
  'G-10': ['McDonald\'s G-10', 'Burger King', 'Subway'],
  'G-11': ['KFC G-11', 'Pizza Hut'],
  'E-7': ['Tehzeeb Bakers', 'Coffee Republic'],
  'E-8': ['KFC E-8', 'Hardees'],
  'E-9': ['McDonald\'s', 'Subway'],
  'E-11': ['KFC E-11', 'Pizza Hut'],
  'I-8': ['Hardees I-8', 'Gloria Jeans'],
  'I-9': ['KFC I-9'],
  'I-10': ['McDonald\'s I-10'],
  'DHA Phase 1': ['KFC DHA', 'Hardees DHA', 'Pizza Hut'],
  'DHA Phase 2': ['McDonald\'s', 'Subway'],
  'Bahria Phase 7': ['KFC Bahria', 'Hardees'],
  'Bahria Phase 8': ['McDonald\'s Bahria'],
  'Gulberg Residencia': ['Tehzeeb Bakers', 'Coffee Planet'],
  'Bani Gala': ['KFC Bani Gala'],
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SECTION_SIDE_PADDING = SPACING.md;

// Hero Food Cards Data
const HERO_CARDS = [
  { id: '1', title: 'Burger King', subtitle: 'Flame Grilled Burgers', image: '🍔', rating: '4.5', deliveryTime: '25-35', deliveryType: 'Free', color: '#2EC4B6' },
  { id: '2', title: 'Pizza Hut', subtitle: 'Delicious Pizzas', image: '🍕', rating: '4.3', deliveryTime: '30-45', deliveryType: 'Free', color: '#2EC4B6' },
  { id: '3', title: 'KFC', subtitle: 'Finger Lickin Good', image: '🍗', rating: '4.4', deliveryTime: '25-40', deliveryType: 'Free', color: '#2EC4B6' },
  { id: '4', title: 'McDonald\'s', subtitle: 'I\'m Lovin It', image: '🍟', rating: '4.2', deliveryTime: '20-30', deliveryType: 'Free', color: '#2EC4B6' },
  { id: '5', title: 'Subway', subtitle: 'Fresh Sandwiches', image: '🥪', rating: '4.6', deliveryTime: '15-25', deliveryType: 'Free', color: '#2EC4B6' },
  { id: '6', title: 'Dunkin', subtitle: 'Coffee & Donuts', image: '🍩', rating: '4.5', deliveryTime: '20-35', deliveryType: 'Free', color: '#2EC4B6' },
  { id: '7', title: 'Baskin Robbins', subtitle: 'Ice Cream Delights', image: '🍦', rating: '4.7', deliveryTime: '15-20', deliveryType: 'Free', color: '#2EC4B6' },
];

const HERO_LOOP_CARDS = [
  HERO_CARDS[HERO_CARDS.length - 1],
  ...HERO_CARDS,
  HERO_CARDS[0],
];

const DashboardScreen = ({ navigation }) => {
  const [user, setUser] = useState({ name: 'Fawad' });
  const [cartCount, setCartCount] = useState(0);
  const [themedAlert, setThemedAlert] = useState({ visible: false, title: '', message: '', buttons: [] });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const currentOrdersAnim = useRef(new Animated.Value(0)).current;
  const orderInterestAnim = useRef(new Animated.Value(0)).current;
  const recentOrdersAnim = useRef(new Animated.Value(0)).current;

  // Hero Carousel State
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const heroScrollRef = useRef(null);
  const heroIntervalRef = useRef(null);
  const heroPageIndexRef = useRef(1);
  const scrollViewRef = useRef(null);

  // Order Items
  const [orderItems, setOrderItems] = useState([]);
  const [currentItem, setCurrentItem] = useState('');

  // Area & Store Selection
  const [selectedArea, setSelectedArea] = useState('');
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);
  const [areaSearch, setAreaSearch] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [customStore, setCustomStore] = useState('');
  const [showCustomStoreInput, setShowCustomStoreInput] = useState(false);
  const [isRobotStore, setIsRobotStore] = useState(false);

  // Address
  const [address, setAddress] = useState('');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedSavedAddress, setSelectedSavedAddress] = useState(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showManualAddressInput, setShowManualAddressInput] = useState(false);

  // Orders
  const [recentOrders, setRecentOrders] = useState([]);
  const [currentOrders, setCurrentOrders] = useState([]);

  // Initialize hero carousel
  useEffect(() => {
    const t = setTimeout(() => {
      heroScrollRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: false });
      heroPageIndexRef.current = 1;
      setCurrentHeroIndex(0);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Hero Auto-Slide
  useEffect(() => {
    heroIntervalRef.current = setInterval(() => {
      const lastLoopPageIndex = HERO_CARDS.length + 1;
      const nextPageIndex = Math.min(heroPageIndexRef.current + 1, lastLoopPageIndex);
      heroScrollRef.current?.scrollTo({ x: nextPageIndex * SCREEN_WIDTH, animated: true });
      heroPageIndexRef.current = nextPageIndex;
    }, 5000);
    return () => { if (heroIntervalRef.current) clearInterval(heroIntervalRef.current); };
  }, []);

  const handleHeroScroll = (event) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(contentOffset / SCREEN_WIDTH);
    const realIndex = (pageIndex - 1 + HERO_CARDS.length) % HERO_CARDS.length;
    setCurrentHeroIndex(realIndex);
  };

  const handleHeroScrollEnd = (event) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(contentOffset / SCREEN_WIDTH);
    if (pageIndex === 0) {
      heroScrollRef.current?.scrollTo({ x: HERO_CARDS.length * SCREEN_WIDTH, animated: false });
      heroPageIndexRef.current = HERO_CARDS.length;
      setCurrentHeroIndex(HERO_CARDS.length - 1);
      return;
    }
    if (pageIndex === HERO_CARDS.length + 1) {
      heroScrollRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: false });
      heroPageIndexRef.current = 1;
      setCurrentHeroIndex(0);
      return;
    }
    heroPageIndexRef.current = pageIndex;
  };

  // Animate sections on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.timing(currentOrdersAnim, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
      Animated.timing(orderInterestAnim, { toValue: 1, duration: 600, delay: 400, useNativeDriver: true }),
      Animated.timing(recentOrdersAnim, { toValue: 1, duration: 600, delay: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const userData = await getData(ASYNC_STORAGE_KEYS.USER_DATA);
      if (userData) setUser(userData);
      const cartItems = await getData(ASYNC_STORAGE_KEYS.CART) || [];
      setCartCount(cartItems.length);
      
      // Fetch orders from backend
      try {
        const ordersResponse = await ordersAPI.getMyOrders({ limit: 10 });
        if (ordersResponse.success && ordersResponse.data) {
          const orders = ordersResponse.data;
          const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
          setRecentOrders(sortedOrders);
          const activeStatuses = ['pending', 'accepted', 'processing'];
          const activeOrders = orders.filter(order => activeStatuses.includes(order.status));
          setCurrentOrders(activeOrders);
        }
      } catch (orderError) {
        console.log('Using local orders:', orderError.message);
        const orders = await getData(ASYNC_STORAGE_KEYS.ORDERS) || [];
        const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
        setRecentOrders(sortedOrders);
        const activeStatuses = ['Pending', 'In Progress', 'Accepted', 'Processing'];
        const activeOrders = orders.filter(order => activeStatuses.includes(order.status));
        setCurrentOrders(activeOrders);
      }
      
      const addresses = await getData(ASYNC_STORAGE_KEYS.ADDRESSES) || [];
      setSavedAddresses(addresses);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchDashboardData(); }, [fetchDashboardData]));

  const addOrderItem = () => {
    if (currentItem && currentItem.trim()) {
      setOrderItems([...orderItems, { id: Date.now().toString(), text: currentItem.trim(), completed: false }]);
      setCurrentItem('');
    }
  };

  const toggleOrderItem = (id) => {
    setOrderItems(orderItems.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
  };

  const removeOrderItem = (id) => {
    Alert.alert('Remove Item', 'Are you sure you want to remove this item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setOrderItems(orderItems.filter(item => item.id !== id)) }
    ]);
  };

  const filteredAreas = Object.keys(ISLAMABAD_AREAS).filter(area =>
    area.toLowerCase().includes(areaSearch.toLowerCase())
  );

  const selectArea = (area) => {
    setSelectedArea(area);
    setSelectedStore('');
    setShowAreaDropdown(false);
    setAreaSearch('');
    setShowStoreDropdown(true);
    setIsRobotStore(false);
    setCustomStore('');
    setShowCustomStoreInput(false);
  };

  const getAvailableStores = () => {
    if (!selectedArea) return [];
    const stores = ISLAMABAD_AREAS[selectedArea] || [];
    return ['Other', ...stores];
  };

  const selectStore = (store) => {
    if (store === 'Other') {
      setShowCustomStoreInput(true);
      setSelectedStore('Other');
    } else {
      setSelectedStore(store);
      setShowCustomStoreInput(false);
      setCustomStore('');
    }
    setShowStoreDropdown(false);
  };

  const handleRobotStoreToggle = () => {
    setIsRobotStore(!isRobotStore);
    if (!isRobotStore) {
      setSelectedStore('Robot Store');
      setShowCustomStoreInput(false);
      setCustomStore('');
    } else {
      setSelectedStore('');
    }
  };

  const validateAndAddToCart = async () => {
    if (orderItems.length === 0) { Alert.alert('Error', 'Please add at least one order item'); return; }
    if (!selectedArea) { Alert.alert('Error', 'Please select your area'); return; }
    if (!isRobotStore && !selectedStore) { Alert.alert('Error', 'Please select a store or choose Robot Store'); return; }
    if (selectedStore === 'Other' && !customStore.trim()) { Alert.alert('Error', 'Please enter custom store name'); return; }
    if (!address.trim()) { Alert.alert('Error', 'Please enter your address'); return; }

    const orderData = {
      id: Date.now().toString(),
      items: orderItems.map(item => ({ id: item.id || Date.now().toString() + Math.random(), text: item.text || '', completed: item.completed || false })),
      area: selectedArea || '',
      store: isRobotStore ? 'Robot Store' : (selectedStore === 'Other' ? (customStore || '') : (selectedStore || '')),
      isRobotStore: !!isRobotStore,
      address: address.trim() || '',
      status: 'Pending',
      createdAt: new Date().toISOString(),
      riderId: null,
      riderName: null,
      riderPhone: null,
    };

    try {
      const currentCart = await getData(ASYNC_STORAGE_KEYS.CART) || [];
      const updatedCart = [...currentCart, orderData];
      await storeData(ASYNC_STORAGE_KEYS.CART, updatedCart);
      setCartCount(updatedCart.length);
      setOrderItems([]);
      setSelectedArea('');
      setSelectedStore('');
      setCustomStore('');
      setIsRobotStore(false);
      setAddress('');
      setThemedAlert({
        visible: true,
        title: 'Success',
        message: 'Order added to cart!',
        buttons: [
          { text: 'View Cart', onPress: () => navigation.navigate('Cart') },
          { text: 'OK', style: 'cancel' },
        ],
      });
    } catch (error) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', 'Failed to add order');
    }
  };

  return (
    <View style={styles.container}>
      <Header navigation={navigation} transparent={true} />

      <ThemedAlert
        visible={themedAlert.visible}
        title={themedAlert.title}
        message={themedAlert.message}
        buttons={themedAlert.buttons}
        onRequestClose={() => setThemedAlert({ visible: false, title: '', message: '', buttons: [] })}
      />

      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ─── HERO SECTION ─── */}
        <Animated.View style={[styles.heroSection, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <ScrollView
            ref={heroScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleHeroScroll}
            onMomentumScrollEnd={handleHeroScrollEnd}
            scrollEventThrottle={16}
            contentContainerStyle={styles.heroScrollContent}
            decelerationRate="fast"
            snapToInterval={SCREEN_WIDTH}
            snapToAlignment="start"
          >
            {HERO_LOOP_CARDS.map((card, index) => (
              <View key={`hero-${card.id}-${index}`} style={styles.heroCardWrapper}>
                <LinearGradient
                  colors={['#28BFB2', '#1FA99D']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroCard}
                >
                  {/* ── Decorative background circles ── */}
                  <View style={styles.heroBgCircleLarge} />
                  <View style={styles.heroBgCircleMedium} />
                  <View style={styles.heroBgCircleSmall} />

                  {/* ── Top row: image + text ── */}
                  <View style={styles.heroTopSection}>
                    {/* Glassmorphism food image circle */}
                    <View style={styles.heroImageOuter}>
                      <View style={styles.heroImageInner}>
                        <Text style={styles.heroImageEmoji}>{card.image}</Text>
                      </View>
                    </View>

                    {/* Title + Subtitle */}
                    <View style={styles.heroTextContainer}>
                      <Text style={styles.heroTitle}>{card.title}</Text>
                      <Text style={styles.heroSubtitle}>{card.subtitle}</Text>
                    </View>
                  </View>

                  {/* ── Stats row with dividers ── */}
                  <View style={styles.heroStatsRow}>
                    <View style={styles.heroStatItem}>
                      <Ionicons name="star" size={14} color="#FFD700" />
                      <Text style={styles.heroStatValue}>{card.rating}</Text>
                      <Text style={styles.heroStatLabel}>Rating</Text>
                    </View>

                    <View style={styles.heroStatDivider} />

                    <View style={styles.heroStatItem}>
                      <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.85)" />
                      <Text style={styles.heroStatValue}>{card.deliveryTime} min</Text>
                      <Text style={styles.heroStatLabel}>Delivery Time</Text>
                    </View>

                    <View style={styles.heroStatDivider} />

                    <View style={styles.heroStatItem}>
                      <Ionicons name="bicycle-outline" size={14} color="rgba(255,255,255,0.85)" />
                      <Text style={styles.heroStatValue}>{card.deliveryType}</Text>
                      <Text style={styles.heroStatLabel}>Delivery</Text>
                    </View>
                  </View>

                  {/* ── Order Now button ── */}
                  <TouchableOpacity style={styles.heroOrderButton} activeOpacity={0.85} onPress={() => scrollViewRef.current?.scrollTo({ y: 300, animated: true })}>
                    <Text style={styles.heroOrderButtonText}>Order Now</Text>
                    <View style={styles.heroOrderButtonArrow}>
                      <Ionicons name="chevron-forward" size={16} color="#fff" />
                    </View>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            ))}
          </ScrollView>

          {/* Pagination dots */}
          <View style={styles.paginationContainer}>
            {HERO_CARDS.map((_, index) => (
              <View
                key={index}
                style={[styles.paginationDot, index === currentHeroIndex && styles.paginationDotActive]}
              />
            ))}
          </View>
        </Animated.View>
        {/* ─── END HERO SECTION ─── */}

        {/* Current Orders */}
        {currentOrders.length > 0 && (
          <Animated.View style={[styles.currentOrdersSection, { opacity: currentOrdersAnim, transform: [{ translateX: slideAnim }] }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.headingLabelContainer}>
                <Ionicons name="bicycle-outline" size={22} color="#2EC4B6" />
                <Text style={styles.sectionTitle}>Current Orders</Text>
              </View>
              <View style={styles.currentOrdersBadge}>
                <Text style={styles.currentOrdersBadgeText}>{currentOrders.length}</Text>
              </View>
            </View>

            <View style={styles.currentOrdersList}>
              {currentOrders.map((order, index) => (
                <TouchableOpacity
                  key={order.id || index}
                  style={styles.currentOrderCard}
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate('OrderDetails', { order })}
                >
                  <View style={styles.currentOrderHeader}>
                    <View style={styles.currentOrderIdContainer}>
                      <Text style={styles.currentOrderId}>#{order.orderId?.slice(-6) || order.id?.slice(-6) || 'N/A'}</Text>
                      <View style={[styles.statusBadge, {
                        backgroundColor: order.status === 'processing' ? '#FF8C42' :
                          order.status === 'accepted' ? '#2EC4B6' : '#2EC4B6'
                      }]}>
                        <Text style={styles.statusText}>{order.status?.charAt(0).toUpperCase() + order.status?.slice(1) || 'Pending'}</Text>
                      </View>
                    </View>
                    <Text style={styles.currentOrderDate}>
                      {new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  {(order.riderName || order.rider?.name) && (
                    <View style={styles.riderInfoContainer}>
                      <Ionicons name="person-circle-outline" size={18} color="#2EC4B6" />
                      <Text style={styles.riderName}>Rider: {order.riderName || order.rider?.name}</Text>
                      {(order.riderPhone || order.rider?.phone) && <Text style={styles.riderPhone}>({order.riderPhone || order.rider?.phone})</Text>}
                    </View>
                  )}

                  <View style={styles.currentOrderItems}>
                    <Text style={styles.currentOrderItemsLabel}>
                      <Ionicons name="fast-food-outline" size={14} color="#666" /> Items:
                    </Text>
                    <Text style={styles.currentOrderItemsText} numberOfLines={2}>
                      {Array.isArray(order.items) ? order.items.map(i => i.text || i).join(' • ') : order.items}
                    </Text>
                  </View>

                  <View style={styles.currentOrderStore}>
                    <Ionicons name="storefront-outline" size={14} color="#666" />
                    <Text style={styles.currentOrderStoreText} numberOfLines={1}>
                      {order.store || 'Unknown Store'} • {order.area}
                    </Text>
                  </View>

                  <View style={styles.currentOrderActions}>
                    <TouchableOpacity style={styles.viewDetailsButton} onPress={() => navigation.navigate('OrderDetails', { order })}>
                      <Ionicons name="eye-outline" size={16} color="#2EC4B6" />
                      <Text style={styles.viewDetailsText}>View Details</Text>
                    </TouchableOpacity>
                    {(order.riderId || order.rider?.id) && (
                      <TouchableOpacity style={styles.chatButton} onPress={() => navigation.navigate('Chat', { riderId: order.riderId || order.rider?.id, riderName: order.riderName || order.rider?.name, orderId: order.id || order._id })}>
                        <Ionicons name="chatbubble-outline" size={16} color="#fff" />
                        <Text style={styles.chatButtonText}>Chat with Rider</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Content Container */}
        <View style={styles.contentContainer}>

          {/* Order Your Interest */}
          <View style={[styles.sectionHeader, styles.orderInterestHeader]}>
            <View style={styles.headingLabelContainer}>
              <Ionicons name="list-outline" size={22} color="#2EC4B6" />
              <Text style={styles.sectionTitle}>Order Your Interest</Text>
            </View>
            {orderItems.length > 0 && (
              <View style={styles.itemCountBadge}>
                <Text style={styles.itemCountBadgeText}>{orderItems.length}</Text>
              </View>
            )}
          </View>

          <Animated.View style={[styles.orderCardContainer, { opacity: orderInterestAnim, transform: [{ translateY: slideAnim }] }]}>

            {/* 1. Order items input */}
            <View style={styles.inputSection}>
              {orderItems.length > 0 && (
                <View style={styles.selectedItemsPreview}>
                  <Text style={styles.selectedItemsLabel}>Your Menu:</Text>
                  <View style={styles.selectedItemsList}>
                    {orderItems.slice(0, 3).map((item) => (
                      <View key={item.id} style={styles.selectedItemChip}>
                        <Text style={styles.selectedItemText}>• {item.text}</Text>
                      </View>
                    ))}
                    {orderItems.length > 3 && <Text style={styles.moreItemsText}>+{orderItems.length - 3} more...</Text>}
                  </View>
                </View>
              )}

              <View style={styles.inlineAddContainer}>
                <View style={styles.inlineInputRow}>
                  <TextInput
                    style={styles.inlineInput}
                    placeholder="Type your order..."
                    value={currentItem}
                    onChangeText={setCurrentItem}
                    onSubmitEditing={addOrderItem}
                    placeholderTextColor="#999"
                  />
                  <TouchableOpacity
                    style={[styles.inlineAddButton, !currentItem.trim() && styles.inlineAddButtonDisabled]}
                    onPress={addOrderItem}
                    disabled={!currentItem.trim()}
                  >
                    <LinearGradient colors={['#2EC4B6', '#2EC4B6']} style={styles.addButtonGradient}>
                      <Text style={styles.inlineAddButtonText}>Add</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>

              {orderItems.length > 0 && (
                <View style={styles.itemsListCompact}>
                  {orderItems.map((item, index) => (
                    <View key={item.id} style={styles.orderItemRowCompact}>
                      <Text style={styles.orderItemNumber}>{index + 1}.</Text>
                      <Text style={styles.orderItemTextCompact}>{item.text}</Text>
                      <TouchableOpacity style={styles.deleteButtonCompact} onPress={() => removeOrderItem(item.id)}>
                        <Ionicons name="close-circle" size={18} color="#FF6B6B" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* 2. Select Area */}
            <View style={styles.inputSection}>
              <View style={styles.labelContainer}>
                <Ionicons name="location-outline" size={18} color="#2EC4B6" />
                <Text style={styles.inputLabel}>Select Your Area</Text>
              </View>
              <TouchableOpacity style={styles.selectorInput} onPress={() => setShowAreaDropdown(true)}>
                <Text style={selectedArea ? styles.selectedText : styles.placeholderText}>
                  {selectedArea || 'Choose your area'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#999" />
              </TouchableOpacity>
            </View>

            {/* 3. Store Selection */}
            {selectedArea && (
              <View style={styles.inputSection}>
                <View style={styles.labelContainer}>
                  <Ionicons name="storefront-outline" size={18} color="#2EC4B6" />
                  <Text style={styles.inputLabel}>Select Store Type</Text>
                </View>

                <View style={styles.storeTypeCardsContainer}>
                  <TouchableOpacity
                    style={[styles.storeTypeCard, (selectedStore && selectedStore !== 'Other' && !isRobotStore) && styles.storeTypeCardSelected]}
                    onPress={() => { setIsRobotStore(false); setShowStoreDropdown(true); setSelectedStore(''); setCustomStore(''); setShowCustomStoreInput(false); }}
                  >
                    <LinearGradient
                      colors={(selectedStore && selectedStore !== 'Other' && !isRobotStore) ? ['#2EC4B6', '#2EC4B6'] : ['#fff', '#fff']}
                      style={styles.storeTypeGradient}
                    >
                      <View style={[styles.storeTypeIconContainer, (selectedStore && selectedStore !== 'Other' && !isRobotStore) && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                        <Ionicons name="fast-food-outline" size={28} color={(selectedStore && selectedStore !== 'Other' && !isRobotStore) ? '#fff' : '#2EC4B6'} />
                      </View>
                      <Text style={[styles.storeTypeCardTitle, (selectedStore && selectedStore !== 'Other' && !isRobotStore) && { color: '#fff' }]}>Food Feed</Text>
                      <Text style={[styles.storeTypeCardSubtitle, (selectedStore && selectedStore !== 'Other' && !isRobotStore) && { color: 'rgba(255,255,255,0.8)' }]}>Choose from available stores</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.storeTypeCard, selectedStore === 'Other' && styles.storeTypeCardSelected]}
                    onPress={() => { setIsRobotStore(false); setSelectedStore('Other'); setShowCustomStoreInput(true); setCustomStore(''); }}
                  >
                    <LinearGradient
                      colors={selectedStore === 'Other' ? ['#FF8C42', '#FF8C42'] : ['#fff', '#fff']}
                      style={styles.storeTypeGradient}
                    >
                      <View style={[styles.storeTypeIconContainer, selectedStore === 'Other' && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                        <Ionicons name="add-circle-outline" size={28} color={selectedStore === 'Other' ? '#fff' : '#FF8C42'} />
                      </View>
                      <Text style={[styles.storeTypeCardTitle, selectedStore === 'Other' && { color: '#fff' }]}>Other</Text>
                      <Text style={[styles.storeTypeCardSubtitle, selectedStore === 'Other' && { color: 'rgba(255,255,255,0.8)' }]}>Add custom store</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {showCustomStoreInput && (
                  <View style={styles.customStoreContainer}>
                    <TextInput
                      style={styles.customStoreInput}
                      placeholder="Enter store name..."
                      value={customStore}
                      onChangeText={setCustomStore}
                      placeholderTextColor="#999"
                    />
                  </View>
                )}

                {(selectedStore && selectedStore !== 'Other' && !isRobotStore) && (
                  <View style={styles.selectedStoreContainer}>
                    <Ionicons name="checkmark-circle" size={20} color="#2EC4B6" />
                    <Text style={styles.selectedStoreText}>{selectedStore}</Text>
                    <TouchableOpacity onPress={() => setShowStoreDropdown(true)}>
                      <Text style={styles.changeStoreText}>Change</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.orDivider}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>OR</Text>
                  <View style={styles.orLine} />
                </View>

                <TouchableOpacity
                  style={[styles.robotStoreCard, isRobotStore && styles.robotStoreCardSelected]}
                  onPress={handleRobotStoreToggle}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={isRobotStore ? ['#2EC4B6', '#2EC4B6'] : ['#fff', '#fff']}
                    style={styles.robotStoreGradient}
                  >
                    <View style={[styles.robotStoreIconContainer, isRobotStore && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                      <Text style={styles.robotEmoji}>🤖</Text>
                    </View>
                    <View style={styles.robotStoreTextContainer}>
                      <Text style={[styles.robotStoreTitle, isRobotStore && { color: '#fff' }]}>Robot Store</Text>
                      <Text style={[styles.robotStoreSubtitle, isRobotStore && { color: 'rgba(255,255,255,0.8)' }]}>Rider will choose the Robot store</Text>
                    </View>
                    {isRobotStore && <Ionicons name="checkmark-circle" size={24} color="#fff" />}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {/* 4. Address */}
            <View style={styles.inputSection}>
              <View style={styles.labelContainer}>
                <Ionicons name="home-outline" size={18} color="#2EC4B6" />
                <Text style={styles.inputLabel}>Delivery Address</Text>
              </View>

              <TouchableOpacity style={styles.addressSelectorButton} onPress={() => setShowAddressModal(true)}>
                <View style={styles.addressSelectorContent}>
                  <Ionicons name={selectedSavedAddress ? 'checkmark-circle' : 'location-outline'} size={22} color={selectedSavedAddress ? '#2EC4B6' : '#999'} />
                  <Text style={[styles.addressSelectorText, selectedSavedAddress && styles.addressSelectorTextSelected]} numberOfLines={2}>
                    {address || 'Select or enter your address...'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.manualAddressToggle} onPress={() => setShowManualAddressInput(!showManualAddressInput)}>
                <Text style={styles.manualAddressToggleText}>
                  {showManualAddressInput ? 'Hide manual input' : 'Or type address manually'}
                </Text>
                <Ionicons name={showManualAddressInput ? 'chevron-up' : 'chevron-down'} size={16} color="#2EC4B6" />
              </TouchableOpacity>

              {showManualAddressInput && (
                <TextInput
                  style={styles.addressInput}
                  placeholder="Enter your complete address..."
                  value={address}
                  onChangeText={(text) => { setAddress(text); setSelectedSavedAddress(null); }}
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              )}
            </View>

            <TouchableOpacity
              style={[styles.addToCartButton, orderItems.length === 0 && styles.addToCartButtonDisabled]}
              onPress={validateAndAddToCart}
              disabled={orderItems.length === 0}
            >
              <LinearGradient colors={['#2EC4B6', '#2EC4B6']} style={styles.addToCartGradient}>
                <Ionicons name="cart-outline" size={24} color="#fff" />
                <Text style={styles.addToCartText}>Add to Cart</Text>
                {cartCount > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{cartCount}</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Recent Orders */}
          <Animated.View style={[styles.recentOrdersSection, { opacity: recentOrdersAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.headingLabelContainer}>
                <Ionicons name="time-outline" size={22} color="#2EC4B6" />
                <Text style={styles.sectionTitle}>Recent Orders</Text>
              </View>
              {recentOrders.length > 0 && (
                <TouchableOpacity onPress={() => navigation.navigate('Request')}>
                  <Text style={styles.viewAllText}>View All →</Text>
                </TouchableOpacity>
              )}
            </View>

            {recentOrders.length === 0 ? (
              <View style={styles.emptyOrdersContainer}>
                <Ionicons name="receipt-outline" size={48} color="#999" />
                <Text style={styles.emptyOrdersText}>No orders yet</Text>
                <Text style={styles.emptyOrdersSubtext}>Your recent orders will appear here</Text>
              </View>
            ) : (
              <View style={styles.ordersList}>
                {recentOrders.map((order, index) => (
                  <TouchableOpacity
                    key={order.id || index}
                    style={styles.orderCard}
                    activeOpacity={0.9}
                    onPress={() => navigation.navigate('OrderDetails', { order })}
                  >
                    <View style={styles.orderHeader}>
                      <View style={styles.orderIdContainer}>
                        <Text style={styles.orderId}>#{order.id?.slice(-6) || 'N/A'}</Text>
                        <View style={[styles.statusBadge, {
                          backgroundColor: order.status === 'Delivered' ? '#2EC4B6' :
                            order.status === 'In Progress' ? '#FF8C42' : '#2EC4B6'
                        }]}>
                          <Text style={styles.statusText}>{order.status || 'Pending'}</Text>
                        </View>
                      </View>
                      <Text style={styles.orderDate}>
                        {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>

                    <View style={styles.orderDetails}>
                      <Text style={styles.orderStore} numberOfLines={1}>
                        <Ionicons name="storefront-outline" size={14} color="#666" />{' '}{order.store || 'Unknown Store'}
                      </Text>
                      <Text style={styles.orderItems} numberOfLines={2}>
                        {Array.isArray(order.items) ? order.items.map(i => i.text || i).join(' • ') : order.items}
                      </Text>
                    </View>

                    <View style={styles.orderFooter}>
                      <Text style={styles.orderArea}>
                        <Ionicons name="location-outline" size={14} color="#666" />{' '}{order.area}
                      </Text>
                      <TouchableOpacity
                        style={styles.reorderButton}
                        onPress={() => {
                          if (order.items) {
                            const itemsArray = Array.isArray(order.items)
                              ? order.items.map(item => ({ id: Date.now().toString() + Math.random(), text: item.text || item, completed: false }))
                              : [{ id: Date.now().toString(), text: order.items, completed: false }];
                            setOrderItems(itemsArray);
                          }
                          setSelectedArea(order.area || '');
                          setSelectedStore(order.store || '');
                          setAddress(order.address || '');
                          setIsRobotStore(order.isRobotStore || false);
                          Alert.alert('Reorder', 'Order details loaded! Review and add to cart.');
                        }}
                      >
                        <Text style={styles.reorderText}>Reorder</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Animated.View>
        </View>
      </ScrollView>

      {/* ─── MODALS ─── */}
      <Modal visible={showAreaDropdown} transparent animationType="slide" onRequestClose={() => setShowAreaDropdown(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Area</Text>
              <TouchableOpacity onPress={() => setShowAreaDropdown(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search-outline" size={20} color="#999" />
              <TextInput style={styles.modalSearchInput} placeholder="Search area..." value={areaSearch} onChangeText={setAreaSearch} placeholderTextColor="#999" />
            </View>
            <FlatList
              data={filteredAreas}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => selectArea(item)}>
                  <Text style={styles.modalItemText}>{item}</Text>
                  <Text style={styles.storeCountText} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyModalText}>No areas found</Text>}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showStoreDropdown} transparent animationType="slide" onRequestClose={() => setShowStoreDropdown(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Store in {selectedArea}</Text>
              <TouchableOpacity onPress={() => setShowStoreDropdown(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={getAvailableStores()}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.modalItem, item === 'Other' && styles.otherItem]} onPress={() => selectStore(item)}>
                  <Text style={[styles.modalItemText, item === 'Other' && styles.otherItemText]}>
                    {item === 'Other' ? '➕ Add Custom Store' : item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showAddressModal} transparent animationType="slide" onRequestClose={() => setShowAddressModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.addressModalContainer]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Address</Text>
              <TouchableOpacity onPress={() => setShowAddressModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.addressModalScroll} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.addressModalOption}
                onPress={() => { setAddress('Current Location (Auto-detected)'); setSelectedSavedAddress({ id: 'current', isCurrentLocation: true }); setShowAddressModal(false); }}
              >
                <View style={styles.addressModalOptionIcon}>
                  <Ionicons name="locate" size={24} color="#2EC4B6" />
                </View>
                <View style={styles.addressModalOptionContent}>
                  <Text style={styles.addressModalOptionTitle}>Use Current Location</Text>
                  <Text style={styles.addressModalOptionSubtitle}>Auto-detect your location</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              {savedAddresses.length > 0 && (
                <>
                  <Text style={styles.addressModalSectionTitle}>Saved Addresses</Text>
                  {savedAddresses.map((addr) => (
                    <TouchableOpacity
                      key={addr.id}
                      style={[styles.addressModalOption, selectedSavedAddress?.id === addr.id && styles.addressModalOptionSelected]}
                      onPress={() => { setAddress(addr.address); setSelectedSavedAddress(addr); setShowAddressModal(false); }}
                    >
                      <View style={styles.addressModalOptionIcon}>
                        <Ionicons name={addr.isCurrentLocation ? 'location' : 'location-outline'} size={22} color="#2EC4B6" />
                      </View>
                      <View style={styles.addressModalOptionContent}>
                        <Text style={styles.addressModalOptionTitle}>{addr.title}</Text>
                        <Text style={styles.addressModalOptionSubtitle} numberOfLines={2}>{addr.address}</Text>
                      </View>
                      {selectedSavedAddress?.id === addr.id && <Ionicons name="checkmark-circle" size={22} color="#2EC4B6" />}
                    </TouchableOpacity>
                  ))}
                </>
              )}

              <TouchableOpacity style={styles.manageAddressesButton} onPress={() => { setShowAddressModal(false); navigation.navigate('MyAddresses'); }}>
                <Ionicons name="settings-outline" size={20} color="#2EC4B6" />
                <Text style={styles.manageAddressesText}>Manage Addresses</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingBottom: SPACING.lg,
  },

  // ─── HERO ───────────────────────────────────────────────────────────────────
  heroSection: {
    marginBottom: 10,
  },
  heroScrollContent: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  heroCardWrapper: {
    width: SCREEN_WIDTH,
  },
  heroCard: {
    paddingTop: 30,
    paddingBottom: 50,
    paddingHorizontal: 24,
    minHeight: 300,
    overflow: 'hidden',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },

  // Decorative background circles (subtle, like the screenshot)
  heroBgCircleLarge: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heroBgCircleMedium: {
    position: 'absolute',
    top: 20,
    right: 30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroBgCircleSmall: {
    position: 'absolute',
    bottom: 60,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  // Top section: image left, text right
  heroTopSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },

  // Glassmorphism double-ring image circle
  heroImageOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
    // subtle border ring effect
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  heroImageInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImageEmoji: {
    fontSize: 54,
  },

  heroTextContainer: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 4,
    fontWeight: '400',
  },

  // Stats row with vertical dividers
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  heroStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  heroStatValue: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
    marginTop: 2,
  },
  heroStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },

  // Order Now button — white pill with teal text + teal arrow circle
  heroOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 50,
    paddingVertical: 14,
    paddingLeft: 30,
    paddingRight: 10,
    marginHorizontal: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  heroOrderButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1FA99D',
  },
  heroOrderButtonArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2EC4B6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Pagination dots
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    gap: 6,
  },
  paginationDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#C5EAE8',
  },
  paginationDotActive: {
    backgroundColor: '#2EC4B6',
    width: 20,
    borderRadius: 4,
  },
  // ─── END HERO ────────────────────────────────────────────────────────────────

  contentContainer: {
    paddingHorizontal: SECTION_SIDE_PADDING,
  },
  orderCardContainer: {
    backgroundColor: '#fff',
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  inputSection: {
    marginBottom: SPACING.md,
  },
  headingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  orderInterestHeader: {
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  itemCountBadge: {
    backgroundColor: '#2EC4B620',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  itemCountBadgeText: {
    fontSize: 12,
    color: '#2EC4B6',
    fontWeight: '600',
  },
  selectedItemsPreview: {
    backgroundColor: '#F5F7FA',
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
  },
  selectedItemsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: SPACING.xs,
  },
  selectedItemsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  selectedItemChip: {
    backgroundColor: '#2EC4B615',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  selectedItemText: {
    fontSize: 13,
    color: '#333',
  },
  moreItemsText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  inlineAddContainer: {
    marginTop: SPACING.sm,
  },
  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  inlineInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  inlineAddButton: {
    overflow: 'hidden',
    borderRadius: 10,
  },
  addButtonGradient: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 10,
  },
  inlineAddButtonDisabled: {
    opacity: 0.5,
  },
  inlineAddButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  itemsListCompact: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  orderItemRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  orderItemNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2EC4B6',
    width: 28,
  },
  orderItemTextCompact: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  deleteButtonCompact: {
    padding: SPACING.xs,
  },
  selectorInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
  },
  storeTypeCardsContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  storeTypeCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  storeTypeGradient: {
    flex: 1,
    padding: SPACING.md,
    alignItems: 'center',
  },
  storeTypeCardSelected: {
    borderColor: '#2EC4B6',
  },
  storeTypeIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5F7FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  storeTypeCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  storeTypeCardSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  customStoreContainer: {
    marginTop: SPACING.md,
  },
  customStoreInput: {
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedStoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    padding: SPACING.md,
    borderRadius: 12,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  selectedStoreText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  changeStoreText: {
    fontSize: 14,
    color: '#2EC4B6',
    fontWeight: '600',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
    gap: SPACING.md,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  orText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  robotStoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  robotStoreCardSelected: {
    borderColor: '#2EC4B6',
  },
  robotStoreIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5F7FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  robotEmoji: {
    fontSize: 24,
  },
  robotStoreGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  robotStoreTextContainer: {
    flex: 1,
  },
  robotStoreTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  robotStoreSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  addressSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  addressSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
  },
  addressSelectorText: {
    flex: 1,
    fontSize: 15,
    color: '#999',
  },
  addressSelectorTextSelected: {
    color: '#333',
    fontWeight: '500',
  },
  manualAddressToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    paddingVertical: SPACING.xs,
    gap: SPACING.xs,
  },
  manualAddressToggleText: {
    fontSize: 13,
    color: '#2EC4B6',
    fontWeight: '600',
  },
  addressInput: {
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 80,
  },
  addToCartButton: {
    overflow: 'hidden',
    borderRadius: 16,
    marginTop: SPACING.lg,
    shadowColor: '#2EC4B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  addToCartGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: 16,
  },
  addToCartButtonDisabled: {
    opacity: 0.5,
  },
  addToCartText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '700',
    marginLeft: SPACING.sm,
  },
  cartBadge: {
    position: 'absolute',
    right: SPACING.md,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cartBadgeText: {
    fontSize: 12,
    color: '#2EC4B6',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    padding: SPACING.sm,
    borderRadius: 12,
    marginBottom: SPACING.md,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: SPACING.sm,
  },
  modalItem: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  storeCountText: {
    fontSize: 13,
    color: '#666',
  },
  emptyModalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingVertical: SPACING.xl,
  },
  otherItem: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: SPACING.md,
    marginVertical: SPACING.xs,
  },
  otherItemText: {
    color: '#2EC4B6',
    fontWeight: '600',
  },
  recentOrdersSection: {
    marginTop: SPACING.lg,
    paddingBottom: SPACING.xl + 80,
  },
  viewAllText: {
    fontSize: 14,
    color: '#2EC4B6',
    fontWeight: '600',
  },
  emptyOrdersContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  emptyOrdersText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: SPACING.md,
  },
  emptyOrdersSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: SPACING.xs,
  },
  ordersList: {
    gap: SPACING.md,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  orderDate: {
    fontSize: 13,
    color: '#666',
  },
  orderDetails: {
    marginBottom: SPACING.sm,
  },
  orderStore: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  orderItems: {
    fontSize: 14,
    color: '#666',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  orderArea: {
    fontSize: 13,
    color: '#666',
  },
  reorderButton: {
    backgroundColor: '#2EC4B6',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 10,
  },
  reorderText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  currentOrdersSection: {
    marginTop: SPACING.md,
    paddingHorizontal: SECTION_SIDE_PADDING,
  },
  currentOrdersBadge: {
    backgroundColor: '#2EC4B6',
    borderRadius: 12,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  currentOrdersBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  currentOrdersList: {
    gap: SPACING.md,
  },
  currentOrderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#2EC4B6',
  },
  currentOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  currentOrderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  currentOrderId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  currentOrderDate: {
    fontSize: 13,
    color: '#666',
  },
  riderInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    padding: SPACING.sm,
    borderRadius: 10,
    marginBottom: SPACING.sm,
  },
  riderName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: SPACING.xs,
  },
  riderPhone: {
    fontSize: 13,
    color: '#666',
    marginLeft: SPACING.xs,
  },
  currentOrderItems: {
    marginBottom: SPACING.sm,
  },
  currentOrderItemsLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  currentOrderItemsText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  currentOrderStore: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  currentOrderStoreText: {
    fontSize: 13,
    color: '#666',
    marginLeft: SPACING.xs,
  },
  currentOrderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    gap: SPACING.sm,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2EC4B6',
    flex: 1,
    justifyContent: 'center',
  },
  viewDetailsText: {
    fontSize: 14,
    color: '#2EC4B6',
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2EC4B6',
    padding: SPACING.sm,
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
  },
  chatButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  addressModalContainer: {
    maxHeight: '80%',
  },
  addressModalScroll: {
    padding: SPACING.lg,
  },
  addressModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  addressModalOptionSelected: {
    borderColor: '#2EC4B6',
    backgroundColor: '#F5F7FA',
  },
  addressModalOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F7FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  addressModalOptionContent: {
    flex: 1,
  },
  addressModalOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  addressModalOptionSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  addressModalSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  manageAddressesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7FA',
    padding: SPACING.md,
    borderRadius: 12,
    marginTop: SPACING.lg,
    gap: SPACING.xs,
  },
  manageAddressesText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2EC4B6',
  },
});

export default DashboardScreen;