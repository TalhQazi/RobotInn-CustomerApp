import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Alert, DeviceEventEmitter, TextInput, Platform } from 'react-native';
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
  const [estimatedPriceInput, setEstimatedPriceInput] = useState('');
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
    if (items.length > 0) {
      if (items[0].items) {
        // Reverse-chronological order (LIFO): Latest items at Index 0
        const sortedOrders = [...items].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        setCartOrders(sortedOrders);
        // Flatten items for display
        const allItems = sortedOrders.flatMap(order => order.items || []);
        setCartItems(allItems);
      } else {

        // Old format - direct items array, convert it to the new order format
        const defaultStore = items[0]?.store || items[0]?.selectedStore || 'Store';
        const mockOrder = {
          id: `mock-ord-${Date.now()}`,
          items: items.map((it, idx) => ({
            text: it.text || it.itemName || it.name || 'Item',
            quantity: parseInt(it.quantity, 10) || 1,
            price: parseFloat(it.price) || 0,
            store: it.store || it.selectedStore || defaultStore,
          })),
          store: defaultStore,
          pickup: defaultStore,
          area: 'N/A',
          address: 'N/A',
          isRobotStore: false,
          createdAt: new Date().toISOString()
        };
        const normalized = [mockOrder];
        setCartOrders(normalized);
        setCartItems(items);
        await storeData(ASYNC_STORAGE_KEYS.CART, normalized);
      }
    } else {
      setCartOrders([]);
      setCartItems([]);
    }
  };

  const removeOrder = async (orderId) => {
    const updatedOrders = cartOrders.filter(order => order.id !== orderId);
    setCartOrders(updatedOrders);
    // Recalculate items
    const allItems = updatedOrders.flatMap(order => order.items || []);
    setCartItems(allItems);
    await storeData(ASYNC_STORAGE_KEYS.CART, updatedOrders);
    DeviceEventEmitter.emit('cartUpdated');
  };

  const handleOrderNow = async () => {
    if (cartOrders.length === 0 && cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty. Please add items first.');
      return;
    }

    // Use cartOrders if available, otherwise create order from cartItems
    const fallbackStore = cartItems[0]?.store || cartItems[0]?.selectedStore || 'Store';
    const ordersToPlace = cartOrders.length > 0 ? cartOrders : [{
      id: Date.now().toString(),
      items: cartItems,
      store: fallbackStore,
      pickup: fallbackStore,
      area: 'N/A',
      address: 'N/A',
      isRobotStore: false,
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
            category: item.category || order.category || 'General',
            quantity: itemQuantity,
            price: itemPrice,
            store: item.store || item.selectedStore || order.store || order.pickup || '',
          };
        });

        const actualStore = order.pickup || order.store || (order.items && (order.items[0]?.store || order.items[0]?.selectedStore)) || 'Store';

        const parsedEst = parseFloat(estimatedPriceInput) || 0;
        const finalEstPrice = parsedEst > 0 ? parsedEst : (order.estimatedPrice || orderTotal || 0);

        const orderData = {
          items,
          category: order.category || items[0]?.category || 'General',
          total: finalEstPrice > 0 ? finalEstPrice : orderTotal,
          estimatedPrice: finalEstPrice,
          estimatedSubtotal: finalEstPrice,
          budget: finalEstPrice,
          pickup: actualStore,
          store: actualStore,
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
      DeviceEventEmitter.emit('cartUpdated');
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

  const formatCategoryBadge = (cat) => {
    if (!cat) return '🏷️ Item';
    const cName = String(cat);
    const icon =
      cName.toLowerCase().includes('pharmacy') ? '💊' :
      cName.toLowerCase().includes('grocer') ? '🛒' :
      cName.toLowerCase().includes('bazaar') || cName.toLowerCase().includes('fruit') ? '🥬' :
      cName.toLowerCase().includes('meat') ? '🥩' :
      cName.toLowerCase().includes('cosmetic') ? '💄' :
      cName.toLowerCase().includes('fitness') ? '🏋️‍♂️' :
      cName.toLowerCase().includes('decor') ? '🛋️' :
      cName.toLowerCase().includes('pet') || cName.toLowerCase().includes('dog') ? '🐾' :
      cName.toLowerCase().includes('gift') || cName.toLowerCase().includes('flower') ? '🎁' :
      cName.toLowerCase().includes('baby') || cName.toLowerCase().includes('babay') ? '🍼' :
      cName.toLowerCase().includes('drink') ? '🥤' :
      cName.toLowerCase().includes('baker') ? '🍰' :
      cName.toLowerCase().includes('office') || cName.toLowerCase().includes('stationery') || cName.toLowerCase().includes('book') ? '📚' :
      cName.toLowerCase().includes('auto') || cName.toLowerCase().includes('car') ? '🚗' : '🏷️';
    return `${icon} ${cName}`;
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
          <Ionicons name="bag-handle-outline" size={14} color={COLORS.primary} /> Ordered Items:
        </Text>
        {Array.isArray(order.items) && order.items.map((item, idx) => {
          const itemCat = item.category || order.category;
          return (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={[styles.orderCardItem, { flex: 1 }]}>
                • {item.text || item.itemName || item.name || item}
              </Text>
              {itemCat ? (
                <View style={{ backgroundColor: '#E6FAF8', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginLeft: 6 }}>
                  <Text style={{ fontSize: 11, color: '#2EC4B6', fontWeight: '600' }}>
                    {formatCategoryBadge(itemCat)}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
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

              <View style={styles.priceInputContainer}>
                <Ionicons name="pricetag-outline" size={20} color={COLORS.primary} style={styles.priceIcon} />
                <View style={styles.priceInputWrapper}>
                  <Text style={styles.priceInputLabel}>Estimated Price / Budget (Rs.)</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="Enter estimated budget (e.g. 2000)"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="numeric"
                    value={estimatedPriceInput}
                    onChangeText={setEstimatedPriceInput}
                  />
                </View>
              </View>

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
    width: '100%',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    borderWidth: 1.5,
    borderColor: COLORS.primary + '50',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginVertical: SPACING.xs,
    width: '100%',
  },
  priceIcon: {
    marginRight: SPACING.sm,
  },
  priceInputWrapper: {
    flex: 1,
  },
  priceInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceInput: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
    margin: 0,
  },
  itemCountText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  orderButton: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.secondary,
    width: '100%',
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
