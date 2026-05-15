import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../theme/colors';
import { SPACING } from '../../theme/spacing';
import Header from '../../components/common/Header';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Card from '../../components/common/Card';
import { notificationsAPI } from '../../services/api';
import { useNotificationUnread } from '../../context/NotificationUnreadContext';

function formatTimeAgo(iso) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function getIconAndColor(item) {
  const status = item.data?.status;
  const title = (item.title || '').toLowerCase();

  if (title.includes('delivered') || status === 'delivered') {
    return { icon: 'checkmark-circle', color: COLORS.delivered };
  }
  if (title.includes('cancel') || status === 'cancelled') {
    return { icon: 'close-circle', color: COLORS.secondary };
  }
  if (title.includes('accepted') || status === 'accepted') {
    return { icon: 'bicycle', color: COLORS.inProgress };
  }
  if (title.includes('picked') || status === 'picked') {
    return { icon: 'cube', color: COLORS.inProgress };
  }
  if (title.includes('process') || status === 'processing') {
    return { icon: 'restaurant', color: COLORS.pending };
  }
  if (title.includes('placed') || status === 'pending') {
    return { icon: 'bag-check', color: COLORS.primary };
  }
  if (item.type === 'chat') {
    return { icon: 'chatbubble', color: COLORS.inProgress };
  }
  return { icon: 'information-circle', color: COLORS.primary };
}

const NotificationScreen = ({ navigation }) => {
  const { refreshUnreadCount } = useNotificationUnread();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await notificationsAPI.getAll({ limit: 100 });
      if (res.success && Array.isArray(res.data)) {
        setNotifications(
          res.data.map((n) => ({
            id: String(n.id),
            title: n.title || 'Notification',
            message: n.message || '',
            time: formatTimeAgo(n.createdAt),
            type: n.type || 'system',
            read: !!n.read,
            data: n.data || {},
          }))
        );
      } else {
        setNotifications([]);
      }
    } catch (e) {
      console.log('notifications load error', e);
      setNotifications([]);
    } finally {
      refreshUnreadCount();
    }
  }, [refreshUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadNotifications().finally(() => setLoading(false));
    }, [loadNotifications])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const markAsRead = async (id) => {
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      refreshUnreadCount();
    } catch (e) {
      console.log('mark read error', e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      refreshUnreadCount();
    } catch (e) {
      console.log('mark all read error', e);
    }
  };

  const renderNotificationItem = ({ item }) => {
    const { icon, color } = getIconAndColor(item);

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => !item.read && markAsRead(item.id)}
      >
        <Card style={[styles.notificationCard, !item.read && styles.unreadCard]}>
          <View style={[styles.iconContainer, { backgroundColor: color + '18' }]}>
            <Ionicons name={icon} size={28} color={color} />
          </View>
          <View style={styles.contentContainer}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
            <Text style={styles.message}>{item.message}</Text>
          </View>
          {!item.read && <View style={styles.unreadDot} />}
        </Card>
      </TouchableOpacity>
    );
  };

  const allRead = notifications.length === 0 || notifications.every((n) => n.read);

  return (
    <SafeAreaView style={styles.container}>
      <Header navigation={navigation} title="Notifications" showBackButton={true} />

      {!loading && notifications.length > 0 && (
        <View style={styles.topRow}>
          <Text style={styles.subtitle}>Order updates & activity</Text>
          <TouchableOpacity onPress={markAllAsRead} disabled={allRead}>
            <Text style={[styles.markAll, allRead && styles.markAllDisabled]}>
              Mark all read
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            notifications.length === 0 && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={60} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No notifications yet</Text>
              <Text style={styles.emptyHint}>
                You will see updates when you place an order and when its status changes.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  markAll: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  markAllDisabled: {
    color: COLORS.textSecondary,
    opacity: 0.6,
  },
  listContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  emptyList: {
    flexGrow: 1,
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
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: SPACING.sm,
  },
  titleUnread: {
    fontWeight: '700',
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
    paddingHorizontal: SPACING.xl,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
});

export default NotificationScreen;
