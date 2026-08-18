/**
 * categoryMatching.js – Robust Category matching & filtering helper for RobotInn Customer App
 */

export const doesStoreMatchCategory = (store, targetCategory) => {
  if (!targetCategory) return true;
  const cleanTarget = String(targetCategory || '')
    .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '')
    .trim();
  const targetRaw = cleanTarget.toLowerCase();
  if (!targetRaw || targetRaw === 'all' || targetRaw === 'other' || targetRaw === 'general') return true;

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
    pharmacy: ['chemist', 'pharmacy', 'medical', 'medicos', 'pharma', 'dr.', 'd.watson', 'watson', 'shaheen', 'servaid', 'shifa', 'health', 'disprin', 'panadol', 'brufen', 'medicine', 'medicines', 'clinic', 'hospital', 'drug', 'drugs', 'care', 'surgical', 'metro pharmacy', 'city pharmacy'],
    food: ['food', 'foods', 'restaurant', 'fast food', 'biryani', 'karahi', 'tikka', 'bbq', 'nihari', 'pulao', 'roll', 'shawarma', 'grill', 'eatery', 'diner', 'cafe', 'coffee', 'tea', 'burger', 'pizza', 'kfc', 'mcdonald', 'subway', 'dunkin', 'cheezious', 'howdy', 'savour', 'kabab', 'kebab', 'haleem', 'fish', 'broast', 'snack', 'paratha', 'chai', 'dhaba', 'kitchen', 'hotel', 'baskin', 'tehzeeb'],
    grocery: ['mart', 'supermarket', 'store', 'cash & carry', 'cash and carry', 'savemart', 'imtiaz', 'greenvalley', 'punjab cash', 'grocery', 'general store', 'carrefour', 'al-fatah', 'karyana', 'provision', 'bazaar', 'super store', 'mini mart', 'wholesale', 'retail'],
    bakery: ['bakery', 'bakers', 'sweets', 'confectionery', 'patisserie', 'tehzeeb', 'rahat', 'layered', 'kitchen cuisine', 'gourmet', 'bread', 'cake', 'cakes', 'pastry', 'nimco', 'sweet', 'mithai', 'halwa'],
    meat: ['meat', 'butcher', 'poultry', 'chicken', 'meat one', 'kausar', 'mutton', 'beef', 'fish', 'prawn', 'al-makkah meat', 'al madina meat', 'gosht'],
    cosmetics: ['cosmetics', 'beauty', 'scentsation', 'saeed ghani', 'makeup', 'nivea', 'skincare', 'glamour', 'perfume', 'fragrance', 'salon'],
    stationery: ['book', 'stationery', 'paper', 'books', 'saeed book', 'london book', 'copy', 'book store', 'photocopy', 'pen'],
    electronics: ['electronic', 'electronics', 'mobile', 'samsung', 'apple', 'mi', 'computer', 'tech', 'gadget', 'cellular', 'telecom'],
    pet_supplies: ['pet', 'vet', 'animal', 'dog', 'cat', 'litter', 'birds', 'aquarium'],
    dairy: ['dairy', 'milk', 'dahi', 'yogurt', 'butter', 'cheese', 'creamer', 'milk shop', 'fresh milk'],
    fruits: ['fruit', 'fruits', 'apple', 'banana', 'mango', 'orange', 'fruit shop', 'fresh fruits'],
    vegetables: ['vegetable', 'vegetables', 'veggie', 'sabzi', 'sabzi mandi', 'potato', 'onion', 'tomato', 'fresh veg'],
    soft_drinks: ['drink', 'drinks', 'beverage', 'coke', 'pepsi', 'sprite', '7up', 'sting', 'redbull', 'soda', 'juice', 'shake'],
  };

  const keyList = targetCatKey ? (KEYWORDS_BY_CAT[targetCatKey] || []) : [];
  if (keyList.some(k => storeName.includes(k))) return true;

  // Fallback: if store was specifically fetched for this category
  if (store?.isGoogleStore || store?.isRealtime || store?.isBackendStore) {
    if (!storeType || storeType === 'store' || storeType === 'general' || storeType.includes(targetCatKey) || targetCatKey.includes(storeType)) {
      return true;
    }
  }

  // Fallback: if no storeType or store is a plain string, check substring match with targetRaw
  if (!storeType || storeType === 'store' || storeType === 'general') {
    if (!storeName) return true;
    return storeName.includes(targetRaw) || targetRaw.includes(storeName);
  }

  return false;
};
