import { getApp } from '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { Alert, AppState, PermissionsAndroid, Platform } from 'react-native';
import { notificationsAPI } from './api';
import { getData, storeData, removeData } from '../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../utils/constants';

const FCM_TOKEN_STORAGE_KEY = 'fcm_token';
const PENDING_FCM_TOKEN_KEY = 'pending_fcm_token';

const saveFcmTokenLocally = async (token) => {
  try {
    if (!token) return;
    await storeData(FCM_TOKEN_STORAGE_KEY, token);
  } catch (error) {
    console.error('Failed to save FCM token locally:', error);
  }
};

const savePendingFcmToken = async (token) => {
  try {
    if (!token) return;
    await storeData(PENDING_FCM_TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to save pending FCM token:', error);
  }
};

const getPendingFcmToken = async () => {
  return getData(PENDING_FCM_TOKEN_KEY);
};

const clearPendingFcmToken = async () => {
  try {
    await removeData(PENDING_FCM_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to clear pending FCM token:', error);
  }
};

// Helper to show debug alerts in development and always log to console
const debugAlert = (title, message) => {
  try {
    console.log(`[Firebase Debug] ${title}:`, message);
    // Disabled visual popups to prevent blocking users when FCM/Play Services is temporarily unavailable
    // if (typeof __DEV__ !== 'undefined' && __DEV__) {
    //   Alert.alert(title, typeof message === 'string' ? message : JSON.stringify(message));
    // }
  } catch (e) {
    console.log('Error showing debug alert:', e);
  }
};

let appStateListener = null;
let foregroundMessageListener = null;
let notificationOpenedListener = null;
let isFirebaseInitialized = false;
let messagingInstance = null;

const ensureNotificationChannel = async () => {
  try {
    const channelId = await notifee.createChannel({
      id: 'default',
      name: 'Default Channel',
      importance: AndroidImportance.HIGH,
    });
    console.log('Notification channel ensured:', channelId);
  } catch (error) {
    console.warn('Failed to create Notifee channel:', error);
  }
};

/**
 * Request Android runtime notification permission (Android 13+)
 */
const requestAndroidNotificationPermission = async () => {
  try {
    if (Platform.OS !== 'android') {
      console.log('Not Android, skipping Android runtime permission request');
      return true;
    }

    const androidVersion = Platform.Version;
    console.log('📱 Android version:', androidVersion);

    if (androidVersion < 33) {
      console.log('✅ Android < 13: POST_NOTIFICATIONS permission not required');
      return true;
    }

    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    console.log('✓ POST_NOTIFICATIONS already granted:', hasPermission);
    if (hasPermission) {
      return true;
    }

    console.log('🔔 Android 13+: Showing POST_NOTIFICATIONS runtime permission dialog...');
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      {
        title: 'Notification Permission',
        message: 'This app needs notification permission to send you updates about your orders, messages, and promotions.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Deny',
        buttonPositive: 'Allow',
      }
    );

    console.log('📲 Permission dialog result:', granted);

    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      console.log('✅ POST_NOTIFICATIONS permission GRANTED by user');
      return true;
    }

    console.log('❌ POST_NOTIFICATIONS permission denied or not granted:', granted);
    return false;
  } catch (error) {
    console.error('❌ Error requesting Android notification permission:', error);
    return false;
  }
};


/**
 * Initialize Firebase Messaging
 * - Request notification permissions (for iOS)
 * - Get FCM token and register it with backend
 * - Set up foreground and background message handlers
 */
