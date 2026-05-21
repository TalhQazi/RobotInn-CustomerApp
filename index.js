/**
 * @format
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);

// Register background handler outside the app lifecycle so it can handle messages
// when the app is in the background or terminated.
messaging().setBackgroundMessageHandler(async remoteMessage => {
	console.log('Background FCM message received:', remoteMessage?.messageId);
	return Promise.resolve();
});
