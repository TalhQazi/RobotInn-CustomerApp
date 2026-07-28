import auth, { GoogleAuthProvider } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { getData, storeData, removeData } from '../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../utils/constants';
import { ORDER_STATUS, isBillVisibleToCustomer } from '../utils/orderStatus';

const checkExists = (snap) => {
  if (!snap) return false;
  return typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
};

const parseGlobalTimestamp = (obj) => {
  if (!obj) return 0;
  const val = obj.createdAt || obj.submittedAt || obj.timestamp || obj.updatedAt || obj.date;
  if (val) {
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'object' && typeof val.seconds === 'number') return val.seconds * 1000;
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  const idStr = String(obj.id || obj._id || '');
  if (/^[0-9a-fA-F]{24}$/.test(idStr)) {
    const timestamp = parseInt(idStr.substring(0, 8), 16) * 1000;
    if (!isNaN(timestamp) && timestamp > 0) return timestamp;
  }
  const matches = idStr.match(/\d{10,13}/);
  if (matches) {
    const num = Number(matches[0]);
    if (!isNaN(num)) return num > 1e11 ? num : num * 1000;
  }
  return 0;
};

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: '301557654113-qih2tg9iq4jp6avo8jehr292fds3hjsh.apps.googleusercontent.com',
});

// Native Firebase replacement for the Express/Node REST backend
// Mimics existing API interface so no UI screens break!

