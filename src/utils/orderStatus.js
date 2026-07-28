/**
 * Canonical order lifecycle, shared by the Customer app, the Rider app and the
 * Admin panel. Keep this file in sync with
 * RiderApp/src/utils/orderStatus.ts and AdminPanel/src/lib/orderStatus.ts.
 *
 *   pending → accepted → processing → bill_submitted ─┬─→ bill_approved → picked → delivered
 *                            ↑                        │
 *                            └──── bill_rejected ─────┤
 *                                                     └─→ adjustment_pending → (customer accepts)
 *                                                                            → bill_approved
 *
 * `processing` and `picked` are reused from the original rider vocabulary so
 * orders already in Firestore keep working; everything else is new.
 */

export const ORDER_STATUS = {
  /** Order created by the customer, no rider yet. */
  PENDING: 'pending',
  /** A rider claimed the order. */
  ACCEPTED: 'accepted',
  /** Rider is at the store buying the requested items. */
  SHOPPING: 'processing',
  /** Rider uploaded the store receipt; waiting on admin. */
  BILL_SUBMITTED: 'bill_submitted',
  /** Admin rejected the receipt; rider must resubmit. */
  BILL_REJECTED: 'bill_rejected',
  /** Admin approved but the total moved; customer must accept the new price. */
  ADJUSTMENT_PENDING: 'adjustment_pending',
  /** Customer declined the adjusted price. */
  ADJUSTMENT_REJECTED: 'adjustment_rejected',
  /** Bill cleared. Customer can now see it and the rider can deliver. */
  BILL_APPROVED: 'bill_approved',
  /** Rider is on the way to the customer. */
  OUT_FOR_DELIVERY: 'picked',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

/** Status of the `bill` sub-document on an order. */
export const BILL_STATUS = {
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

/**
 * Legacy values written by earlier builds of the three apps. Firestore still
 * holds these, so every read normalises before comparing.
 */
const LEGACY_STATUS_ALIASES = {
  // Customer app title-case vocabulary
  'in progress': ORDER_STATUS.SHOPPING,
  // Rider app variants
  picked_up: ORDER_STATUS.OUT_FOR_DELIVERY,
  'picked up': ORDER_STATUS.OUT_FOR_DELIVERY,
  completed: ORDER_STATUS.DELIVERED,
  // Bill-flow SCREAMING_SNAKE vocabulary
  arrived_at_store: ORDER_STATUS.SHOPPING,
  bill_pending: ORDER_STATUS.BILL_SUBMITTED,
  pending_admin_validation: ORDER_STATUS.BILL_SUBMITTED,
  admin_confirmed: ORDER_STATUS.BILL_APPROVED,
  admin_receipt_validated: ORDER_STATUS.BILL_APPROVED,
  out_for_delivery: ORDER_STATUS.OUT_FOR_DELIVERY,
};

/** Maps any historical status value onto the canonical vocabulary above. */
export const normalizeOrderStatus = (status) => {
  const raw = String(status ?? '').trim().toLowerCase();
  if (!raw) return ORDER_STATUS.PENDING;
  return LEGACY_STATUS_ALIASES[raw] || raw;
};

/**
 * An order a rider is still working — claimed, not yet delivered or cancelled.
 * Anything mid-bill belongs here too, otherwise orders vanish from the rider's
 * list while they wait on Admin.
 */
export const ACTIVE_ORDER_STATUSES = [
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.SHOPPING,
  ORDER_STATUS.BILL_SUBMITTED,
  ORDER_STATUS.BILL_REJECTED,
  ORDER_STATUS.ADJUSTMENT_PENDING,
  ORDER_STATUS.ADJUSTMENT_REJECTED,
  ORDER_STATUS.BILL_APPROVED,
  ORDER_STATUS.OUT_FOR_DELIVERY,
];

export const isActiveOrderStatus = (status) =>
  ACTIVE_ORDER_STATUSES.includes(normalizeOrderStatus(status));

export const ORDER_STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: 'Pending',
  [ORDER_STATUS.ACCEPTED]: 'Accepted',
  [ORDER_STATUS.SHOPPING]: 'Rider at store',
  [ORDER_STATUS.BILL_SUBMITTED]: 'Awaiting admin approval',
  [ORDER_STATUS.BILL_REJECTED]: 'Bill rejected',
  [ORDER_STATUS.ADJUSTMENT_PENDING]: 'Price approval needed',
  [ORDER_STATUS.ADJUSTMENT_REJECTED]: 'Price declined',
  [ORDER_STATUS.BILL_APPROVED]: 'Bill approved',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'Out for delivery',
  [ORDER_STATUS.DELIVERED]: 'Delivered',
  [ORDER_STATUS.CANCELLED]: 'Cancelled',
};

export const getOrderStatusLabel = (status) => {
  const canonical = normalizeOrderStatus(status);
  return ORDER_STATUS_LABELS[canonical] || 'Pending';
};

/** True once the admin has cleared the bill for customer visibility. */
export const isBillVisibleToCustomer = (billStatus) =>
  String(billStatus ?? '').trim().toLowerCase() === BILL_STATUS.APPROVED;
