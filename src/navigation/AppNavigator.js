import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import DashboardScreen from '../screens/main/DashboardScreen';
import OrderScreen from '../screens/main/OrderScreen';
import CartScreen from '../screens/main/CartScreen';
import RequestScreen from '../screens/main/RequestScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import MessagesScreen from '../screens/main/MessagesScreen';
import NotificationScreen from '../screens/main/NotificationScreen';
import OrderHistoryScreen from '../screens/main/OrderHistoryScreen';
import ChatScreen from '../screens/main/ChatScreen';
import AddItemsScreen from '../screens/main/AddItemsScreen';
import MyAddressesScreen from '../screens/main/MyAddressesScreen';
import HelpCenterScreen from '../screens/main/HelpCenterScreen';
import OrderDetailsScreen from '../screens/main/OrderDetailsScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import { COLORS } from '../theme/colors';
import { Text, View, StyleSheet, Platform } from 'react-native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getData } from '../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../utils/constants';
import { NotificationUnreadProvider } from '../context/NotificationUnreadContext';
import { UserProfileProvider } from '../context/UserProfileContext';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const getTabBarStyle = (route) => {
  const routeName = getFocusedRouteNameFromRoute(route) ?? '';
  if (routeName === 'Chat') {
    return { display: 'none' };
  }
  return styles.tabBar;
};

// Home Stack (Dashboard + related screens)
const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="DashboardHome" component={DashboardScreen} />
    <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
    <Stack.Screen name="Chat" component={ChatScreen} />
    <Stack.Screen name="Notifications" component={NotificationScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="MyAddresses" component={MyAddressesScreen} />
    <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
  </Stack.Navigator>
);

// Orders Stack
const OrdersStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="OrdersHome" component={RequestScreen} />
    <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
    <Stack.Screen name="Chat" component={ChatScreen} />
  </Stack.Navigator>
);

// Cart Stack
const CartStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CartHome" component={CartScreen} />
    <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
    <Stack.Screen name="Chat" component={ChatScreen} />
  </Stack.Navigator>
);

// Messages Stack
const MessagesStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MessagesHome" component={MessagesScreen} />
    <Stack.Screen name="Chat" component={ChatScreen} />
  </Stack.Navigator>
);

// Profile Stack
const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileHome" component={ProfileScreen} />
    <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
    <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
    <Stack.Screen name="Chat" component={ChatScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="Notifications" component={NotificationScreen} />
    <Stack.Screen name="MyAddresses" component={MyAddressesScreen} />
    <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
  </Stack.Navigator>
);

const TabIcon = ({ icon, label, focused, badgeCount = 0 }) => (
  <View style={styles.tabIconContainer}>
    <View style={styles.iconContent}>
      <Ionicons 
        name={icon} 
        size={20} 
        color={focused ? COLORS.primary : COLORS.textSecondary} 
      />
      {badgeCount > 0 && (
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{badgeCount}</Text>
        </View>
      )}
    </View>
    <Text 
      numberOfLines={1} 
      style={[
        styles.tabLabel, 
        { 
          color: focused ? COLORS.primary : COLORS.textSecondary, 
          fontWeight: focused ? '700' : '400' 
        }
      ]}
    >
      {label}
    </Text>
  </View>
);

const MainTabs = () => {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const fetchCartCount = async () => {
      const cart = await getData(ASYNC_STORAGE_KEYS.CART) || [];
      setCartCount(cart.length);
    };

    // Poll storage for updates (simple for UI phase)
    const interval = setInterval(fetchCartCount, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <UserProfileProvider>
    <NotificationUnreadProvider>
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={HomeStack} 
        options={({ route }) => ({
          tabBarIcon: ({ focused }) => <TabIcon icon={focused ? "home" : "home-outline"} label="Home" focused={focused} />,
          tabBarStyle: getTabBarStyle(route),
        })}
      />
      <Tab.Screen 
        name="Requests" 
        component={OrdersStack} 
        options={({ route }) => ({
          tabBarIcon: ({ focused }) => <TabIcon icon={focused ? "list" : "list-outline"} label="Orders" focused={focused} />,
          tabBarStyle: getTabBarStyle(route),
        })}
      />
      <Tab.Screen 
        name="Cart" 
        component={CartStack} 
        options={({ route }) => ({
          tabBarIcon: ({ focused }) => <TabIcon icon={focused ? "cart" : "cart-outline"} label="Cart" focused={focused} badgeCount={cartCount} />,
          tabBarStyle: getTabBarStyle(route),
        })}
      />
      <Tab.Screen 
        name="Messages" 
        component={MessagesStack} 
        options={({ route }) => ({
          tabBarIcon: ({ focused }) => <TabIcon icon={focused ? "chatbubble" : "chatbubble-outline"} label="Messages" focused={focused} />,
          tabBarStyle: getTabBarStyle(route),
        })}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileStack} 
        options={({ route }) => ({
          tabBarIcon: ({ focused }) => <TabIcon icon={focused ? "person" : "person-outline"} label="Profile" focused={focused} />,
          tabBarStyle: getTabBarStyle(route),
        })}
      />
    </Tab.Navigator>
    </NotificationUnreadProvider>
    </UserProfileProvider>
  );
};

const AppNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="AddOrder" component={OrderScreen} />
      <Stack.Screen name="AddItems" component={AddItemsScreen} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    elevation: 10,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    height: Platform.OS === 'ios' ? 75 : 58,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute',
    paddingTop: 0,
    paddingBottom: 0,
  },
  tabBarItem: {
    height: '100%',
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexDirection: 'column',
    height: 48,
    width: 70,
    paddingTop: 0,
    paddingBottom: 4,
    marginTop: 'auto',
  },
  iconContent: {
    position: 'relative',
    height: 20,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 2,
  },
  badgeContainer: {
    position: 'absolute',
    right: -8,
    top: -4,
    backgroundColor: 'red',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    paddingHorizontal: 2,
  },
  badgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 1,
    textAlign: 'center',
    lineHeight: 14,
  }
});

export default AppNavigator;