// Auth APIs
export const authAPI = {
  register: async (userData) => {
    const { email, password, name, phone } = userData;
    let firebaseUser;
    let existingProfile = null;

    try {
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      firebaseUser = userCredential.user;
    } catch (createErr) {
      // If email already exists in Firebase Auth (e.g. registered as rider), sign in instead
      if (createErr.code === 'auth/email-already-in-use') {
        try {
          const userCredential = await auth().signInWithEmailAndPassword(email, password);
          firebaseUser = userCredential.user;
          const existingSnap = await firestore().collection('users').doc(firebaseUser.uid).get();
          if (checkExists(existingSnap)) {
            existingProfile = existingSnap.data();
          }
        } catch (signInErr) {
          if (signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/wrong-password') {
            throw new Error('This email is already registered with a different password. If you already have a rider account, please sign up using your existing password to link your customer profile.');
          }
          throw signInErr;
        }
      } else {
        throw createErr;
      }
    }

    if (existingProfile) {
      // User already exists (e.g. as rider) — add 'customer' to their types
      const currentTypes = existingProfile.types || [existingProfile.type || 'rider'];
      if (!currentTypes.includes('customer')) {
        currentTypes.push('customer');
      }
      await firestore().collection('users').doc(firebaseUser.uid).update({
        types: currentTypes,
        addresses: existingProfile.addresses || [],
      });
      const profile = { ...existingProfile, types: currentTypes, type: 'customer' };
      await Promise.all([
        storeData(ASYNC_STORAGE_KEYS.AUTH_TOKEN, firebaseUser.uid),
        storeData(ASYNC_STORAGE_KEYS.USER_DATA, profile)
      ]);
      return { success: true, user: profile, token: firebaseUser.uid };
    }
    
    const profile = { 
      id: firebaseUser.uid,
      uid: firebaseUser.uid, 
      email, 
      name: name || 'User', 
      phone: phone || '', 
      type: 'customer',
      types: ['customer'],
      addresses: [],
      // The password is NEVER stored here. Firebase Auth is the only credential
      // store; it hashes with scrypt server-side and no client can read it back.
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

    if (!checkExists(userSnap)) {
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
    // Unified auth: allow any user to log into CustomerApp
    // If they don't have 'customer' in their types yet, add it
    const currentTypes = profile.types || [profile.type];
    if (!currentTypes.includes('customer')) {
      currentTypes.push('customer');
      await firestore().collection('users').doc(firebaseUser.uid).update({ types: currentTypes });
    }
    // Present the user as a customer in this app
    profile.type = 'customer';
    profile.types = currentTypes;
    
    await Promise.all([
      storeData(ASYNC_STORAGE_KEYS.AUTH_TOKEN, firebaseUser.uid),
      storeData(ASYNC_STORAGE_KEYS.USER_DATA, profile)
    ]);
    
    return { success: true, token: firebaseUser.uid, user: profile };
  },

  sendPasswordResetEmail: async (email) => {
    return await auth().sendPasswordResetEmail(email);
  },

  logout: async () => {
    await auth().signOut();
    try {
      await GoogleSignin.signOut();
    } catch (signOutErr) {
      console.warn('Google Sign-Out warning:', signOutErr);
    }
    await Promise.all([
      removeData(ASYNC_STORAGE_KEYS.AUTH_TOKEN),
      removeData(ASYNC_STORAGE_KEYS.USER_DATA)
    ]);
  },

  signInWithGoogle: async () => {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      
      const idToken = signInResult.data ? signInResult.data.idToken : signInResult.idToken;
      if (!idToken) {
        throw new Error('Failed to obtain Google ID Token.');
      }

      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);
      const firebaseUser = userCredential.user;

      const userSnap = await firestore().collection('users').doc(firebaseUser.uid).get();
      let profile;
      if (!checkExists(userSnap)) {
        profile = {
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || 'Customer',
          phone: firebaseUser.phoneNumber || '',
          type: 'customer',
          types: ['customer'],
          addresses: [],
          createdAt: new Date().toISOString()
        };
        await firestore().collection('users').doc(firebaseUser.uid).set(profile);
      } else {
        profile = userSnap.data();
      }

      const currentTypes = profile.types || [profile.type || 'customer'];
      if (!currentTypes.includes('customer')) {
        currentTypes.push('customer');
        await firestore().collection('users').doc(firebaseUser.uid).update({ types: currentTypes });
      }
      profile.type = 'customer';
      profile.types = currentTypes;

      await Promise.all([
        storeData(ASYNC_STORAGE_KEYS.AUTH_TOKEN, firebaseUser.uid),
        storeData(ASYNC_STORAGE_KEYS.USER_DATA, profile)
      ]);

      return { success: true, token: firebaseUser.uid, user: profile };
    } catch (err) {
      console.error('Google Sign-In Error:', err);
      throw err;
    }
  },

  getMe: async () => {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) throw new Error('Not logged in');
    
    const userSnap = await firestore().collection('users').doc(firebaseUser.uid).get();
    const profile = userSnap.data();
    if (profile) {
      const currentTypes = profile.types || [profile.type || 'customer'];
      if (currentTypes.includes('customer')) {
        profile.type = 'customer';
      }
      profile.types = currentTypes;
    }
    return { success: true, data: profile, user: profile };
  },

  sendOTPCode: async (email) => {
    try {
      // No `users` lookup here: querying the collection by email before sign-in
      // would require it to be world-readable, and the response would tell an
      // attacker which addresses have accounts. An unknown address still gets a
      // "code sent" response — the code simply never arrives.

      // 1. Generate 6-digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // 2. Save OTP to Firestore
      await firestore().collection('otps').doc(email).set({
        email,
        code,
        createdAt: new Date().toISOString()
      });

      // 3. Send email via FormSubmit in the background (no await)
      fetch('https://formsubmit.co/ajax/' + email, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'https://robotinn.com',
          'Referer': 'https://robotinn.com/'
        },
        body: JSON.stringify({
          name: 'RobotInn Password Reset',
          message: `Your password reset verification code is: ${code}. Please enter this code in the app to reset your password.`,
          _subject: 'RobotInn Password Reset Verification Code'
        })
      }).then(async (res) => {
        const result = await res.json();
        console.log('✉️ FormSubmit email send result:', result);
      }).catch(emailErr => {
        console.warn('FormSubmit email send warning:', emailErr);
      });

      // The code is deliberately NOT returned to the caller — it only ever
      // travels by email.
      return { success: true };
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('permission-denied')) {
        throw new Error('Could not start password reset. Please try again shortly.');
      }
      throw err;
    }
  },

  verifyOTPAndResetPassword: async (email, code, newPassword) => {
    try {
      // 1. Check OTP in Firestore
      const otpSnap = await firestore().collection('otps').doc(email).get();
      if (!checkExists(otpSnap)) {
        throw new Error('Verification code has not been sent or has expired.');
      }

      const otpData = otpSnap.data();
      if (!otpData || String(otpData.code).trim() !== String(code).trim()) {
        throw new Error('Invalid verification code.');
      }

      // Check expiration (15 minutes)
      const diff = new Date() - new Date(otpData.createdAt);
      if (diff > 15 * 60 * 1000) {
        throw new Error('Verification code has expired. Please request a new one.');
      }

      // 2. Code is good. Hand off to Firebase Auth to actually change the
      // credential.
      //
      // This used to read the user's old password out of Firestore and sign in
      // as them to call updatePassword(). That required storing every password
      // in plaintext in a readable collection, so it is gone. A client SDK
      // cannot set a password it doesn't already know, so the secure link is
      // the only correct option until `resetPasswordWithOtp` moves to a Cloud
      // Function with the Admin SDK.
      await auth().sendPasswordResetEmail(email);

      // 3. Burn the code either way — it has served its purpose.
      await firestore().collection('otps').doc(email).delete();

      return {
        success: true,
        requiresEmailLink: true,
        message: 'Code verified. We have emailed you a secure link to set your new password.'
      };
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('permission-denied')) {
        throw new Error('Could not reset password. Please try again shortly.');
      }
      throw err;
    }
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
    if (!checkExists(productSnap)) throw new Error('Product not found');
    return { success: true, data: { id: productSnap.id, ...productSnap.data() } };
  },
};