export const initializeFirebaseMessaging = async () => {
  try {
    if (isFirebaseInitialized) {
      console.log('Firebase Messaging already initialized');
      return;
    }

    console.log('Starting Firebase Messaging initialization...');

    const firebaseApp = getApp();
    console.log('Firebase app instance:', firebaseApp?.name || 'no app');
    console.log('Firebase app options:', firebaseApp?.options || 'no options');
    if (!firebaseApp || firebaseApp.name !== '[DEFAULT]') {
      const msg = 'Firebase default app is not initialized. Check native Firebase configuration and google-services files.';
      debugAlert('Firebase init error', msg);
      throw new Error(msg);
    }

    // Check if messaging module is callable
    if (typeof messaging !== 'function') {
      throw new Error(`Firebase messaging import is not a function. Type: ${typeof messaging}`);
    }

    messagingInstance = messaging();
    if (!messagingInstance) {
      throw new Error('messaging() returned null or undefined');
    }

    // Register device for remote messages on iOS before requesting permission
    if (Platform.OS === 'ios' && typeof messagingInstance.registerDeviceForRemoteMessages === 'function') {
      try {
        await messagingInstance.registerDeviceForRemoteMessages();
        console.log('Registered device for remote messages on iOS');
      } catch (error) {
        console.warn('Failed to register iOS device for remote messages:', error);
      }
    }

    // Ensure notification channel exists for Android
    await ensureNotificationChannel();

    // Request Android runtime notification permission (Android 13+)
    const androidPermissionGranted = await requestAndroidNotificationPermission();
    console.log('Android notification permission granted:', androidPermissionGranted);

    let enabled = true;
    if (Platform.OS === 'ios') {
      console.log('📱 iOS: Requesting notification permission...');
      const authStatus = await messagingInstance.requestPermission({
        alert: true,
        badge: true,
        sound: true,
      });
      enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      console.log('📲 iOS notification permission status:', authStatus, 'Enabled:', enabled);
      if (!enabled) {
        console.log('⚠️  iOS notification permission NOT granted. Status:', authStatus);
      } else {
        console.log('✅ iOS notification permission GRANTED');
      }
    } else {
      enabled = androidPermissionGranted;
      console.log('📱 Android notification enabled:', enabled);
    }

    if (!enabled) {
      console.log('❌ Notification permissions not granted');
      debugAlert(
        'Notifications disabled',
        'Notification permissions not granted. Please enable notifications in the device settings.'
      );
      return;
    }

    console.log('✅ Notification permissions enabled!');

    // Get FCM token
    const token = await messagingInstance.getToken();
    console.log('FCM Token obtained:', token ? token : 'null');

    if (!token) {
      debugAlert(
        'No FCM token',
        'messagingInstance.getToken() returned null/empty. Check Google Play Services (Android) or APNs (iOS) and ensure firebase config is correct.'
      );
    }

    if (token) {
      // Run both AsyncStorage operations in parallel (not sequentially)
      await Promise.all([
        saveFcmTokenLocally(token),
        savePendingFcmToken(token)
      ]);
      console.log('FCM Token saved locally. Will be registered after login.');
    }

    // Listen for token refresh
    const tokenRefreshUnsubscribe = messagingInstance.onTokenRefresh(async (newToken) => {
      console.log('FCM Token refreshed:', newToken.substring(0, 20) + '...');
      // Run both AsyncStorage operations in parallel (not sequentially)
      await Promise.all([
        saveFcmTokenLocally(newToken),
        savePendingFcmToken(newToken)
      ]);
      console.log('FCM Token refreshed and saved. Will be registered after login.');
    });

    // Set up foreground message handler
    setupForegroundMessageHandler();

    // Set up background message handler
    setupBackgroundMessageHandler();

    // Handle notification when app is opened from notification
    setupNotificationOpenedHandler();

    isFirebaseInitialized = true;
    console.log('Firebase Messaging initialized successfully');

    return () => {
      tokenRefreshUnsubscribe();
    };
  } catch (error) {
    console.warn('Failed to initialize Firebase Messaging:', error?.message || error, error?.code);
    debugAlert('Firebase initialization failed', error?.message || String(error));
  }
};

/**
 * Register FCM token with the backend API
 */
const registerFCMToken = async (token) => {
  try {
    const response = await notificationsAPI.registerToken(token, 'android');
    console.log('FCM token registered:', response);
    if (!response || !response.success) {
      const msg = `Server responded with unexpected value when registering token: ${JSON.stringify(response)}`;
      console.error(msg);
      debugAlert('FCM token registration unexpected', msg);
      await savePendingFcmToken(token);
      return false;
    }
    console.log('✅ FCM token registration successful!');
    await clearPendingFcmToken();
    return true;
  } catch (error) {
    console.error('❌ Failed to register FCM token:', error?.message);
    const errorMsg = error?.message || String(error);
    
    // Check if the error is due to missing auth token
    if (errorMsg.includes('Unauthorized') || errorMsg.includes('401') || errorMsg.includes('access denied') || errorMsg.includes('no authentication token')) {
      console.warn('⚠️  No authentication token available. Token will be retried after login.');
      await savePendingFcmToken(token);
      return false;
    }
    
    debugAlert('FCM token registration failed', 'Token will be retried after login. Error: ' + errorMsg);
    await savePendingFcmToken(token);
    return false;
  }
};

/**
 * Handle foreground messages (when app is open)
 * Display local notification or in-app alert
 */
