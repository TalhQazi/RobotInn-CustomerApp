import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, FlatList, Dimensions, Animated, ActivityIndicator, DeviceEventEmitter, Image, AppState,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS, GRADIENTS } from '../../theme/colors';
import { ordersAPI, areasAPI, usersAPI, categoriesAPI, storesAPI } from '../../services/api';

import { getCurrentLocationWithAddress } from '../../utils/location';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import ThemedAlert from '../../components/common/ThemedAlert';
import { getData, storeData } from '../../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../../utils/constants';
import {
  ORDER_STATUS,
  normalizeOrderStatus,
  getOrderStatusLabel,
  isActiveOrderStatus,
} from '../../utils/orderStatus';
import { fetchNearbyStoresFromGoogle, AREA_COORDINATES, resolveAreaCoords } from '../../utils/maps';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import PaymentAdjustmentModal from '../../components/order/PaymentAdjustmentModal';
import CategoryDetectionService from '../../services/CategoryDetectionService';
import StoreSearchService from '../../services/StoreSearchService';


// ─── Default Islamabad sector list ─────────────────────────────────────────────
const DEFAULT_ISLAMABAD_AREAS = [
  'F-6', 'F-7', 'F-8', 'F-10', 'F-11', 'G-6', 'G-7', 'G-8', 'G-9', 'G-10', 'G-11',
  'I-8', 'I-9', 'I-10', 'E-7', 'E-8', 'E-9', 'E-11', 'DHA Phase 1', 'DHA Phase 2',
  'Bahria Phase 7', 'Bahria Phase 8', 'Gulberg Residencia', 'Bani Gala',
];


const ORDER_STATUS_COLORS = {
  [ORDER_STATUS.PENDING]: '#2EC4B6',
  [ORDER_STATUS.ACCEPTED]: '#2EC4B6',
  [ORDER_STATUS.SHOPPING]: '#F77F00',
  [ORDER_STATUS.BILL_SUBMITTED]: '#FF8C42',
  [ORDER_STATUS.BILL_REJECTED]: '#E63946',
  [ORDER_STATUS.ADJUSTMENT_PENDING]: '#E63946',
  [ORDER_STATUS.ADJUSTMENT_REJECTED]: '#E63946',
  [ORDER_STATUS.BILL_APPROVED]: '#4EA8DE',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: '#4EA8DE',
  [ORDER_STATUS.DELIVERED]: '#2EC4B6',
  [ORDER_STATUS.CANCELLED]: '#9AA5B1',
};

const getOrderStatusColor = (status) =>
  ORDER_STATUS_COLORS[normalizeOrderStatus(status)] || '#2EC4B6';

/**
 * Anything not finished yet, so an order stays on the customer's tracker while
 * the rider shops and the bill is with Admin. The price-approval modal reads
 * from this same list, so dropping a status here silently hides the prompt.
 */
const isOpenOrder = (order) => {
  const s = normalizeOrderStatus(order?.status);
  return s === ORDER_STATUS.PENDING || isActiveOrderStatus(s);
};



/**
 * Dynamic renderCategoryIcon — renders dynamic icon image (iconUrl or URL icon) if saved by admin,
 * or the text emoji set by admin. Bypasses all local static assets.
 */
const renderCategoryIcon = (category) => {
  const iconUrl = category?.iconUrl || (typeof category?.icon === 'string' && category.icon.startsWith('http') ? category.icon : null);
  const emoji = (category?.icon || category?.emoji || '').trim();

  if (iconUrl) {
    return (
      <Image
        source={{ uri: iconUrl }}
        style={styles.categoryDynamicIcon}
        resizeMode="contain"
      />
    );
  }

  return (
    <Text style={styles.categoryEmoji}>
      {emoji || '🏷️'}
    </Text>
  );
};






const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SECTION_SIDE_PADDING = SPACING.md;

// ─── Single card hero banner width ──────────────────────────────────────────
const HERO_CARD_WIDTH = SCREEN_WIDTH - 32;
const HERO_CARD_GAP = 16;
const HERO_SNAP_INTERVAL = HERO_CARD_WIDTH + HERO_CARD_GAP;
const SLIDER_CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.72);


// ─── Hero Cards (emoji-only, no local 3D assets) ─────────────────────────────
const HERO_CARDS = [
  { id: '1', title: 'Burger King', subtitle: 'Flame Grilled Burgers', image: '🍔', rating: '4.5', deliveryTime: '25-35', deliveryType: 'Free' },
  { id: '2', title: 'Pizza Hut', subtitle: 'Delicious Pizzas', image: '🍕', rating: '4.3', deliveryTime: '30-45', deliveryType: 'Free' },
  { id: '3', title: 'KFC', subtitle: 'Finger Lickin Good', image: '🍗', rating: '4.4', deliveryTime: '25-40', deliveryType: 'Free' },
  { id: '4', title: "McDonald's", subtitle: "I'm Lovin It", image: '🍟', rating: '4.2', deliveryTime: '20-30', deliveryType: 'Free' },
  { id: '5', title: 'Subway', subtitle: 'Fresh Sandwiches', image: '🥪', rating: '4.6', deliveryTime: '15-25', deliveryType: 'Free' },
  { id: '6', title: 'Dunkin', subtitle: 'Coffee & Donuts', image: '🍩', rating: '4.5', deliveryTime: '20-35', deliveryType: 'Free' },
  { id: '7', title: 'Baskin Robbins', subtitle: 'Ice Cream Delights', image: '🍦', rating: '4.7', deliveryTime: '15-20', deliveryType: 'Free' },
];
const HERO_LOOP_CARDS = [HERO_CARDS[HERO_CARDS.length - 1], ...HERO_CARDS, HERO_CARDS[0]];


// ─── Store type options ───────────────────────────────────────────────────────
const STORE_TYPES = {
  FEED: 'feed',
  CUSTOM: 'custom',
  ROBOT: 'robot',
};

