import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { getData, storeData, removeData } from '../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../utils/constants';

// Native Firebase replacement for the Express/Node REST backend
// Mimics existing API interface so no UI screens break!

// Auth APIs
export const authAPI = {
  register: async (userData) => {
    const { email, password, name, phone } = userData;
    const userCredential = await auth().createUserWithEmailAndPassword(email, password);
    const firebaseUser = userCredential.user;
    
    const profile = { 
      id: firebaseUser.uid,
      uid: firebaseUser.uid, 
      email, 
      name: name || 'User', 
      phone: phone || '', 
      type: 'customer', 
      addresses: [],
      createdAt: new Date().toISOString() 
    };
    
    await firestore().collection('users').doc(firebaseUser.uid).set(profile);
    
    // Store local sessions in AsyncStorage
    await Promise.all([
      storeData(ASYNC_STORAGE_KEYS.AUTH_TOKEN, firebaseUser.uid),
      storeData(ASYNC_STORAGE_KEYS.USER_DATA, profile)
    ]);
    
    return { success: true, user: profile, token: firebaseUser.uid };
  },

  login: async (email, password) => {
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    const firebaseUser = userCredential.user;
    
    // Fetch profile details
    const userSnap = await firestore().collection('users').doc(firebaseUser.uid).get();
    
    if (!userSnap.exists) {
      // Create a default profile if not exists
      const defaultProfile = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email || email,
        name: 'Customer',
        phone: '',
        type: 'customer',
        addresses: [],
        createdAt: new Date().toISOString()
      };
      await firestore().collection('users').doc(firebaseUser.uid).set(defaultProfile);
      
      await Promise.all([
        storeData(ASYNC_STORAGE_KEYS.AUTH_TOKEN, firebaseUser.uid),
        storeData(ASYNC_STORAGE_KEYS.USER_DATA, defaultProfile)
      ]);
      return { success: true, token: firebaseUser.uid, user: defaultProfile };
    }

    const profile = userSnap.data();
    if (profile?.type !== 'customer') {
      await auth().signOut();
      throw new Error('Access Denied: Only customers can log into this app.');
    }
    
    await Promise.all([
      storeData(ASYNC_STORAGE_KEYS.AUTH_TOKEN, firebaseUser.uid),
      storeData(ASYNC_STORAGE_KEYS.USER_DATA, profile)
    ]);
    
    return { success: true, token: firebaseUser.uid, user: profile };
  },

  logout: async () => {
    await auth().signOut();
    await Promise.all([
      removeData(ASYNC_STORAGE_KEYS.AUTH_TOKEN),
      removeData(ASYNC_STORAGE_KEYS.USER_DATA)
    ]);
  },

  getMe: async () => {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) throw new Error('Not logged in');
    
    const userSnap = await firestore().collection('users').doc(firebaseUser.uid).get();
    return { success: true, user: userSnap.data() };
  },
};

