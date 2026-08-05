/**
 * KeywordCacheService.js  –  RobotInn Customer Mobile App
 *
 * Maintains a local memory & AsyncStorage cache of Category Keywords & Aliases.
 * Subscribes to real-time Firestore updates on CategoryKeywords and categories collections.
 * Ensures instant, offline-capable category detection.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import FirestoreRepository from './FirestoreRepository';

const ASYNC_KEYWORD_CACHE = '@robotinn_category_keywords_v2';

// Rich fallback category keyword definitions to guarantee out-of-the-box offline support
const DEFAULT_CATEGORY_KEYWORDS = [
  {
    categoryId: 'food',
    categoryName: 'Food',
    categoryIcon: 'restaurant-outline',
    keywords: [
      'burger', 'burgers', 'pizza', 'pizzas', 'fries', 'french fries', 'hot dog', 'sandwich', 'sandwiches',
      'biryani', 'karahi', 'nihari', 'tikka', 'kabab', 'kebab', 'shawarma', 'roll', 'paratha',
      'zinger', 'broast', 'chowmein', 'pasta', 'fried chicken', 'nuggets', 'fast food',
      'food', 'meal', 'lunch', 'dinner', 'breakfast', 'snack', 'restaurant', 'mcdonalds', 'kfc'
    ],
    aliases: ['fast food', 'food', 'restaurant', 'cafe']
  },
  {
    categoryId: 'stationery',
    categoryName: 'Stationery',
    categoryIcon: 'pencil-outline',
    keywords: [
      'pen', 'pens', 'pencil', 'pencils', 'paper', 'notebook', 'notebooks', 'copy', 'copies',
      'register', 'marker', 'markers', 'eraser', 'sharpener', 'scale', 'ruler', 'stapler',
      'staples', 'file', 'folder', 'ink', 'ballpoint', 'pointer', 'book', 'books', 'calculator',
      'tape', 'glue', 'sticky note', 'envelope', 'stationery', 'journal', 'diary', 'highlighter',
      'geometry', 'page', 'pages', 'chart', 'board', 'gel pen', 'blue pen', 'black pen'
    ],
    aliases: ['register', 'copy', 'stationary']
  },
  {
    categoryId: 'dairy',
    categoryName: 'Dairy',
    categoryIcon: 'water-outline',
    keywords: [
      'milk', 'cheese', 'butter', 'yogurt', 'curd', 'dahi', 'cream', 'makhan', 'paneer',
      'condensed milk', 'margarine', 'skimmed milk', 'full cream milk', 'dairy', 'olpers', 'nestle milkpak', 'milkmang'
    ],
    aliases: ['dairy', 'milkman']
  },
  {
    categoryId: 'meat',
    categoryName: 'Meat',
    categoryIcon: 'restaurant-outline',
    keywords: [
      'chicken', 'mutton', 'beef', 'lamb', 'goat', 'keema', 'qima', 'mince', 'steak',
      'wings', 'boneless', 'chops', 'kabab', 'meat', 'butcher', 'fresh mutton boneless', 'mutton leg'
    ],
    aliases: ['chicken', 'beef', 'mutton']
  },
  {
    categoryId: 'seafood',
    categoryName: 'Seafood',
    categoryIcon: 'fish-outline',
    keywords: [
      'fish', 'prawn', 'prawns', 'shrimp', 'shrimps', 'salmon', 'tuna', 'crab', 'lobster',
      'pomfret', 'finger fish', 'seafood'
    ],
    aliases: ['fish', 'seafood']
  },
  {
    categoryId: 'fruits',
    categoryName: 'Fruits',
    categoryIcon: 'nutrition-outline',
    keywords: [
      'apple', 'apples', 'banana', 'bananas', 'orange', 'oranges', 'mango', 'mangoes',
      'grapes', 'grape', 'kiwi', 'pineapple', 'watermelon', 'melon', 'strawberry',
      'peach', 'plum', 'guava', 'pomegranate', 'fruit', 'fruits'
    ],
    aliases: ['fresh fruit']
  },
  {
    categoryId: 'vegetables',
    categoryName: 'Vegetables',
    categoryIcon: 'leaf-outline',
    keywords: [
      'tomato', 'tomatoes', 'potato', 'potatoes', 'onion', 'onions', 'ginger', 'garlic',
      'cucumber', 'gobi', 'cauliflower', 'cabbage', 'palak', 'spinach', 'bhindi', 'okra',
      'kera', 'aloo', 'pyaz', 'coriander', 'mint', 'lemon', 'vegetable', 'vegetables', 'sabzi'
    ],
    aliases: ['vegetable', 'sabzi']
  },
  {
    categoryId: 'grocery',
    categoryName: 'Grocery',
    categoryIcon: 'cart-outline',
    keywords: [
      'rice', 'flour', 'atta', 'sugar', 'salt', 'oil', 'ghee', 'tea', 'patti', 'pulses',
      'daal', 'dal', 'chana', 'spices', 'masala', 'groceries', 'supermarket', 'maggi', 'noodle',
      'noodles', 'pasta', 'ketchup', 'mayonnaise', 'vinegar', 'sauce', 'grocery'
    ],
    aliases: ['maggi', 'ration', 'grocery']
  },
  {
    categoryId: 'soft_drinks',
    categoryName: 'Soft Drinks',
    categoryIcon: 'beaker-outline',
    keywords: [
      'coke', 'cocacola', 'coca-cola', 'pepsi', '7up', 'sprite', 'sting', 'redbull',
      'red bull', 'dew', 'mountain dew', 'fanta', 'mirinda', 'pakola', 'soda', 'cold drink',
      'beverage', 'drink', 'drinks'
    ],
    aliases: ['coke', 'pepsi', 'soft drink']
  },
  {
    categoryId: 'bakery',
    categoryName: 'Bakery',
    categoryIcon: 'fast-food-outline',
    keywords: [
      'bread', 'cake', 'cakes', 'biscuit', 'biscuits', 'bun', 'buns', 'pastry', 'pastries',
      'naan', 'roti', 'rusk', 'rusks', 'donut', 'donuts', 'patties', 'samosa', 'roll', 'bakery'
    ],
    aliases: ['cake', 'bakers']
  },
  {
    categoryId: 'electronics',
    categoryName: 'Electronics',
    categoryIcon: 'laptop-outline',
    keywords: [
      'laptop', 'laptops', 'mobile', 'mobiles', 'charger', 'mobile charger', 'mouse',
      'keyboard', 'speaker', 'headphone', 'headphones', 'earbuds', 'cable', 'usb',
      'adapter', 'power bank', 'electronics', 'gadget'
    ],
    aliases: ['tech', 'electronics']
  },
  {
    categoryId: 'pharmacy',
    categoryName: 'Pharmacy',
    categoryIcon: 'medkit-outline',
    keywords: [
      'medicine', 'medicines', 'tablet', 'tablets', 'capsule', 'capsules', 'bandage', 'bandaid',
      'syrup', 'syrups', 'dettol', 'disprin', 'panadol', 'brufen', 'paracetamol', 'aspirin',
      'vitamin', 'vitamins', 'medical', 'pharmacy', 'thermometer', 'pills', 'injection'
    ],
    aliases: ['dettol', 'medicine', 'pharma']
  },
  {
    categoryId: 'cosmetics',
    categoryName: 'Cosmetics',
    categoryIcon: 'sparkles-outline',
    keywords: [
      'soap', 'soaps', 'shampoo', 'cream', 'creams', 'face wash', 'facewash', 'perfume',
      'fragrance', 'lux', 'lux soap', 'lotion', 'lipstick', 'makeup', 'foundation', 'mascara',
      'skincare', 'beauty', 'nivea', 'ponds', 'garnier', 'vaseline', 'cosmetics'
    ],
    aliases: ['lux soap', 'cosmetics', 'makeup']
  },
  {
    categoryId: 'pet_supplies',
    categoryName: 'Pet Supplies',
    categoryIcon: 'paw-outline',
    keywords: [
      'dog food', 'cat food', 'pet food', 'pet shampoo', 'dog', 'cat', 'pet', 'litter',
      'pet supplies', 'whiskas', 'pedigree'
    ],
    aliases: ['pet food', 'cat food']
  }
];

class KeywordCacheService {
  constructor() {
    this.memoryCache = DEFAULT_CATEGORY_KEYWORDS;
    this.isInitialized = false;
    this.unsubscribeKeywords = null;
    this.unsubscribeCategories = null;
  }

  /**
   * Initialize cache from AsyncStorage and start Firestore snapshot listener
   */
  async init() {
    if (this.isInitialized) return;

    try {
      // Step 1: Load offline cache from AsyncStorage
      const cachedData = await AsyncStorage.getItem(ASYNC_KEYWORD_CACHE);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.memoryCache = this.mergeWithDefaults(parsed);
        }
      }
    } catch (err) {
      console.warn('Error loading keyword cache from AsyncStorage:', err);
    }

    // Step 2: Subscribe to real-time updates from Firestore
    this.startFirestoreListeners();
    this.isInitialized = true;
  }

  /**
   * Start FirestoreListeners for CategoryKeywords and categories collections
   */
  startFirestoreListeners() {
    this.unsubscribeKeywords = FirestoreRepository.subscribeCategoryKeywords(
      (firestoreKeywords) => {
        if (Array.isArray(firestoreKeywords) && firestoreKeywords.length > 0) {
          this.updateCache(firestoreKeywords);
        }
      }
    );

    this.unsubscribeCategories = FirestoreRepository.subscribeCategories(
      (categories) => {
        if (Array.isArray(categories) && categories.length > 0) {
          this.updateCategoriesInfo(categories);
        }
      }
    );
  }

  /**
   * Update cache with new data from Firestore and save to AsyncStorage
   */
  async updateCache(firestoreList) {
    try {
      const merged = this.mergeWithDefaults(firestoreList);
      this.memoryCache = merged;
      await AsyncStorage.setItem(ASYNC_KEYWORD_CACHE, JSON.stringify(merged));
    } catch (err) {
      console.warn('Error saving updated keyword cache to AsyncStorage:', err);
    }
  }

  /**
   * Update categories metadata (name, icon) from categories collection
   */
  updateCategoriesInfo(categories) {
    let changed = false;
    const cacheCopy = [...this.memoryCache];

    categories.forEach((cat) => {
      const catId = String(cat.categoryId || cat.id || '').toLowerCase();
      const existingIdx = cacheCopy.findIndex(c => String(c.categoryId).toLowerCase() === catId);
      if (existingIdx !== -1) {
        cacheCopy[existingIdx] = {
          ...cacheCopy[existingIdx],
          categoryName: cat.name || cat.categoryName || cacheCopy[existingIdx].categoryName,
          categoryIcon: cat.icon || cat.categoryIcon || cacheCopy[existingIdx].categoryIcon,
          keywords: Array.from(new Set([
            ...(cacheCopy[existingIdx].keywords || []),
            ...(Array.isArray(cat.keywords) ? cat.keywords : [])
          ]))
        };
        changed = true;
      } else if (catId) {
        cacheCopy.push({
          categoryId: catId,
          categoryName: cat.name || cat.categoryName || catId,
          categoryIcon: cat.icon || cat.categoryIcon || 'grid-outline',
          keywords: Array.isArray(cat.keywords) ? cat.keywords : [catId],
          aliases: Array.isArray(cat.aliases) ? cat.aliases : []
        });
        changed = true;
      }
    });

    if (changed) {
      this.memoryCache = cacheCopy;
      AsyncStorage.setItem(ASYNC_KEYWORD_CACHE, JSON.stringify(cacheCopy)).catch(() => {});
    }
  }

  /**
   * Ensure default categories are preserved if missing from Firestore
   */
  mergeWithDefaults(customList) {
    const map = new Map();

    // Fill defaults first
    DEFAULT_CATEGORY_KEYWORDS.forEach((item) => {
      map.set(item.categoryId.toLowerCase(), { ...item });
    });

    // Override with custom Firestore documents
    customList.forEach((item) => {
      const catId = String(item.categoryId || item.id || '').toLowerCase();
      if (!catId) return;

      const existing = map.get(catId) || {};
      const keywords = Array.from(
        new Set([
          ...(existing.keywords || []),
          ...(Array.isArray(item.keywords) ? item.keywords : []),
        ])
      );
      const aliases = Array.from(
        new Set([
          ...(existing.aliases || []),
          ...(Array.isArray(item.aliases) ? item.aliases : []),
        ])
      );

      map.set(catId, {
        categoryId: catId,
        categoryName: item.categoryName || item.name || existing.categoryName || catId,
        categoryIcon: item.categoryIcon || item.icon || existing.categoryIcon || 'grid-outline',
        keywords,
        aliases,
      });
    });

    return Array.from(map.values());
  }

  /**
   * Get synchronous array of category keyword definitions
   */
  getKeywordList() {
    return this.memoryCache;
  }
}

const service = new KeywordCacheService();
service.init().catch(() => {});

export default service;