// ─── Keyword & pattern-based automatic category detection ───────────────────
const PHARMACY_KEYWORDS = [
  'disprean', 'disprin', 'dispirin', 'panadol', 'brufen', 'paracetamol', 'medicine', 'medicines',
  'tablet', 'tablets', 'syrup', 'syrups', 'bandaid', 'bandage', 'vitamin', 'vitamins', 'health',
  'pharmacy', 'medical', 'dettol', 'sanitizer', 'mask', 'insulin', 'cream', 'lotion', 'ointment',
  'capsule', 'capsules', 'antibiotic', 'painkiller', 'aspirin', 'ponstan', 'flagyl', 'augmentin',
  'rigix', 'gaviscon', 'secnidazole', 'calpol', 'entamizole', 'arinac', 'surbex', 'cac', 'nuberol',
  'flynex', 'strip', 'thermometer', 'pills', 'pill', 'injection', 'injections', 'drops', 'drop',
  'avomine', 'gravinate', 'polyfax', 'amoxil', 'cipro', 'zithromax', 'klacid', 'velosef', 'famila',
  'tylenol', 'advil', 'aleve', 'benadryl', 'ventolin', 'cough', 'cold', 'fever', 'pharma', 'chemists'
];

const PHARMACY_SUFFIXES = [
  'prin', 'prean', 'pirin', 'adol', 'fen', 'stan', 'nac', 'bex', 'rol', 'nex',
  'zole', 'cillin', 'mycin', 'clovir', 'statin', 'sone', 'done', 'pam', 'lam', 'mine'
];

const MEAT_KEYWORDS = [
  'meat', 'chicken', 'mutton', 'beef', 'lamb', 'fish', 'prawn', 'butcher', 'meat shop',
  'mince', 'keema', 'qima', 'steak', 'wings', 'boneless', 'mutton leg', 'chops', 'kabab'
];

const COSMETICS_KEYWORDS = [
  'cosmetics', 'cosmetic', 'cream', 'golden pearl', 'pearl', 'fairness', 'whitening',
  'lipstick', 'makeup', 'makeup-kit', 'foundation', 'concealer', 'mascara',
  'eyeliner', 'blush', 'nailpaint', 'nail polish', 'perfume', 'fragrance', 'lotion',
  'skincare', 'facewash', 'face wash', 'serum', 'beauty', 'eyeshadow', 'compact', 'moisturizer',
  'moisturiser', 'bleach', 'cleanser', 'scrub', 'toner', 'sunblock', 'sunscreen', 'faiza',
  'stillmans', 'olay', 'nivea', 'ponds', 'pond', 'garnier', 'vaseline', 'body wash', 'hair oil'
];

const STATIONERY_KEYWORDS = [
  'pen', 'pens', 'pencil', 'pencils', 'paper', 'notebook', 'notebooks', 'copy', 'copies',
  'register', 'marker', 'markers', 'eraser', 'sharpener', 'scale', 'ruler', 'stapler',
  'staples', 'file', 'folder', 'ink', 'ballpoint', 'pointer', 'book', 'books', 'calculator',
  'tape', 'glue', 'sticky note', 'envelope', 'stationery', 'journal', 'diary', 'highlighter',
  'geometry', 'page', 'pages', 'chart', 'board'
];

const BABY_CARE_KEYWORDS = [
  'baby', 'babay', 'diaper', 'diapers', 'pamper', 'pampers', 'feeder', 'cerelac',
  'lactogen', 'formula', 'nan', 'wipes', 'johnson', 'pacifier', 'nipple', 'rattle', 'baby oil'
];

const GIFTS_KEYWORDS = [
  'gift', 'gifts', 'card', 'cards', 'bouquet', 'flower', 'flowers', 'chocolate box',
  'teddy', 'toy', 'toys', 'ribbon', 'wrapping', 'frame', 'frames'
];

const DRINKS_KEYWORDS = [
  'drink', 'drinks', 'coke', 'pepsi', '7up', 'sprite', 'sting', 'redbull', 'red bull',
  'juice', 'juices', 'water', 'nestle', 'soda', 'cold drink', 'beverage', 'slush', 'shake'
];

const BAKERY_KEYWORDS = [
  'bakery', 'bakers', 'baker', 'cake', 'cakes', 'pastry', 'pastries', 'naan', 'roti',
  'rusk', 'rusks', 'donut', 'donuts', 'patties', 'samosa', 'roll', 'bun', 'cupcake'
];

const GROCERY_KEYWORDS = [
  'milk', 'bread', 'egg', 'eggs', 'butter', 'cheese', 'rice', 'flour', 'atta', 'sugar',
  'salt', 'oil', 'ghee', 'tea', 'patti', 'soap', 'detergent', 'surf', 'grocer', 'groceries',
  'supermarket', 'biscuit', 'biscuits', 'chips', 'olpers', 'dairy', 'tissue',
  'shampoo', 'colgate', 'toothpaste', 'cleaner', 'washing'
];

const FRESH_KEYWORDS = [
  'apple', 'apples', 'banana', 'bananas', 'mango', 'mangoes', 'orange', 'oranges',
  'potato', 'potatoes', 'onion', 'onions', 'tomato', 'tomatoes', 'vegetable', 'vegetables',
  'fruit', 'fruits', 'sabzi', 'phool', 'bazaar', 'fresh', 'coriander', 'mint', 'lemon',
  'ginger', 'garlic', 'cucumber', 'gobi', 'palak', 'bhindi', 'kera', 'aloo', 'pyaz'
];

const FITNESS_KEYWORDS = [
  'fitness', 'gym', 'protein', 'whey', 'creatine', 'supplements', 'supplement',
  'dumbbell', 'workout', 'bcaa', 'preworkout', 'shaker', 'gym wear', 'fitness gear',
  'treadmill', 'resistance band', 'weights', 'nutrition'
];

const HOUSE_DECOR_KEYWORDS = [
  'house decor', 'decoration', 'decor', 'sofa', 'lamp', 'furniture', 'curtains',
  'curtain', 'interior', 'vase', 'wall art', 'painting', 'rug', 'carpet', 'cushion',
  'lights', 'party', 'home decor', 'crafts'
];

