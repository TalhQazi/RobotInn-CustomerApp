import { Alert, ToastAndroid, Platform } from 'react-native';

/**
 * Show a notification to the user
 * On Android: Toast message
 * On iOS: Alert
 */
export const showNotification = (title, message, type = 'info') => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.LONG);
  } else {
    Alert.alert(title, message);
  }
};

/**
 * Show an error notification
 */
export const showErrorNotification = (message) => {
  showNotification('Error', message, 'error');
};

/**
 * Show a success notification
 */
export const showSuccessNotification = (message) => {
  showNotification('Success', message, 'success');
};

/**
 * Show an info notification
 */
export const showInfoNotification = (title, message) => {
  showNotification(title, message, 'info');
};

/**
 * Log notification for debugging
 */
export const logNotification = (title, data) => {
  console.log(`[Notification] ${title}:`, JSON.stringify(data, null, 2));
};
