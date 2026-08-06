/**
 * FirestoreRepository.js  –  RobotInn Customer Mobile App
 *
 * Data Access Layer for fetching & listening to Firestore collections:
 * - Categories
 * - CategoryKeywords
 * - Stores
 * - Areas
 */

import firestore from '@react-native-firebase/firestore';

class FirestoreRepository {
  /**
   * Listen to real-time updates for CategoryKeywords collection
   */
  subscribeCategoryKeywords(onUpdate, onError) {
    return firestore()
      .collection('CategoryKeywords')
      .onSnapshot(
        (snapshot) => {
          if (!snapshot) {
            onUpdate([]);
            return;
          }
          const list = [];
          snapshot.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() });
          });
          onUpdate(list);
        },
        (error) => {
          // CategoryKeywords is rule-protected. When the caller isn't allowed to read it
          // (typically before sign-in) this is expected, not a failure: KeywordCacheService
          // keeps serving DEFAULT_CATEGORY_KEYWORDS merged with the last AsyncStorage
          // snapshot, so category detection carries on unaffected.
          if (error && error.code === 'firestore/permission-denied') {
            console.warn(
              'CategoryKeywords not readable (permission-denied) — using cached/default keywords.'
            );
          } else {
            console.error('CategoryKeywords listener error:', error);
          }
          if (onError) onError(error);
        }
      );
  }

  /**
   * Listen to real-time updates for categories collection
   */
  subscribeCategories(onUpdate, onError) {
    return firestore()
      .collection('categories')
      .onSnapshot(
        (snapshot) => {
          if (!snapshot) {
            onUpdate([]);
            return;
          }
          const list = [];
          snapshot.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() });
          });
          onUpdate(list);
        },
        (error) => {
          console.error('Categories listener error:', error);
          if (onError) onError(error);
        }
      );
  }

  /**
   * Fetch all active stores from Firestore
   */
  async getStores() {
    try {
      const snapshot = await firestore().collection('stores').get();
      const stores = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        stores.push({
          id: doc.id,
          storeId: doc.id,
          name: data.name || data.storeName || 'Store',
          storeName: data.name || data.storeName || 'Store',
          latitude: parseFloat(data.latitude || data.lat || 0),
          longitude: parseFloat(data.longitude || data.lng || data.lon || 0),
          supportedCategories: Array.isArray(data.supportedCategories)
            ? data.supportedCategories.map(c => String(c).toLowerCase())
            : Array.isArray(data.categories)
            ? data.categories.map(c => String(c).toLowerCase())
            : [String(data.category || '').toLowerCase()].filter(Boolean),
          deliveryRadiusKm: parseFloat(data.deliveryRadiusKm || data.radius || 10),
          status: data.status || 'active',
          isOpen: data.isOpen !== false,
          rating: parseFloat(data.rating || 4.5),
          area: data.area || '',
          address: data.address || '',
          ...data,
        });
      });
      return stores;
    } catch (error) {
      console.error('Error fetching stores from Firestore:', error);
      return [];
    }
  }

  /**
   * Listen to real-time updates for active stores
   */
  subscribeStores(onUpdate, onError) {
    return firestore()
      .collection('stores')
      .onSnapshot(
        (snapshot) => {
          if (!snapshot) {
            onUpdate([]);
            return;
          }
          const stores = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            stores.push({
              id: doc.id,
              storeId: doc.id,
              name: data.name || data.storeName || 'Store',
              storeName: data.name || data.storeName || 'Store',
              latitude: parseFloat(data.latitude || data.lat || 0),
              longitude: parseFloat(data.longitude || data.lng || data.lon || 0),
              supportedCategories: Array.isArray(data.supportedCategories)
                ? data.supportedCategories.map(c => String(c).toLowerCase())
                : Array.isArray(data.categories)
                ? data.categories.map(c => String(c).toLowerCase())
                : [String(data.category || '').toLowerCase()].filter(Boolean),
              deliveryRadiusKm: parseFloat(data.deliveryRadiusKm || data.radius || 10),
              status: data.status || 'active',
              isOpen: data.isOpen !== false,
              rating: parseFloat(data.rating || 4.5),
              area: data.area || '',
              address: data.address || '',
              ...data,
            });
          });
          onUpdate(stores);
        },
        (error) => {
          console.error('Stores listener error:', error);
          if (onError) onError(error);
        }
      );
  }
}

export default new FirestoreRepository();
