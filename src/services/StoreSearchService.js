/**
 * StoreSearchService.js  –  RobotInn Customer Mobile App
 *
 * Intelligent Store Matching Engine:
 * - Reads detected item categories from cart
 * - Reads selected Google Maps delivery location (lat, lng, area)
 * - Dynamic Category Filtering: Matches stores whose `supportedCategories` contains detected categories
 * - Progressive Radius Expansion: Gradually increases radius (3km -> 5km -> 8km -> 10km -> 15km)
 *   until at least 10 nearby stores are found or max radius is reached.
 * - Deduplication & sorting by distance (nearest first), rating, and open status.
 */

import FirestoreRepository from './FirestoreRepository';
import GeoLocationService from './GeoLocationService';

const RADIUS_STEPS_KM = [3, 5, 8, 10, 15, 25];
const TARGET_MIN_STORES = 10;

class StoreSearchService {
  /**
   * Search stores matching the customer items' detected categories and delivery location
   * @param {Object} options
   * @param {Array<string|Object>} options.categories - Array of category IDs / names or item objects
   * @param {Object} options.userLocation - { latitude, longitude, area }
   * @param {number} [options.initialRadiusKm=3] - Initial search radius in KM
   * @returns {Promise<{ stores: Array, searchedRadiusKm: number, totalMatches: number }>}
   */
  async searchStores({ categories = [], userLocation = {}, initialRadiusKm = 3 }) {
    // Extract target category IDs (lowercased)
    const targetCategoryIds = Array.from(
      new Set(
        categories
          .map((cat) => {
            if (typeof cat === 'string') return cat.toLowerCase().trim();
            if (cat && typeof cat === 'object') {
              return String(cat.categoryId || cat.categoryName || cat.category || '')
                .toLowerCase()
                .trim();
            }
            return '';
          })
          .filter(Boolean)
      )
    );

    // Fetch all active stores from Firestore
    const allStores = await FirestoreRepository.getStores();

    const userLat = parseFloat(userLocation.latitude || userLocation.lat || 0);
    const userLng = parseFloat(userLocation.longitude || userLocation.lng || userLocation.lon || 0);
    const userArea = String(userLocation.area || '').toLowerCase().trim();

    // ── Step 1: Filter stores by Supported Categories AND selected area
    // Only return stores whose supportedCategories array contains ANY of the cart item categories.
    // If no specific category is provided (or category is 'other'), match all active stores.
    // Area filtering: when userArea is specified, only include stores that either
    //   (a) have store.allAreas === true (explicitly available everywhere), or
    //   (b) have a store.area field that matches userArea (case-insensitive substring).
    // Stores with a missing/empty area field are excluded when a target area is given,
    // because we cannot confirm they belong to the selected area.
    const categoryMatchedStores = allStores.filter((store) => {
      if (store.status === 'inactive') return false;

      // ── Area guard (surgical — only when caller provided a target area) ──────
      if (userArea) {
        if (store.allAreas === true) {
          // Explicitly marked as available in all areas — allow through
        } else {
          const storeAreaLower = String(store.area || '').toLowerCase().trim();
          if (!storeAreaLower) {
            // No area field — cannot confirm it belongs to the selected area; exclude it.
            return false;
          }
          const areaMatches =
            storeAreaLower === userArea ||
            storeAreaLower.includes(userArea) ||
            userArea.includes(storeAreaLower);
          if (!areaMatches) return false;
        }
      }

      if (targetCategoryIds.length === 0 || targetCategoryIds.includes('other')) {
        return true;
      }

      const supported = store.supportedCategories || [];
      const storeNameLower = String(store.name || store.storeName || '').toLowerCase();
      const storeTypeLower = String(store.type || store.category || '').toLowerCase();

      return targetCategoryIds.some((targetCat) => {
        // Direct supported category array match
        if (supported.some((sCat) => String(sCat).toLowerCase().includes(targetCat) || targetCat.includes(String(sCat).toLowerCase()))) {
          return true;
        }
        // Name or store type match
        if (storeNameLower.includes(targetCat) || storeTypeLower.includes(targetCat)) {
          return true;
        }
        return false;
      });
    });

    // ── Step 2: Calculate Distance for each matched store
    const storesWithDistance = categoryMatchedStores.map((store) => {
      let distanceKm = 9999;
      if (userLat !== 0 && userLng !== 0) {
        distanceKm = GeoLocationService.calculateDistance(
          userLat,
          userLng,
          store.latitude,
          store.longitude
        );
      } else if (userArea && store.area && String(store.area).toLowerCase().includes(userArea)) {
        distanceKm = 1.5; // Area match estimate
      }

      return {
        ...store,
        distanceKm,
        formattedDistance: GeoLocationService.formatDistance(distanceKm),
      };
    });

    // Sort by distance (nearest first), then rating
    storesWithDistance.sort((a, b) => {
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return (b.rating || 0) - (a.rating || 0);
    });

    // ── Step 3: Progressive Radius Expansion (3km -> 5km -> 8km -> 10km -> 15km -> 25km)
    // Expand radius until at least 10 stores are found or no more stores exist.
    let finalStores = [];
    let activeRadius = initialRadiusKm;

    const availableSteps = RADIUS_STEPS_KM.filter((r) => r >= initialRadiusKm);
    if (availableSteps.length === 0 || availableSteps[0] !== initialRadiusKm) {
      availableSteps.unshift(initialRadiusKm);
    }

    for (const radiusStep of availableSteps) {
      activeRadius = radiusStep;
      if (userLat !== 0 && userLng !== 0) {
        // Filter by driving/straight-line distance radius
        finalStores = storesWithDistance.filter((s) => s.distanceKm <= radiusStep);
      } else if (userArea) {
        // No GPS coordinates — use area-text match only (already applied in Step 1).
        // Do NOT fall back to all stores, because that would include stores from other areas.
        finalStores = [...storesWithDistance];
        // Area is already enforced in Step 1; no further filtering needed here.
        break; // All area-matched stores are already included; radius expansion is N/A without coords.
      } else {
        // No area and no coordinates — allow all category-matched stores (legacy fallback).
        finalStores = [...storesWithDistance];
      }

      if (finalStores.length >= TARGET_MIN_STORES || finalStores.length === storesWithDistance.length) {
        break;
      }
    }

    // If still less than TARGET_MIN_STORES and GPS was missing, only expand to remaining
    // area-matched stores — never to stores from outside the selected area.
    if (finalStores.length < TARGET_MIN_STORES && storesWithDistance.length > finalStores.length && !userArea) {
      finalStores = storesWithDistance.slice(0, Math.max(TARGET_MIN_STORES, storesWithDistance.length));
    }

    // Deduplicate by storeId/id
    const seenIds = new Set();
    const deduplicatedStores = finalStores.filter((store) => {
      const sId = store.id || store.storeId;
      if (seenIds.has(sId)) return false;
      seenIds.add(sId);
      return true;
    });

    return {
      stores: deduplicatedStores,
      searchedRadiusKm: activeRadius,
      totalMatches: deduplicatedStores.length,
    };
  }
}

export default new StoreSearchService();
