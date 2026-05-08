import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import { ORDER_STATUS } from '../../utils/constants';

const { width, height } = Dimensions.get('window');

const formatTime = (date) =>
  date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const getEstimatedWindow = (createdAt) => {
  const base = createdAt ? new Date(createdAt) : new Date();
  const start = new Date(base.getTime() + 25 * 60 * 1000);
  const end = new Date(base.getTime() + 35 * 60 * 1000);
  return `${formatTime(start)} - ${formatTime(end)}`;
};

const ETA_TOTAL_MINUTES = 30;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const getMinutesRemaining = (createdAt, now = Date.now()) => {
  const baseMs = createdAt ? new Date(createdAt).getTime() : now;
  const elapsedMins = Math.floor((now - baseMs) / (60 * 1000));
  return clamp(ETA_TOTAL_MINUTES - elapsedMins, 0, ETA_TOTAL_MINUTES);
};

const getEtaProgress = (createdAt, now = Date.now()) => {
  const remaining = getMinutesRemaining(createdAt, now);
  return clamp((ETA_TOTAL_MINUTES - remaining) / ETA_TOTAL_MINUTES, 0, 1);
};

const normalizeItemsText = (order) => {
  if (Array.isArray(order?.items) && order.items.length > 0) {
    return order.items.map((i) => i?.text || i?.itemName || i).join(', ');
  }
  return order?.itemName || '';
};