const formatCategoryBadge = (categoryInput, categoriesList = []) => {
  if (!categoryInput) return '🍔 Food';
  const catName = typeof categoryInput === 'object' ? (categoryInput.name || '') : String(categoryInput);
  const foundCat = Array.isArray(categoriesList) ? categoriesList.find(c => (c.name || '').toLowerCase() === catName.toLowerCase() || c.id === categoryInput) : null;
  const icon = foundCat?.icon || (
    catName.toLowerCase().includes('pharmacy') ? '💊' :
      catName.toLowerCase().includes('grocer') ? '🛒' :
        catName.toLowerCase().includes('bazaar') || catName.toLowerCase().includes('fruit') ? '🥬' :
          catName.toLowerCase().includes('meat') ? '🥩' :
            catName.toLowerCase().includes('cosmetic') ? '💄' :
              catName.toLowerCase().includes('fitness') ? '🏋️‍♂️' :
                catName.toLowerCase().includes('decor') ? '🛋️' :
                  catName.toLowerCase().includes('pet') || catName.toLowerCase().includes('dog') ? '🐾' :
                    catName.toLowerCase().includes('gift') || catName.toLowerCase().includes('flower') ? '🎁' :
                      catName.toLowerCase().includes('baby') || catName.toLowerCase().includes('babay') ? '🍼' :
                        catName.toLowerCase().includes('drink') ? '🥤' :
                          catName.toLowerCase().includes('baker') ? '🍰' :
                            catName.toLowerCase().includes('office') || catName.toLowerCase().includes('stationery') || catName.toLowerCase().includes('book') ? '📚' :
                              catName.toLowerCase().includes('auto') || catName.toLowerCase().includes('car') ? '🚗' : '🏷️'
  );
  return `${icon} ${catName}`;
};

const detectItemCategory = (itemText = '', categoriesList = []) => {
  if (!itemText) return 'Food';
  const detected = CategoryDetectionService.detectCategory(itemText);
  if (detected && detected.categoryName) {
    return detected.categoryName;
  }
  return 'Food';
};

// ─── Helper: build a blank order item ────────────────────────────────────────
const newOrderItem = (text = '', categoryOverride = null) => {
  const detectedObj = CategoryDetectionService.detectCategory(text);
  const finalCategoryName = typeof categoryOverride === 'string'
    ? categoryOverride
    : (categoryOverride?.categoryName || categoryOverride?.name || detectedObj.categoryName || 'Food');
  const finalCategoryId = categoryOverride?.categoryId || detectedObj.categoryId || 'other';

  return {
    id: Date.now().toString() + Math.random(),
    text,
    name: text,
    category: finalCategoryName,
    categoryId: finalCategoryId,
    categoryName: finalCategoryName,
    categoryIcon: detectedObj.categoryIcon || 'grid-outline',
    categoryDetected: detectedObj.categoryDetected,
    editing: false,
    editText: text,
    storeType: null,       // STORE_TYPES.FEED | CUSTOM | ROBOT | null
    selectedStore: '',     // name of the chosen feed-store
    customStore: '',       // typed custom store
    customStoreConfirmed: false,
  };
};


// ─────────────────────────────────────────────────────────────────────────────
const getBrandLogo = (storeName) => {
  if (!storeName) return null;
  const name = storeName.toLowerCase();
  if (name.includes('kfc')) return 'https://icon.horse/icon/kfc.com';
  if (name.includes('pizza hut')) return 'https://icon.horse/icon/pizzahut.com';
  if (name.includes('subway')) return 'https://icon.horse/icon/subway.com';
  if (name.includes('mcdonald')) return 'https://icon.horse/icon/mcdonalds.com';
  if (name.includes('burger king')) return 'https://icon.horse/icon/burgerking.com';
  if (name.includes('domino')) return 'https://icon.horse/icon/dominos.com';
  if (name.includes('starbucks')) return 'https://icon.horse/icon/starbucks.com';
  if (name.includes('cheezious')) return 'https://icon.horse/icon/cheezious.com';
  if (name.includes('hardee')) return 'https://icon.horse/icon/hardees.com';
  if (name.includes('popeyes')) return 'https://icon.horse/icon/popeyes.com';
  if (name.includes('tim hortons')) return 'https://icon.horse/icon/timhortons.com';
  if (name.includes('baskin')) return 'https://icon.horse/icon/baskinrobbins.com';
  if (name.includes('dunkin')) return 'https://icon.horse/icon/dunkindonuts.com';
  if (name.includes('tehzeeb')) return 'https://icon.horse/icon/tehzeeb.com.pk';
  return null;
};

