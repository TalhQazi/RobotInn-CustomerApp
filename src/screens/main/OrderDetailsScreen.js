import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import firestore from '@react-native-firebase/firestore';
import LiveTrackingMap from '../../components/order/LiveTrackingMap';
import ThemedAlert from '../../components/common/ThemedAlert';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import { ordersAPI, usersAPI } from '../../services/api';
import {
  geocodeAddress,
  getDrivingDistance,
  formatEtaWindow,
  haversineKm,
  normalizeRiderLocation,
} from '../../utils/maps';
import {
  connectSocket,
  joinOrderRoom,
  leaveOrderRoom,
  onRiderLocationUpdated,
  onOrderUpdated,
} from '../../services/socket';

const TRACKING_STATUSES = ['accepted', 'processing', 'picked'];

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const STATUS_DISPLAY = {
  pending: 'Pending',
  accepted: 'Accepted',
  processing: 'In Progress',
  picked: 'Picked Up',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function normalizeOrderStatus(status) {
  const value = String(status || '').toLowerCase().trim();
  const aliases = {
    'in progress': 'processing',
    'picked up': 'picked',
  };
  return aliases[value] || value;
}

function isTrackableStatus(status) {
  return TRACKING_STATUSES.includes(normalizeOrderStatus(status));
}

function formatStatus(status) {
  if (!status) return 'Pending';
  const key = normalizeOrderStatus(status);
  return STATUS_DISPLAY[key] || status.charAt(0).toUpperCase() + status.slice(1);
}

function formatOrderDate(dateVal) {
  if (!dateVal) return 'Jul 21, 2026';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'Jul 21, 2026';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Jul 21, 2026';
  }
}

function formatOrderTime(dateVal) {
  if (!dateVal) return '12:07 PM';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '12:07 PM';
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '12:07 PM';
  }
}

function formatOrderPrice(totalVal, items, bill) {
  const computedBillAmount =
    bill?.amount ??
    bill?.total ??
    ((parseFloat(bill?.productPrice) || 0) + (parseFloat(bill?.shippingFee) || 0));
  const val = (totalVal != null && totalVal !== '' && Number(totalVal) > 0) ? totalVal : (computedBillAmount > 0 ? computedBillAmount : null);

  if (val != null && val !== '' && !isNaN(Number(val)) && Number(val) > 0) {
    return `Rs. ${Number(val).toLocaleString('en-US')}`;
  }
  if (Array.isArray(items) && items.length > 0) {
    const calculated = items.reduce((sum, item) => {
      const p = parseFloat(item?.price || item?.cost || item?.amount) || 0;
      const q = parseInt(item?.quantity || item?.qty, 10) || 1;
      return sum + p * q;
    }, 0);
    if (calculated > 0) {
      return `Rs. ${calculated.toLocaleString('en-US')}`;
    }
  }
  return 'Rs. 0.00';
}

function mapApiOrderToView(o) {
  if (!o) return {};
  const riderLocation = normalizeRiderLocation(o.riderLocation);
  const createdAt = o.createdAt || o.date || o.timestamp || o.time;
  const billTotal =
    o.bill?.amount ??
    o.bill?.total ??
    ((parseFloat(o.bill?.productPrice) || 0) + (parseFloat(o.bill?.shippingFee) || 0));
  const total = o.total ?? o.price ?? o.amount ?? (billTotal > 0 ? billTotal : null);

  return {
    id: o.id,
    orderId: o.orderId,
    status: formatStatus(o.status),
    rawStatus: o.status,
    store: o.pickup || o.store || o.restaurant || '—',
    restaurant: o.pickup || o.restaurant || o.store || '—',
    area: o.area || '—',
    address: o.dropoff || o.address || o.deliveryAddress || '—',
    deliveryAddress: o.dropoff || o.deliveryAddress || o.address || '—',
    items: o.items,
    total: total,
    bill: o.bill,
    pickup: o.pickup || o.store,
    dropoff: o.dropoff || o.address || o.deliveryAddress,
    createdAt: createdAt,
    date: createdAt,
    riderId: o.rider?.id || o.riderId,
    riderName: o.rider?.name || o.riderName,
    riderPhone: o.rider?.phone || o.riderPhone,
    rider: o.rider || (o.riderId ? { id: o.riderId, name: o.riderName, phone: o.riderPhone } : null),
    estimatedArrivalTime: o.estimatedArrivalTime,
    estimatedDuration: o.estimatedDuration,
    minutesRemaining: o.minutesRemaining,
    etaProgress: o.etaProgress,
    riderLocation,
    distanceToCustomer: o.distanceToCustomer,
    location: o.location || null,
    rating: o.rating || null,
  };
}

