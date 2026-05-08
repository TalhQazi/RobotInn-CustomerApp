import React from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity } from 'react-native';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import Header from '../../components/common/Header';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Card from '../../components/common/Card';

const NotificationScreen = ({ navigation }) => {
  const notifications = [
    {
      id: '1',
      title: 'Order Delivered',
      message: 'Your order #101 has been delivered successfully.',
      time: '2 hours ago',
      type: 'success',
      read: false,
    },
    {
      id: '2',
      title: 'Order In Progress',
      message: 'Your order #102 is being prepared by the restaurant.',
      time: '5 hours ago',
      type: 'info',
      read: false,
    },
    {
      id: '3',
      title: 'Special Offer',
      message: 'Get 20% off on your next order with code ROBOT20.',
      time: '1 day ago',
      type: 'offer',
      read: true,
    },
    {
      id: '4',
      title: 'New Food Menu Added',
      message: 'Check out our new sushi platter on the dashboard.',
      time: '2 days ago',
      type: 'info',
      read: true,
    },
  ];

  const getIconByType = (type) => {
    switch (type) {
      case 'success':
        return 'checkmark-circle';
      case 'offer':
        return 'gift';
      default:
        return 'information-circle';
    }
  };

  const getIconColorByType = (type) => {
    switch (type) {
      case 'success':
        return COLORS.delivered;
      case 'offer':
        return COLORS.secondary;
      default:
        return COLORS.primary;
    }
  };

  const renderNotificationItem = ({ item }) => (
    <Card style={[styles.notificationCard, !item.read && styles.unreadCard]}>
      <View style={styles.iconContainer}>
        <Ionicons 
          name={getIconByType(item.type)} 
          size={28} 
          color={getIconColorByType(item.type)} 
        />
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
        <Text style={styles.message}>{item.message}</Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        navigation={navigation}
        title="Notifications"
        showBackButton={true}
      />
      
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={60} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No notifications yet</Text>
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
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  unreadCard: {
    backgroundColor: COLORS.white,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  time: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  message: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginLeft: SPACING.sm,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
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

export default NotificationScreen;
