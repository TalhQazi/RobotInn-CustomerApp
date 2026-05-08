import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../theme/colors';
import { SPACING } from '../../theme/spacing';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import { getData } from '../../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS, ORDER_STATUS } from '../../utils/constants';
import { MOCK_ORDERS } from '../../services/mockData';
import { ordersAPI } from '../../services/api';
import Ionicons from 'react-native-vector-icons/Ionicons';

const RequestScreen = ({ navigation, route }) => {
  const [requests, setRequests] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState({ name: 'Fawad', profilePic: null });
  const flatListRef = useRef(null);

  // Fetch orders on initial load
  useEffect(() => {
    fetchRequests();
    fetchUser();
    
    // Scroll to content if navigated from Order Now button
    if (route?.params?.scrollToContent) {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 100, animated: true });
      }, 300);
    }
  }, []);

  // Fetch orders every time screen is focused
  useFocusEffect(() => {
    fetchRequests();
  });

  const fetchUser = async () => {
    const userData = await getData(ASYNC_STORAGE_KEYS.USER_DATA);
    if (userData) setUser(userData);
  };

  const fetchRequests = async () => {
    setRefreshing(true);
    
    // Try to fetch from backend first
    try {
      const response = await ordersAPI.getMyOrders({ limit: 20 });
      if (response.success && response.data) {
        setRequests(response.data);
        setRefreshing(false);
        return;
      }
    } catch (error) {
      console.log('Using local orders:', error.message);
    }
    
    // Fallback to local storage
    const storedRequests = await getData(ASYNC_STORAGE_KEYS.REQUESTS) || [];
    const combined = [...storedRequests, ...MOCK_ORDERS]
      .sort((a, b) => {
        const da = new Date(a.createdAt || a.date || 0).getTime();
        const db = new Date(b.createdAt || b.date || 0).getTime();
        return db - da;
      })
      .slice(0, 20);
    setRequests(combined);
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    // Handle backend status values
    switch (status) {
      case 'delivered': return COLORS.delivered;
      case 'processing':
      case 'accepted':
      case 'picked': return COLORS.inProgress;
      case 'cancelled': return '#E74C3C';
      case 'pending': 
      default: return COLORS.pending;
    }
  };

  const renderRequestItem = ({ item }) => (
    <Card
      style={styles.requestCard}
      onPress={() => navigation.navigate('OrderDetails', { order: item })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}>Order #{item.orderId?.slice(-6) || item.id?.slice(-6) || 'N/A'}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status?.charAt(0).toUpperCase() + item.status?.slice(1) || 'Pending'}</Text>
        </View>
      </View>
      
      <View style={styles.cardBody}>
        <Text style={styles.itemName}>
          {Array.isArray(item.items) 
            ? item.items.map(i => i.name || i.text || i.itemName || i).slice(0, 2).join(', ') 
            : item.itemName || item.items?.name || 'Order'}
          {Array.isArray(item.items) && item.items.length > 2 && '...'}
        </Text>
        {(item.pickup || item.store) && (
          <Text style={styles.storeText}>
            {item.pickup || item.store} • {item.area}
          </Text>
        )}
        <Text style={styles.orderDate}>
          {new Date(item.createdAt || item.date).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>

      <View style={styles.viewDetailsRow}>
        <Text style={styles.viewDetailsText}>View Details</Text>
        <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        navigation={navigation}
        title="My Orders"
      />
      <View style={styles.content}>
        <FlatList
          ref={flatListRef}
          data={requests}
          renderItem={renderRequestItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={fetchRequests}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No delivery requests found.</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl + 90,
  },
  requestCard: {
    padding: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  cardBody: {
    marginBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.sm,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  orderDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  storeText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: 4,
    fontWeight: '500',
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});

export default RequestScreen;
