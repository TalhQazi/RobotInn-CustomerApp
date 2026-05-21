import app from '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';
import { Alert, AppState } from 'react-native';
import { notificationsAPI } from './api';
import { getData } from '../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../utils/constants';

// Helper to show debug alerts in development and always log to console
const debugAlert = (title, message) => {
  try {
    console.log(`[Firebase Debug] ${title}:`, message);
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      Alert.alert(title, typeof message === 'string' ? message : JSON.stringify(message));
    }
  } catch (e) {
    console.log('Error showing debug alert:', e);
  }
};

let appStateListener = null;
let foregroundMessageListener = null;
let notificationOpenedListener = null;
let isFirebaseInitialized = false;

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

    const firebaseApp = app();
    console.log('Firebase app instance:', firebaseApp?.name || 'no app');
    console.log('Firebase app options:', firebaseApp?.options || 'no options');
    if (!firebaseApp || firebaseApp.name !== '[DEFAULT]') {
      const msg = 'Firebase default app is not initialized. Check native Firebase configuration and google-services files.';
      debugAlert('Firebase init error', msg);
      throw new Error(msg);
    }

    // Request notification permissions (iOS - Android is handled by manifest)
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    console.log('Notification permission status:', authStatus, 'Enabled:', enabled);

    if (!enabled) {
      console.log('Notification permissions not granted');
      debugAlert('Notifications disabled', 'Notification permissions not granted. Please enable notifications in the device settings.');
      return;
    }

    // Get FCM token
    const token = await messaging().getToken();
    console.log('FCM Token obtained:', token ? token : 'null');
    if (!token) {
      debugAlert('No FCM token', 'messaging().getToken() returned null/empty. Check Google Play Services (Android) or APNs (iOS) and ensure firebase config is correct.');
    }

    // Register token with backend
    if (token) {
      await registerFCMToken(token);
    }

    // Listen for token refresh
    const tokenRefreshUnsubscribe = messaging().onTokenRefresh(async (newToken) => {
      console.log('FCM Token refreshed:', newToken.substring(0, 20) + '...');
      await registerFCMToken(newToken);
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
    console.error('Failed to initialize Firebase Messaging:', error?.message || error, error?.code);
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
      return false;
    }
    return true;
  } catch (error) {
    console.error('Failed to register FCM token:', error);
    debugAlert('FCM token registration failed', error?.message || String(error));
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
    foregroundMessageListener = messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground message received:', remoteMessage?.notification?.title);

      const { notification, data } = remoteMessage;

      // Display as alert
      Alert.alert(
        notification?.title || 'New Notification',
        notification?.body || 'You have a new message',
        [
          {
            text: 'OK',
            onPress: () => {
              handleNotificationPress(data);
            },
          },
        ]
      );
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
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
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
    // Handle notification that caused app to open from background state
    messaging()
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

    // Handle notification when app is in background and user taps on it
    notificationOpenedListener = messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened app:', remoteMessage?.notification?.title);
      if (remoteMessage) {
        handleNotificationPress(remoteMessage.data);
      }
    });
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
