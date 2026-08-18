import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_GEOCODE_URL } from './constants';

const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const STATIC_MAP_URL = 'https://maps.googleapis.com/maps/api/staticmap';

const geocodeCache = new Map();

export function normalizeRiderLocation(location) {
  if (!location) {
    return null;
  }

  const latitude = location.latitude ?? location.lat;
  const longitude = location.longitude ?? location.lng;

  if (latitude == null || longitude == null) {
    return null;
  }

  return {
    latitude: Number(latitude),
    longitude: Number(longitude),
    updatedAt: location.updatedAt || null,
  };
}

export async function geocodeAddress(address, area) {
  if (!address || address === '—') {
    return null;
  }

  const key = `${String(address).trim().toLowerCase()}|${String(area || '').trim().toLowerCase()}`;
  if (geocodeCache.has(key)) {
    return geocodeCache.get(key);
  }

  const cleanAddress = String(address).trim();
  const cleanArea = area ? String(area).trim() : '';

  // Build query variants to try
  const queries = [];
  if (cleanArea && !cleanAddress.toLowerCase().includes(cleanArea.toLowerCase())) {
    queries.push(`${cleanAddress}, ${cleanArea}, Pakistan`);
  }
  queries.push(`${cleanAddress}, Pakistan`);
  if (cleanArea) queries.push(`${cleanArea}, Pakistan`);

  for (const queryText of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryText)}&format=json&limit=1&countrycodes=pk`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'RobotInn-CustomerApp/1.0' },
      });
      const json = await response.json();
      if (Array.isArray(json) && json.length > 0) {
        const coords = { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
        geocodeCache.set(key, coords);
        return coords;
      }
    } catch (error) {
      console.warn('geocodeAddress error:', error?.message);
    }
  }

  return null;
}

export async function getDrivingDistance(origin, destination) {
  if (!origin?.lat || !destination?.lat) {
    return null;
  }

  try {
    const origins = `${origin.lat},${origin.lng}`;
    const destinations = `${destination.lat},${destination.lng}`;
    const url = `${DISTANCE_MATRIX_URL}?origins=${origins}&destinations=${destinations}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const json = await response.json();
    const element = json?.rows?.[0]?.elements?.[0];

    if (element?.status === 'OK') {
      return {
        distanceText: element.distance?.text || '',
        durationText: element.duration?.text || '',
        distanceMeters: element.distance?.value || 0,
        durationSeconds: element.duration?.value || 0,
      };
    }
  } catch (error) {
    console.warn('getDrivingDistance error:', error);
  }

  return null;
}

