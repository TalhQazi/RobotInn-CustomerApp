import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ordersAPI } from '../../services/api';
import { normalizeRiderLocation } from '../../utils/maps';

function formatStatus(status) {
  if (!status) return 'Pending';
  const s = String(status).toLowerCase();
  const map = {
    pending: 'Pending',
    accepted: 'Accepted',
    processing: 'In Progress',
    picked: 'Picked Up',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };
  return map[s] || status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function itemsSummary(items) {
  if (!Array.isArray(items) || items.length === 0) return 'No items';
  return items
    .map((i) => {
      const qty = i.quantity > 1 ? `${i.quantity}x ` : '';
      return `${qty}${i.name || i.text || 'Item'}`;
    })
    .join(', ');
}

function mapOrderToDetails(o) {
  return {
    id: o.id,
    orderId: o.orderId,
    status: formatStatus(o.status),
    rawStatus: o.status,
    store: o.pickup,
    restaurant: o.pickup,
    area: o.area,
    address: o.dropoff,
    deliveryAddress: o.dropoff,
    items: o.items,
    total: o.bill?.total ?? o.total,
    pickup: o.pickup,
    dropoff: o.dropoff,
    createdAt: o.createdAt,
    date: o.createdAt,
    riderId: o.rider?.id,
    riderName: o.rider?.name,
    riderPhone: o.rider?.phone,
    rider: o.rider,
    bill: o.bill,
    estimatedArrivalTime: o.estimatedArrivalTime,
    estimatedDuration: o.estimatedDuration,
    minutesRemaining: o.minutesRemaining,
    etaProgress: o.etaProgress,
    riderLocation: normalizeRiderLocation(o.riderLocation),
  };
}

const OrderHistoryScreen = ({ navigation, route }) => {
  const [allOrders, setAllOrders] = useState([]);
  const [activeFilter, setActiveFilter] = useState(route?.params?.filter || 'total');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);

  useEffect(() => {
    if (route?.params?.filter) {
      setActiveFilter(route?.params?.filter);
    }
  }, [route?.params?.filter]);

  const isPendingStatus = (status) => String(status || '').toLowerCase() === 'pending';

  const cancelOrder = async (order) => {
    if (!order?.id) {
      return;
    }

    setCancellingOrderId(order.id);
    try {
      const response = await ordersAPI.cancel(order.id);
      if (response.success) {
        Alert.alert('Order Cancelled', `Order #${order.orderId?.slice(-6) || order.id?.slice(-6)} has been cancelled successfully.`, [
          { text: 'OK', style: 'cancel' }
        ]);
        setAllOrders((prev) => prev.map((o) => (
          o.id === order.id ? { ...o, status: 'Cancelled', rawStatus: 'cancelled' } : o
        )));
      } else {
        Alert.alert('Cancel failed', response.message || 'Unable to cancel this order. Please try again.', [
          { text: 'OK', style: 'cancel' }
        ]);
      }
    } catch (error) {
      console.error('Order cancel error:', error);
      Alert.alert('Cancel failed', error?.message || 'Unable to cancel this order. Please try again.', [
        { text: 'OK', style: 'cancel' }
      ]);
    } finally {
      setCancellingOrderId(null);
    }
  };

  const promptCancelOrder = (order) => {
    Alert.alert(
      'Cancel Order',
      `Are you sure you want to cancel order #${order.orderId?.slice(-6) || order.id?.slice(-6)}? This can only be cancelled while pending.`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', onPress: () => cancelOrder(order) },
      ]
    );
  };

  const loadOrders = useCallback(async () => {
    try {
      const res = await ordersAPI.getMyOrders({ limit: 100 });
      if (res.success && Array.isArray(res.data)) {
        setAllOrders(
          res.data.map((o) => ({
            id: String(o.id),
            orderId: o.orderId,
            restaurant: o.pickup || 'Order',
            items: itemsSummary(o.items),
            total: o.bill?.total ?? o.total ?? 0,
            date: formatDate(o.createdAt),
            time: formatTime(o.createdAt),
            status: formatStatus(o.status),
            rawStatus: o.status,
            raw: o,
          }))
        );
      } else {
        setAllOrders([]);
      }
    } catch (e) {
      console.error('Order history load error:', e);
      setAllOrders([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadOrders().finally(() => setLoading(false));
    }, [loadOrders])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const { filteredOrders, activeCount, deliveredCount, cancelledCount, totalCount } = useMemo(() => {
    const active = allOrders.filter(o => 
      ['pending', 'accepted', 'processing', 'picked', 'preparing'].includes(String(o.rawStatus).toLowerCase())
    ).length;
    const delivered = allOrders.filter(o => 
      String(o.rawStatus).toLowerCase() === 'delivered'
    ).length;
    const cancelled = allOrders.filter(o => 
      String(o.rawStatus).toLowerCase() === 'cancelled'
    ).length;

    let filtered = allOrders;
    if (activeFilter === 'active') {
      filtered = allOrders.filter(o => 
        ['pending', 'accepted', 'processing', 'picked', 'preparing'].includes(String(o.rawStatus).toLowerCase())
      );
    } else if (activeFilter === 'completed') {
      filtered = allOrders.filter(o => 
        String(o.rawStatus).toLowerCase() === 'delivered'
      );
    }

    return {
      filteredOrders: filtered,
      activeCount: active,
      deliveredCount: delivered,
      cancelledCount: cancelled,
      totalCount: allOrders.length,
    };
  }, [allOrders, activeFilter]);

  const getStatusColor = (status) => {
    const s = String(status).toLowerCase();
    if (s.includes('deliver')) return COLORS.delivered;
    if (s.includes('cancel')) return '#FF6B6B';
    if (s.includes('progress') || s.includes('accept') || s.includes('pick')) return COLORS.inProgress;
    return COLORS.pending;
  };

  const getStatusIcon = (status) => {
    const s = String(status).toLowerCase();
    if (s.includes('deliver')) return 'checkmark-circle';
    if (s.includes('cancel')) return 'close-circle';
    return 'time';
  };

  const renderOrderItem = ({ item }) => (
    <View style={styles.orderCardWrapper}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('OrderDetails', { order: mapOrderToDetails(item.raw) })
        }
      >
        <Card style={styles.orderCard}>
          <View style={styles.orderHeader}>
          <View style={styles.restaurantInfo}>
            <View style={styles.restaurantIcon}>
              <Ionicons name="receipt-outline" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.restaurantTextBlock}>
              <Text style={styles.restaurantName} numberOfLines={1}>
                {item.restaurant}
              </Text>
              <Text style={styles.orderIdText}>#{item.orderId?.slice(-6) || item.id?.slice(-6)}</Text>
              <Text style={styles.orderDate}>
                {item.date} • {item.time}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Ionicons name={getStatusIcon(item.status)} size={14} color={COLORS.white} />
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.orderDetails}>
          <Text style={styles.itemsText} numberOfLines={2}>
            {item.items}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalAmount}>PKR {item.bill?.total || item.total}</Text>
          </View>
        </View>

        <View style={styles.viewRow}>
          <Text style={styles.viewDetailsText}>View details</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
        </View>
        {isPendingStatus(item.rawStatus) && (
          <TouchableOpacity
            style={styles.cancelOrderButton}
            onPress={() => promptCancelOrder(item)}
            activeOpacity={0.85}
            disabled={cancellingOrderId === item.id}
          >
            {cancellingOrderId === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.cancelOrderText}>Cancel Order</Text>
            )}
          </TouchableOpacity>
        )}
        </Card>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header navigation={navigation} title="Order History" showBackButton={true} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, filteredOrders.length === 0 && styles.emptyList]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListHeaderComponent={
            allOrders.length > 0 ? (
              <View style={styles.summaryContainer}>
                <TouchableOpacity 
                  style={[styles.summaryCard, activeFilter === 'total' && styles.summaryCardActive]}
                  onPress={() => setActiveFilter('total')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.summaryNumber, activeFilter === 'total' && styles.summaryNumberActive]}>{totalCount}</Text>
                  <Text style={[styles.summaryLabel, activeFilter === 'total' && styles.summaryLabelActive]}>Total</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.summaryCard, activeFilter === 'active' && styles.summaryCardActive]}
                  onPress={() => setActiveFilter('active')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.summaryNumber, activeFilter === 'active' && styles.summaryNumberActive, { color: '#c7b407ff' }]}>{activeCount}</Text>
                  <Text style={[styles.summaryLabel, activeFilter === 'active' && styles.summaryLabelActive]}>Active</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.summaryCard, activeFilter === 'completed' && styles.summaryCardActive]}
                  onPress={() => setActiveFilter('completed')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.summaryNumber, activeFilter === 'completed' && styles.summaryNumberActive, { color: '#4ECDC4' }]}>{deliveredCount}</Text>
                  <Text style={[styles.summaryLabel, activeFilter === 'completed' && styles.summaryLabelActive]}>Completed</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={60} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {activeFilter === 'active' 
                  ? 'No active orders' 
                  : activeFilter === 'completed' 
                    ? 'No completed orders' 
                    : 'No order history yet'}
              </Text>
              <Text style={styles.emptyHint}>
                {activeFilter === 'active' 
                  ? 'Your active/in-progress orders will appear here.' 
                  : activeFilter === 'completed' 
                    ? 'Your delivered orders will appear here.' 
                    : 'Your placed orders will appear here.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: SPACING.lg, paddingTop: SPACING.md },
  emptyList: { flexGrow: 1 },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginHorizontal: SPACING.xs,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  summaryCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#EEFAF9',
  },
  summaryNumber: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  summaryNumberActive: {
    fontWeight: '900',
  },
  summaryLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  summaryLabelActive: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  orderCardWrapper: {
    marginBottom: SPACING.lg,
  },
  orderCard: { padding: SPACING.md },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  restaurantInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: SPACING.sm },
  restaurantIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  restaurantTextBlock: { flex: 1 },
  restaurantName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  orderIdText: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  orderDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusText: { color: COLORS.white, fontSize: 11, fontWeight: '700', marginLeft: 4 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },
  orderDetails: { marginBottom: SPACING.sm },
  itemsText: { fontSize: 14, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  totalLabel: { fontSize: 14, color: COLORS.textSecondary, marginRight: 4 },
  totalAmount: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  viewDetailsText: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginRight: 4 },
  cancelOrderButton: {
    marginTop: SPACING.sm,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelOrderText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyContainer: { alignItems: 'center', paddingTop: 100, paddingHorizontal: SPACING.xl },
  emptyText: { fontSize: 16, color: COLORS.textSecondary, marginTop: SPACING.md, fontWeight: '600' },
  emptyHint: { fontSize: 14, color: COLORS.textSecondary, marginTop: SPACING.sm, textAlign: 'center' },
});

export default OrderHistoryScreen;
