import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { getData } from './storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from './utils/constants';
import { webrtcService } from './services/WebRTCService';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, LogBox } from 'react-native';
import 'react-native-gesture-handler';

// Suppress Firebase deprecation warnings
LogBox.ignoreLogs([
  'This method is deprecated (as well as all React Native Firebase namespaced API)',
  'Please use `getApp()` instead',
]);

import SplashScreen from './screens/SplashScreen';
import AuthNavigator from './navigation/AuthNavigator';
import AppNavigator from './navigation/AppNavigator';
import { navigationRef } from './navigation/navigationRef';
import { COLORS } from './theme/colors';
import { NotificationUnreadProvider } from './context/NotificationUnreadContext';
import { UserProfileProvider } from './context/UserProfileContext';
import { initializeFirebaseMessaging, cleanupFirebaseMessaging } from './services/firebase';
import GlobalAlert from './components/common/GlobalAlert';

const Stack = createStackNavigator();

const App = () => {
  useEffect(() => {
    // Initialize Firebase Messaging
    const initializeMessaging = async () => {
      try {
        console.log('App initialized, starting Firebase setup...');
        await initializeFirebaseMessaging();
        console.log('✅ Firebase Messaging initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize Firebase Messaging:', error);
      }
    };

    initializeMessaging();

    // Store navigation reference for use in notifications
    global.notificationNavigation = navigationRef;

    // Subscribe to WebRTC incoming calls
    const setupWebRTC = async () => {
      const user = await getData(ASYNC_STORAGE_KEYS.USER_DATA);
      const uid = user?._id || user?.id;
      if (uid) {
        webrtcService.subscribeToIncomingCalls(String(uid));
        webrtcService.setIncomingListener((callData) => {
          if (navigationRef.current) {
            navigationRef.current.navigate('ZegoUIKitPrebuiltCallWaitingScreen', {
              isIncoming: true,
              callId: callData.id,
              callerName: callData.callerName || 'Unknown',
              callerId: callData.callerId,
            });
          }
        });
      }
    };
    setupWebRTC();

    // Cleanup on app unmount
    return () => {
      cleanupFirebaseMessaging();
    };
  }, []);

  return (
    <UserProfileProvider>
      <NotificationUnreadProvider>
        <SafeAreaProvider>
          <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
          <NavigationContainer ref={navigationRef}>
            <Stack.Navigator
              initialRouteName="Splash"
              screenOptions={{
                headerShown: false,
                gestureEnabled: true,
              }}
            >
              <Stack.Screen name="Splash" component={SplashScreen} />
              <Stack.Screen name="Auth" component={AuthNavigator} />
              <Stack.Screen name="Main" component={AppNavigator} />
            </Stack.Navigator>

            <GlobalAlert />
          </NavigationContainer>
        </SafeAreaProvider>
      </NotificationUnreadProvider>
    </UserProfileProvider>
  );
};

export default App;
