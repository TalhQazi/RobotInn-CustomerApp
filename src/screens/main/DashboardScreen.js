import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, FlatList, Dimensions, Animated, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS, GRADIENTS } from '../../theme/colors';
import { ordersAPI, areasAPI, usersAPI, categoriesAPI } from '../../services/api';
import { getCurrentLocationWithAddress } from '../../utils/location';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import ThemedAlert from '../../components/common/ThemedAlert';
import { getData, storeData } from '../../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../../utils/constants';
import Ionicons from 'react-native-vector-icons/Ionicons';


// ─── Static fallback areas ───────────────────────────────────────────────────
const STATIC_AREAS = {
  'F-6': ['KFC F-6', 'Hardees F-6', 'Tehzeeb Bakers'],
  'F-7': ['KFC F-7', 'Pizza Hut F-7', 'Subway F-7'],
  'F-8': ["McDonald's F-8", "Domino's Pizza", 'Ginyaki'],
  'F-10': ['KFC F-10', 'Pizza Hut F-10', 'Gloria Jeans'],
  'F-11': ["McDonald's F-11", 'Hardees F-11'],
  'G-6': ['Tehzeeb Bakers', 'Loafology'],
  'G-7': ['KFC G-7', 'Subway'],
  'G-8': ["McDonald's G-8", 'Pizza Hut'],
  'G-9': ['KFC G-9', 'Hardees', 'Ginyaki'],
  'G-10': ["McDonald's G-10", 'Burger King', 'Subway'],
  'G-11': ['KFC G-11', 'Pizza Hut'],
  'E-7': ['Tehzeeb Bakers', 'Coffee Republic'],
  'E-8': ['KFC E-8', 'Hardees'],
  'E-9': ["McDonald's", 'Subway'],
  'E-11': ['KFC E-11', 'Pizza Hut'],
  'I-8': ['Hardees I-8', 'Gloria Jeans'],
  'I-9': ['KFC I-9'],
  'I-10': ["McDonald's I-10"],
  'DHA Phase 1': ['KFC DHA', 'Hardees DHA', 'Pizza Hut'],
  'DHA Phase 2': ["McDonald's", 'Subway'],
  'Bahria Phase 7': ['KFC Bahria', 'Hardees'],
  'Bahria Phase 8': ["McDonald's Bahria"],
  'Gulberg Residencia': ['Tehzeeb Bakers', 'Coffee Planet'],
  'Bani Gala': ['KFC Bani Gala'],
};

