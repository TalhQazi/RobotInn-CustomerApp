import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { fetchNearbyStoresFromGoogle } from '../../utils/maps';
import StoreSearchService from '../../services/StoreSearchService';

const StoreListScreen = ({ navigation, route }) => {
  const {
    categoryName = '',
    categoryId = '',
    areaName = '',
    userLocation = null,
    onStoreSelected,
    itemName = '',
  } = route.params || {};

  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState(null);
  const [searchMeta, setSearchMeta] = useState({ searchedRadiusKm: 3, totalMatches: 0 });

  const loadStores = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Use StoreSearchService for dynamic category store matching & radius expansion
      const searchRes = await StoreSearchService.searchStores({
        categories: [categoryId || categoryName].filter(Boolean),
        userLocation: userLocation || { area: areaName },
        initialRadiusKm: 3,
      });

      if (searchRes.stores && searchRes.stores.length > 0) {
        setStores(searchRes.stores);
        setSearchMeta({
          searchedRadiusKm: searchRes.searchedRadiusKm,
          totalMatches: searchRes.totalMatches,
        });
      } else {
        // Fallback to Google maps lookup if no stores found in Firestore
        const results = await fetchNearbyStoresFromGoogle(categoryName, areaName);
        setStores(Array.isArray(results) ? results : []);
        setSearchMeta({ searchedRadiusKm: 10, totalMatches: (results || []).length });
      }
    } catch (err) {
      console.warn('[StoreListScreen] fetch error:', err?.message);
      setError('Could not load stores. Please check your connection.');
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [categoryName, categoryId, areaName, userLocation]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const handleSelectStore = (store) => {
    if (onStoreSelected) {
      onStoreSelected(store);
    }
    navigation.goBack();
  };

  const handleSkip = () => {
    navigation.goBack();
  };

  const filtered = searchText
    ? stores.filter(s =>
        (s.name || '').toLowerCase().includes(searchText.toLowerCase()) ||
        (s.address || '').toLowerCase().includes(searchText.toLowerCase())
      )
    : stores;

  const renderStoreCard = ({ item: store }) => (
    <TouchableOpacity
      style={styles.storeCard}
      activeOpacity={0.8}
      onPress={() => handleSelectStore(store)}
    >
      <View style={styles.storeIconCircle}>
        <Ionicons name="storefront-outline" size={24} color="#2EC4B6" />
      </View>
      <View style={styles.storeInfo}>
        <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
        <View style={styles.storeMetaRow}>
          <Ionicons name="location-outline" size={13} color="#888" />
          <Text style={styles.storeAddress} numberOfLines={1}>
            {store.address || areaName || 'Nearby'}
          </Text>
        </View>
        {store.openingHours ? (
          <Text style={styles.storeHours} numberOfLines={1}>
            {'\u{1F550}'} {store.openingHours}
          </Text>
        ) : null}
      </View>
      <View style={styles.selectBtn}>
        <Ionicons name="chevron-forward" size={18} color="#2EC4B6" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7FFFE" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleSkip}>
          <Ionicons name="arrow-back" size={22} color="#1A202C" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {categoryName ? categoryName + ' Stores' : 'Nearby Stores'}
          </Text>
          {areaName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.areaBadge}>
                <Ionicons name="location" size={11} color="#2EC4B6" />
                <Text style={styles.areaBadgeText}>{areaName}</Text>
              </View>
              {searchMeta.searchedRadiusKm ? (
                <View style={[styles.areaBadge, { marginLeft: 6, backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="navigate-outline" size={11} color="#0284C7" />
                  <Text style={[styles.areaBadgeText, { color: '#0369A1' }]}>
                    {searchMeta.searchedRadiusKm} km radius
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Item context banner */}
      {itemName ? (
        <View style={styles.itemBanner}>
          <Ionicons name="bag-handle-outline" size={15} color="#2EC4B6" />
          <Text style={styles.itemBannerText}>
            Select a store for:{' '}
            <Text style={styles.itemNameText}>"{itemName}"</Text>
          </Text>
        </View>
      ) : null}

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#aaa" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search stores..."
          placeholderTextColor="#aaa"
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Ionicons name="close-circle" size={18} color="#aaa" />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2EC4B6" />
          <Text style={styles.loadingText}>
            Finding {categoryName || 'nearby'} stores in {areaName || 'your area'}...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="wifi-outline" size={48} color="#ccc" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadStores}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="storefront-outline" size={56} color="#D1FAF5" />
          <Text style={styles.emptyTitle}>No stores found</Text>
          <Text style={styles.emptySubtitle}>
            {searchText
              ? 'No stores match your search'
              : 'No ' + categoryName + ' stores found in ' + areaName}
          </Text>
          <TouchableOpacity style={styles.skipFullBtn} onPress={handleSkip}>
            <Text style={styles.skipFullBtnText}>Continue without selecting a store</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.place_id || item.placeId || item.name}
          renderItem={renderStoreCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.resultsCount}>
              {filtered.length} store{filtered.length !== 1 ? 's' : ''} found
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FFFE' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8F9F7',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F0FFFE',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A202C' },
  areaBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E6FAF8',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
    marginTop: 3, gap: 3,
  },
  areaBadgeText: { fontSize: 11, color: '#2EC4B6', fontWeight: '600' },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  skipText: { fontSize: 14, color: '#2EC4B6', fontWeight: '600' },
  itemBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E6FAF8',
    marginHorizontal: 16, marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, gap: 8,
  },
  itemBannerText: { fontSize: 13, color: '#2D3748' },
  itemNameText: { fontWeight: '700', color: '#2EC4B6' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, gap: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#1A202C', padding: 0 },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 32, gap: 12,
  },
  loadingText: { fontSize: 14, color: '#718096', textAlign: 'center', marginTop: 12 },
  errorText: { fontSize: 14, color: '#E53E3E', textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#2EC4B6', paddingHorizontal: 24,
    paddingVertical: 10, borderRadius: 10, marginTop: 8,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#2D3748' },
  emptySubtitle: { fontSize: 14, color: '#718096', textAlign: 'center' },
  skipFullBtn: {
    marginTop: 8, paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 10, borderWidth: 1, borderColor: '#2EC4B6',
  },
  skipFullBtnText: { color: '#2EC4B6', fontWeight: '600', fontSize: 14 },
  resultsCount: { fontSize: 13, color: '#718096', marginBottom: 10, marginLeft: 4, fontWeight: '500' },
  listContent: { padding: 16, paddingBottom: 32 },
  storeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    padding: 14, marginBottom: 10,
    elevation: 2,
    shadowColor: '#2EC4B6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6,
  },
  storeIconCircle: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#E6FAF8',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  storeInfo: { flex: 1, gap: 3 },
  storeName: { fontSize: 15, fontWeight: '700', color: '#1A202C' },
  storeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  storeAddress: { fontSize: 12, color: '#718096', flex: 1 },
  storeHours: { fontSize: 11, color: '#A0AEC0', marginTop: 1 },
  selectBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F0FFFE',
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
});

export default StoreListScreen;