const DEFAULT_MAP_REGION = {
  latitude: 33.6844,
  longitude: 73.0479,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export function buildStaticMapUrl({ rider, destination, width = 640, height = 280, cacheKey }) {
  if (!rider?.lat && !destination?.lat) {
    return null;
  }

  const parts = [
    `${STATIC_MAP_URL}?size=${width}x${height}`,
    'scale=2',
    'maptype=roadmap',
    `key=${GOOGLE_MAPS_API_KEY}`,
  ];

  if (rider?.lat && rider?.lng) {
    parts.push(`markers=color:0x2EC4B6|label:R|${rider.lat},${rider.lng}`);
  }

  if (destination?.lat && destination?.lng) {
    parts.push(`markers=color:red|label:D|${destination.lat},${destination.lng}`);
  }

  if (rider?.lat && destination?.lat) {
    parts.push(
      `path=color:0x2EC4B6ff|weight:4|${rider.lat},${rider.lng}|${destination.lat},${destination.lng}`
    );
    parts.push(`center=${(rider.lat + destination.lat) / 2},${(rider.lng + destination.lng) / 2}`);
    parts.push('zoom=13');
  } else if (rider?.lat) {
    parts.push(`center=${rider.lat},${rider.lng}`);
    parts.push('zoom=15');
  } else {
    parts.push(`center=${destination.lat},${destination.lng}`);
    parts.push('zoom=15');
  }

  if (cacheKey) {
    parts.push(`_t=${encodeURIComponent(String(cacheKey))}`);
  }

  return parts.join('&');
}

export function getMapRegion(rider, destination, useDefault = false) {
  if (rider?.lat && rider?.lng && destination?.lat && destination?.lng) {
    const minLat = Math.min(rider.lat, destination.lat);
    const maxLat = Math.max(rider.lat, destination.lat);
    const minLng = Math.min(rider.lng, destination.lng);
    const maxLng = Math.max(rider.lng, destination.lng);
    const latDelta = Math.max((maxLat - minLat) * 1.6, 0.015);
    const lngDelta = Math.max((maxLng - minLng) * 1.6, 0.015);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }

  if (rider?.lat && rider?.lng) {
    return {
      latitude: rider.lat,
      longitude: rider.lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }

  if (destination?.lat && destination?.lng) {
    return {
      latitude: destination.lat,
      longitude: destination.lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }

  return useDefault ? DEFAULT_MAP_REGION : null;
}

export { DEFAULT_MAP_REGION };

export function getGoogleMapsUrl({ rider, destination }) {
  if (rider?.lat && destination?.lat) {
    return `https://www.google.com/maps/dir/?api=1&origin=${rider.lat},${rider.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
  }
  if (rider?.lat) {
    return `https://www.google.com/maps?q=${rider.lat},${rider.lng}`;
  }
  if (destination?.lat) {
    return `https://www.google.com/maps?q=${destination.lat},${destination.lng}`;
  }
  return null;
}

export function formatEtaWindow(estimatedArrivalTime) {
  if (!estimatedArrivalTime) {
    return null;
  }
  const eta = new Date(estimatedArrivalTime);
  if (Number.isNaN(eta.getTime())) {
    return null;
  }
  return eta.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const AREA_COORDINATES = {
  // Islamabad Sectors & Commercial Hubs
  'F-5': { lat: 33.7380, lng: 73.0900 },
  'F-6': { lat: 33.7294, lng: 73.0747 },
  'F-7': { lat: 33.7215, lng: 73.0565 },
  'F-8': { lat: 33.7126, lng: 73.0378 },
  'F-9': { lat: 33.7000, lng: 73.0200 },
  'F-10': { lat: 33.6920, lng: 73.0134 },
  'F-11': { lat: 33.6844, lng: 72.9886 },
  'F-12': { lat: 33.6700, lng: 72.9600 },
  'G-5': { lat: 33.7250, lng: 73.0950 },
  'G-6': { lat: 33.7150, lng: 73.0800 },
  'G-7': { lat: 33.7050, lng: 73.0600 },
  'G-8': { lat: 33.6950, lng: 73.0400 },
  'G-9': { lat: 33.6880, lng: 73.0240 },
  'G-10': { lat: 33.6780, lng: 73.0040 },
  'G-11': { lat: 33.6680, lng: 72.9840 },
  'G-12': { lat: 33.6580, lng: 72.9640 },
  'G-13': { lat: 33.6480, lng: 72.9440 },
  'G-14': { lat: 33.6380, lng: 72.9240 },
  'G-15': { lat: 33.6280, lng: 72.9040 },
  'I-8': { lat: 33.6685, lng: 73.0750 },
  'I-9': { lat: 33.6550, lng: 73.0550 },
  'I-10': { lat: 33.6450, lng: 73.0350 },
  'I-11': { lat: 33.6350, lng: 73.0150 },
  'I-12': { lat: 33.6250, lng: 72.9950 },
  'I-14': { lat: 33.6050, lng: 72.9550 },
  'E-7': { lat: 33.7320, lng: 73.0520 },
  'E-8': { lat: 33.7220, lng: 73.0320 },
  'E-9': { lat: 33.7120, lng: 73.0120 },
  'E-11': { lat: 33.6980, lng: 72.9750 },
  'H-8': { lat: 33.6800, lng: 73.0650 },
  'H-9': { lat: 33.6700, lng: 73.0450 },
  'H-10': { lat: 33.6600, lng: 73.0250 },
  'H-11': { lat: 33.6500, lng: 73.0050 },
  'H-12': { lat: 33.6400, lng: 72.9850 },
  'Blue Area': { lat: 33.7120, lng: 73.0650 },
  'Centaurus': { lat: 33.7075, lng: 73.0515 },
  'Bani Gala': { lat: 33.7050, lng: 73.1550 },
  'PWD': { lat: 33.5850, lng: 73.1550 },
  'Pakistan Town': { lat: 33.5780, lng: 73.1480 },
  'Korang Town': { lat: 33.5900, lng: 73.1400 },
  'Soan Garden': { lat: 33.5650, lng: 73.1650 },
  'Gulberg Residencia': { lat: 33.5950, lng: 73.1950 },
  'Gulberg Greens': { lat: 33.6100, lng: 73.1600 },
  'DHA Phase 1': { lat: 33.5250, lng: 73.1350 },
  'DHA Phase 2': { lat: 33.5150, lng: 73.1750 },
  'DHA Phase 3': { lat: 33.5000, lng: 73.1200 },
  'DHA Phase 4': { lat: 33.4900, lng: 73.1100 },
  'DHA Phase 5': { lat: 33.5100, lng: 73.1900 },
  'Bahria Phase 1': { lat: 33.5650, lng: 73.0900 },
  'Bahria Phase 2': { lat: 33.5600, lng: 73.0950 },
  'Bahria Phase 3': { lat: 33.5550, lng: 73.1000 },
  'Bahria Phase 4': { lat: 33.5500, lng: 73.1050 },
  'Bahria Phase 5': { lat: 33.5450, lng: 73.1100 },
  'Bahria Phase 6': { lat: 33.5400, lng: 73.1120 },
  'Bahria Phase 7': { lat: 33.5350, lng: 73.1150 },
  'Bahria Phase 8': { lat: 33.5050, lng: 73.0950 },
  'Bahria Enclave': { lat: 33.6900, lng: 73.2200 },
  'Saddar': { lat: 33.5980, lng: 73.0550 },
  'Commercial Market': { lat: 33.6350, lng: 73.0720 },
  'Satellite Town': { lat: 33.6420, lng: 73.0750 },
  'Chaklala': { lat: 33.5850, lng: 73.0950 },
  'Westridge': { lat: 33.6050, lng: 73.0250 },
  'Raja Bazar': { lat: 33.6150, lng: 73.0580 },
  'Rawalpindi': { lat: 33.5980, lng: 73.0550 },
  'Islamabad': { lat: 33.6844, lng: 73.0479 },
  'Lahore': { lat: 31.5204, lng: 74.3587 },
  'Gulberg Lahore': { lat: 31.5150, lng: 74.3480 },
  'DHA Lahore': { lat: 31.4700, lng: 74.4100 },
  'Johar Town': { lat: 31.4690, lng: 74.2960 },
  'Model Town': { lat: 31.4850, lng: 74.3250 },
  'Karachi': { lat: 24.8607, lng: 67.0011 },
  'Clifton': { lat: 24.8200, lng: 67.0300 },
  'PECHS': { lat: 24.8700, lng: 67.0600 },
  'Multan': { lat: 30.1575, lng: 71.5249 },
  'Faisalabad': { lat: 31.4504, lng: 73.1350 },
  'Peshawar': { lat: 34.0151, lng: 71.5249 },
  'Quetta': { lat: 30.1798, lng: 66.9750 },
};

export function resolveAreaCoords(areaName) {
  if (!areaName) return null;
  const clean = String(areaName).trim().toUpperCase();
  const normalizedKey = clean.replace(/[^A-Z0-9]/g, '');

  for (const [key, coords] of Object.entries(AREA_COORDINATES)) {
    const keyNorm = key.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalizedKey === keyNorm || normalizedKey.includes(keyNorm) || keyNorm.includes(normalizedKey)) {
      return coords;
    }
  }
  return null;
}

// ─── Store Fetch In-Memory Cache ──────────────────────────────────────────────
const storeFetchCache = new Map();

// ─── Google Places Nearby Search — category search configuration ───────────────
const CATEGORY_SEARCH_CONFIG = {
  'groceries': { keyword: 'grocery supermarket store mart', type: 'supermarket' },
  'grocery': { keyword: 'grocery supermarket store mart', type: 'supermarket' },
  'fresh bazaar': { keyword: 'fresh bazaar fruit vegetable market grocery', type: null },
  'freshbazaar': { keyword: 'fresh bazaar fruit vegetable market', type: null },
  'meat': { keyword: 'meat butcher chicken poultry shop', type: null },
  'pharmacy': { keyword: 'pharmacy medical chemist medicine store', type: 'pharmacy' },
  'health': { keyword: 'pharmacy medical health hospital chemist', type: 'pharmacy' },
  'medical': { keyword: 'pharmacy medical chemist clinic hospital', type: 'pharmacy' },
  'fruits': { keyword: 'fruit fresh produce fruits market', type: null },
  'fruit': { keyword: 'fruit fresh produce market', type: null },
  'vegetables': { keyword: 'vegetables sabzi produce market', type: null },
  'bakery': { keyword: 'bakery sweets cakes bread confectionery', type: 'bakery' },
  'bakers': { keyword: 'bakery sweets cakes bread', type: 'bakery' },
  'drink corners': { keyword: 'cafe juice shake beverages tea coffee drinks', type: 'cafe' },
  'drink corner': { keyword: 'cafe juice beverages drinks tea coffee', type: 'cafe' },
  'drinks': { keyword: 'cafe juice beverages cold drinks', type: 'cafe' },
  'cosmetics': { keyword: 'cosmetics beauty makeup skincare store', type: null },
  'cosmetic': { keyword: 'cosmetics beauty makeup store', type: null },
  'stationery': { keyword: 'stationery books paper book shop', type: 'book_store' },
  'restaurant': { keyword: 'restaurant fast food dining cafe', type: 'restaurant' },
  'food': { keyword: 'restaurant fast food food cafe eatery', type: 'restaurant' },
  'electronics': { keyword: 'electronics mobile phones computer gadgets', type: 'electronics_store' },
  'clothing': { keyword: 'clothing fashion apparel garments boutique', type: 'clothing_store' },
  'mart': { keyword: 'mart supermarket grocery cash and carry', type: 'supermarket' },
  'marts': { keyword: 'mart supermarket grocery', type: 'supermarket' },
  'supermarket': { keyword: 'supermarket hypermarket cash carry', type: 'supermarket' },
  'hardware': { keyword: 'hardware tools sanitary paints store', type: 'hardware_store' },
  'pet': { keyword: 'pet care animal shop pet supplies', type: 'pet_store' },
  'pets': { keyword: 'pet care animal supplies food', type: 'pet_store' },
  'baby': { keyword: 'baby garments toys care shop', type: null },
  'dairy': { keyword: 'dairy milk yogurt butter sweets', type: null },
};

function getSearchConfigForCategory(categoryName) {
  const lower = (categoryName || '').toLowerCase().trim();
  if (CATEGORY_SEARCH_CONFIG[lower]) return CATEGORY_SEARCH_CONFIG[lower];
  for (const [key, cfg] of Object.entries(CATEGORY_SEARCH_CONFIG)) {
    if (lower.includes(key) || key.includes(lower)) return cfg;
  }
  return { keyword: lower || 'store', type: null };
}

// ─── Overpass API store tags for each category ────────────────────────────────
const CATEGORY_OSM_TAGS = {
  'groceries': [['shop', 'supermarket'], ['shop', 'convenience'], ['shop', 'grocery'], ['shop', 'department_store']],
  'grocery': [['shop', 'supermarket'], ['shop', 'convenience'], ['shop', 'grocery']],
  'fresh bazaar': [['shop', 'greengrocer'], ['shop', 'farm'], ['amenity', 'marketplace'], ['shop', 'fruit']],
  'freshbazaar': [['shop', 'greengrocer'], ['amenity', 'marketplace']],
  'meat': [['shop', 'butcher'], ['shop', 'meat'], ['shop', 'supermarket']],
  'pharmacy': [['amenity', 'pharmacy'], ['shop', 'chemist'], ['shop', 'medical_supply'], ['healthcare', 'pharmacy']],
  'health': [['amenity', 'pharmacy'], ['shop', 'chemist'], ['amenity', 'clinic'], ['amenity', 'hospital'], ['shop', 'medical_supply']],
  'medical': [['amenity', 'pharmacy'], ['shop', 'chemist'], ['amenity', 'clinic'], ['shop', 'medical_supply']],
  'fruits': [['shop', 'greengrocer'], ['shop', 'fruit']],
  'fruit': [['shop', 'greengrocer'], ['shop', 'fruit']],
  'bakery': [['shop', 'bakery'], ['shop', 'pastry'], ['shop', 'confectionery']],
  'bakers': [['shop', 'bakery'], ['shop', 'confectionery']],
  'drink corners': [['amenity', 'cafe'], ['amenity', 'juice_bar'], ['shop', 'beverages']],
  'drink corner': [['amenity', 'cafe'], ['shop', 'beverages']],
  'drinks': [['amenity', 'cafe'], ['shop', 'beverages'], ['amenity', 'juice_bar']],
  'cosmetics': [['shop', 'cosmetics'], ['shop', 'beauty'], ['shop', 'perfumery']],
  'cosmetic': [['shop', 'cosmetics'], ['shop', 'beauty']],
  'stationery': [['shop', 'stationery'], ['shop', 'books']],
  'restaurant': [['amenity', 'restaurant'], ['amenity', 'fast_food']],
  'food': [['amenity', 'restaurant'], ['amenity', 'fast_food'], ['amenity', 'cafe'], ['shop', 'bakery']],
  'electronics': [['shop', 'electronics'], ['shop', 'computer'], ['shop', 'mobile_phone']],
  'clothing': [['shop', 'clothes'], ['shop', 'fashion'], ['shop', 'boutique']],
  'mart': [['shop', 'supermarket'], ['shop', 'convenience']],
  'marts': [['shop', 'supermarket'], ['shop', 'convenience']],
  'supermarket': [['shop', 'supermarket'], ['shop', 'convenience']],
  'hardware': [['shop', 'hardware'], ['shop', 'doityourself']],
  'pet': [['shop', 'pet']],
  'pets': [['shop', 'pet']],
  'baby': [['shop', 'baby_goods']],
};

function getOsmTagsForCategory(categoryName) {
  const lower = (categoryName || '').toLowerCase().trim();
  if (CATEGORY_OSM_TAGS[lower]) return CATEGORY_OSM_TAGS[lower];
  for (const [key, tags] of Object.entries(CATEGORY_OSM_TAGS)) {
    if (lower.includes(key) || key.includes(lower)) return tags;
  }
  return [['shop', lower.replace(/\s+/g, '_')], ['shop', 'supermarket'], ['shop', 'convenience']];
}

async function geocodeAreaNominatim(areaName) {
  if (!areaName) return null;
  const staticCoords = resolveAreaCoords(areaName);
  if (staticCoords) return staticCoords;

  try {
    const query = encodeURIComponent(`${areaName}, Pakistan`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=pk`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'RobotInn-CustomerApp/1.0' }
    });
    clearTimeout(timeoutId);
    const json = await resp.json();
    if (json?.length > 0) {
      return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
    }
  } catch (e) {
    console.warn('[Nominatim] geocode error:', e?.message);
  }
  return null;
}

const GENERAL_BRAND_STORES_BY_CATEGORY = {
  pharmacy: [
    { name: 'Shaheen Chemist', rating: '4.9', isInternational: true, type: 'pharmacy' },
    { name: 'D.Watson Pharmacy', rating: '4.8', isInternational: true, type: 'pharmacy' },
    { name: 'Shifa Pharmacy', rating: '4.8', isInternational: true, type: 'pharmacy' },
    { name: 'Servaid Pharmacy', rating: '4.7', isInternational: true, type: 'pharmacy' },
    { name: 'Metro Pharmacy', rating: '4.6', isInternational: false, type: 'pharmacy' },
    { name: 'Medical Store & Pharmacy', rating: '4.5', isInternational: false, type: 'pharmacy' },
    { name: 'City Pharmacy & Medical', rating: '4.5', isInternational: false, type: 'pharmacy' },
  ],
  food: [
    { name: 'KFC', rating: '4.8', isInternational: true, type: 'food' },
    { name: "McDonald's", rating: '4.8', isInternational: true, type: 'food' },
    { name: 'Pizza Hut', rating: '4.7', isInternational: true, type: 'food' },
    { name: 'Subway', rating: '4.7', isInternational: true, type: 'food' },
    { name: 'Cheezious', rating: '4.9', isInternational: true, type: 'food' },
    { name: 'Howdy', rating: '4.8', isInternational: true, type: 'food' },
    { name: 'Tehzeeb Bakers & Foods', rating: '4.9', isInternational: true, type: 'food' },
    { name: 'Savour Foods', rating: '4.8', isInternational: false, type: 'food' },
  ],
  grocery: [
    { name: 'SaveMart', rating: '4.8', isInternational: true, type: 'grocery' },
    { name: 'Punjab Cash & Carry', rating: '4.7', isInternational: true, type: 'grocery' },
    { name: 'Greenvalley Premium Hypermarket', rating: '4.9', isInternational: true, type: 'grocery' },
    { name: 'Imtiaz Super Market', rating: '4.8', isInternational: true, type: 'grocery' },
    { name: 'Corner Grocery Store', rating: '4.5', isInternational: false, type: 'grocery' },
  ],
  bakery: [
    { name: 'Tehzeeb Bakery', rating: '4.9', isInternational: true, type: 'bakery' },
    { name: 'Rahat Bakery', rating: '4.7', isInternational: true, type: 'bakery' },
    { name: 'Layered Bakery', rating: '4.8', isInternational: false, type: 'bakery' },
    { name: 'Kitchen Cuisine', rating: '4.7', isInternational: false, type: 'bakery' },
  ],
  meat: [
    { name: 'Meat One', rating: '4.8', isInternational: true, type: 'meat' },
    { name: 'Kausar Chicken & Meat', rating: '4.6', isInternational: false, type: 'meat' },
    { name: 'Fresh Butcher Shop', rating: '4.5', isInternational: false, type: 'meat' },
  ],
  cosmetics: [
    { name: 'Scentsation Cosmetics', rating: '4.8', isInternational: true, type: 'cosmetics' },
    { name: 'Saeed Ghani Beauty Store', rating: '4.7', isInternational: true, type: 'cosmetics' },
    { name: 'Nivea Beauty Store', rating: '4.6', isInternational: false, type: 'cosmetics' },
    { name: 'Glamour Cosmetics Shop', rating: '4.5', isInternational: false, type: 'cosmetics' },
  ],
  stationery: [
    { name: 'Saeed Book Bank', rating: '4.9', isInternational: true, type: 'stationery' },
    { name: 'London Book Co', rating: '4.7', isInternational: true, type: 'stationery' },
    { name: 'Stationery & Copy Corner', rating: '4.5', isInternational: false, type: 'stationery' },
  ],
  electronics: [
    { name: 'Mi Official Store', rating: '4.8', isInternational: true, type: 'electronics' },
    { name: 'Samsung Experience Store', rating: '4.8', isInternational: true, type: 'electronics' },
    { name: 'Mobile & Computer Zone', rating: '4.6', isInternational: false, type: 'electronics' },
  ],
  pet_supplies: [
    { name: 'Pet Care & Supplies Store', rating: '4.7', isInternational: false, type: 'pet_supplies' },
    { name: 'Vet & Animal Care Center', rating: '4.6', isInternational: false, type: 'pet_supplies' },
  ],
  dairy: [
    { name: 'Dairy & Milk Fresh Shop', rating: '4.7', isInternational: false, type: 'dairy' },
  ],
  fruits: [
    { name: 'Fresh Fruits & Produce Market', rating: '4.7', isInternational: false, type: 'fruits' },
  ],
  vegetables: [
    { name: 'Sabzi & Fresh Veggie Store', rating: '4.7', isInternational: false, type: 'vegetables' },
  ],
  soft_drinks: [
    { name: 'Beverage & Cold Drink Corner', rating: '4.6', isInternational: false, type: 'soft_drinks' },
  ],
};

export function getFallbackStoresForAreaAndCategory(areaName = '', categoryName = '') {
  const cleanArea = String(areaName || 'Islamabad').trim();
  const catKey = String(categoryName || 'food').toLowerCase().trim();
  const areaCoords = resolveAreaCoords(cleanArea) || { lat: 33.6844, lng: 73.0479 };

  let targetCatKey = 'food';
  if (catKey.includes('pharma') || catKey.includes('health') || catKey.includes('medical') || catKey.includes('chemist') || catKey.includes('medicine')) {
    targetCatKey = 'pharmacy';
  } else if (catKey.includes('grocer') || catKey.includes('mart') || catKey.includes('supermarket')) {
    targetCatKey = 'grocery';
  } else if (catKey.includes('baker') || catKey.includes('cake') || catKey.includes('bread') || catKey.includes('sweet')) {
    targetCatKey = 'bakery';
  } else if (catKey.includes('meat') || catKey.includes('chicken') || catKey.includes('butcher')) {
    targetCatKey = 'meat';
  } else if (catKey.includes('cosmetic') || catKey.includes('beauty') || catKey.includes('makeup') || catKey.includes('skin')) {
    targetCatKey = 'cosmetics';
  } else if (catKey.includes('stationery') || catKey.includes('book') || catKey.includes('paper')) {
    targetCatKey = 'stationery';
  } else if (catKey.includes('electronic') || catKey.includes('mobile') || catKey.includes('tech') || catKey.includes('computer')) {
    targetCatKey = 'electronics';
  } else if (catKey.includes('pet')) {
    targetCatKey = 'pet_supplies';
  } else if (catKey.includes('dairy') || catKey.includes('milk')) {
    targetCatKey = 'dairy';
  } else if (catKey.includes('fruit')) {
    targetCatKey = 'fruits';
  } else if (catKey.includes('veg') || catKey.includes('sabzi')) {
    targetCatKey = 'vegetables';
  } else if (catKey.includes('drink') || catKey.includes('soda') || catKey.includes('beverage')) {
    targetCatKey = 'soft_drinks';
  }

  const baseList = GENERAL_BRAND_STORES_BY_CATEGORY[targetCatKey] || GENERAL_BRAND_STORES_BY_CATEGORY['food'];

  return baseList.map((item, idx) => ({
    place_id: `fallback_${cleanArea.toLowerCase()}_${targetCatKey}_${idx}`,
    placeId: `fallback_${cleanArea.toLowerCase()}_${targetCatKey}_${idx}`,
    name: item.name.includes(cleanArea) ? item.name : `${item.name} (${cleanArea})`,
    address: `${cleanArea}, Islamabad`,
    rating: item.rating,
    type: targetCatKey,
    category: targetCatKey,
    categoryName: targetCatKey,
    lat: areaCoords.lat,
    lng: areaCoords.lng,
    isGoogleStore: true,
    isFallbackStore: true,
    isInternational: item.isInternational,
  }));
}

// ─── List of distinct sector/area tokens to detect cross-sector pollution ────
export const ALL_SECTORS = [
  'F-5', 'F-6', 'F-7', 'F-8', 'F-9', 'F-10', 'F-11', 'F-12',
  'G-5', 'G-6', 'G-7', 'G-8', 'G-9', 'G-10', 'G-11', 'G-12', 'G-13', 'G-14', 'G-15',
  'I-8', 'I-9', 'I-10', 'I-11', 'I-12', 'I-14',
  'E-7', 'E-8', 'E-9', 'E-11',
  'H-8', 'H-9', 'H-10', 'H-11', 'H-12',
  'Blue Area', 'Centaurus', 'PWD', 'Pakistan Town', 'Korang Town', 'Soan Garden',
  'Gulberg', 'DHA Phase 1', 'DHA Phase 2', 'DHA Phase 3', 'DHA Phase 4', 'DHA Phase 5',
  'Bahria Phase 1', 'Bahria Phase 2', 'Bahria Phase 3', 'Bahria Phase 4', 'Bahria Phase 5',
  'Bahria Phase 6', 'Bahria Phase 7', 'Bahria Phase 8', 'Bahria Enclave',
  'Saddar', 'Commercial Market', 'Satellite Town', 'Chaklala', 'Westridge', 'Raja Bazar'
];

export const SECTOR_ALIASES = {
  'F-6': ['f-6', 'f6', 'super market', 'kohsar', 'f 6', 'f-6 markaz'],
  'F-7': ['f-7', 'f7', 'jinnah super', 'gol market', 'f 7', 'f-7 markaz'],
  'F-8': ['f-8', 'f8', 'ayub market', 'f 8', 'f-8 markaz'],
  'F-10': ['f-10', 'f10', 'tariq market', 'f 10', 'f-10 markaz'],
  'F-11': ['f-11', 'f11', 'f 11', 'f-11 markaz'],
  'G-6': ['g-6', 'g6', 'melody', 'aabpara', 'g 6', 'g-6 markaz'],
  'G-7': ['g-7', 'g7', 'sitara market', 'g 7', 'g-7 markaz'],
  'G-8': ['g-8', 'g8', 'i&t centre', 'i&t center', 'g 8', 'g-8 markaz'],
  'G-9': ['g-9', 'g9', 'karachi company', 'g 9', 'g-9 markaz'],
  'G-10': ['g-10', 'g10', 'g 10', 'g-10 markaz'],
  'G-11': ['g-11', 'g11', 'g 11', 'g-11 markaz'],
  'G-13': ['g-13', 'g13', 'g 13', 'g-13 markaz'],
  'I-8': ['i-8', 'i8', 'habib market', 'i 8', 'i-8 markaz'],
  'I-9': ['i-9', 'i9', 'i 9', 'i-9 markaz'],
  'I-10': ['i-10', 'i10', 'i 10', 'i-10 markaz'],
  'E-7': ['e-7', 'e7', 'e 7', 'e-7 markaz'],
  'E-11': ['e-11', 'e11', 'mpchs', 'fechs', 'e 11'],
  'Blue Area': ['blue area', 'jinnah avenue', 'fazl-e-haq'],
};

/**
 * Validates if a store strictly belongs to the requested target area/sector.
 * Prevents cross-sector pollution (e.g. stores from F-7 or G-6 showing when F-6 is chosen).
 */
export function isStoreInTargetArea(store, targetArea = '', targetCoords = null) {
  if (!targetArea || targetArea.toLowerCase() === 'islamabad' || targetArea.toLowerCase() === 'rawalpindi') {
    return true;
  }

  // Admin stores explicitly tied to the selected area document belong to it
  if (store?.isAdminStore) {
    return true;
  }

  const cleanTarget = String(targetArea).trim();
  const targetLower = cleanTarget.toLowerCase();
  const targetNorm = cleanTarget.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // If store has explicit area property, check that first
  if (store?.area) {
    const storeAreaNorm = String(store.area).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (storeAreaNorm === targetNorm || storeAreaNorm.includes(targetNorm) || targetNorm.includes(storeAreaNorm)) {
      return true;
    }
  }

  const storeName = String(store?.name || '').toLowerCase();
  const storeAddress = String(store?.address || store?.vicinity || '').toLowerCase();
  const fullText = `${storeName} ${storeAddress}`;

  // 1. Check known aliases for this target sector/area
  let targetAliases = [targetLower, targetNorm.toLowerCase()];
  for (const [secKey, aliases] of Object.entries(SECTOR_ALIASES)) {
    const secNorm = secKey.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (targetNorm === secNorm || targetLower.includes(secKey.toLowerCase())) {
      targetAliases = [...targetAliases, ...aliases];
      break;
    }
  }

  const hasTargetMention = targetAliases.some(alias => fullText.includes(alias));

  // 2. Check if the store explicitly mentions another conflicting sector or commercial hub
  if (targetNorm !== 'BLUEAREA' && targetNorm !== 'CENTAURUS') {
    if (storeName.includes('beverly centre') || storeName.includes('blue area') || storeName.includes('centaurus') || storeAddress.includes('blue area') || storeAddress.includes('centaurus')) {
      return false;
    }
  }

  for (const otherSec of ALL_SECTORS) {
    const otherNorm = otherSec.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (otherNorm === targetNorm) continue; // Same sector, skip

    const otherLower = otherSec.toLowerCase();
    const otherNoHyphen = otherLower.replace(/[^a-z0-9]/g, '');
    const otherSpace = otherLower.replace('-', ' ');

    const regex = new RegExp(`\\b(${otherLower}|${otherNoHyphen}|${otherSpace})\\b`, 'i');
    if (regex.test(fullText)) {
      if (!hasTargetMention) {
        return false;
      }
    }
  }

  // 3. If it explicitly mentions target sector, accept it
  if (hasTargetMention) {
    return true;
  }

  // 4. Geographical distance check strictly as secondary verification
  const storeLat = store?.lat || store?.latitude;
  const storeLng = store?.lng || store?.longitude;
  const tLat = targetCoords?.lat || resolveAreaCoords(cleanTarget)?.lat;
  const tLng = targetCoords?.lng || resolveAreaCoords(cleanTarget)?.lng;

  if (storeLat && storeLng && tLat && tLng) {
    const dist = haversineKm(tLat, tLng, Number(storeLat), Number(storeLng));
    const isSector = /^[E-Ie-i]-?[0-9]+/i.test(targetNorm);
    const maxRadiusKm = isSector ? 1.4 : 2.5;
    if (dist <= maxRadiusKm) {
      return true;
    }
    return false;
  }

  return false;
}

// ─── Normalise a single Google Places (New) result into the common store shape ──
function normalizeGooglePlaceResult(place, cleanCatName, cleanArea) {
  const loc = place.location;
  const vicinity = place.formattedAddress || `${cleanArea}, Islamabad`;
  const types = Array.isArray(place.types) ? place.types : [];
  return {
    place_id: place.id,
    placeId: place.id,
    name: place.displayName?.text || place.name || 'Store',
    address: vicinity,
    rating: place.rating != null ? String(place.rating) : '4.5',
    userRatingsTotal: place.userRatingCount || 0,
    type: cleanCatName || 'Store',
    category: cleanCatName || 'Store',
    types: types,
    supportedCategories: types,
    isOpen: place.currentOpeningHours?.openNow ?? null,
    lat: loc?.latitude ?? null,
    lng: loc?.longitude ?? null,
    isGoogleStore: true,
    isRealtime: true,
    isFallbackStore: false,
  };
}

export async function fetchNearbyStoresFromGoogle(category = 'Food', areaName = '', lat = null, lng = null) {
  // Strip emoji / non-printable characters from category string
  const cleanCatName = (typeof category === 'object' && category !== null
    ? category.name || category.title
    : String(category || ''))
    .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '')
    .trim();
  const cleanArea = String(areaName || 'Islamabad').trim();
  const cacheKey = `${cleanCatName.toLowerCase()}_${cleanArea.toLowerCase()}`;

  // Return cached results if already populated
  if (storeFetchCache.has(cacheKey) && storeFetchCache.get(cacheKey).length > 0) {
    return storeFetchCache.get(cacheKey);
  }

  // ── Resolve coordinates for the target area ────────────────────────────────
  let targetLat = lat;
  let targetLng = lng;

  const resolved = resolveAreaCoords(cleanArea);
  if (resolved) {
    targetLat = resolved.lat;
    targetLng = resolved.lng;
  }
  if (!targetLat || !targetLng) {
    // Default to Islamabad city centre
    targetLat = 33.6844;
    targetLng = 73.0479;
  }

  const cleanAreaNorm = cleanArea.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const isSector = /^[E-Ie-i]-?[0-9]+/i.test(cleanAreaNorm);
  const radius = isSector ? 1500 : 3000;

  const searchCfg = getSearchConfigForCategory(cleanCatName);
  const query = `${searchCfg.keyword || cleanCatName} in ${cleanArea} Islamabad`;

  // ── Google Places API (New) SearchText ───────────────────────────────────────
  try {
    const placesUrl = 'https://places.googleapis.com/v1/places:searchText';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(placesUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.location,places.currentOpeningHours',
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: 20,
        locationBias: {
          circle: {
            center: { latitude: targetLat, longitude: targetLng },
            radius: radius,
          },
        },
      }),
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const json = await response.json();

      if (Array.isArray(json.places) && json.places.length > 0) {
        const storeMap = new Map();
        json.places.forEach(place => {
          if (!place.displayName?.text) return;
          const normalized = normalizeGooglePlaceResult(place, cleanCatName, cleanArea);
          if (isStoreInTargetArea(normalized, cleanArea, { lat: targetLat, lng: targetLng })) {
            storeMap.set(normalized.name.toLowerCase().trim(), normalized);
          }
        });

        const finalResults = Array.from(storeMap.values());
        if (finalResults.length > 0) {
          storeFetchCache.set(cacheKey, finalResults);
          return finalResults;
        }
      }
    }
  } catch (gErr) {
    console.warn('[GooglePlaces] SearchText failed:', gErr?.message);
  }

  // ── Fallback to SearchNearby (Places API New) ───────────────────────────────
  try {
    const nearbyUrl = 'https://places.googleapis.com/v1/places:searchNearby';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const body = {
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: targetLat, longitude: targetLng },
          radius: radius,
        },
      },
    };
    if (searchCfg.type) {
      body.includedTypes = [searchCfg.type];
    }

    const response = await fetch(nearbyUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.location,places.currentOpeningHours',
      },
      body: JSON.stringify(body),
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const json = await response.json();
      if (Array.isArray(json.places) && json.places.length > 0) {
        const storeMap = new Map();
        json.places.forEach(place => {
          if (!place.displayName?.text) return;
          const normalized = normalizeGooglePlaceResult(place, cleanCatName, cleanArea);
          if (isStoreInTargetArea(normalized, cleanArea, { lat: targetLat, lng: targetLng })) {
            storeMap.set(normalized.name.toLowerCase().trim(), normalized);
          }
        });

        const finalResults = Array.from(storeMap.values());
        if (finalResults.length > 0) {
          storeFetchCache.set(cacheKey, finalResults);
          return finalResults;
        }
      }
    }
  } catch (nErr) {
    console.warn('[GooglePlaces] SearchNearby failed:', nErr?.message);
  }

  // If no store exists in the selected area, return empty array immediately (no fake dummy stores)
  return [];
}