const getItemLabel = (item) => {
  if (typeof item === 'string') {
    return item;
  }

  if (!item || typeof item !== 'object') {
    return String(item || '');
  }

  const name =
    item.name ||
    item.text ||
    item.itemName ||
    item.title ||
    item.label ||
    item.product?.name ||
    item.product?.title ||
    item.item?.name ||
    item.nameWithQuantity ||
    JSON.stringify(item);

  const store = item.store || '';
  return store ? `${name} (${store})` : name;
};

const normalizeItemsText = (order) => {
  if (Array.isArray(order?.items) && order.items.length > 0) {
    return order.items.map(getItemLabel).filter(Boolean).join(', ');
  }
  return getItemLabel(order?.itemName || order?.items || '');
};

const getOrderItemList = (order) => {
  if (Array.isArray(order?.items)) {
    return order.items;
  }
  if (order?.items) {
    return [order.items];
  }
  return [];
};

const OrderDetailsScreen = ({ navigation, route }) => {
  const initialOrder = route?.params?.order || {};
  const [order, setOrder] = useState(() => mapApiOrderToView(initialOrder));
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [themedAlert, setThemedAlert] = useState({ visible: false, title: '', message: '', buttons: [] });
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [distanceText, setDistanceText] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());
  const simIntervalRef = useRef(null);

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingReview, setRatingReview] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [riderRating, setRiderRating] = useState(null);

  const orderMongoId = order.id || initialOrder.id;

  const loadLiveOrder = useCallback(async () => {
    if (!orderMongoId) {
      setLoading(false);
      return;
    }

    const shouldShowLoading = !initialLoadComplete;
    if (shouldShowLoading) {
      setLoading(true);
    }

    try {
      const res = await ordersAPI.getById(orderMongoId);
      if (res.success && res.data) {
        console.log('ORDER DATA:', JSON.stringify(res.data, null, 2));
        setOrder(mapApiOrderToView(res.data));
      }
    } catch (error) {
      console.error('Order details refresh error:', error);
    } finally {
      if (shouldShowLoading) {
        setLoading(false);
      }
      setInitialLoadComplete(true);
    }
  }, [orderMongoId, initialLoadComplete]);

  useFocusEffect(
    useCallback(() => {
      loadLiveOrder();

      let poll = setInterval(loadLiveOrder, 10000);

      return () => clearInterval(poll);
    }, [loadLiveOrder])
  );

  const statusLower = normalizeOrderStatus(order.rawStatus || order.status);
  const isPending = statusLower === 'pending';
  const isCancellable = statusLower !== 'delivered' && statusLower !== 'completed' && statusLower !== 'cancelled';
  const isTracking = isTrackableStatus(order.rawStatus || order.status) || Boolean(order.riderId);

  useEffect(() => {
    if (!isTracking) {
      return undefined;
    }

    const poll = setInterval(loadLiveOrder, 5000);
    return () => clearInterval(poll);
  }, [isTracking, loadLiveOrder]);

  useEffect(() => {
    if (order.riderId) {
      usersAPI.getUserById(order.riderId)
        .then(res => {
          if (res.success && res.data && res.data.rating != null) {
            setRiderRating(res.data.rating);
          }
        })
        .catch(err => console.log('Error fetching rider rating:', err));
    } else {
      setRiderRating(null);
    }
  }, [order.riderId]);

  useEffect(() => {
    if (!orderMongoId || !isTracking) {
      return undefined;
    }

    let active = true;
    let unsubscribeLocation = () => { };
    let unsubscribeOrder = () => { };

    (async () => {
      await connectSocket();
      if (!active) {
        return;
      }

      await joinOrderRoom(orderMongoId);
      if (!active) {
        return;
      }

      unsubscribeLocation = onRiderLocationUpdated((payload) => {
        const normalized = normalizeRiderLocation(payload);
        if (!normalized) {
          return;
        }

        setOrder((prev) => ({
          ...prev,
          riderLocation: normalized,
        }));
      });

      unsubscribeOrder = onOrderUpdated((payload) => {
        if (payload?.status) {
          setOrder((prev) => ({
            ...prev,
            rawStatus: payload.status,
            status: formatStatus(payload.status),
          }));
        }
      });
    })();

    return () => {
      active = false;
      unsubscribeLocation();
      unsubscribeOrder();
      leaveOrderRoom();
    };
  }, [orderMongoId, isTracking]);

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 30000);
    return () => {
      clearInterval(interval);
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (order.location?.lat && order.location?.lng) {
      setDestinationCoords(order.location);
      return undefined;
    }
    let cancelled = false;
    const address = order.address || order.deliveryAddress || order.dropoff;
    const area = order.area;
    geocodeAddress(address, area).then((coords) => {
      if (!cancelled) {
        setDestinationCoords(coords);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [order.address, order.deliveryAddress, order.dropoff, order.area, order.location]);

  const riderCoords = useMemo(() => {
    const loc = normalizeRiderLocation(order.riderLocation);
    if (loc) {
      return { lat: loc.latitude, lng: loc.longitude };
    }
    return null;
  }, [order.riderLocation]);

  useEffect(() => {
    let cancelled = false;
    if (!riderCoords) {
      setDistanceText('');
      return undefined;
    }

    if (!destinationCoords) {
      setDistanceText('Rider location received');
      return undefined;
    }

    getDrivingDistance(riderCoords, destinationCoords).then((matrix) => {
      if (cancelled) {
        return;
      }
      if (matrix?.distanceText && matrix?.durationText) {
        setDistanceText(`Rider is ${matrix.distanceText} away • ${matrix.durationText} by road`);
        return;
      }
      const km = haversineKm(
        riderCoords.lat,
        riderCoords.lng,
        destinationCoords.lat,
        destinationCoords.lng
      );
      setDistanceText(`Rider is ${km.toFixed(1)} km away`);
    });

    return () => {
      cancelled = true;
    };
  }, [riderCoords, destinationCoords]);

  const riderId = order.rider?.id || order.riderId;
  const showChatWithRider =
    !!riderId && statusLower !== 'pending' && statusLower !== 'cancelled';

  useEffect(() => {
    if (isDelivered && !order.rating && order.riderId && !showRatingModal) {
      setShowRatingModal(true);
    }
  }, [isDelivered, order.rating, order.riderId]);

  const handleSubmitRating = async () => {
    if (ratingScore === 0) {
      showThemedAlert({
        title: 'Rating Required',
        message: 'Please select a star rating.',
        buttons: [{ text: 'OK', style: 'cancel' }]
      });
      return;
    }

    setSubmittingRating(true);
    try {
      await ordersAPI.submitOrderRating(orderMongoId, order.riderId, ratingScore, ratingReview.trim());
      setOrder(prev => ({
        ...prev,
        rating: { score: ratingScore, review: ratingReview.trim() }
      }));
      setShowRatingModal(false);
      showThemedAlert({
        title: 'Thank You!',
        message: 'Your feedback helps us improve our service.',
        buttons: [{ text: 'OK', style: 'cancel' }]
      });
    } catch (error) {
      console.error('Rating submission failed:', error);
      showThemedAlert({
        title: 'Submission Failed',
        message: 'Unable to submit your rating. Please try again.',
        buttons: [{ text: 'OK', style: 'cancel' }]
      });
    } finally {
      setSubmittingRating(false);
    }
  };

  const showThemedAlert = ({ title, message, buttons = [] }) => {
    setThemedAlert({ visible: true, title, message, buttons });
  };

  const hideThemedAlert = () => {
    setThemedAlert({ visible: false, title: '', message: '', buttons: [] });
  };

  const handleCancelOrder = () => {
    if (!orderMongoId) {
      showThemedAlert({
        title: 'Unable to cancel',
        message: 'This order cannot be cancelled at the moment.',
        buttons: [{ text: 'OK', style: 'cancel' }]
      });
      return;
    }

    showThemedAlert({
      title: 'Cancel Order',
      message: 'Are you sure you want to cancel this order? This can only be done while it is still pending.',
      buttons: [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const response = await ordersAPI.cancel(orderMongoId);
              if (response.success) {
                setOrder((prev) => ({
                  ...prev,
                  rawStatus: 'cancelled',
                  status: formatStatus('cancelled')
                }));
                showThemedAlert({
                  title: 'Order Cancelled',
                  message: 'Your order has been cancelled successfully.',
                  buttons: [{ text: 'OK', style: 'cancel' }]
                });
                navigation.goBack();
              }
            } catch (error) {
              showThemedAlert({
                title: 'Cancel failed',
                message: error.message || 'Unable to cancel order. Please try again.',
                buttons: [{ text: 'OK', style: 'cancel' }]
              });
            } finally {
              setCancelling(false);
            }
          }
        }
      ]
    });
  };

  const handleSimulateRider = async () => {
    if (!orderMongoId) {
      showThemedAlert({
        title: 'Simulation Error',
        message: 'Order ID is missing.',
        buttons: [{ text: 'OK', style: 'cancel' }]
      });
      return;
    }

    try {
      let dest = destinationCoords;
      if (!dest) {
        const address = order.address || order.deliveryAddress || order.dropoff;
        const area = order.area;
        dest = await geocodeAddress(address, area);
      }

      if (!dest) {
        dest = { lat: 33.6844, lng: 73.0479 };
      }

      const startLat = dest.lat + 0.008;
      const startLng = dest.lng + 0.008;

      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }

      // Update Firestore to assign the rider and change status
      await firestore().collection('orders').doc(orderMongoId).update({
        status: 'In Progress',
        riderId: 'simulated_rider_1',
        riderName: 'Sher Shah (Simulated)',
        riderPhone: '+92 300 1234567',
        riderLocation: {
          latitude: startLat,
          longitude: startLng,
        },
        estimatedDuration: 12,
        estimatedArrivalTime: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      });

      showThemedAlert({
        title: 'Simulation Started',
        message: 'Rider assigned! The rider will now start moving towards your location.',
        buttons: [{ text: 'OK', style: 'cancel' }]
      });

      let step = 0;
      const totalSteps = 30;
      simIntervalRef.current = setInterval(async () => {
        step++;
        if (step > totalSteps) {
          if (simIntervalRef.current) {
            clearInterval(simIntervalRef.current);
            simIntervalRef.current = null;
          }
          await firestore().collection('orders').doc(orderMongoId).update({
            status: 'Delivered',
            updatedAt: new Date().toISOString()
          });
          return;
        }

        const ratio = step / totalSteps;
        const currentLat = startLat + (dest.lat - startLat) * ratio;
        const currentLng = startLng + (dest.lng - startLng) * ratio;

        await firestore().collection('orders').doc(orderMongoId).update({
          riderLocation: {
            latitude: currentLat,
            longitude: currentLng,
          },
          updatedAt: new Date().toISOString()
        });
      }, 4000);

    } catch (error) {
      console.error('Error starting simulation:', error);
      showThemedAlert({
        title: 'Simulation Failed',
        message: error.message || 'Unable to update order in database.',
        buttons: [{ text: 'OK', style: 'cancel' }]
      });
    }
  };

  const minutesRemaining = useMemo(() => {
    if (order.minutesRemaining != null) {
      return order.minutesRemaining;
    }
    if (!order.estimatedArrivalTime) {
      return null;
    }
    const diffMs = new Date(order.estimatedArrivalTime).getTime() - nowTick;
    return Math.max(0, Math.ceil(diffMs / (60 * 1000)));
  }, [order.minutesRemaining, order.estimatedArrivalTime, nowTick]);

  const etaProgress = useMemo(() => {
    if (order.etaProgress != null) {
      return clamp(order.etaProgress, 0, 1);
    }
    if (!order.estimatedDuration || minutesRemaining == null) {
      return 0;
    }
    return clamp(
      (order.estimatedDuration - minutesRemaining) / order.estimatedDuration,
      0,
      1
    );
  }, [order.etaProgress, order.estimatedDuration, minutesRemaining]);

  const statusProgress = useMemo(() => {
    switch (statusLower) {
      case 'pending':
        return 0.08;
      case 'accepted':
        return 0.33;
      case 'processing':
      case 'in progress':
        return 0.66;
      case 'picked':
      case 'picked up':
        return 0.85;
      case 'delivered':
      case 'completed':
        return 1;
      default:
        return etaProgress;
    }
  }, [statusLower, etaProgress]);

  const isDelivered = statusLower === 'delivered' || statusLower === 'completed';

  const estimatedWindow = useMemo(() => {
    if (isPending || isDelivered) {
      return null;
    }
    return formatEtaWindow(order.estimatedArrivalTime);
  }, [isPending, isDelivered, order.estimatedArrivalTime]);

  const etaStatusText = useMemo(() => {
    if (isDelivered) {
      return 'Order completed';
    }
    switch (statusLower) {
      case 'pending':
        return 'Waiting for rider acceptance';
      case 'accepted':
        return 'Order accepted';
      case 'processing':
      case 'in progress':
        return 'Order in progress';
      case 'picked':
      case 'picked up':
        return 'Order picked up';
      default:
        return minutesRemaining != null ? `${minutesRemaining} minutes` : 'ETA will appear when rider starts';
    }
  }, [isDelivered, statusLower, minutesRemaining]);

  const riderName = order.riderName || order.rider?.name || 'Not assigned yet';
  const riderPhone = order.riderPhone || order.rider?.phone || '—';
  const riderBikeReg = order.bikeRegNo || order.rider?.bikeRegNo || '—';

  const storeName = order.store || order.restaurant || '—';
  const areaName = order.area || '—';
  const addressText = order.address || order.deliveryAddress || '—';
  const itemsText = normalizeItemsText(order);
  const orderItemList = getOrderItemList(order);

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

  if (loading && !order.id) {
    return (
      <SafeAreaView style={styles.container}>
        <Header navigation={navigation} title="Order Details" showBackButton={true} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#2EC4B6" />
        </View>
      </SafeAreaView>
    );
  }

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
        <View style={styles.mapSection}>
          <LiveTrackingMap
            riderCoords={riderCoords}
            destinationCoords={destinationCoords}
            distanceText={distanceText}
            loading={loading && !riderCoords && !destinationCoords}
            isTracking={isTracking || !!destinationCoords}
            trackingActive={isTracking && !!riderCoords}
          />
        </View>

        {/* Enhanced ETA Card */}
        <View style={styles.etaCard}>
          <View style={styles.etaHeader}>
            <View style={styles.etaIconContainer}>
              <Ionicons name="stopwatch-outline" size={22} color="#2EC4B6" />
            </View>
            <View>
              <Text style={styles.etaOverlayLabel}>Order progress</Text>
              <Text style={isDelivered ? styles.etaOverlayCompleted : styles.etaOverlayMins}>
                {etaStatusText}
              </Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${statusProgress * 100}%` }]} />
          </View>

          {!isDelivered && estimatedWindow ? (
            <View style={styles.etaTimeWindow}>
              <Ionicons name="calendar-outline" size={14} color="#64748B" />
              <Text style={styles.etaOverlayWindow}>Arriving by {estimatedWindow}</Text>
            </View>
          ) : null}

        </View>

        {/* Enhanced Chat Button */}
        {showChatWithRider && (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.chatButton}
            onPress={() => {
              if (!riderId) {
                showThemedAlert({
                  title: 'No rider',
                  message: 'A rider has not been assigned to this order yet.',
                  buttons: [{ text: 'OK', style: 'cancel' }]
                });
                return;
              }
              navigation.navigate('Chat', {
                participantId: String(riderId),
                contactName: riderName,
                orderCode: order.orderId,
                riderPhone: riderPhone,
              });
            }}
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
            {riderRating !== null && (
              <View style={styles.riderRating}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.riderRatingText}>{riderRating > 0 ? riderRating.toFixed(1) : '-'}</Text>
              </View>
            )}
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
            {showChatWithRider && (
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => {
                  navigation.navigate('Chat', {
                    participantId: String(riderId),
                    contactName: riderName,
                    orderCode: order.orderId,
                    riderPhone: riderPhone,
                  });
                }}
              >
                <Ionicons name="chatbox-outline" size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIconLabel}>
              {/* <Ionicons name="car-outline" size={16} color="#64748B" />
              <Text style={styles.detailLabel}>Bike Registration</Text> */}
            </View>
            {/* <Text style={styles.detailValue}>{riderBikeReg}</Text> */}
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

              <Text style={styles.orderIdValue}>#{order.orderId?.slice(-6) || order.id?.slice(-6) || '—'}</Text>

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

          {isCancellable && (
            <View style={{ gap: 10, marginBottom: 10 }}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.simulateButton}
                onPress={handleSimulateRider}
              >
                <Ionicons name="play-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.simulateButtonText}>Simulate Rider Tracking</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.cancelButton, { marginBottom: 0 }, cancelling && styles.cancelButtonDisabled]}
                onPress={handleCancelOrder}
                disabled={cancelling}
              >
                <Text style={styles.cancelButtonText}>
                  {cancelling ? 'Cancelling...' : 'Cancel Order'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.divider} />

          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconLabel}>
                <Ionicons name="calendar-outline" size={18} color="#64748B" />
                <Text style={styles.infoLabel}>Date</Text>
              </View>
              <Text style={styles.infoValue}>{formatOrderDate(order.createdAt || order.date)}</Text>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIconLabel}>
                <Ionicons name="time-outline" size={18} color="#64748B" />
                <Text style={styles.infoLabel}>Time</Text>
              </View>
              <Text style={styles.infoValue}>{formatOrderTime(order.createdAt || order.date)}</Text>
            </View>

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
                {orderItemList.map((item, index) => (
                  <View key={`${index}-${getItemLabel(item)}`} style={styles.itemChip}>
                    <Text style={styles.itemChipText}>{getItemLabel(item)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.paymentSummary}>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <View style={styles.infoIconLabel}>
                <Ionicons name="cash-outline" size={20} color="#2EC4B6" />
                <Text style={styles.totalLabel}>Total Price</Text>
              </View>
              <Text style={styles.totalValue}>{formatOrderPrice(order.total, order.items, order.bill)}</Text>
            </View>
          </View>

        </Card>
      </ScrollView>
      <ThemedAlert
        visible={themedAlert.visible}
        title={themedAlert.title}
        message={themedAlert.message}
        buttons={themedAlert.buttons}
        onRequestClose={hideThemedAlert}
      />

      <Modal
        visible={showRatingModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ratingModalContent}>
            <View style={styles.ratingHeader}>
              <Text style={styles.ratingTitle}>Rate your Delivery</Text>
              <TouchableOpacity onPress={() => setShowRatingModal(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.riderAvatarModal}>
              <Text style={styles.riderAvatarTextModal}>
                {riderName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.ratingRiderName}>How was your delivery by {riderName}?</Text>

            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRatingScore(star)}>
                  <Ionicons
                    name={star <= ratingScore ? 'star' : 'star-outline'}
                    size={40}
                    color={star <= ratingScore ? '#FFD700' : '#E2E8F0'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.reviewInput}
              placeholder="Write an optional review..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              value={ratingReview}
              onChangeText={setRatingReview}
            />

            <TouchableOpacity
              style={[styles.submitRatingBtn, submittingRating && styles.submitRatingBtnDisabled]}
              onPress={handleSubmitRating}
              disabled={submittingRating}
            >
              {submittingRating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitRatingText}>Submit Rating</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#E2E8F0',
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
  etaOverlayCompleted: {
    fontSize: 28,
    fontWeight: '900',
    color: '#22C55E',
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
  cancelButton: {
    backgroundColor: '#F87171',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
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
  simulateButton: {
    backgroundColor: '#2EC4B6',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  simulateButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  ratingModalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  ratingHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    position: 'relative',
  },
  ratingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  closeModalBtn: {
    position: 'absolute',
    right: 0,
    top: -4,
    padding: 4,
  },
  riderAvatarModal: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2EC4B6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  riderAvatarTextModal: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  ratingRiderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: SPACING.xl,
  },
  reviewInput: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    fontSize: 15,
    color: '#1E293B',
    textAlignVertical: 'top',
    minHeight: 100,
    marginBottom: SPACING.xl,
  },
  submitRatingBtn: {
    width: '100%',
    backgroundColor: '#2EC4B6',
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitRatingBtnDisabled: {
    opacity: 0.7,
  },
  submitRatingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default OrderDetailsScreen;