const OrderDetailsScreen = ({ navigation, route }) => {
  const order = route?.params?.order || {};

  const [nowTick, setNowTick] = useState(Date.now());

  const isPending = order.status === ORDER_STATUS.PENDING || order.status === 'Pending';
  const showChatWithRider =
    order.status === ORDER_STATUS.IN_PROGRESS ||
    order.status === ORDER_STATUS.DELIVERED ||
    order.status === 'In Progress' ||
    order.status === 'Delivered' ||
    order.status === 'Completed';

  useEffect(() => {
    if (isPending) return;
    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [isPending]);

  const estimatedWindow = useMemo(() => {
    if (isPending) return null;
    return getEstimatedWindow(order.createdAt || order.date);
  }, [isPending, order.createdAt, order.date]);

  const minutesRemaining = useMemo(() => {
    if (isPending) return null;
    return getMinutesRemaining(order.createdAt || order.date, nowTick);
  }, [isPending, order.createdAt, order.date, nowTick]);

  const etaProgress = useMemo(() => {
    if (isPending) return 0;
    return getEtaProgress(order.createdAt || order.date, nowTick);
  }, [isPending, order.createdAt, order.date, nowTick]);

  const riderName = order.riderName || order.rider?.name || 'Not assigned yet';
  const riderPhone = order.riderPhone || order.rider?.phone || '—';
  const riderBikeReg = order.bikeRegNo || order.rider?.bikeRegNo || '—';

  const storeName = order.store || order.restaurant || '—';
  const areaName = order.area || '—';
  const addressText = order.address || order.deliveryAddress || '—';
  const itemsText = normalizeItemsText(order);

  const getStatusColor = () => {
    switch (order.status) {
      case 'Pending':
        return '#FFA235';
      case 'In Progress':
        return '#2EC4B6';
      case 'Delivered':
        return '#4CAF50';
      case 'Completed':
        return '#4CAF50';
      default:
        return '#94A3B8';
    }
  };

  const getStatusIcon = () => {
    switch (order.status) {
      case 'Pending':
        return 'time-outline';
      case 'In Progress':
        return 'bicycle-outline';
      case 'Delivered':
        return 'checkmark-circle-outline';
      case 'Completed':
        return 'checkmark-done-circle-outline';
      default:
        return 'receipt-outline';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        navigation={navigation}
        title="Order Details"
        showBackButton={true}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Enhanced Map Section */}
        <View style={styles.mapSection}>
          <Image
            source={require('../../assets/images/map.png')}
            style={styles.mapImage}
            resizeMode="cover"
          />
          <View style={styles.mapGradient} />
          
          <View style={styles.mapOverlayHeader}>
            <View style={styles.mapTitleContainer}>
              <Ionicons name="location-sharp" size={20} color="#fff" />
              <Text style={styles.mapTitle}>Track your rider</Text>
            </View>
            <TouchableOpacity style={styles.helpPill}>
              <Ionicons name="help-circle-outline" size={16} color="#fff" />
              <Text style={styles.helpText}>Help</Text>
            </TouchableOpacity>
          </View>

          {/* Rider Location Indicator */}
          <View style={styles.riderLocationBadge}>
            <View style={styles.pulsingDot} />
            <Text style={styles.riderLocationText}>Rider is 1.2 km away</Text>
          </View>
        </View>

        {/* Enhanced ETA Card */}
        <View style={styles.etaCard}>
          <View style={styles.etaHeader}>
            <View style={styles.etaIconContainer}>
              <Ionicons name="stopwatch-outline" size={22} color="#2EC4B6" />
            </View>
            <View>
              <Text style={styles.etaOverlayLabel}>Estimated arrival</Text>
              {isPending ? (
                <Text style={styles.etaOverlayPending}>Waiting for rider acceptance</Text>
              ) : (
                <Text style={styles.etaOverlayMins}>{minutesRemaining} minutes</Text>
              )}
            </View>
          </View>

          {!isPending && (
            <>
              <View style={styles.etaTimeWindow}>
                <Ionicons name="calendar-outline" size={14} color="#64748B" />
                <Text style={styles.etaOverlayWindow}>{estimatedWindow}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${etaProgress * 100}%` }]} />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressLabel}>Order placed</Text>
                <Text style={styles.progressLabel}>Preparing</Text>
                <Text style={styles.progressLabel}>On the way</Text>
                <Text style={styles.progressLabel}>Delivered</Text>
              </View>
            </>
          )}
        </View>

        {/* Enhanced Chat Button */}
        {showChatWithRider && (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.chatButton}
            onPress={() => navigation.navigate('Chat')}
          >
            <View style={styles.chatIconContainer}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#2EC4B6" />
            </View>
            <Text style={styles.chatButtonText}>Chat with rider</Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Enhanced Rider Card */}
        <Card style={styles.riderCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={styles.cardIconWrapper}>
                <Ionicons name="bicycle" size={20} color="#2EC4B6" />
              </View>
              <Text style={styles.cardTitle}>Rider Details</Text>
            </View>
            {/* <View style={styles.riderRating}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.riderRatingText}>4.9</Text>
            </View> */}
          </View>

          <View style={styles.riderInfoRow}>
            <View style={styles.riderAvatar}>
              <Text style={styles.riderAvatarText}>
                {riderName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.riderInfo}>
              <Text style={styles.riderName}>{riderName}</Text>
              <View style={styles.riderContactRow}>
                <Ionicons name="call-outline" size={14} color="#2EC4B6" />
                <Text style={styles.riderPhone}>{riderPhone}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.callButton}>
              <Ionicons name="chatbox-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIconLabel}>
              <Ionicons name="car-outline" size={16} color="#64748B" />
              <Text style={styles.detailLabel}>Bike Registration</Text>
            </View>
            <Text style={styles.detailValue}>{riderBikeReg}</Text>
          </View>
        </Card>

        {/* Enhanced Order Card */}
        <Card style={styles.orderCard}>
          <View style={styles.cardTitleRow}>
            <View style={styles.cardIconWrapper}>
              <Ionicons name="receipt-outline" size={20} color="#2EC4B6" />
            </View>
            <Text style={styles.cardTitle}>Order Details</Text>
          </View>

          <View style={styles.orderIdRow}>
            <Text style={styles.orderIdLabel}>Order ID</Text>
            <View style={styles.orderIdBadge}>
              <Text style={styles.orderIdValue}>#{String(order.id || '—').slice(-6)}</Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor()}15` }]}>
              <Ionicons name={getStatusIcon()} size={16} color={getStatusColor()} />
              <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {order.status || '—'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconLabel}>
                <Ionicons name="storefront-outline" size={18} color="#64748B" />
                <Text style={styles.infoLabel}>Store</Text>
              </View>
              <Text style={styles.infoValue}>{storeName}</Text>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIconLabel}>
                <Ionicons name="location-outline" size={18} color="#64748B" />
                <Text style={styles.infoLabel}>Area</Text>
              </View>
              <Text style={styles.infoValue}>{areaName}</Text>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIconLabel}>
                <Ionicons name="home-outline" size={18} color="#64748B" />
                <Text style={styles.infoLabel}>Delivery Address</Text>
              </View>
              <Text style={styles.infoValue}>{addressText}</Text>
            </View>

            <View style={styles.itemsSection}>
              <View style={styles.infoIconLabel}>
                <Ionicons name="fast-food-outline" size={18} color="#64748B" />
                <Text style={styles.infoLabel}>Items Ordered</Text>
              </View>
              <View style={styles.itemsList}>
                {itemsText.split(', ').map((item, index) => (
                  <View key={index} style={styles.itemChip}>
                    <Text style={styles.itemChipText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl * 2,
  },
  mapSection: {
    marginHorizontal: -SPACING.lg,
    marginTop: -SPACING.md,
    height: 280,
    backgroundColor: '#0f172a',
    marginBottom: SPACING.md,
    position: 'relative',
    overflow: 'hidden',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  mapOverlayHeader: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    top: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mapTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  helpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  helpText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  riderLocationBadge: {
    position: 'absolute',
    bottom: SPACING.lg,
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    alignSelf: 'flex-start',
  },
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2EC4B6',
  },
  riderLocationText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  etaCard: {
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: SPACING.md,
  },
  etaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: SPACING.md,
  },
  etaIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2EC4B615',
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaOverlayLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  etaOverlayMins: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1E293B',
  },
  etaOverlayPending: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFA235',
  },
  etaTimeWindow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.md,
  },
  etaOverlayWindow: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  progressTrack: {
    marginTop: SPACING.sm,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2EC4B6',
    borderRadius: 8,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  progressLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: '#94A3B8',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2EC4B6',
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: 14,
    marginBottom: SPACING.md,
    shadowColor: '#2EC4B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  chatIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  riderCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
  },
  orderCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2EC4B615',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  riderRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riderRatingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  riderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: SPACING.md,
  },
  riderAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2EC4B6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderAvatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  riderInfo: {
    flex: 1,
  },
  riderName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  riderContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  riderPhone: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2EC4B6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  orderIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  orderIdLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  orderIdBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderIdValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  statusRow: {
    marginBottom: SPACING.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoSection: {
    gap: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  infoIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
    textAlign: 'right',
  },
  itemsSection: {
    gap: 10,
  },
  itemsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  itemChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  itemChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1E293B',
  },
  paymentSummary: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  totalRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2EC4B6',
  },
});

export default OrderDetailsScreen;