const setupForegroundMessageHandler = () => {
  if (foregroundMessageListener) {
    foregroundMessageListener();
  }

  try {
    if (!messagingInstance || typeof messagingInstance.onMessage !== 'function') {
      console.error('messagingInstance or messagingInstance.onMessage is not available');
      return;
    }

    foregroundMessageListener = messagingInstance.onMessage(async (remoteMessage) => {
      console.log('Foreground message received:', remoteMessage?.notification?.title || remoteMessage?.data?.title);

      const title = remoteMessage?.notification?.title || remoteMessage?.data?.title || 'New Notification';
      const body = remoteMessage?.notification?.body || remoteMessage?.data?.body || 'You have a new message';
      const data = remoteMessage?.data || {};

      try {
        await notifee.displayNotification({
          title,
          body,
          android: {
            channelId: 'default',
            smallIcon: 'ic_launcher',
            pressAction: { id: 'default' }
          },
          data
        });
      } catch (error) {
        console.warn('Failed to display notification via Notifee:', error);
        Alert.alert(
          title,
          body,
          [
            {
              text: 'OK',
              onPress: () => handleNotificationPress(data)
            }
          ]
        );
      }
    });
  } catch (error) {
    console.error('Error setting foreground message handler:', error);
  }
};

/**
 * Handle background messages
 * This is called when app is in background or terminated
 */
export const setupBackgroundMessageHandler = () => {
  try {
    if (!messagingInstance || typeof messagingInstance.setBackgroundMessageHandler !== 'function') {
      console.error('messagingInstance or messagingInstance.setBackgroundMessageHandler is not available');
      return;
    }

    messagingInstance.setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background message handled:', remoteMessage?.data?.title);
      // Message handled in the background
      // The notification will be displayed automatically by Firebase
      return Promise.resolve();
    });
  } catch (error) {
    console.error('Error setting background message handler:', error);
  }
};

/**
 * Handle notification when app is opened from notification
 */
const setupNotificationOpenedHandler = () => {
  if (notificationOpenedListener) {
    notificationOpenedListener();
  }

  try {
    if (!messagingInstance) {
      console.error('messagingInstance is not available in setupNotificationOpenedHandler');
      return;
    }

    // Handle notification that caused app to open from background state
    if (typeof messagingInstance.getInitialNotification === 'function') {
      messagingInstance
        .getInitialNotification()
        .then((remoteMessage) => {
          if (remoteMessage) {
            console.log('App opened from notification:', remoteMessage?.notification?.title);
            handleNotificationPress(remoteMessage.data);
          }
        })
        .catch(error => {
          console.error('Error getting initial notification:', error);
        });
    } else {
      console.error('messagingInstance.getInitialNotification is not a function');
    }

    // Handle notification when app is in background and user taps on it
    if (typeof messagingInstance.onNotificationOpenedApp === 'function') {
      notificationOpenedListener = messagingInstance.onNotificationOpenedApp((remoteMessage) => {
        console.log('Notification opened app:', remoteMessage?.notification?.title);
        if (remoteMessage) {
          handleNotificationPress(remoteMessage.data);
        }
      });
    } else {
      console.error('messagingInstance.onNotificationOpenedApp is not a function');
    }
  } catch (error) {
    console.error('Error setting notification opened handler:', error);
  }
};

/**
 * Handle notification press
 * Navigate to appropriate screen based on notification data
 */
export const handleNotificationPress = (data) => {
  if (!data) return;

  console.log('Handling notification press with data:', data);

  // Extract data
  const { type, orderId, conversationId, title, body } = data;

  // Navigate based on notification type
  if (type === 'order' && orderId) {
    // Navigate to order details
    global.notificationNavigation?.navigate('Main', {
      screen: 'MainTabs',
      params: {
        screen: 'Orders',
        params: { orderId },
      },
    });
  } else if (type === 'chat' && conversationId) {
    // Navigate to chat screen
    global.notificationNavigation?.navigate('Main', {
      screen: 'MainTabs',
      params: {
        screen: 'Chat',
        params: { conversationId },
      },
    });
  } else if (type === 'promotion') {
    // Navigate to dashboard/promotions
    global.notificationNavigation?.navigate('Main', {
      screen: 'MainTabs',
      params: { screen: 'Dashboard' },
    });
  }
};

/**
 * Cleanup Firebase listeners
 */
export const cleanupFirebaseMessaging = () => {
  if (foregroundMessageListener) {
    foregroundMessageListener();
  }
  if (notificationOpenedListener) {
    notificationOpenedListener();
  }
  if (appStateListener) {
    appStateListener.remove();
  }
};

export const registerPendingFcmToken = async () => {
  try {
    const pendingToken = await getPendingFcmToken();
    if (!pendingToken) {
      console.log('No pending FCM token to register.');
      return false;
    }
    console.log('🔄 Registering pending FCM token after login:', pendingToken.substring(0, 30) + '...');
    const result = await registerFCMToken(pendingToken);
    if (result) {
      console.log('✅ FCM token registered successfully after login');
      // Don't wait for this - it's not critical to block the UI
      clearPendingFcmToken().catch(err => console.error('Error clearing pending token:', err));
    } else {
      console.log('⚠️  FCM token registration failed after login, will retry on next app startup');
    }
    return result;
  } catch (error) {
    console.error('Failed to register pending FCM token:', error);
    return false;
  }
};