// Products APIs
export const productsAPI = {
  getAll: async (params = {}) => {
    const productsSnap = await firestore().collection('products').get();
    const data = [];
    productsSnap.forEach(doc => {
      data.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, data };
  },

  getById: async (id) => {
    const productSnap = await firestore().collection('products').doc(id).get();
    if (!productSnap.exists) throw new Error('Product not found');
    return { success: true, data: { id: productSnap.id, ...productSnap.data() } };
  },
};

// Orders APIs
export const ordersAPI = {
  create: async (orderData) => {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) throw new Error('Authentication required');

    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
    const newOrder = {
      ...orderData,
      orderId,
      status: 'pending',
      customer: {
        id: firebaseUser.uid,
        name: orderData.customerName || 'Customer',
        phone: orderData.customerPhone || ''
      },
      rider: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const docRef = await firestore().collection('orders').add(newOrder);
    return { success: true, data: { id: docRef.id, ...newOrder } };
  },

  getMyOrders: async (params = {}) => {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) throw new Error('Authentication required');

    const ordersSnap = await firestore()
      .collection('orders')
      .where('customer.id', '==', firebaseUser.uid)
      .get();
      
    const data = [];
    ordersSnap.forEach(doc => {
      data.push({ id: doc.id, ...doc.data() });
    });
    
    // Sort by date newest first
    data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { success: true, data };
  },

  getById: async (id) => {
    const orderSnap = await firestore().collection('orders').doc(id).get();
    if (!orderSnap.exists) throw new Error('Order not found');
    return { success: true, data: { id: orderSnap.id, ...orderSnap.data() } };
  },

  cancel: async (id) => {
    await firestore().collection('orders').doc(id).update({
      status: 'cancelled',
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  },
};

// Notifications APIs
export const notificationsAPI = {
  getAll: async (params = {}) => {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) throw new Error('Authentication required');

    const snap = await firestore()
      .collection('notifications')
      .where('userId', '==', firebaseUser.uid)
      .get();
      
    const data = [];
    snap.forEach(doc => {
      data.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, data };
  },

  markAsRead: async (id) => {
    await firestore().collection('notifications').doc(id).update({ read: true });
    return { success: true };
  },

  markAllAsRead: async () => {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) throw new Error('Authentication required');

    const snap = await firestore()
      .collection('notifications')
      .where('userId', '==', firebaseUser.uid)
      .get();
      
    const batch = firestore().batch();
    snap.forEach(doc => {
      batch.update(doc.ref, { read: true });
    });
    await batch.commit();
    return { success: true };
  },

  registerToken: async (token, deviceType) => {
    const firebaseUser = auth().currentUser;
    if (firebaseUser) {
      await firestore().collection('users').doc(firebaseUser.uid).update({
        fcmToken: token,
        deviceType: deviceType || 'android'
      });
    }
    return { success: true };
  },
};

// Users APIs
export const usersAPI = {
  getProfile: async () => {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) throw new Error('Authentication required');

    const docSnap = await firestore().collection('users').doc(firebaseUser.uid).get();
    return { success: true, data: docSnap.data() };
  },

  updateProfile: async (userData) => {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) throw new Error('Authentication required');

    await firestore().collection('users').doc(firebaseUser.uid).update(userData);
    const updatedSnap = await firestore().collection('users').doc(firebaseUser.uid).get();
    return { success: true, data: updatedSnap.data() };
  },

  getAddresses: async () => {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) throw new Error('Authentication required');

    const docSnap = await firestore().collection('users').doc(firebaseUser.uid).get();
    return { success: true, data: docSnap.data()?.addresses || [] };
  },

  addAddress: async (addressData) => {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) throw new Error('Authentication required');

    const addressId = `ADR-${Date.now()}`;
    const newAddress = { id: addressId, ...addressData };
    
    await firestore().collection('users').doc(firebaseUser.uid).update({
      addresses: firestore.FieldValue.arrayUnion(newAddress)
    });
    return { success: true, data: newAddress };
  },

  updateAddress: async (id, addressData) => {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) throw new Error('Authentication required');

    const userRef = firestore().collection('users').doc(firebaseUser.uid);
    const userDoc = await userRef.get();
    const addresses = userDoc.data()?.addresses || [];
    const updated = addresses.map(addr => addr.id === id ? { ...addr, ...addressData } : addr);
    
    await userRef.update({ addresses: updated });
    return { success: true };
  },

  deleteAddress: async (id) => {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) throw new Error('Authentication required');

    const userRef = firestore().collection('users').doc(firebaseUser.uid);
    const userDoc = await userRef.get();
    const addresses = userDoc.data()?.addresses || [];
    const updated = addresses.filter(addr => addr.id !== id);
    
    await userRef.update({ addresses: updated });
    return { success: true };
  },
};

// Upload APIs
export const uploadAPI = {
  uploadImage: async ({ uri, name, type }) => {
    if (!uri) throw new Error('No image selected');
    
    const firebaseUser = auth().currentUser;
    const uid = firebaseUser ? firebaseUser.uid : 'anon';
    const fileName = name || `profile-${uid}-${Date.now()}.jpg`;
    
    const ref = storage().ref().child(`profiles/${fileName}`);
    await ref.putFile(uri);
    
    const downloadURL = await ref.getDownloadURL();
    return { success: true, data: { url: downloadURL } };
  },
};

