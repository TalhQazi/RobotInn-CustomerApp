/**
 * PaymentAdjustmentModal.js
 * Customer-facing bottom-sheet that appears when an active order
 * transitions to `ADJUSTMENT_PENDING` (rider proposed a price change).
 *
 * Triggered from DashboardScreen when order.status === 'ADJUSTMENT_PENDING'.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.72;

/**
 * @param {object}   props
 * @param {boolean}  props.visible           - Controls modal visibility
 * @param {object}   props.order             - Active order object (id, estimatedSubtotal, adjustmentData, etc.)
 * @param {Function} props.onApprove         - Called when customer taps "Approve & Pay Difference"
 * @param {Function} props.onDispute         - Called when customer taps "Challenge / Dispute"
 * @param {Function} props.onDismiss         - Called to close without action (e.g. backdrop press)
 * @param {boolean}  props.isSubmitting      - Shows loading spinner on active button
 */
const PaymentAdjustmentModal = ({
  visible,
  order,
  onApprove,
  onDispute,
  onDismiss,
  isSubmitting = false,
}) => {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const slideIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 68,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, overlayAnim]);

  const slideOut = useCallback((callback) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => callback && callback());
  }, [slideAnim, overlayAnim]);

  useEffect(() => {
    if (visible) {
      slideIn();
    }
  }, [visible, slideIn]);

  const handleDismiss = () => {
    slideOut(() => onDismiss && onDismiss());
  };

  if (!order) return null;

  const adjustment = order.adjustmentData || {};
  const originalAmount = parseFloat(order.estimatedSubtotal || adjustment.originalEstimatedAmount || 0);
  const proposedAmount = parseFloat(adjustment.proposedNewAmount || order.proposedTotal || 0);
  const difference = (proposedAmount - originalAmount).toFixed(2);
  const receiptImageUrl = adjustment.receiptImageUrl || order.receiptUrl || null;
  const riderName = order.riderName || order.rider?.name || 'Rider';
  const riderReason = adjustment.reason || 'Actual store prices differ from estimate.';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      {/* ── Dimmed Overlay ── */}
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleDismiss} />
      </Animated.View>

      {/* ── Bottom Sheet Panel ── */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>

        {/* Sheet Handle Bar */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* ── Warning Header ── */}
        <View style={styles.warningHeader}>
          <View style={styles.warningIconCircle}>
            <MaterialCommunityIcons name="alert-circle" size={28} color="#E63946" />
          </View>
          <View style={styles.warningHeaderText}>
            <Text style={styles.warningTitle}>Price Adjustment Required</Text>
            <Text style={styles.warningSubtitle}>{riderName} has updated your order total</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>

          {/* ── Bill Photo Preview ── */}
          {receiptImageUrl ? (
            <View style={styles.receiptCard}>
              <Text style={styles.sectionLabel}>
                <Ionicons name="receipt-outline" size={14} color="#666" />  Store Receipt (Uploaded by Rider)
              </Text>
              <Image source={{ uri: receiptImageUrl }} style={styles.receiptImage} resizeMode="cover" />
            </View>
          ) : (
            <View style={styles.receiptCardPlaceholder}>
              <Ionicons name="image-outline" size={32} color="#ccc" />
              <Text style={styles.receiptPlaceholderText}>Receipt photo not yet available</Text>
            </View>
          )}

          {/* ── Price Breakdown ── */}
          <View style={styles.priceCard}>
            <Text style={styles.sectionLabel}>
              <Ionicons name="calculator-outline" size={14} color="#666" />  Payment Breakdown
            </Text>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Original Estimate</Text>
              <Text style={styles.priceOriginal}>Rs. {originalAmount.toFixed(2)}</Text>
            </View>
            <View style={styles.priceDivider} />
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Actual Store Bill</Text>
              <Text style={styles.priceProposed}>Rs. {proposedAmount.toFixed(2)}</Text>
            </View>
            <View style={[styles.priceDivider, { borderStyle: 'solid', borderColor: '#E63946' }]} />
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { fontWeight: '700', color: '#E63946' }]}>Extra to Pay</Text>
              <Text style={styles.priceDifference}>
                + Rs. {Math.abs(parseFloat(difference)).toFixed(2)}
              </Text>
            </View>
          </View>

          {/* ── Rider Reason Note ── */}
          <View style={styles.reasonCard}>
            <Text style={styles.sectionLabel}>
              <Ionicons name="chatbubble-ellipses-outline" size={14} color="#666" />  Rider's Note
            </Text>
            <Text style={styles.reasonText}>"{riderReason}"</Text>
          </View>

        </ScrollView>

        {/* ── Action Buttons ── */}
        <View style={styles.actionsContainer}>
          {/* Dispute Button */}
          <TouchableOpacity
            style={styles.disputeButton}
            onPress={() => !isSubmitting && onDispute && onDispute(order)}
            activeOpacity={0.82}
            disabled={isSubmitting}
          >
            <Ionicons name="close-circle-outline" size={20} color="#E63946" />
            <Text style={styles.disputeButtonText}>Challenge Amount</Text>
          </TouchableOpacity>

          {/* Approve Button */}
          <TouchableOpacity
            style={[styles.approveButton, isSubmitting && styles.approveButtonLoading]}
            onPress={() => !isSubmitting && onApprove && onApprove(order)}
            activeOpacity={0.88}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.approveButtonText}>Approve & Pay Difference</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

      </Animated.View>
    </Modal>
  );
};

export default PaymentAdjustmentModal;

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 20,
    overflow: 'hidden',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#DDD',
  },

  // Warning Header
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFDADC',
  },
  warningIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFE9EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  warningHeaderText: { flex: 1 },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E63946',
    marginBottom: 2,
  },
  warningSubtitle: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },

  // Scroll Body
  scrollBody: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 12 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  // Receipt Photo
  receiptCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  receiptImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: '#eee',
  },
  receiptCardPlaceholder: {
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    padding: 24,
    marginTop: 12,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderStyle: 'dashed',
  },
  receiptPlaceholderText: {
    marginTop: 8,
    fontSize: 13,
    color: '#bbb',
  },

  // Price Breakdown Card
  priceCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  priceOriginal: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  priceProposed: {
    fontSize: 16,
    color: '#222',
    fontWeight: '700',
  },
  priceDifference: {
    fontSize: 17,
    color: '#E63946',
    fontWeight: '800',
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
    borderStyle: 'dashed',
  },

  // Reason Card
  reasonCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFE5A0',
  },
  reasonText: {
    fontSize: 14,
    color: '#7A6000',
    lineHeight: 22,
    fontStyle: 'italic',
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#fff',
  },
  disputeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E63946',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 6,
    backgroundColor: '#FFF5F5',
  },
  disputeButtonText: {
    color: '#E63946',
    fontWeight: '700',
    fontSize: 14,
  },
  approveButton: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2EC4B6',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 6,
    shadowColor: '#2EC4B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  approveButtonLoading: {
    opacity: 0.72,
  },
  approveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
