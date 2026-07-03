import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ZegoCallInvitationDialog } from '@zegocloud/zego-uikit-prebuilt-call-rn';
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
import { initializeFirebaseMessaging, cleanupFirebaseMessaging } from './services/firebase';

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

    // Cleanup on app unmount
    return () => {
      cleanupFirebaseMessaging();
    };
  }, []);

  return (
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
          <ZegoCallInvitationDialog />
        </NavigationContainer>
      </SafeAreaProvider>
    </NotificationUnreadProvider>
  );
};

export default App;
