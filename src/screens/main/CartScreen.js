import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import CustomButton from '../../components/common/CustomButton';
import ThemedAlert from '../../components/common/ThemedAlert';
import { getData, storeData, removeData } from '../../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS, ORDER_STATUS } from '../../utils/constants';
import { ordersAPI } from '../../services/api';

const CartScreen = ({ navigation }) => {
  const [cartItems, setCartItems] = useState([]);
  const [cartOrders, setCartOrders] = useState([]);
  const [user, setUser] = useState({ name: 'Fawad', profilePic: null });
  const [themedAlert, setThemedAlert] = useState({ visible: false, title: '', message: '', buttons: [] });

  useFocusEffect(
    useCallback(() => {
      fetchCart();
      fetchUser();
    }, [])
  );

  const fetchUser = async () => {
    const userData = await getData(ASYNC_STORAGE_KEYS.USER_DATA);
    if (userData) setUser(userData);
  };

  const fetchCart = async () => {
    const items = await getData(ASYNC_STORAGE_KEYS.CART) || [];
    // Handle both old format (array of items) and new format (array of orders)
    if (items.length > 0 && items[0].items) {
      // New format - each item is an order with items array
      setCartOrders(items);
      // Flatten items for display
      const allItems = items.flatMap(order => order.items || []);
      setCartItems(allItems);
    } else {
      // Old format - direct items array
      setCartOrders([]);
      setCartItems(items);
    }
  };

  const removeOrder = async (orderId) => {
    const updatedOrders = cartOrders.filter(order => order.id !== orderId);
    setCartOrders(updatedOrders);
    // Recalculate items
    const allItems = updatedOrders.flatMap(order => order.items || []);
    setCartItems(allItems);
    await storeData(ASYNC_STORAGE_KEYS.CART, updatedOrders);
  };

  const handleOrderNow = async () => {
    if (cartOrders.length === 0 && cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty. Please add items first.');
      return;
    }

    // Use cartOrders if available, otherwise create order from cartItems
    const ordersToPlace = cartOrders.length > 0 ? cartOrders : [{
      id: Date.now().toString(),
      items: cartItems,
      store: 'Robot Store',
      area: 'N/A',
      address: 'N/A',
      isRobotStore: true,
      createdAt: new Date().toISOString()
    }];

    try {
      // Place each order via backend API
      const placedOrders = [];
      
      for (const order of ordersToPlace) {
        // Format items for backend
        let orderTotal = 0;
        const items = order.items.map(item => {
          const itemPrice = parseFloat(item.price) || 0;
          const itemQuantity = parseInt(item.quantity, 10) || 1;
          orderTotal += itemPrice * itemQuantity;
          return {
            name: item.text || item.itemName || item.name || 'Item',
            quantity: itemQuantity,
            price: itemPrice,
          };
        });

        const orderData = {
          items,
          total: orderTotal,
          pickup: order.store || 'Robot Store',
          dropoff: order.address || order.area || 'N/A',
          area: order.area || 'N/A',
          notes: order.notes || '',
          location: order.location || null,
        };

        try {
          const response = await ordersAPI.create(orderData);
          placedOrders.push(response.data || response.order);
        } catch (error) {
          console.error('Error placing order:', error);
          // Continue with other orders even if one fails
        }
      }

      if (placedOrders.length === 0) {
        Alert.alert('Error', 'Failed to place orders. Please try again.');
        return;
      }

      // Clear cart
      await removeData(ASYNC_STORAGE_KEYS.CART);
      setCartItems([]);
      setCartOrders([]);

      setThemedAlert({
        visible: true,
        title: 'Order Placed! 🎉',
        message: `Your ${placedOrders.length > 1 ? placedOrders.length + ' orders have' : 'order has'} been placed successfully!\n\nOrder ID: ${placedOrders[0]?.orderId || 'N/A'}`,
        buttons: [
          { 
            text: 'View Orders', 
            onPress: () => {
              setThemedAlert({ visible: false, title: '', message: '', buttons: [] });
              // Navigate to Orders tab
              navigation.navigate('MainTabs', { screen: 'Requests' });
            } 
          },
          { text: 'Stay Here', style: 'cancel' },
        ],
      });
    } catch (error) {
      console.error('Error in handleOrderNow:', error);
      Alert.alert('Error', 'Failed to place order. Please try again.');
    }
  };

  const renderCartOrder = ({ item: order }) => (
    <Card style={styles.cartOrderCard}>
      {/* Order Header */}
      <View style={styles.orderCardHeader}>
        <Text style={styles.orderCardId}>Order #{order.orderId?.slice(-6) || order.id?.slice(-6)}</Text>
        <TouchableOpacity onPress={() => removeOrder(order.id)}>
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      </View>
      
      {/* Store & Area */}
      <View style={styles.orderCardStore}>
        <Ionicons name="storefront-outline" size={16} color={COLORS.primary} />
        <Text style={styles.orderCardStoreText}>
          {order.isRobotStore ? '🤖 ' : ''}{order.store} • {order.area}
        </Text>
      </View>
      
      {/* Address */}
      <View style={styles.orderCardAddress}>
        <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
        <Text style={styles.orderCardAddressText} numberOfLines={2}>
          {order.address}
        </Text>
      </View>
      
      {/* Items */}
      <View style={styles.orderCardItems}>
        <Text style={styles.orderCardItemsLabel}>
          <Ionicons name="fast-food-outline" size={14} color={COLORS.textSecondary} /> Items:
        </Text>
        {Array.isArray(order.items) && order.items.map((item, idx) => (
          <Text key={idx} style={styles.orderCardItem}>
            • {item.text || item.itemName || item}
          </Text>
        ))}
      </View>
      
      {/* Date */}
      <Text style={styles.orderCardDate}>
        Added: {new Date(order.createdAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </Text>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        navigation={navigation}
        title="Your Cart"
      />

      <ThemedAlert
        visible={themedAlert.visible}
        title={themedAlert.title}
        message={themedAlert.message}
        buttons={themedAlert.buttons}
        onRequestClose={() => setThemedAlert({ visible: false, title: '', message: '', buttons: [] })}
      />
      <View style={styles.content}>
        {cartItems.length > 0 ? (
          <>
            <FlatList
              data={cartOrders.length > 0 ? cartOrders : cartItems}
              renderItem={cartOrders.length > 0 ? renderCartOrder : null}
              keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
              contentContainerStyle={styles.listContent}
            />
            <View style={styles.summaryContainer}>
              <Text style={styles.itemCountText}>
                {cartOrders.length > 0 ? cartOrders.length : cartItems.length} {cartOrders.length > 0 ? 'order' : 'item'}{cartOrders.length > 1 || cartItems.length > 1 ? 's' : ''} in cart
              </Text>
              <CustomButton
                title="Place Order"
                onPress={handleOrderNow}
                style={styles.orderButton}
              />
            </View>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Your cart is empty 🛒</Text>
            <CustomButton
              title="Add Items"
              onPress={() => navigation.navigate('Dashboard')}
              style={styles.emptyButton}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  cartOrderCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  orderCardId: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  orderCardStore: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  orderCardStoreText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    marginLeft: SPACING.xs,
    fontWeight: '600',
  },
  orderCardAddress: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  orderCardAddressText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
    flex: 1,
  },
  orderCardItems: {
    backgroundColor: COLORS.background,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  orderCardItemsLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  orderCardItem: {
    fontSize: 14,
    color: COLORS.textPrimary,
    paddingVertical: 2,
  },
  orderCardDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  cartCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  itemQuantity: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  itemAction: {
    justifyContent: 'center',
  },
  removeText: {
    fontSize: 12,
    color: 'red',
    fontWeight: '600',
  },
  summaryContainer: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    paddingBottom: 80,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    alignItems: 'center',
  },
  itemCountText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  orderButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.secondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyText: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  emptyButton: {
    width: '100%',
  },
});

export default CartScreen;
