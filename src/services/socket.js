import firestore from '@react-native-firebase/firestore';

// Drop-in replacement for Socket.io that uses Firestore real-time listeners!
// Keeps the identical API signatures so no screens or map UI breaks.

let activeOrderUnsubscribe = null;
let riderLocationCallback = null;
let orderUpdatedCallback = null;

export async function connectSocket() {
  // Stub - no-op for Firestore
  return { connected: true };
}

export function getSocket() {
  return { connected: true };
}

export async function joinOrderRoom(orderId) {
  if (!orderId) return;

  // Clean up any existing active listener
  if (activeOrderUnsubscribe) {
    activeOrderUnsubscribe();
    activeOrderUnsubscribe = null;
  }

  console.log(`📡 Joining real-time Firestore room for Order: ${orderId}`);

  // Subscribe to real-time updates of the order document in Firestore
  activeOrderUnsubscribe = firestore()
    .collection('orders')
    .doc(String(orderId))
    .onSnapshot(
      (documentSnapshot) => {
        if (!documentSnapshot || !documentSnapshot.exists) {
          console.log(`⚠️ Order ${orderId} does not exist in Firestore yet.`);
          return;
        }

        const data = documentSnapshot.data();
        const orderData = { id: documentSnapshot.id, ...data };

        // 1. Trigger Order Updated Callback
        if (orderUpdatedCallback) {
          orderUpdatedCallback(orderData);
        }

        // 2. Trigger Rider Location Updated Callback
        if (data?.riderLocation && riderLocationCallback) {
          const lat = data.riderLocation.latitude;
          const lng = data.riderLocation.longitude;
          
          riderLocationCallback({
            orderId,
            latitude: lat,
            longitude: lng,
            lat: lat, // Provide fallback for both lat/longitude naming conventions
            lng: lng,
            coords: { latitude: lat, longitude: lng }
          });
        }
      },
      (error) => {
        console.error(`❌ Firestore real-time track error for order ${orderId}:`, error);
      }
    );
}

export function leaveOrderRoom() {
  console.log('📡 Leaving real-time Firestore order room.');
  if (activeOrderUnsubscribe) {
    activeOrderUnsubscribe();
    activeOrderUnsubscribe = null;
  }
}

export function disconnectSocket() {
  leaveOrderRoom();
}

export function onRiderLocationUpdated(callback) {
  riderLocationCallback = callback;
  return () => {
    riderLocationCallback = null;
  };
}

export function onOrderUpdated(callback) {
  orderUpdatedCallback = callback;
  return () => {
    orderUpdatedCallback = null;
  };
}
