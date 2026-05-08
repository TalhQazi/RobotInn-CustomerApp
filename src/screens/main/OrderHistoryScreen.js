import React from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, Image } from 'react-native';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Ionicons from 'react-native-vector-icons/Ionicons';

const OrderHistoryScreen = ({ navigation }) => {
  const orderHistory = [
    {
      id: '1',
      restaurant: 'Biryani House',
      items: 'Chicken Biryani, Raita, Salad',
      total: 450,
      date: '2024-03-15',
      time: '14:30',
      status: 'Delivered',
      rating: 4.5,
    },
    {
      id: '2',
      restaurant: 'Pizza Hut',
      items: 'Large Pepperoni Pizza, Garlic Bread',
      total: 1299,
      date: '2024-03-12',
      time: '19:45',
      status: 'Delivered',
      rating: 4.0,
    },
    {
      id: '3',
      restaurant: 'Burger King',
      items: 'Whopper Meal, Fries, Coke',
      total: 850,
      date: '2024-03-10',
      time: '13:20',
      status: 'Cancelled',
      rating: null,
    },
    {
      id: '4',
      restaurant: 'Desi Tadka',
      items: 'Butter Chicken, Naan, Rice',
      total: 750,
      date: '2024-03-08',
      time: '20:15',
      status: 'Delivered',
      rating: 5.0,
    },
    {
      id: '5',
      restaurant: 'Sushi Master',
      items: 'California Roll, Miso Soup',
      total: 1200,
      date: '2024-03-05',
      time: '18:30',
      status: 'Delivered',
      rating: 4.8,
    },
    {
      id: '6',
      restaurant: 'Karachi BBQ',
      items: 'Beef Seekh Kebab, Paratha',
      total: 550,
      date: '2024-03-02',
      time: '21:00',
      status: 'Delivered',
      rating: 4.2,
    },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'Delivered':
        return COLORS.delivered;
      case 'Cancelled':
        return '#FF6B6B';
      default:
        return COLORS.pending;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Delivered':
        return 'checkmark-circle';
      case 'Cancelled':
        return 'close-circle';
      default:
        return 'time';
    }
  };

  const renderOrderItem = ({ item }) => (
    <Card style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.restaurantInfo}>
          <View style={styles.restaurantIcon}>
            <Ionicons name="restaurant-outline" size={24} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.restaurantName}>{item.restaurant}</Text>
            <Text style={styles.orderDate}>{item.date} • {item.time}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Ionicons name={getStatusIcon(item.status)} size={14} color={COLORS.white} />
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.orderDetails}>
        <Text style={styles.itemsText}>{item.items}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalAmount}>PKR {item.total}</Text>
        </View>
      </View>

      {item.status === 'Delivered' && item.rating && (
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={16} color="#FFD700" />
          <Text style={styles.ratingText}>{item.rating}</Text>
          <Text style={styles.reviewText}>You rated this order</Text>
        </View>
      )}

      {item.status === 'Delivered' && (
        <TouchableOpacity style={styles.reorderButton}>
          <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
          <Text style={styles.reorderText}>Reorder</Text>
        </TouchableOpacity>
      )}
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        navigation={navigation}
        title="Order History"
        showBackButton={true}
      />
      
      <FlatList
        data={orderHistory}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryNumber}>{orderHistory.filter(o => o.status === 'Delivered').length}</Text>
              <Text style={styles.summaryLabel}>Completed</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryNumber}>{orderHistory.filter(o => o.status === 'Cancelled').length}</Text>
              <Text style={styles.summaryLabel}>Cancelled</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryNumber}>{orderHistory.length}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={60} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No order history found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginHorizontal: SPACING.xs,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  orderCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  restaurantIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  orderDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  orderDetails: {
    marginBottom: SPACING.sm,
  },
  itemsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginRight: 4,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginLeft: 4,
    marginRight: 8,
  },
  reviewText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  reorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  reorderText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
});

export default OrderHistoryScreen;