const DashboardScreen = ({ navigation, route }) => {
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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const currentOrdersAnim = useRef(new Animated.Value(0)).current;
  const orderInterestAnim = useRef(new Animated.Value(0)).current;
  const recentOrdersAnim = useRef(new Animated.Value(0)).current;

  // Hero Carousel
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const heroScrollRef = useRef(null);
  const heroIntervalRef = useRef(null);
  const heroPageIndexRef = useRef(1);
  const scrollViewRef = useRef(null);

  // Slider dot tracking
  const [currentOrderSliderIndex, setCurrentOrderSliderIndex] = useState(0);
  const [recentOrderSliderIndex, setRecentOrderSliderIndex] = useState(0);

  // ── Area selection (moved to top) ─────────────────────────────────────────
  const [selectedArea, setSelectedArea] = useState('');
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);
  const [areaSearch, setAreaSearch] = useState('');
  const [areasData, setAreasData] = useState([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const areasLoadedRef = useRef(false);

  // ── Order items (each carries its own store choice) ───────────────────────
  const [orderItems, setOrderItems] = useState([]);
  const [currentItem, setCurrentItem] = useState('');

  // Store picker modal (for feed-store list per item)
  const [storePicker, setStorePicker] = useState({ visible: false, itemId: null });
  const [storeSearch, setStoreSearch] = useState('');

  // ── Address ───────────────────────────────────────────────────────────────
  const [address, setAddress] = useState('');
  const [addressCoords, setAddressCoords] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedSavedAddress, setSelectedSavedAddress] = useState(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showManualAddressInput, setShowManualAddressInput] = useState(false);
  const [addressLocationLoading, setAddressLocationLoading] = useState(false);

  // ── Categories & Dynamic Stores ───────────────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  // These are used by the store picker modal and order submission
  const [googleStores, setGoogleStores] = useState([]);
  const [loadingGoogleStores, setLoadingGoogleStores] = useState(false);
  const [selectedStoreObj, setSelectedStoreObj] = useState(null);

  // ── Orders ────────────────────────────────────────────────────────────────
  const [recentOrders, setRecentOrders] = useState([]);
  const [currentOrders, setCurrentOrders] = useState([]);

  // ── Price Adjustment Modal (ADJUSTMENT_PENDING) ───────────────────────────
  const [adjustmentModalOrder, setAdjustmentModalOrder] = useState(null);
  const [adjustmentModalVisible, setAdjustmentModalVisible] = useState(false);
  const [adjustmentSubmitting, setAdjustmentSubmitting] = useState(false);
  const shownAdjustmentOrderIds = useRef(new Set());

  const handleApproveAdjustment = async (order) => {
    try {
      setAdjustmentSubmitting(true);
      const orderId = order.id || order.orderId || order._id;
      await ordersAPI.respondPriceAdjustment(orderId, { decision: 'ACCEPT' });
      setAdjustmentModalVisible(false);
      setAdjustmentModalOrder(null);
      showThemedAlert({
        title: '✅ Payment Approved',
        message: 'You have approved the price adjustment. The rider is on their way!',
        buttons: [{ text: 'OK' }],
      });
      fetchDashboardData();
    } catch (err) {
      showThemedAlert({ title: 'Error', message: err.message || 'Failed to approve adjustment.' });
    } finally {
      setAdjustmentSubmitting(false);
    }
  };

  const handleDisputeAdjustment = (order) => {
    setAdjustmentModalVisible(false);
    setAdjustmentModalOrder(null);
    showThemedAlert({
      title: '⚠️ Amount Disputed',
      message: 'Your dispute has been submitted. An admin will review the receipt and contact you shortly.',
      buttons: [{ text: 'OK' }],
    });
  };
  const [cancellingOrderId, setCancellingOrderId] = useState(null);

  // Auto-show adjustment modal whenever a current order hits ADJUSTMENT_PENDING
  useEffect(() => {
    const adjustmentOrder = currentOrders.find(
      o => normalizeOrderStatus(o.status) === ORDER_STATUS.ADJUSTMENT_PENDING,
    );
    if (adjustmentOrder) {
      const oid = adjustmentOrder.id || adjustmentOrder.orderId || adjustmentOrder._id;
      if (oid && !shownAdjustmentOrderIds.current.has(oid)) {
        shownAdjustmentOrderIds.current.add(oid);
        setAdjustmentModalOrder(adjustmentOrder);
        setAdjustmentModalVisible(true);
      }
    }
  }, [currentOrders]);

  const isPendingOrder = (status) => {
    if (!status) return true;
    const s = String(status).toLowerCase().trim();
    return s !== 'delivered' && s !== 'completed' && s !== 'cancelled';
  };

  const promptCancelOrder = (order) => {
    const targetId = order.id || order.orderId || order._id;
    if (!targetId) return;

    showThemedAlert({
      title: 'Cancel Order',
      message: `Are you sure you want to cancel order #${order.orderId?.slice(-6) || order.id?.slice(-6) || 'this order'}?`,
      buttons: [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: () => handleCancelOrder(targetId) },
      ],
    });
  };

  const handleCancelOrder = async (orderId) => {
    try {
      setCancellingOrderId(orderId);
      const res = await ordersAPI.cancelOrder(orderId, 'Cancelled by customer');
      if (res.success) {
        showThemedAlert({ title: 'Order Cancelled', message: 'Your order has been cancelled successfully.' });
        fetchDashboardData();
      } else {
        showThemedAlert({ title: 'Error', message: res.error || 'Failed to cancel order.' });
      }
    } catch (err) {
      showThemedAlert({ title: 'Error', message: err.message || 'Error cancelling order.' });
    } finally {
      setCancellingOrderId(null);
    }
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

  // ── Categories ─────────────────────────────────────────────────────────────
  // Live Firestore subscription + 4s polling fallback + AppState listener.
  useEffect(() => {
    let unsubscribe = null;
    let pollTimer = null;

    const applyCategoriesList = (list) => {
      const activeList = (Array.isArray(list) ? list : []).filter(c => c.active !== false);
      setCategories(activeList);
      setCategoriesLoading(false);
    };

    const startSubscription = () => {
      if (unsubscribe) {
        try { unsubscribe(); } catch (_) { }
        unsubscribe = null;
      }
      setCategoriesLoading(true);

      // 1. Initial direct fetch
      categoriesAPI.getAll().then(res => {
        if (res.success && Array.isArray(res.data)) {
          applyCategoriesList(res.data);
        }
      });

      // 2. Real-time Firestore snapshot listener
      unsubscribe = categoriesAPI.subscribe(
        list => {
          applyCategoriesList(list);
        },
        err => {
          console.warn('❌ Categories live subscription error:', err);
          categoriesAPI.getAll().then(res => {
            if (res.success) applyCategoriesList(res.data);
          });
        },
      );
    };

    startSubscription();

    // 3. Fallback background polling every 4 seconds to guarantee additions/deletions update instantly
    pollTimer = setInterval(async () => {
      try {
        const res = await categoriesAPI.getAll();
        if (res.success && Array.isArray(res.data)) {
          const activeList = res.data.filter(c => c.active !== false);
          setCategories(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(activeList)) {
              return activeList;
            }
            return prev;
          });
        }
      } catch (_) { }
    }, 4000);

    const appStateSub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        console.log('📡 App foregrounded — restarting categories listener');
        startSubscription();
      }
    });

    return () => {
      if (unsubscribe) { try { unsubscribe(); } catch (_) { } }
      if (pollTimer) clearInterval(pollTimer);
      appStateSub.remove();
    };
  }, []);

  // Auto-reset selected category if deleted by admin
  useEffect(() => {
    if (selectedCategoryId && categories.length > 0) {
      const exists = categories.some(c => (c.id || c._id || c.name) === selectedCategoryId);
      if (!exists) {
        setSelectedCategoryId(null);
      }
    }
  }, [categories, selectedCategoryId]);

  // ── Hero carousel init ────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      heroScrollRef.current?.scrollTo({ x: HERO_SNAP_INTERVAL, animated: false });
      heroPageIndexRef.current = 1;
      setCurrentHeroIndex(0);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    heroIntervalRef.current = setInterval(() => {
      const lastLoopPageIndex = HERO_CARDS.length + 1;
      const next = Math.min(heroPageIndexRef.current + 1, lastLoopPageIndex);
      heroScrollRef.current?.scrollTo({ x: next * HERO_SNAP_INTERVAL, animated: true });
      heroPageIndexRef.current = next;
    }, 5000);
    return () => { if (heroIntervalRef.current) clearInterval(heroIntervalRef.current); };
  }, []);

  const handleHeroScroll = (e) => {
    const pageIndex = Math.round(e.nativeEvent.contentOffset.x / HERO_SNAP_INTERVAL);
    setCurrentHeroIndex((pageIndex - 1 + HERO_CARDS.length) % HERO_CARDS.length);
  };

  const handleHeroScrollEnd = (e) => {
    const pageIndex = Math.round(e.nativeEvent.contentOffset.x / HERO_SNAP_INTERVAL);
    if (pageIndex === 0) {
      heroScrollRef.current?.scrollTo({ x: HERO_CARDS.length * HERO_SNAP_INTERVAL, animated: false });
      heroPageIndexRef.current = HERO_CARDS.length;
      setCurrentHeroIndex(HERO_CARDS.length - 1);
      return;
    }
    if (pageIndex === HERO_CARDS.length + 1) {
      heroScrollRef.current?.scrollTo({ x: HERO_SNAP_INTERVAL, animated: false });
      heroPageIndexRef.current = 1;
      setCurrentHeroIndex(0);
      return;
    }
    heroPageIndexRef.current = pageIndex;
  };

  // ── Entrance animations ───────────────────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Animated.parallel([
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
    Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    Animated.timing(currentOrdersAnim, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
    Animated.timing(orderInterestAnim, { toValue: 1, duration: 600, delay: 400, useNativeDriver: true }),
    Animated.timing(recentOrdersAnim, { toValue: 1, duration: 600, delay: 600, useNativeDriver: true }),
  ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          setCurrentOrders(orders.filter(isOpenOrder));
        }
      } catch {
        const orders = await getData(ASYNC_STORAGE_KEYS.ORDERS) || [];
        setRecentOrders([...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5));
        setCurrentOrders(orders.filter(isOpenOrder));
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
    areasData.length > 0 ? areasData.map(a => a.name) : DEFAULT_ISLAMABAD_AREAS;


  const filteredAreas = getAreasList().filter(a =>
    a.toLowerCase().includes(areaSearch.toLowerCase()));

  const getStoresForArea = (itemCategory) => {
    const activeArea = selectedArea || 'Islamabad';
    const cat = itemCategory || 'Food';
    const catLower = cat.toLowerCase();

    const areaObj = areasData.find(a => (a.name || '').toLowerCase() === activeArea.toLowerCase());
    if (areaObj?.stores?.length) {
      return areaObj.stores
        .filter(s => {
          if (!s.type) return catLower.includes('food');
          const sType = s.type.toLowerCase();
          return sType.includes(catLower) || catLower.includes(sType);
        })
        .map(s => s.name);
    }

    return [];
  };

  const currentPickerItem = storePicker.itemId ? orderItems.find(i => i.id === storePicker.itemId) : null;
  const activeSelectedCategory = categories.find(c => (c.id || c._id || c.name) === selectedCategoryId)?.name || null;
  const currentPickerCategory = currentPickerItem?.category || activeSelectedCategory || 'Food';

  const storeOptions = getStoresForArea(currentPickerCategory);
  const filteredStoreOptions = storeOptions.filter((store) =>
    store.toLowerCase().includes(storeSearch.toLowerCase())
  );

  const [backendStores, setBackendStores] = useState([]);

  // ── Fetch Google Places & Backend real stores for selected Area & Category ─
  useEffect(() => {
    let isCancelled = false;
    const activeArea = selectedArea || 'Islamabad';

    // Strip emoji characters from category name for proper API matching
    const cleanCategory = (currentPickerCategory || '')
      .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '')
      .trim();

    if (storePicker.visible && cleanCategory) {
      setLoadingGoogleStores(true);

      // 1. Query Backend Database for stores in activeArea + cleanCategory
      storesAPI.getByAreaAndCategory(activeArea, cleanCategory)
        .then(res => {
          if (!isCancelled) {
            if (res.success && Array.isArray(res.data) && res.data.length > 0) {
              setBackendStores(res.data.map(s => ({
                name: s.name,
                address: s.address || `${activeArea}, Islamabad`,
                rating: s.rating || '4.8',
                isBackendStore: true,
                ...s
              })));
            } else {
              setBackendStores([]);
            }
          }
        })
        .catch(err => {
          console.warn('Backend stores fetch error:', err);
          if (!isCancelled) setBackendStores([]);
        });

      const areaCoords = resolveAreaCoords(activeArea);

      // 2. Query Google Places API for real stores in activeArea + cleanCategory using user coordinates if present
      fetchNearbyStoresFromGoogle(cleanCategory, activeArea, addressCoords?.lat || areaCoords?.lat, addressCoords?.lng || areaCoords?.lng)
        .then(results => {
          if (!isCancelled) {
            setGoogleStores(Array.isArray(results) ? results : []);
          }
        })
        .catch(err => {
          console.warn('Google Places fetch error:', err);
          if (!isCancelled) setGoogleStores([]);
        })
        .finally(() => {
          if (!isCancelled) setLoadingGoogleStores(false);
        });
    } else {
      setGoogleStores([]);
      setBackendStores([]);
      setLoadingGoogleStores(false);
    }

    return () => {
      isCancelled = true;
    };
  }, [storePicker.visible, storePicker.itemId, currentPickerCategory, selectedArea, addressCoords]);

  const combinedStoreList = React.useMemo(() => {
    const googleList = (googleStores || []).map((g) => ({
      place_id: g.place_id || g.placeId,
      placeId: g.place_id || g.placeId,
      name: g.name,
      address: g.address || `${selectedArea || 'Islamabad'}`,
      rating: g.rating || '4.5',
      isGoogleStore: true,
      isBackendStore: false,
      ...g
    }));

    const backendList = (backendStores || [])
      .filter(b => (b.name || '').toLowerCase().includes(storeSearch.toLowerCase()))
      .filter(b => !googleList.some(g => (g.name || '').toLowerCase() === (b.name || '').toLowerCase()))
      .map((b) => ({
        place_id: b.place_id || b.id || b._id,
        placeId: b.place_id || b.id || b._id,
        name: b.name,
        address: b.address || `${selectedArea || 'Islamabad'}`,
        rating: b.rating || '4.8',
        isGoogleStore: false,
        isBackendStore: true,
        ...b
      }));

    const all = [...googleList, ...backendList];
    return all.filter(s => (s.name || '').toLowerCase().includes(storeSearch.toLowerCase()));
  }, [googleStores, backendStores, storeSearch, selectedArea]);

  const selectArea = (area) => {
    setSelectedArea(area);
    setShowAreaDropdown(false);
    setAreaSearch('');
    setGoogleStores([]);
    setBackendStores([]);
    // Reset store choices on all existing items when area changes
    setOrderItems(prev => prev.map(item => ({
      ...item,
      storeType: null,
      selectedStore: '',
      customStore: '',
      customStoreConfirmed: false,
    })));
  };




  // ── Order item CRUD ───────────────────────────────────────────────────────
  const addOrderItem = () => {
    if (!currentItem.trim()) return;

    const detectedCatObj = CategoryDetectionService.detectCategory(currentItem.trim());
    const selectedCatObj = categories.find(c => (c.id || c._id || c.name) === selectedCategoryId);

    // Prioritize specific detected item category over default
    const finalCategoryObj = (detectedCatObj && detectedCatObj.categoryId !== 'other')
      ? detectedCatObj
      : (selectedCatObj ? { categoryId: selectedCatObj.id || selectedCatObj.name, categoryName: selectedCatObj.name, categoryIcon: selectedCatObj.icon } : detectedCatObj);

    const newItem = newOrderItem(currentItem.trim(), finalCategoryObj);
    setOrderItems(prev => [newItem, ...prev]);
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
    setOrderItems(prev => prev.map(i => {
      if (i.id === id) {
        const newText = i.editText.trim() || i.text;
        const newCat = detectItemCategory(newText, categories);
        return { ...i, editing: false, text: newText, category: newCat };
      }
      return i;
    }));


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
    if (item.storeType === STORE_TYPES.FEED) return item.selectedStore || 'Feed Store';
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
      const detectedCat = detectItemCategory(currentItem.trim(), categories);
      const selectedCatObj = categories.find(c => (c.id || c._id || c.name) === selectedCategoryId);
      const finalCategory = (detectedCat && detectedCat.toLowerCase() !== 'food')
        ? detectedCat
        : (selectedCatObj ? selectedCatObj.name : (detectedCat || 'Food'));

      const newItem = newOrderItem(currentItem.trim(), finalCategory);
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

    // Extract unique store names for items in this order
    const selectedStoresList = [...new Set(itemsToValidate.map(item => {
      if (item.storeType === STORE_TYPES.ROBOT) return 'Robot Store';
      if (item.storeType === STORE_TYPES.CUSTOM) return item.customStore?.trim();
      return item.selectedStore?.trim() || selectedStoreObj?.name;
    }).filter(Boolean))];

    const mainStore = selectedStoreObj?.name || (selectedStoresList.length > 0 ? selectedStoresList.join(', ') : 'Store');

    const orderData = {
      id: Date.now().toString(),
      items: itemsToValidate.map(item => {
        const itemStoreName = item.storeType === STORE_TYPES.ROBOT ? 'Robot Store'
          : item.storeType === STORE_TYPES.CUSTOM ? item.customStore?.trim()
            : (item.selectedStore?.trim() || selectedStoreObj?.name || mainStore);
        return {
          id: item.id,
          text: item.text,
          category: item.category || 'General',
          store: itemStoreName,
          selectedStore: itemStoreName,
          isRobotStore: item.storeType === STORE_TYPES.ROBOT,
        };
      }),
      category: itemsToValidate[0]?.category || 'General',
      store: mainStore,
      pickup: mainStore,
      pickupAddress: selectedStoreObj?.address || null,
      place_id: selectedStoreObj?.place_id || null,
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
      DeviceEventEmitter.emit('cartUpdated');
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

      {/* ── Price Adjustment Bottom-Sheet Modal ── */}
      <PaymentAdjustmentModal
        visible={adjustmentModalVisible}
        order={adjustmentModalOrder}
        isSubmitting={adjustmentSubmitting}
        onApprove={handleApproveAdjustment}
        onDispute={handleDisputeAdjustment}
        onDismiss={() => setAdjustmentModalVisible(false)}
      />

      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>


        {/* ─── HERO ─── */}
        <Animated.View style={[styles.heroSection, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <ScrollView
            ref={heroScrollRef}
            horizontal
            pagingEnabled={false}
            showsHorizontalScrollIndicator={false}
            onScroll={handleHeroScroll}
            onMomentumScrollEnd={handleHeroScrollEnd}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={HERO_SNAP_INTERVAL}
            snapToAlignment="start"
            contentContainerStyle={styles.heroScrollContent}
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
          <View style={styles.categoriesHeaderRow}>
            <Text style={styles.categoriesTitle}>Categories</Text>
            {selectedCategoryId && (
              <TouchableOpacity onPress={() => setSelectedCategoryId(null)} activeOpacity={0.7}>
                <Text style={styles.clearCategoryText}>Clear Selection</Text>
              </TouchableOpacity>
            )}
          </View>
          {categoriesLoading ? (
            <View style={styles.storesLoadingContainer}>
              <ActivityIndicator size="small" color="#2EC4B6" />
              <Text style={styles.storesLoadingText}>Loading live categories...</Text>
            </View>
          ) : categories.length === 0 ? (
            <View style={styles.emptyStoresContainer}>
              <Text style={styles.emptyStoresSubtext}>No categories found in database</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesScrollContent}
            >
              {categories.map((category) => {
                const category_id = category.id || category._id || category.name;
                const isSelected = selectedCategoryId === category_id;

                return (
                  <TouchableOpacity
                    key={category_id}
                    style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                    onPress={() => setSelectedCategoryId(isSelected ? null : category_id)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.categoryIconContainer, isSelected && styles.categoryIconContainerSelected]}>
                      {renderCategoryIcon(category)}
                    </View>
                    <Text style={[styles.categoryNameText, isSelected && styles.categoryNameTextSelected]} numberOfLines={1}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
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
                        <View style={[styles.statusBadge, {
                          backgroundColor: getOrderStatusColor(order.status)
                        }]}>
                          <Text style={styles.statusText}>
                            {getOrderStatusLabel(order.status)}
                          </Text>
                        </View>

                      </View>
                      <Text style={styles.currentOrderDate}>
                        {new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    {(order.riderName || order.rider?.name) && (
                      <View style={styles.riderInfoContainer}>
                        <Ionicons name="person-circle-outline" size={18} color="#2EC4B6" />
                        <Text style={styles.riderName} numberOfLines={1} ellipsizeMode="tail">
                          Rider: {order.riderName || order.rider?.name}
                          {(order.riderPhone || order.rider?.phone) && (
                            <Text style={styles.riderPhone}> ({order.riderPhone || order.rider?.phone})</Text>
                          )}
                        </Text>
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
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <Text style={styles.orderItemText}>{item.text}</Text>
                            <View style={styles.itemCategoryBadge}>
                              <Text style={styles.itemCategoryBadgeText}>
                                {formatCategoryBadge(item.category, categories)}
                              </Text>



                            </View>
                          </View>
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
                            backgroundColor: getOrderStatusColor(order.status),
                          }]}>
                            <Text style={styles.statusText}>{getOrderStatusLabel(order.status)}</Text>
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
              <View>
                <Text style={styles.modalTitle}>Choose Store in {selectedArea}</Text>
                <Text style={styles.modalCategorySub}>
                  Category: {currentPickerCategory}
                </Text>
              </View>
              <TouchableOpacity onPress={closeStorePicker}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search-outline" size={20} color="#999" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder={`Search ${currentPickerCategory} stores...`}
                value={storeSearch}
                onChangeText={setStoreSearch}
                placeholderTextColor="#999"
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>

            {loadingGoogleStores && (
              <View style={styles.googleLoadingBanner}>
                <ActivityIndicator size="small" color="#2EC4B6" style={{ marginRight: 8 }} />
                <Text style={styles.googleLoadingText}>
                  Fetching nearby {currentPickerCategory} stores via Google Maps API...
                </Text>
              </View>
            )}

            <FlatList
              data={combinedStoreList}
              keyExtractor={(item) => item.place_id || item.placeId || item.id || item._id}
              renderItem={({ item }) => {
                const storeName = typeof item === 'string' ? item : item.name;
                const isGoogle = typeof item !== 'string' && item.isGoogleStore;
                const isBackend = typeof item !== 'string' && item.isBackendStore;
                const storeAddress = (typeof item !== 'string' && item.address) ? item.address : `${selectedArea || 'Islamabad'}`;
                const rating = typeof item !== 'string' ? item.rating : null;
                const logoUrl = getBrandLogo(storeName);
                return (
                  <TouchableOpacity style={styles.modalItem} onPress={() => pickFeedStore(storeName)}>
                    {logoUrl ? (
                      <Image
                        source={{ uri: logoUrl }}
                        style={{ width: 24, height: 24, marginRight: 10, borderRadius: 12, resizeMode: 'contain' }}
                      />
                    ) : isGoogle ? (
                      <Ionicons name="location" size={20} color="#EA4335" style={{ marginRight: 10 }} />
                    ) : (
                      <Ionicons name="storefront-outline" size={18} color="#2EC4B6" style={{ marginRight: 10 }} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalItemText}>{storeName}</Text>
                      <Text style={{ fontSize: 11, color: '#666', marginTop: 2 }} numberOfLines={1}>
                        📍 {storeAddress} {rating ? ` • ⭐ ${rating}` : ''}
                      </Text>
                    </View>
                    {isGoogle ? (
                      <View style={styles.googleBadge}>
                        <Text style={styles.googleBadgeText}>Google Maps</Text>
                      </View>
                    ) : isBackend ? (
                      <View style={[styles.googleBadge, { backgroundColor: '#E6F9F7' }]}>
                        <Text style={[styles.googleBadgeText, { color: '#00796B' }]}>Registered</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyModalText}>
                  No {currentPickerCategory} stores found for "{storeSearch}" in {selectedArea}
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
  scrollContent: { paddingHorizontal: 0, paddingTop: 16, paddingBottom: SPACING.lg },

  // ─── HERO ────────────────────────────────────────────────────────────────
  heroSection: { marginTop: 8, marginBottom: 6 },
  heroScrollContent: { paddingHorizontal: 16 },

  heroCardWrapper: { width: HERO_CARD_WIDTH, marginRight: HERO_CARD_GAP },
  heroCard: { paddingTop: 16, paddingBottom: 16, paddingHorizontal: 16, minHeight: 200, overflow: 'hidden', borderRadius: 24 },
  heroBgCircleLarge: { position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)' },
  heroBgCircleMedium: { position: 'absolute', top: 10, right: 20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.06)' },
  heroBgCircleSmall: { position: 'absolute', bottom: 30, left: -20, width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.05)' },
  heroTopSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  heroImageOuter: { width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  heroImageInner: { width: 56, height: 56, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroBrandImage: { width: 50, height: 50, borderRadius: 10 },
  heroImageEmoji: { fontSize: 30 },

  heroTextContainer: { flex: 1 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 8 },
  heroStatItem: { flex: 1, alignItems: 'center', gap: 2 },
  heroStatDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.25)' },
  heroStatValue: { fontSize: 12, color: '#fff', fontWeight: '700', marginTop: 1 },
  heroStatLabel: { fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  heroOrderButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 50, paddingVertical: 8, paddingLeft: 18, paddingRight: 6, alignSelf: 'center', width: '58%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  heroOrderButtonText: { fontSize: 14, fontWeight: '700', color: '#1FA99D' },
  heroOrderButtonArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2EC4B6', alignItems: 'center', justifyContent: 'center' },

  paginationContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8, gap: 5 },
  paginationDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C5EAE8' },
  paginationDotActive: { backgroundColor: '#2EC4B6', width: 16, borderRadius: 3 },

  // ─── CATEGORIES ──────────────────────────────────────────────────────────
  categoriesSection: { marginTop: 12, paddingHorizontal: 16 },
  categoriesHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  categoriesTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  clearCategoryText: { fontSize: 12, color: '#EF4444', fontWeight: '600' },
  categoriesScrollContent: { paddingRight: 16, paddingTop: 10, paddingBottom: 10, gap: 14 },
  categoryCard: { alignItems: 'center', width: 76 },
  categoryCardSelected: { transform: [{ scale: 1.06 }] },
  categoryIconContainer: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2EC4B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: '#E6F9F7',
    overflow: 'hidden',
    padding: 3,
  },
  categoryIconContainerSelected: {
    borderColor: '#2EC4B6',
    borderWidth: 2.5,
    shadowColor: '#2EC4B6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    backgroundColor: '#E6F9F7',
  },
  category3DImage: { width: 54, height: 54, borderRadius: 16 },
  categoryDynamicIcon: { width: 42, height: 42, borderRadius: 10 },
  categoryEmoji: { fontSize: 34, lineHeight: 42, textAlign: 'center' },

  categoryNameText: { fontSize: 12, fontWeight: '600', color: '#4A5568', marginTop: 6, textAlign: 'center' },
  categoryNameTextSelected: { color: '#2EC4B6', fontWeight: '800' },



  modalCategorySub: { fontSize: 12, color: '#2EC4B6', fontWeight: '600', marginTop: 2 },
  googleLoadingBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#E6F9F7', borderRadius: 8, marginBottom: 8 },
  googleLoadingText: { fontSize: 12, color: '#00796B', fontWeight: '500' },
  googleBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, marginLeft: 6 },
  googleBadgeText: { fontSize: 10, color: '#DC2626', fontWeight: '700' },
  itemCategoryBadge: { backgroundColor: '#E6F9F7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: '#2EC4B6' },
  itemCategoryBadgeText: { fontSize: 11, color: '#00796B', fontWeight: '700' },

  // ─── NEARBY STORES SECTION ───────────────────────────────────────────────
  nearbyStoresSection: { marginTop: 10, marginBottom: 4, paddingHorizontal: 16 },
  nearbyStoresHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  nearbyStoresSectionTitle: { fontSize: 17, fontWeight: '700', color: '#1A202C', marginLeft: 6 },
  nearbyCountBadge: { backgroundColor: '#2EC4B620', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  nearbyCountBadgeText: { fontSize: 12, color: '#2EC4B6', fontWeight: '700' },
  nearbyLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 4 },
  nearbyLoadingText: { fontSize: 13, color: '#2EC4B6', fontWeight: '500' },
  nearbyStoresScrollContent: { paddingRight: 16, paddingBottom: 4, gap: 12 },
  nearbyStoreCard: {
    width: 148,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#2EC4B6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#EBF8F7',
  },
  nearbyStoreIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  nearbyStoreIconCircle: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center' },
  nearbyStoreLogo: { width: 38, height: 38, borderRadius: 12 },
  nearbyGooglePill: { backgroundColor: '#FEE2E2', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  nearbyGooglePillText: { fontSize: 9, color: '#DC2626', fontWeight: '700' },
  nearbyStoreName: { fontSize: 13, fontWeight: '700', color: '#1A202C', lineHeight: 17, marginBottom: 4 },
  nearbyStoreAddress: { fontSize: 10, color: '#718096', lineHeight: 14, marginBottom: 4 },
  nearbyStoreRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  nearbyStoreRating: { fontSize: 11, color: '#F59E0B', fontWeight: '700' },
  emptyStoresText: { fontSize: 14, color: '#999', fontWeight: '600', marginTop: 8 },


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
  recentOrdersSection: { marginTop: SPACING.lg, paddingBottom: SPACING.xl + 110, marginBottom: SPACING.sm },
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
  riderName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#333', marginLeft: SPACING.xs },
  riderPhone: { fontSize: 13, color: '#666', fontWeight: 'normal' },
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

  // ─── STORES FOR SELECTED CATEGORY ─────────────────────────────────────────
  categoryStoresSection: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryStoresHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  categoryStoresTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginLeft: 6,
  },
  storesLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: 8,
  },
  storesLoadingText: {
    fontSize: 14,
    color: '#666',
  },
  emptyStoresContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  emptyStoresTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  emptyStoresSubtext: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
  categoryStoresScrollContent: {
    paddingVertical: 4,
    gap: 12,
  },
  categoryStoreCard: {
    width: 160,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryStoreIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E6FFFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryStoreInfo: {
    flex: 1,
  },
  categoryStoreName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  categoryStoreAddress: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 4,
  },
  categoryStoreRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  categoryStoreRatingText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
  },
});

export default DashboardScreen;