const DEFAULT_CATEGORIES = [
  { id: 'cat1', name: 'Groceries', icon: '🛒' },
  { id: 'cat2', name: 'Fresh Bazaar', icon: '🥬' },
  { id: 'cat3', name: 'Health & Beauty', icon: '💄' },
  { id: 'cat4', name: 'Pharmacy', icon: '💊' }
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SECTION_SIDE_PADDING = SPACING.md;
const SLIDER_CARD_WIDTH = SCREEN_WIDTH - SECTION_SIDE_PADDING * 2 - 24;

// ─── Hero Cards ──────────────────────────────────────────────────────────────
const HERO_CARDS = [
  { id: '1', title: 'Burger King',    subtitle: 'Flame Grilled Burgers', image: '🍔', rating: '4.5', deliveryTime: '25-35', deliveryType: 'Free' },
  { id: '2', title: 'Pizza Hut',      subtitle: 'Delicious Pizzas',      image: '🍕', rating: '4.3', deliveryTime: '30-45', deliveryType: 'Free' },
  { id: '3', title: 'KFC',            subtitle: 'Finger Lickin Good',    image: '🍗', rating: '4.4', deliveryTime: '25-40', deliveryType: 'Free' },
  { id: '4', title: "McDonald's",     subtitle: "I'm Lovin It",          image: '🍟', rating: '4.2', deliveryTime: '20-30', deliveryType: 'Free' },
  { id: '5', title: 'Subway',         subtitle: 'Fresh Sandwiches',      image: '🥪', rating: '4.6', deliveryTime: '15-25', deliveryType: 'Free' },
  { id: '6', title: 'Dunkin',         subtitle: 'Coffee & Donuts',       image: '🍩', rating: '4.5', deliveryTime: '20-35', deliveryType: 'Free' },
  { id: '7', title: 'Baskin Robbins', subtitle: 'Ice Cream Delights',    image: '🍦', rating: '4.7', deliveryTime: '15-20', deliveryType: 'Free' },
];
const HERO_LOOP_CARDS = [HERO_CARDS[HERO_CARDS.length - 1], ...HERO_CARDS, HERO_CARDS[0]];

// ─── Store type options ───────────────────────────────────────────────────────
const STORE_TYPES = {
  FEED:   'feed',
  CUSTOM: 'custom',
  ROBOT:  'robot',
};

// ─── Helper: build a blank order item ────────────────────────────────────────
const newOrderItem = (text = '', category = 'Food') => ({
  id: Date.now().toString() + Math.random(),
  text,
  category,
  editing: false,
  editText: text,
  storeType: null,       // STORE_TYPES.FEED | CUSTOM | ROBOT | null
  selectedStore: '',     // name of the chosen feed-store
  customStore: '',       // typed custom store
  customStoreConfirmed: false,
});

// ─────────────────────────────────────────────────────────────────────────────
const DashboardScreen = ({ navigation }) => {
  const [user, setUser] = useState({ name: 'Fawad' });
  const [cartCount, setCartCount] = useState(0);
  const [themedAlert, setThemedAlert] = useState({ visible: false, title: '', message: '', buttons: [] });

  const showThemedAlert = ({ title, message, buttons = [] }) => {
    setThemedAlert({ visible: true, title, message, buttons });
  };

  const hideThemedAlert = () => {
    setThemedAlert({ visible: false, title: '', message: '', buttons: [] });
  };

  // Animations
  const fadeAnim           = useRef(new Animated.Value(0)).current;
  const scaleAnim          = useRef(new Animated.Value(0.95)).current;
  const slideAnim          = useRef(new Animated.Value(50)).current;
  const currentOrdersAnim  = useRef(new Animated.Value(0)).current;
  const orderInterestAnim  = useRef(new Animated.Value(0)).current;
  const recentOrdersAnim   = useRef(new Animated.Value(0)).current;

  // Hero Carousel
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const heroScrollRef   = useRef(null);
  const heroIntervalRef = useRef(null);
  const heroPageIndexRef = useRef(1);
  const scrollViewRef   = useRef(null);

  // Slider dot tracking
  const [currentOrderSliderIndex, setCurrentOrderSliderIndex] = useState(0);
  const [recentOrderSliderIndex,  setRecentOrderSliderIndex]  = useState(0);

  // ── Area selection (moved to top) ─────────────────────────────────────────
  const [selectedArea,      setSelectedArea]      = useState('');
  const [showAreaDropdown,  setShowAreaDropdown]  = useState(false);
  const [areaSearch,        setAreaSearch]        = useState('');
  const [areasData,         setAreasData]         = useState([]);
  const [areasLoading,      setAreasLoading]      = useState(false);
  const areasLoadedRef = useRef(false);

  // ── Order items (each carries its own store choice) ───────────────────────
  const [orderItems,   setOrderItems]   = useState([]);
  const [currentItem,  setCurrentItem]  = useState('');

  // Store picker modal (for feed-store list per item)
  const [storePicker, setStorePicker] = useState({ visible: false, itemId: null });
  const [storeSearch, setStoreSearch] = useState('');

  // ── Address ───────────────────────────────────────────────────────────────
  const [address,               setAddress]               = useState('');
  const [addressCoords,         setAddressCoords]         = useState(null);
  const [savedAddresses,        setSavedAddresses]        = useState([]);
  const [selectedSavedAddress,  setSelectedSavedAddress]  = useState(null);
  const [showAddressModal,      setShowAddressModal]      = useState(false);
  const [showManualAddressInput,setShowManualAddressInput]= useState(false);
  const [addressLocationLoading,setAddressLocationLoading]= useState(false);

  // ── Categories ─────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // ── Orders ────────────────────────────────────────────────────────────────
  const [recentOrders,  setRecentOrders]  = useState([]);
  const [currentOrders, setCurrentOrders] = useState([]);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);

  const isPendingOrder = (status) => String(status || '').toLowerCase().trim() === 'pending';

  const cancelOrder = async (order) => {
    const orderId = order.id || order.orderId || order._id;
    if (!orderId) return;

    setCancellingOrderId(orderId);
    try {
      const response = await ordersAPI.cancel(orderId);
      if (response.success) {
        setCurrentOrders((prev) => prev.filter((o) => (o.id || o.orderId || o._id) !== orderId));
        setRecentOrders((prev) => prev.map((o) => {
          const currentId = o.id || o.orderId || o._id;
          return currentId === orderId ? { ...o, status: 'cancelled' } : o;
        }));

        showThemedAlert({
          title: 'Order Cancelled',
          message: `Order #${order.orderId?.slice(-6) || order.id?.slice(-6)} has been cancelled successfully.`,
          buttons: [{ text: 'OK', style: 'cancel' }]
        });
      } else {
        showThemedAlert({
          title: 'Cancel failed',
          message: response.message || 'Unable to cancel this order. Please try again.',
          buttons: [{ text: 'OK', style: 'cancel' }]
        });
      }
    } catch (error) {
      showThemedAlert({
        title: 'Cancel failed',
        message: error?.message || 'Unable to cancel this order. Please try again.',
        buttons: [{ text: 'OK', style: 'cancel' }]
      });
    } finally {
      setCancellingOrderId(null);
    }
  };

  const promptCancelOrder = (order) => {
    showThemedAlert({
      title: 'Cancel Order',
      message: `Are you sure you want to cancel order #${order.orderId?.slice(-6) || order.id?.slice(-6) || 'N/A'}? This can only be cancelled while pending.`,
      buttons: [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', onPress: () => cancelOrder(order) }
      ]
    });
  };

  // ── Fetch areas ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (areasLoadedRef.current) return;
    const fetchAreas = async () => {
      setAreasLoading(true);
      try {
        const response = await areasAPI.getAll();
        if (response.success && response.data) setAreasData(response.data);
      } catch (err) {
        console.log('❌ Areas fetch error:', err.message);
      } finally {
        setAreasLoading(false);
        areasLoadedRef.current = true;
      }
    };
    fetchAreas();
  }, []);

  // ── Fetch categories ───────────────────────────────────────────────────────
  useEffect(() => {
    const fetchCategories = async () => {
      setCategoriesLoading(true);
      try {
        const response = await categoriesAPI.getAll();
        if (response.success && Array.isArray(response.data) && response.data.length > 0) {
          const activeCats = response.data.filter(c => c.active !== false);
          setCategories(activeCats);
        } else {
          setCategories(DEFAULT_CATEGORIES);
        }
      } catch (err) {
        console.log('❌ Categories fetch error:', err.message);
        setCategories(DEFAULT_CATEGORIES);
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const handleCategoryPress = (categoryName) => {
    if (!selectedArea) {
      showThemedAlert({
        title: 'Select Area First',
        message: 'Please select your area first before choosing a category.',
        buttons: [{ text: 'OK', style: 'cancel' }]
      });
      return;
    }
    setOrderItems((prev) => [...prev, newOrderItem(`${categoryName} items`, categoryName)]);
    // Scroll down to the order builder card
    scrollViewRef.current?.scrollTo({ y: 450, animated: true });
  };

  // ── Hero carousel init ────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      heroScrollRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: false });
      heroPageIndexRef.current = 1;
      setCurrentHeroIndex(0);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    heroIntervalRef.current = setInterval(() => {
      const lastLoopPageIndex = HERO_CARDS.length + 1;
      const next = Math.min(heroPageIndexRef.current + 1, lastLoopPageIndex);
      heroScrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
      heroPageIndexRef.current = next;
    }, 5000);
    return () => { if (heroIntervalRef.current) clearInterval(heroIntervalRef.current); };
  }, []);

  const handleHeroScroll = (e) => {
    const pageIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentHeroIndex((pageIndex - 1 + HERO_CARDS.length) % HERO_CARDS.length);
  };

  const handleHeroScrollEnd = (e) => {
    const pageIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
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

  // ── Entrance animations ───────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,          { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim,         { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.timing(slideAnim,         { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.timing(currentOrdersAnim, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
      Animated.timing(orderInterestAnim, { toValue: 1, duration: 600, delay: 400, useNativeDriver: true }),
      Animated.timing(recentOrdersAnim,  { toValue: 1, duration: 600, delay: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Fetch dashboard data ──────────────────────────────────────────────────
  const fetchDashboardData = useCallback(async () => {
    try {
      const userData = await getData(ASYNC_STORAGE_KEYS.USER_DATA);
      if (userData) setUser(userData);
      const cartItems = await getData(ASYNC_STORAGE_KEYS.CART) || [];
      setCartCount(cartItems.length);

      try {
        const ordersResponse = await Promise.race([
          ordersAPI.getMyOrders({ limit: 10 }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
        ]);
        if (ordersResponse.success && ordersResponse.data) {
          const orders = ordersResponse.data;
          setRecentOrders([...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5));
          setCurrentOrders(orders.filter(o => ['pending', 'accepted', 'processing'].includes(o.status)));
        }
      } catch {
        const orders = await getData(ASYNC_STORAGE_KEYS.ORDERS) || [];
        setRecentOrders([...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5));
        setCurrentOrders(orders.filter(o => ['Pending', 'In Progress', 'Accepted', 'Processing'].includes(o.status)));
      }

      try {
        const addrRes = await Promise.race([
          usersAPI.getAddresses(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
        ]);
        if (addrRes?.data?.length) {
          const formatted = addrRes.data.map(addr => ({ ...addr, id: addr.addressId || addr._id || addr.id }));
          setSavedAddresses(formatted);
          await storeData(ASYNC_STORAGE_KEYS.ADDRESSES, formatted);
        } else {
          setSavedAddresses(await getData(ASYNC_STORAGE_KEYS.ADDRESSES) || []);
        }
      } catch {
        setSavedAddresses(await getData(ASYNC_STORAGE_KEYS.ADDRESSES) || []);
      }
    } catch (error) {
      console.error('❌ Dashboard fetch error:', error);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchDashboardData(); }, [fetchDashboardData]));

  // ── Area helpers ──────────────────────────────────────────────────────────
  const getAreasList = () =>
    areasData.length > 0 ? areasData.map(a => a.name) : Object.keys(STATIC_AREAS);

  const filteredAreas = getAreasList().filter(a =>
    a.toLowerCase().includes(areaSearch.toLowerCase()));

  const getStoresForArea = (itemCategory) => {
    if (!selectedArea) return [];
    const area = areasData.find(a => a.name === selectedArea);
    if (area?.stores?.length) {
      return area.stores
        .filter(s => {
          if (!itemCategory || itemCategory === 'Food') {
            return s.type === 'Food' || s.type === 'Food Store' || !s.type;
          }
          return s.type === itemCategory;
        })
        .map(s => s.name);
    }
    
    // Fallback to static food points
    if (!itemCategory || itemCategory === 'Food') {
      return STATIC_AREAS[selectedArea] || [];
    }
    return [];
  };

  const currentPickerItem = storePicker.itemId ? orderItems.find(i => i.id === storePicker.itemId) : null;
  const currentPickerCategory = currentPickerItem ? (currentPickerItem.category || 'Food') : 'Food';

  const storeOptions = getStoresForArea(currentPickerCategory);
  const filteredStoreOptions = storeOptions.filter((store) =>
    store.toLowerCase().includes(storeSearch.toLowerCase())
  );

  const selectArea = (area) => {
    setSelectedArea(area);
    setShowAreaDropdown(false);
    setAreaSearch('');
    // Reset store choices on all existing items when area changes
    setOrderItems(prev => prev.map(item => ({
      ...item,
      storeType: null,
      selectedStore: '',
      customStore: '',
    })));
  };

  // ── Order item CRUD ───────────────────────────────────────────────────────
  const addOrderItem = () => {
    if (!currentItem.trim()) return;
    const newItem = newOrderItem(currentItem.trim(), 'Food');
    setOrderItems(prev => [...prev, newItem]);
    setCurrentItem('');
  };

  const removeOrderItem = (id) => {
    showThemedAlert({
      title: 'Remove Item',
      message: 'Remove this item?',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', onPress: () => setOrderItems(prev => prev.filter(i => i.id !== id)) },
      ],
    });
  };

  const startEditItem = (id) =>
    setOrderItems(prev => prev.map(i => i.id === id ? { ...i, editing: true, editText: i.text } : i));

  const saveEditItem = (id) =>
    setOrderItems(prev => prev.map(i => i.id === id
      ? { ...i, editing: false, text: i.editText.trim() || i.text }
      : i));

  const cancelEditItem = (id) =>
    setOrderItems(prev => prev.map(i => i.id === id ? { ...i, editing: false, editText: i.text } : i));

  const updateEditText = (id, text) =>
    setOrderItems(prev => prev.map(i => i.id === id ? { ...i, editText: text } : i));

  // ── Per-item store helpers ────────────────────────────────────────────────
  const setItemStoreType = (id, type) =>
    setOrderItems(prev => prev.map(i => i.id === id
      ? { ...i, storeType: type, selectedStore: '', customStore: '', customStoreConfirmed: false }
      : i));

  const setItemSelectedStore = (id, store) =>
    setOrderItems(prev => prev.map(i => i.id === id ? { ...i, selectedStore: store } : i));

  const setItemCustomStore = (id, text) =>
    setOrderItems(prev => prev.map(i => i.id === id ? { ...i, customStore: text } : i));

  const setItemCustomStoreConfirmed = (id, confirmed) =>
    setOrderItems(prev => prev.map(i => i.id === id ? { ...i, customStoreConfirmed: confirmed } : i));

  const getItemStoreLabel = (item) => {
    if (!item.storeType) return null;
    if (item.storeType === STORE_TYPES.ROBOT) return '🤖 Robot Store';
    if (item.storeType === STORE_TYPES.CUSTOM) return item.customStore || 'Custom Store';
    if (item.storeType === STORE_TYPES.FEED)   return item.selectedStore || 'Feed Store';
    return null;
  };

  // ── Address helpers ───────────────────────────────────────────────────────
  const handleSelectCurrentLocation = async () => {
    setAddressLocationLoading(true);
    try {
      const { lat, lng, address: formattedAddress } = await getCurrentLocationWithAddress();
      setAddress(formattedAddress);
      setAddressCoords({ lat, lng });
      setSelectedSavedAddress({ id: 'current', isCurrentLocation: true });
      setShowAddressModal(false);
    } catch (error) {
      console.error('Location error:', error);
    } finally {
      setAddressLocationLoading(false);
    }
  };

  // ── Validate & add to cart ────────────────────────────────────────────────
  const validateAndAddToCart = async () => {
    let itemsToValidate = [...orderItems];
    if (currentItem.trim()) {
      const newItem = newOrderItem(currentItem.trim());
      itemsToValidate.push(newItem);
      setOrderItems(itemsToValidate);
      setCurrentItem('');
    }

    if (!selectedArea) {
      showThemedAlert({ title: 'Error', message: 'Please select your area first' });
      return;
    }
    if (itemsToValidate.length === 0) {
      showThemedAlert({ title: 'Error', message: 'Please add at least one item' });
      return;
    }

    // Validate each item's store
    for (const item of itemsToValidate) {
      if (!item.storeType) {
        showThemedAlert({ title: 'Error', message: `Please choose a store for "${item.text}"` });
        return;
      }
      if (item.storeType === STORE_TYPES.FEED && !item.selectedStore) {
        showThemedAlert({ title: 'Error', message: `Please select a store for "${item.text}"` });
        return;
      }
      if (item.storeType === STORE_TYPES.CUSTOM && !item.customStore.trim()) {
        showThemedAlert({ title: 'Error', message: `Please enter a store name for "${item.text}"` });
        return;
      }
    }

    if (!address.trim()) {
      showThemedAlert({ title: 'Error', message: 'Please enter your delivery address' });
      return;
    }

    const orderData = {
      id: Date.now().toString(),
      items: itemsToValidate.map(item => ({
        id: item.id,
        text: item.text,
        store: item.storeType === STORE_TYPES.ROBOT  ? 'Robot Store'
             : item.storeType === STORE_TYPES.CUSTOM ? item.customStore
             : item.selectedStore,
        isRobotStore: item.storeType === STORE_TYPES.ROBOT,
      })),
      area: selectedArea,
      address: address.trim(),
      location: addressCoords || selectedSavedAddress?.location || null,
      isCurrentLocation: !!selectedSavedAddress?.isCurrentLocation,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };

    try {
      const currentCart = await getData(ASYNC_STORAGE_KEYS.CART) || [];
      await storeData(ASYNC_STORAGE_KEYS.CART, [...currentCart, orderData]);
      setCartCount(currentCart.length + 1);
      // Reset form
      setOrderItems([]);
      setSelectedArea('');
      setAddress('');
      setAddressCoords(null);
      setSelectedSavedAddress(null);
      setThemedAlert({
        visible: true,
        title: 'Added to Cart!',
        message: 'Your order has been added to cart.',
        buttons: [
          { text: 'View Cart', onPress: () => navigation.navigate('Cart') },
          { text: 'OK', style: 'cancel' },
        ],
      });
    } catch (error) {
      showThemedAlert({ title: 'Error', message: 'Failed to add order to cart' });
    }
  };

  // Slider dot handlers
  const handleCurrentOrderScroll = (e) =>
    setCurrentOrderSliderIndex(Math.max(0, Math.min(
      Math.round(e.nativeEvent.contentOffset.x / (SLIDER_CARD_WIDTH + SPACING.md)),
      currentOrders.length - 1)));

  const handleRecentOrderScroll = (e) =>
    setRecentOrderSliderIndex(Math.max(0, Math.min(
      Math.round(e.nativeEvent.contentOffset.x / (SLIDER_CARD_WIDTH + SPACING.md)),
      recentOrders.length - 1)));

  // ── Store picker modal (for feed stores) ──────────────────────────────────
  const openStorePicker = (itemId) => {
    setStorePicker({ visible: true, itemId });
    setStoreSearch('');
  };
  const closeStorePicker = () => setStorePicker({ visible: false, itemId: null });

  const pickFeedStore = (store) => {
    if (storePicker.itemId) setItemSelectedStore(storePicker.itemId, store);
    closeStorePicker();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
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

        {/* ─── HERO ─── */}
        <Animated.View style={[styles.heroSection, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <ScrollView
            ref={heroScrollRef}
            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onScroll={handleHeroScroll}
            onMomentumScrollEnd={handleHeroScrollEnd}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={SCREEN_WIDTH} snapToAlignment="start"
          >
            {HERO_LOOP_CARDS.map((card, index) => (
              <View key={`hero-${card.id}-${index}`} style={styles.heroCardWrapper}>
                <LinearGradient colors={['#28BFB2', '#1FA99D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
                  <View style={styles.heroBgCircleLarge} />
                  <View style={styles.heroBgCircleMedium} />
                  <View style={styles.heroBgCircleSmall} />
                  <View style={styles.heroTopSection}>
                    <View style={styles.heroImageOuter}>
                      <View style={styles.heroImageInner}>
                        <Text style={styles.heroImageEmoji}>{card.image}</Text>
                      </View>
                    </View>
                    <View style={styles.heroTextContainer}>
                      <Text style={styles.heroTitle}>{card.title}</Text>
                      <Text style={styles.heroSubtitle}>{card.subtitle}</Text>
                    </View>
                  </View>
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
                  <TouchableOpacity
                    style={styles.heroOrderButton}
                    activeOpacity={0.85}
                    onPress={() => scrollViewRef.current?.scrollTo({ y: 300, animated: true })}
                  >
                    <Text style={styles.heroOrderButtonText}>Order Now</Text>
                    <View style={styles.heroOrderButtonArrow}>
                      <Ionicons name="chevron-forward" size={16} color="#fff" />
                    </View>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            ))}
          </ScrollView>
          <View style={styles.paginationContainer}>
            {HERO_CARDS.map((_, i) => (
              <View key={i} style={[styles.paginationDot, i === currentHeroIndex && styles.paginationDotActive]} />
            ))}
          </View>
        </Animated.View>
        {/* ─── END HERO ─── */}

        {/* ─── CATEGORIES ─── */}
        <View style={styles.categoriesSection}>
          <Text style={styles.categoriesTitle}>Categories</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScrollContent}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={styles.categoryCard}
                onPress={() => handleCategoryPress(category.name)}
                activeOpacity={0.8}
              >
                <View style={styles.categoryIconContainer}>
                  <Text style={styles.categoryIconText}>{category.icon}</Text>
                </View>
                <Text style={styles.categoryNameText} numberOfLines={1}>{category.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ─── CURRENT ORDERS ─── */}
        {currentOrders.length > 0 && (
          <Animated.View style={[styles.sliderSection, { opacity: currentOrdersAnim, transform: [{ translateX: slideAnim }] }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.headingLabelContainer}>
                <Ionicons name="bicycle-outline" size={22} color="#2EC4B6" />
                <Text style={styles.sectionTitle}>Current Orders</Text>
              </View>
              <View style={styles.currentOrdersBadge}>
                <Text style={styles.currentOrdersBadgeText}>{currentOrders.length}</Text>
              </View>
            </View>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16} onScroll={handleCurrentOrderScroll}
              decelerationRate="fast"
              snapToInterval={SLIDER_CARD_WIDTH + SPACING.md} snapToAlignment="start"
              contentContainerStyle={styles.sliderContentContainer}
            >
              {currentOrders.map((order, index) => (
                <TouchableOpacity
                  key={order.id || index} style={styles.currentSliderCard}
                  activeOpacity={0.9} onPress={() => navigation.navigate('OrderDetails', { order })}
                >
                  <View style={styles.sliderCardAccent} />
                  <View style={styles.sliderCardInner}>
                    <View style={styles.currentOrderHeader}>
                      <View style={styles.currentOrderIdContainer}>
                        <Text style={styles.currentOrderId}>#{order.orderId?.slice(-6) || order.id?.slice(-6) || 'N/A'}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: order.status === 'processing' ? '#FF8C42' : '#2EC4B6' }]}>
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
                        {(order.riderPhone || order.rider?.phone) && (
                          <Text style={styles.riderPhone}>({order.riderPhone || order.rider?.phone})</Text>
                        )}
                      </View>
                    )}
                    <View style={styles.currentOrderItems}>
                      <Text style={styles.currentOrderItemsLabel}><Ionicons name="fast-food-outline" size={14} color="#666" /> Items:</Text>
                      <Text style={styles.currentOrderItemsText} numberOfLines={2}>
                        {Array.isArray(order.items)
                          ? order.items.map(i => i.name || i.text || JSON.stringify(i)).join(' • ')
                          : order.items}
                      </Text>
                    </View>
                    <View style={styles.currentOrderStore}>
                      <Ionicons name="storefront-outline" size={14} color="#666" />
                      <Text style={styles.currentOrderStoreText} numberOfLines={1}>
                        {order.pickup || 'Unknown Store'} • {order.area}
                      </Text>
                    </View>
                    <View style={styles.currentOrderActions}>
                      <TouchableOpacity style={styles.viewDetailsButton} onPress={() => navigation.navigate('OrderDetails', { order })}>
                        <Ionicons name="eye-outline" size={16} color="#2EC4B6" />
                        <Text style={styles.viewDetailsText}>View Details</Text>
                      </TouchableOpacity>
                      {isPendingOrder(order.status) && (
                        <TouchableOpacity
                          style={styles.cancelOrderButton}
                          onPress={() => promptCancelOrder(order)}
                          activeOpacity={0.85}
                          disabled={cancellingOrderId === (order.id || order.orderId || order._id)}
                        >
                          {cancellingOrderId === (order.id || order.orderId || order._id) ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.cancelOrderText}>Cancel Order</Text>
                          )}
                        </TouchableOpacity>
                      )}
                      {(order.riderId || order.rider?.id) && (
                        <TouchableOpacity
                          style={styles.chatButton}
                          onPress={() => navigation.navigate('Chat', {
                            riderId: order.riderId || order.rider?.id,
                            riderName: order.riderName || order.rider?.name,
                            orderId: order.id || order._id,
                          })}
                        >
                          <Ionicons name="chatbubble-outline" size={16} color="#fff" />
                          <Text style={styles.chatButtonText}>Chat with Rider</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {currentOrders.length > 1 && (
              <View style={styles.sliderDotsContainer}>
                {currentOrders.map((_, i) => (
                  <View key={i} style={[styles.sliderDot, i === currentOrderSliderIndex && styles.sliderDotActive]} />
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {/* ─── CONTENT ─── */}
        <View style={styles.contentContainer}>

          {/* ── ORDER YOUR INTEREST heading ── */}
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

            {/* ── 1. CHOOSE YOUR AREA (top field) ── */}
            <View style={styles.inputSection}>
              <View style={styles.labelContainer}>
                <Ionicons name="location-outline" size={18} color="#2EC4B6" />
                <Text style={styles.inputLabel}>Choose Your Area</Text>
              </View>
              <TouchableOpacity style={styles.selectorInput} onPress={() => setShowAreaDropdown(true)}>
                <Text style={selectedArea ? styles.selectedText : styles.placeholderText}>
                  {selectedArea || 'Select your area first...'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#999" />
              </TouchableOpacity>
            </View>

            {/* ── 2. TYPE YOUR ORDER (with edit + inline store per item) ── */}
            <View style={styles.inputSection}>
              <View style={styles.labelContainer}>
                <Ionicons name="fast-food-outline" size={18} color="#2EC4B6" />
                <Text style={styles.inputLabel}>Type Your Order</Text>
              </View>

              {/* Input row */}
              <View style={styles.inlineInputRow}>
                <TextInput
                  style={styles.inlineInput}
                  placeholder={selectedArea ? 'Add an item...' : 'Select area first...'}
                  value={currentItem}
                  onChangeText={setCurrentItem}
                  onSubmitEditing={addOrderItem}
                  placeholderTextColor="#999"
                  editable={!!selectedArea}
                />
                <TouchableOpacity
                  style={[styles.inlineAddButton, (!currentItem.trim() || !selectedArea) && styles.inlineAddButtonDisabled]}
                  onPress={addOrderItem}
                  disabled={!currentItem.trim() || !selectedArea}
                >
                  <LinearGradient colors={['#2EC4B6', '#2EC4B6']} style={styles.addButtonGradient}>
                    <Text style={styles.inlineAddButtonText}>Add</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Order items list */}
              {orderItems.length > 0 && (
                <View style={styles.itemsListCompact}>
                  {orderItems.map((item, index) => (
                    <View key={item.id} style={styles.orderItemCard}>
                      {/* ── Item row ── */}
                      <View style={styles.orderItemTopRow}>
                        <Text style={styles.orderItemNumber}>{index + 1}.</Text>

                        {item.editing ? (
                          <TextInput
                            style={styles.orderItemEditInput}
                            value={item.editText}
                            onChangeText={text => updateEditText(item.id, text)}
                            autoFocus
                            onSubmitEditing={() => saveEditItem(item.id)}
                            returnKeyType="done"
                          />
                        ) : (
                          <Text style={styles.orderItemText}>{item.text}</Text>
                        )}

                        <View style={styles.orderItemActions}>
                          {item.editing ? (
                            <>
                              <TouchableOpacity style={styles.iconBtn} onPress={() => saveEditItem(item.id)}>
                                <Ionicons name="checkmark-circle" size={20} color="#2EC4B6" />
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.iconBtn} onPress={() => cancelEditItem(item.id)}>
                                <Ionicons name="close-circle-outline" size={20} color="#999" />
                              </TouchableOpacity>
                            </>
                          ) : (
                            <>
                              <TouchableOpacity style={styles.iconBtn} onPress={() => startEditItem(item.id)}>
                                <Ionicons name="pencil-outline" size={18} color="#2EC4B6" />
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.iconBtn} onPress={() => removeOrderItem(item.id)}>
                                <Ionicons name="close-circle" size={20} color="#FF6B6B" />
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>

                      {/* ── Store picker for this item ── */}
                      {!item.editing && (
                        <View style={styles.itemStoreSection}>
                          <Text style={styles.itemStoreLabel}>Choose Store:</Text>
                          <View style={styles.itemStoreOptions}>

                            {/* Feed Stores */}
                            <TouchableOpacity
                              style={[styles.storeChip, item.storeType === STORE_TYPES.FEED && styles.storeChipActive]}
                              onPress={() => {
                                setItemStoreType(item.id, STORE_TYPES.FEED);
                                openStorePicker(item.id);
                              }}
                            >
                              <Ionicons
                                name="fast-food-outline" size={13}
                                color={item.storeType === STORE_TYPES.FEED ? '#fff' : '#2EC4B6'}
                              />
                              <Text style={[styles.storeChipText, item.storeType === STORE_TYPES.FEED && styles.storeChipTextActive]}>
                                {item.storeType === STORE_TYPES.FEED && item.selectedStore
                                  ? item.selectedStore
                                  : 'Feed Stores'}
                              </Text>
                              {item.storeType === STORE_TYPES.FEED && item.selectedStore && (
                                <TouchableOpacity
                                  onPress={() => openStorePicker(item.id)}
                                  style={{ marginLeft: 2 }}
                                >
                                  <Ionicons name="chevron-down" size={12} color="#fff" />
                                </TouchableOpacity>
                              )}
                            </TouchableOpacity>

                            {/* Own store */}
                            <TouchableOpacity
                              style={[styles.storeChip, styles.storeChipOrange, item.storeType === STORE_TYPES.CUSTOM && styles.storeChipOrangeActive]}
                              onPress={() => setItemStoreType(item.id, STORE_TYPES.CUSTOM)}
                            >
                              <Ionicons
                                name="add-circle-outline" size={13}
                                color={item.storeType === STORE_TYPES.CUSTOM ? '#fff' : '#FF8C42'}
                              />
                              <Text style={[styles.storeChipText, styles.storeChipTextOrange, item.storeType === STORE_TYPES.CUSTOM && styles.storeChipTextActive]}>
                                Own
                              </Text>
                            </TouchableOpacity>

                            {/* Robot */}
                            <TouchableOpacity
                              style={[styles.storeChip, item.storeType === STORE_TYPES.ROBOT && styles.storeChipActive]}
                              onPress={() => setItemStoreType(item.id, STORE_TYPES.ROBOT)}
                            >
                              <Text style={styles.robotChipEmoji}>🤖</Text>
                              <Text style={[styles.storeChipText, item.storeType === STORE_TYPES.ROBOT && styles.storeChipTextActive]}>
                                Robot
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Custom store input */}
                          {item.storeType === STORE_TYPES.CUSTOM && !item.customStoreConfirmed && (
                            <View style={styles.customStoreInputRow}>
                              <TextInput
                                style={styles.customStoreInput}
                                placeholder="Enter store name..."
                                value={item.customStore}
                                onChangeText={text => setItemCustomStore(item.id, text)}
                                onSubmitEditing={() => {
                                  if (item.customStore.trim()) {
                                    setItemCustomStoreConfirmed(item.id, true);
                                  }
                                }}
                                returnKeyType="done"
                                placeholderTextColor="#999"
                              />
                              <TouchableOpacity
                                style={[
                                  styles.customStoreEnterBtn,
                                  !item.customStore.trim() && styles.customStoreEnterBtnDisabled
                                ]}
                                onPress={() => {
                                  if (item.customStore.trim()) {
                                    setItemCustomStoreConfirmed(item.id, true);
                                  }
                                }}
                                disabled={!item.customStore.trim()}
                              >
                                <Text style={styles.customStoreEnterBtnText}>Enter</Text>
                              </TouchableOpacity>
                            </View>
                          )}

                          {!item.storeType && (
                            <Text style={styles.itemStoreHint}>
                              Please choose a store for this item before adding to cart.
                            </Text>
                          )}

                          {/* Chosen store label */}
                          {((getItemStoreLabel(item) && item.storeType !== STORE_TYPES.CUSTOM) ||
                            (item.storeType === STORE_TYPES.CUSTOM && item.customStoreConfirmed)) && (
                            <View style={styles.chosenStoreRow}>
                              <View style={styles.chosenStorePill}>
                                <Ionicons
                                  name="checkmark-circle"
                                  size={14}
                                  color={item.storeType === STORE_TYPES.CUSTOM ? '#FF8C42' : '#2EC4B6'}
                                />
                                <Text
                                  style={[
                                    styles.chosenStorePillText,
                                    item.storeType === STORE_TYPES.CUSTOM && { color: '#FF8C42' }
                                  ]}
                                >
                                  {item.storeType === STORE_TYPES.CUSTOM ? `Own: ${item.customStore}` : getItemStoreLabel(item)}
                                </Text>
                              </View>
                              {item.storeType === STORE_TYPES.CUSTOM && (
                                <TouchableOpacity
                                  style={styles.customStoreEditBtn}
                                  onPress={() => setItemCustomStoreConfirmed(item.id, false)}
                                >
                                  <Ionicons name="pencil-outline" size={14} color="#FF8C42" />
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* ── 3. DELIVERY ADDRESS ── */}
            <View style={styles.inputSection}>
              <View style={styles.labelContainer}>
                <Ionicons name="home-outline" size={18} color="#2EC4B6" />
                <Text style={styles.inputLabel}>Delivery Address</Text>
              </View>

              <TouchableOpacity
                style={styles.addressSelectorButton}
                onPress={() => setShowAddressModal(true)}
                disabled={addressLocationLoading}
              >
                <View style={styles.addressSelectorContent}>
                  {addressLocationLoading
                    ? <ActivityIndicator size="small" color="#2EC4B6" />
                    : <Ionicons name={address ? 'checkmark-circle' : 'location-outline'} size={22} color={address ? '#2EC4B6' : '#999'} />
                  }
                  <Text style={[styles.addressSelectorText, address && styles.addressSelectorTextSelected]} numberOfLines={2}>
                    {addressLocationLoading ? 'Getting your location...' : (address || 'Select or enter your address...')}
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
                  onChangeText={text => { setAddress(text); setSelectedSavedAddress(null); setAddressCoords(null); }}
                  placeholderTextColor="#999"
                  multiline numberOfLines={3} textAlignVertical="top"
                />
              )}
            </View>

            <TouchableOpacity
              style={styles.addToCartButton}
              onPress={validateAndAddToCart}
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

          {/* ─── RECENT ORDERS ─── */}
          <Animated.View style={[styles.recentOrdersSection, { opacity: recentOrdersAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.headingLabelContainer}>
                <Ionicons name="time-outline" size={22} color="#2EC4B6" />
                <Text style={styles.sectionTitle}>Recent Orders</Text>
              </View>
              {recentOrders.length > 0 && (
                <TouchableOpacity onPress={() => navigation.navigate('Requests')}>
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
              <>
                <ScrollView
                  horizontal showsHorizontalScrollIndicator={false}
                  scrollEventThrottle={16} onScroll={handleRecentOrderScroll}
                  decelerationRate="fast"
                  snapToInterval={SLIDER_CARD_WIDTH + SPACING.md} snapToAlignment="start"
                  contentContainerStyle={styles.sliderContentContainer}
                >
                  {recentOrders.map((order, index) => (
                    <TouchableOpacity
                      key={order.id || index} style={styles.recentSliderCard}
                      activeOpacity={0.9} onPress={() => navigation.navigate('OrderDetails', { order })}
                    >
                      <View style={styles.orderHeader}>
                        <View style={styles.orderIdContainer}>
                          <Text style={styles.orderId}>#{order.orderId?.slice(-6) || order.id?.slice(-6) || 'N/A'}</Text>
                          <View style={[styles.statusBadge, {
                            backgroundColor: order.status === 'Delivered' ? '#2EC4B6'
                              : order.status === 'In Progress' ? '#FF8C42' : '#2EC4B6',
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
                          <Ionicons name="storefront-outline" size={14} color="#666" />{' '}
                          {order.pickup || 'Unknown Store'}
                        </Text>
                        <Text style={styles.orderItems} numberOfLines={2}>
                          {Array.isArray(order.items)
                            ? order.items.map(i => i.name || i.text || JSON.stringify(i)).join(' • ')
                            : order.items}
                        </Text>
                      </View>
                      <View style={styles.orderFooter}>
                        <Text style={styles.orderArea}>
                          <Ionicons name="location-outline" size={14} color="#666" />{' '}{order.area}
                        </Text>
                       
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {recentOrders.length > 1 && (
                  <View style={styles.sliderDotsContainer}>
                    {recentOrders.map((_, i) => (
                      <View key={i} style={[styles.sliderDot, i === recentOrderSliderIndex && styles.sliderDotActive]} />
                    ))}
                  </View>
                )}
              </>
            )}
          </Animated.View>
        </View>
      </ScrollView>

      {/* ─── MODALS ─── */}

      {/* Area dropdown */}
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
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search area..."
                value={areaSearch}
                onChangeText={setAreaSearch}
                placeholderTextColor="#999"
              />
            </View>
            <FlatList
              data={filteredAreas}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => selectArea(item)}>
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyModalText}>No areas found</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* Feed store picker modal */}
      <Modal visible={storePicker.visible} transparent animationType="slide" onRequestClose={closeStorePicker}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Store in {selectedArea}</Text>
              <TouchableOpacity onPress={closeStorePicker}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search-outline" size={20} color="#999" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search stores..."
                value={storeSearch}
                onChangeText={setStoreSearch}
                placeholderTextColor="#999"
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
            <FlatList
              data={filteredStoreOptions}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => pickFeedStore(item)}>
                  <Ionicons name="storefront-outline" size={18} color="#2EC4B6" style={{ marginRight: 10 }} />
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyModalText}>
                  No stores found for "{storeSearch}" in {selectedArea}
                </Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Address modal */}
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
                onPress={handleSelectCurrentLocation}
                disabled={addressLocationLoading}
              >
                <View style={styles.addressModalOptionIcon}>
                  {addressLocationLoading
                    ? <ActivityIndicator size="small" color="#2EC4B6" />
                    : <Ionicons name="locate" size={24} color="#2EC4B6" />}
                </View>
                <View style={styles.addressModalOptionContent}>
                  <Text style={styles.addressModalOptionTitle}>Use Current Location</Text>
                  <Text style={styles.addressModalOptionSubtitle}>
                    {addressLocationLoading ? 'Detecting GPS & address...' : 'Auto-detect your location'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              {savedAddresses.length > 0 && (
                <>
                  <Text style={styles.addressModalSectionTitle}>Saved Addresses</Text>
                  {savedAddresses.map(addr => (
                    <TouchableOpacity
                      key={addr.id}
                      style={[styles.addressModalOption, selectedSavedAddress?.id === addr.id && styles.addressModalOptionSelected]}
                      onPress={() => {
                        setAddress(addr.address);
                        setSelectedSavedAddress(addr);
                        const lat = addr.location?.lat, lng = addr.location?.lng;
                        setAddressCoords(lat != null && lng != null ? { lat, lng } : null);
                        setShowAddressModal(false);
                      }}
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

              <TouchableOpacity
                style={styles.manageAddressesButton}
                onPress={() => { setShowAddressModal(false); navigation.navigate('MyAddresses'); }}
              >
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

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  scrollContent: { paddingHorizontal: 0, paddingBottom: SPACING.lg },

  // ─── HERO ────────────────────────────────────────────────────────────────
  heroSection: { marginBottom: 10 },
  heroCardWrapper: { width: SCREEN_WIDTH },
  heroCard: { paddingTop: 30, paddingBottom: 50, paddingHorizontal: 24, minHeight: 300, overflow: 'hidden', borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  heroBgCircleLarge:  { position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.07)' },
  heroBgCircleMedium: { position: 'absolute', top: 20, right: 30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)' },
  heroBgCircleSmall:  { position: 'absolute', bottom: 60, left: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)' },
  heroTopSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  heroImageOuter: { width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginRight: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  heroImageInner: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  heroImageEmoji: { fontSize: 54 },
  heroTextContainer: { flex: 1 },
  heroTitle: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  heroSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.82)', marginTop: 4 },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8 },
  heroStatItem: { flex: 1, alignItems: 'center', gap: 3 },
  heroStatDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.25)' },
  heroStatValue: { fontSize: 13, color: '#fff', fontWeight: '700', marginTop: 2 },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  heroOrderButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 50, paddingVertical: 14, paddingLeft: 30, paddingRight: 10, marginHorizontal: 80, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6 },
  heroOrderButtonText: { fontSize: 17, fontWeight: '700', color: '#1FA99D' },
  heroOrderButtonArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2EC4B6', alignItems: 'center', justifyContent: 'center' },
  paginationContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 14, gap: 6 },
  paginationDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#C5EAE8' },
  paginationDotActive: { backgroundColor: '#2EC4B6', width: 20, borderRadius: 4 },

  // ─── CATEGORIES ──────────────────────────────────────────────────────────
  categoriesSection: { marginTop: 20, paddingHorizontal: 16 },
  categoriesTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 12 },
  categoriesScrollContent: { paddingRight: 16, gap: 14 },
  categoryCard: { alignItems: 'center', width: 80 },
  categoryIconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3, borderWidth: 1, borderColor: '#f0f0f0' },
  categoryIconText: { fontSize: 32 },
  categoryNameText: { fontSize: 13, fontWeight: '600', color: '#4A5568', marginTop: 8, textAlign: 'center' },

  // ─── SLIDER ───────────────────────────────────────────────────────────────
  sliderSection: { marginTop: SPACING.md, paddingHorizontal: SECTION_SIDE_PADDING },
  sliderContentContainer: { paddingRight: SECTION_SIDE_PADDING, gap: SPACING.md },
  sliderDotsContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10, gap: 5 },
  sliderDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C5EAE8' },
  sliderDotActive: { backgroundColor: '#2EC4B6', width: 18, borderRadius: 3 },

  // ─── CURRENT ORDER CARD ───────────────────────────────────────────────────
  currentSliderCard: { width: SLIDER_CARD_WIDTH, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', flexDirection: 'row', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4 },
  sliderCardAccent: { width: 4, backgroundColor: '#2EC4B6', borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  sliderCardInner: { flex: 1, padding: SPACING.md },

  // ─── RECENT ORDER CARD ────────────────────────────────────────────────────
  recentSliderCard: { width: SLIDER_CARD_WIDTH, backgroundColor: '#fff', borderRadius: 16, padding: SPACING.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },

  // ─── CONTENT ─────────────────────────────────────────────────────────────
  contentContainer: { paddingHorizontal: SECTION_SIDE_PADDING },
  orderCardContainer: { backgroundColor: '#fff', marginTop: SPACING.sm, padding: SPACING.md, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  inputSection: { marginBottom: SPACING.md },
  headingLabelContainer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  labelContainer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.sm },
  inputLabel: { fontSize: 16, fontWeight: '600', color: '#333' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  orderInterestHeader: { marginTop: SPACING.sm },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#333' },
  itemCountBadge: { backgroundColor: '#2EC4B620', paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: 12 },
  itemCountBadgeText: { fontSize: 12, color: '#2EC4B6', fontWeight: '600' },

  // ─── AREA selector ───────────────────────────────────────────────────────
  selectorInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: SPACING.md, borderRadius: 12, borderWidth: 1, borderColor: '#ddd' },
  selectedText: { fontSize: 16, color: '#333' },
  placeholderText: { fontSize: 16, color: '#999' },

  // ─── INLINE ADD ───────────────────────────────────────────────────────────
  inlineInputRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: '#fff', borderRadius: 12, padding: SPACING.sm, borderWidth: 1, borderColor: '#ddd' },
  inlineInput: { flex: 1, fontSize: 16, color: '#333', paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm },
  inlineAddButton: { overflow: 'hidden', borderRadius: 10 },
  addButtonGradient: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 10 },
  inlineAddButtonDisabled: { opacity: 0.4 },
  inlineAddButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // ─── ORDER ITEM CARD ─────────────────────────────────────────────────────
  itemsListCompact: { marginTop: SPACING.sm, gap: SPACING.sm },
  orderItemCard: { backgroundColor: '#F5F7FA', borderRadius: 12, padding: SPACING.sm, borderLeftWidth: 3, borderLeftColor: '#2EC4B6' },
  orderItemTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  orderItemNumber: { fontSize: 14, fontWeight: '700', color: '#2EC4B6', width: 24 },
  orderItemText: { flex: 1, fontSize: 15, color: '#333', fontWeight: '500' },
  orderItemEditInput: { flex: 1, fontSize: 15, color: '#333', backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#2EC4B6' },
  orderItemActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { padding: 4 },

  // ─── PER-ITEM STORE SECTION ───────────────────────────────────────────────
  itemStoreSection: { paddingLeft: 24 },
  itemStoreLabel: { fontSize: 18, color: '#7da838', fontWeight: '500', marginBottom: 9 },
  itemStoreOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  storeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#2EC4B6' },
  storeChipActive: { backgroundColor: '#2EC4B6', borderColor: '#2EC4B6' },
  storeChipOrange: { borderColor: '#FF8C42' },
  storeChipOrangeActive: { backgroundColor: '#FF8C42', borderColor: '#FF8C42' },
  storeChipText: { fontSize: 12, fontWeight: '600', color: '#2EC4B6' },
  storeChipTextOrange: { color: '#FF8C42' },
  storeChipTextActive: { color: '#fff' },
  robotChipEmoji: { fontSize: 12 },
  customStoreInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  customStoreInput: { flex: 1, fontSize: 14, color: '#333', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
  customStoreEnterBtn: { backgroundColor: '#FF8C42', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  customStoreEnterBtnDisabled: { backgroundColor: '#FF8C4250' },
  customStoreEnterBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  chosenStoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  customStoreEditBtn: { padding: 4 },
  chosenStorePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chosenStorePillText: { fontSize: 12, color: '#2EC4B6', fontWeight: '600' },

  // ─── ADDRESS ─────────────────────────────────────────────────────────────
  addressSelectorButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: SPACING.md, borderRadius: 12, borderWidth: 1, borderColor: '#ddd' },
  addressSelectorContent: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: SPACING.sm },
  addressSelectorText: { flex: 1, fontSize: 15, color: '#999' },
  addressSelectorTextSelected: { color: '#333', fontWeight: '500' },
  manualAddressToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm, paddingVertical: SPACING.xs, gap: SPACING.xs },
  manualAddressToggleText: { fontSize: 13, color: '#2EC4B6', fontWeight: '600' },
  addressInput: { fontSize: 16, color: '#333', backgroundColor: '#fff', padding: SPACING.md, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', minHeight: 80 },

  // ─── ADD TO CART ─────────────────────────────────────────────────────────
  addToCartButton: { overflow: 'hidden', borderRadius: 16, marginTop: SPACING.lg, shadowColor: '#2EC4B6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  addToCartGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.md, borderRadius: 16 },
  addToCartButtonDisabled: { opacity: 0.5 },
  addToCartText: { fontSize: 18, color: '#fff', fontWeight: '700', marginLeft: SPACING.sm },
  cartBadge: { position: 'absolute', right: SPACING.md, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 },
  cartBadgeText: { fontSize: 12, color: '#2EC4B6', fontWeight: 'bold' },

  // ─── MODALS ───────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: SPACING.lg, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#ddd' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F7FA', padding: SPACING.sm, borderRadius: 12, marginBottom: SPACING.md },
  modalSearchInput: { flex: 1, fontSize: 16, color: '#333', marginLeft: SPACING.sm },
  modalItem: { paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#ddd', flexDirection: 'row', alignItems: 'center' },
  modalItemText: { fontSize: 16, color: '#333', fontWeight: '500' },
  emptyModalText: { fontSize: 16, color: '#666', textAlign: 'center', paddingVertical: SPACING.xl },

  // ─── RECENT ORDERS ────────────────────────────────────────────────────────
  recentOrdersSection: { marginTop: SPACING.lg, paddingBottom: SPACING.xl + 110 , marginBottom: SPACING.sm},
  viewAllText: { fontSize: 14, color: '#2EC4B6', fontWeight: '600' },
  itemStoreHint: { marginTop: SPACING.sm, color: '#D97706', fontSize: 12, fontWeight: '600' },
  emptyOrdersContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xl, backgroundColor: '#fff', borderRadius: 16 },
  emptyOrdersText: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: SPACING.md },
  emptyOrdersSubtext: { fontSize: 14, color: '#666', marginTop: SPACING.xs },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  orderIdContainer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  orderId: { fontSize: 16, fontWeight: '700', color: '#333' },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  orderDate: { fontSize: 13, color: '#666' },
  orderDetails: { marginBottom: SPACING.sm },
  orderStore: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 4 },
  orderItems: { fontSize: 14, color: '#666' },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: '#ddd' },
  orderArea: { fontSize: 13, color: '#666' },
  reorderButton: { backgroundColor: '#2EC4B6', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 10 },
  reorderText: { fontSize: 13, color: '#fff', fontWeight: '600' },

  // ─── CURRENT ORDER CARD INTERNALS ─────────────────────────────────────────
  currentOrdersBadge: { backgroundColor: '#2EC4B6', borderRadius: 12, paddingHorizontal: SPACING.sm, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
  currentOrdersBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  currentOrderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  currentOrderIdContainer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  currentOrderId: { fontSize: 16, fontWeight: '700', color: '#333' },
  currentOrderDate: { fontSize: 13, color: '#666' },
  riderInfoContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F7FA', padding: SPACING.sm, borderRadius: 10, marginBottom: SPACING.sm },
  riderName: { fontSize: 14, fontWeight: '600', color: '#333', marginLeft: SPACING.xs },
  riderPhone: { fontSize: 13, color: '#666', marginLeft: SPACING.xs },
  currentOrderItems: { marginBottom: SPACING.sm },
  currentOrderItemsLabel: { fontSize: 13, color: '#666', marginBottom: 2 },
  currentOrderItemsText: { fontSize: 14, color: '#333', fontWeight: '500' },
  currentOrderStore: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  currentOrderStoreText: { fontSize: 13, color: '#666', marginLeft: SPACING.xs },
  currentOrderActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: '#ddd', gap: SPACING.sm },
  viewDetailsButton: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm, borderRadius: 10, borderWidth: 1, borderColor: '#2EC4B6', flex: 1, justifyContent: 'center' },
  viewDetailsText: { fontSize: 14, color: '#2EC4B6', fontWeight: '600', marginLeft: SPACING.xs },
  cancelOrderButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#EF4444', borderRadius: 12, flex: 1 },
  cancelOrderText: { fontSize: 14, color: '#fff', fontWeight: '700' },
  chatButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2EC4B6', padding: SPACING.sm, borderRadius: 10, flex: 1, justifyContent: 'center' },
  chatButtonText: { fontSize: 14, color: '#fff', fontWeight: '600', marginLeft: SPACING.xs },

  // ─── ADDRESS MODAL ────────────────────────────────────────────────────────
  addressModalContainer: { maxHeight: '80%' },
  addressModalScroll: { padding: SPACING.lg },
  addressModalOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: SPACING.md, borderRadius: 12, marginBottom: SPACING.sm, borderWidth: 1, borderColor: '#ddd' },
  addressModalOptionSelected: { borderColor: '#2EC4B6', backgroundColor: '#F5F7FA' },
  addressModalOptionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F7FA', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  addressModalOptionContent: { flex: 1 },
  addressModalOptionTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 2 },
  addressModalOptionSubtitle: { fontSize: 13, color: '#666' },
  addressModalSectionTitle: { fontSize: 14, fontWeight: '700', color: '#666', marginTop: SPACING.md, marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  manageAddressesButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F7FA', padding: SPACING.md, borderRadius: 12, marginTop: SPACING.lg, gap: SPACING.xs },
  manageAddressesText: { fontSize: 15, fontWeight: '600', color: '#2EC4B6' },
});

export default DashboardScreen;