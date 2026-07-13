import auth, { GoogleAuthProvider } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { getData, storeData, removeData } from '../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../utils/constants';

const checkExists = (snap) => {
  if (!snap) return false;
  return typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
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
        const userCredential = await auth().signInWithEmailAndPassword(email, password);
        firebaseUser = userCredential.user;
        const existingSnap = await firestore().collection('users').doc(firebaseUser.uid).get();
        if (checkExists(existingSnap)) {
          existingProfile = existingSnap.data();
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
        password,
        addresses: existingProfile.addresses || [],
      });
      const profile = { ...existingProfile, types: currentTypes, type: 'customer', password };
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
      password, // Save password in Firestore for verification-code resets
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
    
    if (checkExists(userSnap)) {
      await firestore().collection('users').doc(firebaseUser.uid).update({ password });
    }
    
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
      // 1. Verify user exists
      const userSnap = await firestore().collection('users').where('email', '==', email).get();
      if (userSnap.empty) {
        throw new Error('No user found with this email address.');
      }

      // 2. Generate 6-digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // 3. Save OTP to Firestore
      await firestore().collection('otps').doc(email).set({
        email,
        code,
        createdAt: new Date().toISOString()
      });

      // Always log the generated OTP to console for development/debug access
      console.log(`🔑 [DEBUG] OTP Code for ${email}: ${code}`);

      // 4. Send email via FormSubmit in the background (no await)
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

      return { success: true, code: code };
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('permission-denied')) {
        throw new Error('Firestore Rules Denied: Unauthenticated password reset is blocked by your Firebase rules. Please allow public read/write to the "otps" and "users" collections in your Firebase console.');
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

      // 2. Fetch user's profile to get the old password
      const userSnap = await firestore().collection('users').where('email', '==', email).get();
      if (userSnap.empty) {
        throw new Error('User not found.');
      }

      const userDoc = userSnap.docs[0];
      const userData = userDoc.data();
      const oldPassword = userData.password;

      // 3. Temporarily sign in user with their old password to update password in Firebase Auth
      let authUpdateSuccess = false;
      if (oldPassword) {
        try {
          const userCredential = await auth().signInWithEmailAndPassword(email, oldPassword);
          await userCredential.user.updatePassword(newPassword);
          authUpdateSuccess = true;
          // Sign out immediately after updating
          await auth().signOut();
        } catch (authErr) {
          console.warn('Temporary sign in / password update error in Firebase Auth:', authErr);
        }
      }

      if (!authUpdateSuccess) {
        // Fallback: If we couldn't automatically sync the password with Firebase Auth,
        // send the official Firebase reset email and instruct the user.
        await auth().sendPasswordResetEmail(email);
        
        // Still clean up the OTP
        await firestore().collection('otps').doc(email).delete();

        throw new Error('For security reasons, your account requires a direct reset link. We have sent a secure password reset link to your email. Please click the link to set your password, then return here to login.');
      }

      // 4. Update the password field and temporary password in Firestore
      await userDoc.ref.update({
        password: newPassword,
        tempPassword: newPassword,
        updatedAt: new Date().toISOString()
      });

      // 5. Clean up OTP doc
      await firestore().collection('otps').doc(email).delete();

      return { success: true };
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('permission-denied')) {
        throw new Error('Firestore Rules Denied: Updating password in Firestore is blocked by your security rules. Please check your Firestore security settings.');
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
    data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    const snap = await firestore().collection('categories').get();
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
    if (!checkExists(orderSnap)) throw new Error('Bill not found');
    const order = orderSnap.data();
    return { success: true, data: { id: orderSnap.id, orderId: order.orderId, ...order.bill } };
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
  bills: billsAPI,
  chat: chatAPI,
};
