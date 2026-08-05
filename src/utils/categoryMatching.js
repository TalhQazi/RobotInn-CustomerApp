/**
 * categoryMatching.js – Robust Category matching & filtering helper for RobotInn Customer App
 */

export const doesStoreMatchCategory = (store, targetCategory) => {
  if (!targetCategory) return true;
  const targetRaw = String(targetCategory).toLowerCase().trim();
  if (!targetRaw || targetRaw === 'all' || targetRaw === 'other' || targetRaw === 'general') return true;

  // Admin-curated stores are always shown — admin placed them there intentionally
  if (typeof store === 'object' && store !== null && store.isAdminStore === true) return true;

  // Stores with no type/category field should never be filtered out silently
  if (typeof store === 'object' && store !== null) {
    const hasType = store.type || store.category || store.categoryName || store.categoryId || store.supportedCategories;
    if (!hasType) return true;
  }

  const storeName = (typeof store === 'string' ? store : store?.name || '').toLowerCase().trim();
  const storeType = (typeof store === 'object' ? String(store?.type || store?.category || store?.categoryName || store?.categoryId || '').toLowerCase().trim() : '');
  const supported = (typeof store === 'object' && Array.isArray(store?.supportedCategories))
    ? store.supportedCategories.map(c => String(c).toLowerCase())
    : [];

  // Determine canonical category key for targetCategory
  let targetCatKey = '';
  if (targetRaw.includes('pharma') || targetRaw.includes('health') || targetRaw.includes('medical') || targetRaw.includes('chemist') || targetRaw.includes('medicine')) {
    targetCatKey = 'pharmacy';
  } else if (targetRaw.includes('food') || targetRaw.includes('restaurant') || targetRaw.includes('fast') || targetRaw.includes('diner') || targetRaw.includes('cafe')) {
    targetCatKey = 'food';
  } else if (targetRaw.includes('grocer') || targetRaw.includes('mart') || targetRaw.includes('supermarket')) {
    targetCatKey = 'grocery';
  } else if (targetRaw.includes('baker') || targetRaw.includes('cake') || targetRaw.includes('bread') || targetRaw.includes('sweet')) {
    targetCatKey = 'bakery';
  } else if (targetRaw.includes('meat') || targetRaw.includes('chicken') || targetRaw.includes('butcher')) {
    targetCatKey = 'meat';
  } else if (targetRaw.includes('cosmetic') || targetRaw.includes('beauty') || targetRaw.includes('makeup') || targetRaw.includes('skin')) {
    targetCatKey = 'cosmetics';
  } else if (targetRaw.includes('stationery') || targetRaw.includes('book') || targetRaw.includes('paper')) {
    targetCatKey = 'stationery';
  } else if (targetRaw.includes('electronic') || targetRaw.includes('mobile') || targetRaw.includes('tech') || targetRaw.includes('computer')) {
    targetCatKey = 'electronics';
  } else if (targetRaw.includes('pet')) {
    targetCatKey = 'pet_supplies';
  } else if (targetRaw.includes('dairy') || targetRaw.includes('milk')) {
    targetCatKey = 'dairy';
  } else if (targetRaw.includes('fruit')) {
    targetCatKey = 'fruits';
  } else if (targetRaw.includes('veg') || targetRaw.includes('sabzi')) {
    targetCatKey = 'vegetables';
  } else if (targetRaw.includes('drink') || targetRaw.includes('soda') || targetRaw.includes('beverage')) {
    targetCatKey = 'soft_drinks';
  }

  // Check supportedCategories array if specified on store
  if (supported.length > 0) {
    if (targetCatKey && supported.some(s => s.includes(targetCatKey) || targetCatKey.includes(s))) return true;
    if (supported.some(s => s.includes(targetRaw) || targetRaw.includes(s))) return true;
  }

  // Check storeType / category string on store
  if (storeType) {
    if (targetCatKey && (storeType.includes(targetCatKey) || targetCatKey.includes(storeType))) return true;
    if (storeType.includes(targetRaw) || targetRaw.includes(storeType)) return true;
  }

  // Keyword check on storeName
  const KEYWORDS_BY_CAT = {
    pharmacy: ['chemist', 'pharmacy', 'medical', 'medicos', 'pharma', 'dr.', 'd.watson', 'watson', 'shaheen', 'servaid', 'shifa', 'health', 'disprin', 'panadol', 'brufen', 'medicine', 'metro pharmacy', 'city pharmacy'],
    food: ['burger', 'pizza', 'kfc', 'mcdonald', 'subway', 'dunkin', 'cafe', 'restaurant', 'bakers', 'foods', 'grill', 'bbq', 'tikka', 'karahi', 'diner', 'eatery', 'fast food', 'cheezious', 'howdy', 'savour', 'tehzeeb', 'baskin'],
    grocery: ['mart', 'supermarket', 'store', 'cash & carry', 'cash and carry', 'savemart', 'imtiaz', 'greenvalley', 'punjab cash', 'grocery', 'general store', 'carrefour', 'al-fatah'],
    bakery: ['bakery', 'bakers', 'sweets', 'confectionery', 'patisserie', 'tehzeeb', 'rahat', 'layered', 'kitchen cuisine', 'gourmet'],
    meat: ['meat', 'butcher', 'poultry', 'chicken', 'meat one', 'kausar'],
    cosmetics: ['cosmetics', 'beauty', 'scentsation', 'saeed ghani', 'makeup', 'nivea', 'skincare', 'glamour'],
    stationery: ['book', 'stationery', 'paper', 'books', 'saeed book', 'london book', 'copy'],
    electronics: ['electronic', 'electronics', 'mobile', 'samsung', 'apple', 'mi', 'computer', 'tech', 'gadget'],
    pet_supplies: ['pet', 'vet', 'animal', 'dog', 'cat', 'litter'],
    dairy: ['dairy', 'milk', 'dahi', 'yogurt', 'butter', 'cheese', 'creamer'],
    fruits: ['fruit', 'fruits', 'apple', 'banana', 'mango', 'orange', 'fruit shop'],
    vegetables: ['vegetable', 'vegetables', 'veggie', 'sabzi', 'sabzi mandi', 'potato', 'onion', 'tomato'],
    soft_drinks: ['drink', 'drinks', 'beverage', 'coke', 'pepsi', 'sprite', '7up', 'sting', 'redbull', 'soda'],
  };

  const keyList = targetCatKey ? (KEYWORDS_BY_CAT[targetCatKey] || []) : [];
  if (keyList.some(k => storeName.includes(k))) return true;

  // Fallback: if no storeType or store is a plain string, check substring match with targetRaw
  if (!storeType || storeType === 'store' || storeType === 'general') {
    // If storeName is empty (e.g., plain object with no name), include it
    if (!storeName) return true;
    return storeName.includes(targetRaw) || targetRaw.includes(storeName);
  }

  return false;
};
