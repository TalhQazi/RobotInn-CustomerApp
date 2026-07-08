/**
 * @format
 */

import { AppRegistry, Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './src/App';
import { name as appName } from './app.json';
import AlertHelper from './src/utils/AlertHelper';

const originalAlert = Alert.alert;
AlertHelper.setOriginalAlert(originalAlert);
Alert.alert = AlertHelper.alert;

AppRegistry.registerComponent(appName, () => App);

// Register background handler outside the app lifecycle so it can handle messages
// when the app is in the background or terminated.
messaging().setBackgroundMessageHandler(async remoteMessage => {
	console.log('Background FCM message received:', remoteMessage?.messageId);
	return Promise.resolve();
});