// Orders APIs
export const ordersAPI = {
  submitOrderRating: async (orderId, riderId, rating, reviewText) => {
    const orderRef = firestore().collection('orders').doc(orderId);
    const riderRef = firestore().collection('users').doc(riderId);

    await firestore().runTransaction(async (transaction) => {
      const riderDoc = await transaction.get(riderRef);

      transaction.update(orderRef, {
        rating: {
          score: rating,
          review: reviewText || '',
          createdAt: new Date().toISOString()
        }
      });

      if (checkExists(riderDoc)) {
        const riderData = riderDoc.data();
        if (riderData) {
          const currentRating = riderData.rating || 0;
          const ratingCount = riderData.ratingCount || 0;
          const newCount = ratingCount + 1;
          const newRating = ((currentRating * ratingCount) + rating) / newCount;

          transaction.update(riderRef, {
            rating: newRating,
            ratingCount: newCount
          });
        }
      } else {
        console.warn(`Rider profile ${riderId} does not exist. Skipping rider rating aggregation.`);
      }
    });

    return { success: true };
  },

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

    // Create an admin notification for the new order
    await firestore().collection('notifications').add({
      recipient: 'admin',
      title: 'New Order Placed',
      message: `Order ${orderId} has been placed by ${newOrder.customer.name || 'Customer'}.`,
      type: 'order',
      read: false,
      createdAt: new Date().toISOString(),
      data: { orderId: docRef.id }
    });

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
    data.sort((a, b) => parseGlobalTimestamp(b) - parseGlobalTimestamp(a));
    return { success: true, data };
  },

  getById: async (id) => {
    const orderSnap = await firestore().collection('orders').doc(id).get();
    if (!checkExists(orderSnap)) throw new Error('Order not found');
    return { success: true, data: { id: orderSnap.id, ...orderSnap.data() } };
  },

  cancel: async (id) => {
    await firestore().collection('orders').doc(id).update({
      status: 'cancelled',
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  },

  // ── Price adjustment ───────────────────────────────────────────────────────
  // Receipt upload lives in the Rider app and receipt validation in the Admin
  // panel; the customer only ever answers an adjustment the admin has already
  // approved, so those two writers were removed from this client.
  respondPriceAdjustment: async (orderId, { decision, paymentMethodId }) => {
    const isAccepted = decision === 'ACCEPT';
    const nextStatus = isAccepted
      ? ORDER_STATUS.BILL_APPROVED
      : ORDER_STATUS.ADJUSTMENT_REJECTED;

    const updateData = {
      status: nextStatus,
      'adjustmentNegotiation.customerApproved': isAccepted,
      'adjustmentNegotiation.decisionTimestamp': new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isAccepted) {
      updateData['financials.paymentStatus'] = 'ADJUSTMENT_APPROVED';
      updateData['financials.paymentMethodId'] = paymentMethodId || 'COD';
    }

    await firestore().collection('orders').doc(orderId).update(updateData);
    return { success: true, status: nextStatus };
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
    
    data.sort((a, b) => parseGlobalTimestamp(b) - parseGlobalTimestamp(a));
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
    const profile = docSnap.data();
    if (profile) {
      const currentTypes = profile.types || [profile.type || 'customer'];
      if (currentTypes.includes('customer')) {
        profile.type = 'customer';
      }
      profile.types = currentTypes;
    }
    return { success: true, data: profile };
  },

  getUserById: async (id) => {
    const docSnap = await firestore().collection('users').doc(id).get();
    if (!checkExists(docSnap)) throw new Error('User not found');
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
    const newAddress = {
      id: addressId,
      addressId,
      ...addressData,
      createdAt: addressData.createdAt || new Date().toISOString(),
    };
    
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
  uploadImage: async ({ uri, base64, name, type }) => {
    if (!uri && !base64) throw new Error('No image selected');
    
    const firebaseUser = auth().currentUser;
    const uid = firebaseUser ? firebaseUser.uid : 'anon';
    const cleanName = name ? name.replace(/[^a-zA-Z0-9.\-]/g, '_') : 'image.jpg';
    
    // Changing filename to start with uid to match potential Firebase Storage rule requirements
    const fileName = `${uid}-profile-${Date.now()}-${cleanName}`;
    const ref = storage().ref(`profiles/${fileName}`);
    
    try {
      if (base64) {
        console.log('[UPLOAD] Starting base64 putString...');
        await ref.putString(base64, 'base64', { contentType: type || 'image/jpeg' });
        console.log('[UPLOAD] base64 putString succeeded.');
      } else if (uri) {
        console.log('[UPLOAD] Starting URI putFile...', uri);
        // Ensure URI has file:// prefix if it's a local absolute path
        const finalUri = uri.startsWith('/') ? 'file://' + uri : uri;
        await ref.putFile(finalUri, { contentType: type || 'image/jpeg' });
        console.log('[UPLOAD] URI putFile succeeded.');
      }
      
      console.log('[UPLOAD] Fetching download URL...');
      const downloadURL = await ref.getDownloadURL();
      console.log('[UPLOAD] Download URL fetched:', downloadURL);
      return { success: true, url: downloadURL, data: { url: downloadURL } };
    } catch (e) {
      console.error('[UPLOAD ERROR]', e);
      throw new Error(`Upload Failed: ${e.message}`);
    }
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

// Categories API
export const categoriesAPI = {
  getAll: async () => {
    const snap = await firestore()
      .collection('categories')
      .orderBy('createdAt', 'asc')
      .get();
    const data = [];
    snap.forEach(doc => {
      data.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, data };
  },

  /**
   * Live categories, so an icon or name changed in the Admin panel shows up
   * without the customer restarting the app. Returns the unsubscribe fn.
   */
  subscribe: (onChange, onError) =>
    firestore()
      .collection('categories')
      .orderBy('createdAt', 'asc')
      .onSnapshot(
        snap => {
          const data = [];
          snap.forEach(doc => {
            const cat = { id: doc.id, ...doc.data() };
            if (cat.active !== false) data.push(cat);
          });
          onChange(data);
        },
        err => {
          console.log('❌ Categories listener error:', err?.message);
          if (onError) onError(err);
        },
      ),
};

// Stores API with Location & Category Geo-filtering
export const storesAPI = {
  getByAreaAndCategory: async (areaName, categoryName) => {
    try {
      if (!areaName) return { success: true, data: [] };

      // 1. Query Firestore 'stores' collection strictly by selected area
      const snap = await firestore()
        .collection('stores')
        .where('area', '==', areaName)
        .get();

      const data = [];
      snap.forEach(doc => {
        const store = doc.data();
        if (!categoryName || !store.category || store.category.toLowerCase().includes(categoryName.toLowerCase()) || categoryName.toLowerCase().includes(store.category.toLowerCase())) {
          data.push({ id: doc.id, ...store });
        }
      });

      return { success: true, data };
    } catch (err) {
      console.warn('storesAPI getByAreaAndCategory error:', err);
      return { success: false, data: [] };
    }
  },
};


// Helper function to resolve exact non-zero bill total
const resolveBillAmount = (bill, order) => {
  const pPrice = parseFloat(bill?.productPrice) || 0;
  const sFee = parseFloat(bill?.shippingFee) || 0;
  const compSum = pPrice + sFee;

  const bAmount = parseFloat(bill?.amount) || 0;
  const bTotal = parseFloat(bill?.total) || 0;
  const oTotal = parseFloat(order?.total) || 0;
  const oPrice = parseFloat(order?.price) || 0;

  if (bAmount > 0) return bAmount;
  if (bTotal > 0) return bTotal;
  if (compSum > 0) return compSum;
  if (oTotal > 0) return oTotal;
  if (oPrice > 0) return oPrice;
  return 0;
};

// Bills API
export const billsAPI = {
  getMyBills: async () => {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) throw new Error('Authentication required');

    const ordersSnap = await firestore()
      .collection('orders')
      .get();

    const bills = [];
    ordersSnap.forEach(doc => {
      const order = doc.data();
      const isCustomerOrder =
        order.customerId === firebaseUser.uid ||
        order.customer?.id === firebaseUser.uid ||
        order.customer?.uid === firebaseUser.uid ||
        order.userId === firebaseUser.uid ||
        order.uid === firebaseUser.uid;

      // A bill only becomes the customer's business once the admin has
      // approved it — an unreviewed rider submission stays hidden.
      if (isCustomerOrder && order.bill && isBillVisibleToCustomer(order.bill.status)) {
        const amount = resolveBillAmount(order.bill, order);

        bills.push({
          id: doc.id,
          orderId: order.orderId || doc.id,
          ...order.bill,
          amount,
          total: amount,
          createdAt: order.bill.submittedAt || order.createdAt || new Date().toISOString(),
        });
      }
    });
    
    bills.sort((a, b) => parseGlobalTimestamp(b) - parseGlobalTimestamp(a));
    return { success: true, data: bills };
  },

  getBillById: async (billId) => {
    const orderSnap = await firestore().collection('orders').doc(billId).get();
    if (!checkExists(orderSnap)) throw new Error('Bill not found');
    const order = orderSnap.data();
    if (!isBillVisibleToCustomer(order?.bill?.status)) {
      throw new Error('This bill is still being reviewed by our team.');
    }
    const amount = resolveBillAmount(order?.bill, order);
    return {
      success: true,
      data: {
        id: orderSnap.id,
        orderId: order.orderId || orderSnap.id,
        ...order.bill,
        amount,
        total: amount,
      },
    };
  },

  uploadPaymentProof: async ({ billId, uri, fileName, type }) => {
    if (!uri) throw new Error('No image selected');
    
    const name = fileName || `bill-proof-${billId}-${Date.now()}.jpg`;
    const ref = storage().ref().child(`bills/${name}`);
    await ref.putFile(uri);
    
    const downloadURL = await ref.getDownloadURL();
    return { success: true, url: downloadURL, data: { url: downloadURL } };
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
    const activeParticipantIds = new Set();

    for (const doc of snap.docs) {
      const convData = doc.data();
      const participants = convData.participants || [];
      const participantId = participants.find(p => p !== firebaseUser.uid);
      if (participantId) {
        activeParticipantIds.add(participantId);
      }
      
      let participantName = 'Rider';
      let participantType = 'rider';
      if (participantId) {
        const userSnap = await firestore().collection('users').doc(participantId).get();
        if (checkExists(userSnap)) {
          const userData = userSnap.data();
          participantName = userData?.name || 'Rider';
          participantType = userData?.type || 'rider';
        }
      }

      data.push({
        id: doc.id,
        ...convData,
        participantId,
        participantName,
        participantType,
        lastMessageTime: convData.lastMessage?.createdAt || null,
        lastMessage: convData.lastMessage?.text || ''
      });
    }

    try {
      const activeOrdersSnap = await firestore()
        .collection('orders')
        .where('customer.id', '==', firebaseUser.uid)
        .where('status', 'in', ['accepted', 'processing', 'picked', 'picked up', 'in progress'])
        .get();

      for (const orderDoc of activeOrdersSnap.docs) {
        const orderData = orderDoc.data();
        const riderId = orderData.rider?.id || orderData.riderId;
        if (riderId && !activeParticipantIds.has(riderId)) {
          const riderName = orderData.rider?.name || orderData.riderName || 'Rider';
          const newConv = {
            participants: [firebaseUser.uid, riderId],
            orderId: orderData.orderId || null,
            createdAt: new Date().toISOString(),
            lastMessage: null
          };
          const docRef = await firestore().collection('conversations').add(newConv);
          
          data.push({
            id: docRef.id,
            ...newConv,
            participantId: riderId,
            participantName: riderName,
            participantType: 'rider',
            lastMessageTime: null,
            lastMessage: ''
          });
          activeParticipantIds.add(riderId);
        }
      }
    } catch (err) {
      console.error('Error auto-creating conversations for active orders:', err);
    }

    data.sort((a, b) => {
      const ta = a.lastMessageTime ? parseGlobalTimestamp({ createdAt: a.lastMessageTime }) : parseGlobalTimestamp(a);
      const tb = b.lastMessageTime ? parseGlobalTimestamp({ createdAt: b.lastMessageTime }) : parseGlobalTimestamp(b);
      return tb - ta;
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

    try {
      const convDoc = await firestore().collection('conversations').doc(conversationId).get();
      if (checkExists(convDoc)) {
        const convData = convDoc.data();
        const participants = convData?.participants || [];
        const recipientId = participants.find(p => p !== firebaseUser.uid);
        if (recipientId) {
          const senderDoc = await firestore().collection('users').doc(firebaseUser.uid).get();
          const senderName = checkExists(senderDoc) ? (senderDoc.data()?.name || 'User') : 'User';

          await firestore().collection('notifications').add({
            userId: recipientId,
            title: `New message from ${senderName}`,
            message: text,
            type: 'chat',
            read: false,
            createdAt: new Date().toISOString(),
            data: { conversationId, senderId: firebaseUser.uid }
          });
        }
      }
    } catch (err) {
      console.error('Error writing chat notification to Firestore:', err);
    }

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
  categories: categoriesAPI,
  stores: storesAPI,
  bills: billsAPI,
  chat: chatAPI,
};