// Areas API
export const areasAPI = {
  getAll: async () => {
    const snap = await firestore().collection('areas').get();
    const data = [];
    snap.forEach(doc => {
      data.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, data };
  },
};

// Bills API
export const billsAPI = {
  getMyBills: async () => {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) throw new Error('Authentication required');

    const ordersSnap = await firestore()
      .collection('orders')
      .where('customer.id', '==', firebaseUser.uid)
      .get();
      
    const bills = [];
    ordersSnap.forEach(doc => {
      const order = doc.data();
      if (order.bill) {
        bills.push({ id: doc.id, orderId: order.orderId, ...order.bill });
      }
    });
    return { success: true, data: bills };
  },

  getBillById: async (billId) => {
    const orderSnap = await firestore().collection('orders').doc(billId).get();
    if (!orderSnap.exists) throw new Error('Bill not found');
    const order = orderSnap.data();
    return { success: true, data: { id: orderSnap.id, orderId: order.orderId, ...order.bill } };
  },

  uploadPaymentProof: async ({ billId, uri, fileName, type }) => {
    if (!uri) throw new Error('No image selected');
    
    const name = fileName || `bill-proof-${billId}-${Date.now()}.jpg`;
    const ref = storage().ref().child(`bills/${name}`);
    await ref.putFile(uri);
    
    const downloadURL = await ref.getDownloadURL();
    return { success: true, data: { url: downloadURL } };
  },

  submitPaymentProof: async (billId, proofImageUrl) => {
    await firestore().collection('orders').doc(billId).update({
      'bill.paymentProofImage': proofImageUrl,
      'bill.status': 'submitted',
      'bill.submittedAt': new Date().toISOString()
    });
    return { success: true };
  },

  updateBillStatus: async (billId, status) => {
    await firestore().collection('orders').doc(billId).update({
      'bill.status': status
    });
    return { success: true };
  },
};

// Chat APIs
export const chatAPI = {
  getConversations: async () => {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) throw new Error('Authentication required');

    const snap = await firestore()
      .collection('conversations')
      .where('participants', 'array-contains', firebaseUser.uid)
      .get();
      
    const data = [];
    snap.forEach(doc => {
      data.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, data };
  },

  startConversation: async (participantId, orderId) => {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) throw new Error('Authentication required');

    // Find if a conversation already exists between these participants
    const existingSnap = await firestore()
      .collection('conversations')
      .where('participants', 'array-contains', firebaseUser.uid)
      .get();
      
    let conversation = null;
    existingSnap.forEach(doc => {
      const data = doc.data();
      if (data.participants.includes(participantId)) {
        conversation = { id: doc.id, ...data };
      }
    });

    if (conversation) {
      return { success: true, data: conversation };
    }

    const newConv = {
      participants: [firebaseUser.uid, participantId],
      orderId: orderId || null,
      createdAt: new Date().toISOString(),
      lastMessage: null
    };
    
    const docRef = await firestore().collection('conversations').add(newConv);
    return { success: true, data: { id: docRef.id, ...newConv } };
  },

  getMessages: async (conversationId, params = {}) => {
    const snap = await firestore()
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .get();
      
    const data = [];
    snap.forEach(doc => {
      data.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, data };
  },

  sendMessage: async (conversationId, text) => {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) throw new Error('Authentication required');

    const newMessage = {
      senderId: firebaseUser.uid,
      text,
      createdAt: new Date().toISOString()
    };
    
    const docRef = await firestore()
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .add(newMessage);

    await firestore().collection('conversations').doc(conversationId).update({
      lastMessage: {
        text,
        senderId: firebaseUser.uid,
        createdAt: new Date().toISOString()
      }
    });

    return { success: true, data: { id: docRef.id, ...newMessage } };
  },

  markRead: async (conversationId) => {
    return { success: true };
  },

  subscribeMessages: (conversationId, callback) => {
    return firestore()
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .onSnapshot(snap => {
        if (!snap) return;
        const messages = [];
        snap.forEach(doc => {
          messages.push({ id: doc.id, ...doc.data() });
        });
        callback(messages);
      }, err => {
        console.error('Error listening to messages:', err);
      });
  },
};

export async function openRiderChat({ riderId, orderCode, autoMessage }) {
  const res = await chatAPI.startConversation(riderId, orderCode);
  const conversationId = res.data?.id;
  if (!conversationId) {
    throw new Error('Could not open conversation');
  }
  if (autoMessage?.trim()) {
    await chatAPI.sendMessage(conversationId, autoMessage.trim());
  }
  return conversationId;
}

export default {
  auth: authAPI,
  products: productsAPI,
  orders: ordersAPI,
  notifications: notificationsAPI,
  users: usersAPI,
  areas: areasAPI,
  bills: billsAPI,
  chat: chatAPI,
};
