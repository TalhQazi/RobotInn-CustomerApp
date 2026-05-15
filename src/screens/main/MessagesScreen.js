import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import Header from '../../components/common/Header';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { chatAPI } from '../../services/api';

function formatListTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const MessagesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadInbox = useCallback(async () => {
    try {
      const res = await chatAPI.getConversations();
      if (res.success && Array.isArray(res.data)) {
        setConversations(
          res.data.map((c) => ({
            id: String(c.id),
            participantId: String(c.participantId || ''),
            participantName: c.participantName || 'Rider',
            participantType: c.participantType,
            lastMessage: c.lastMessage || '',
            lastMessageTime: formatListTime(c.lastMessageTime),
            unreadCount: c.unreadCount || 0,
            orderId: c.orderId,
            avatarInitials: c.avatarInitials,
          }))
        );
      } else {
        setConversations([]);
      }
    } catch (e) {
      console.log('load inbox', e);
      setConversations([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let pollId = null;
      const run = async () => {
        setLoading(true);
        await loadInbox();
        setLoading(false);

        const params = route.params || {};
        if (params.riderId || params.conversationId) {
          navigation.navigate('Chat', {
            conversationId: params.conversationId,
            participantId: params.riderId,
            contactName: params.riderName || 'Rider',
            orderCode: params.orderCode,
          });
          navigation.setParams({
            riderId: undefined,
            riderName: undefined,
            orderCode: undefined,
            conversationId: undefined,
          });
        }
      };

      run();
      pollId = setInterval(loadInbox, 8000);

      return () => {
        if (pollId) clearInterval(pollId);
      };
    }, [loadInbox, route.params?.riderId, route.params?.conversationId, navigation])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInbox();
    setRefreshing(false);
  };

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.participantName.toLowerCase().includes(q) ||
      (c.orderId && String(c.orderId).toLowerCase().includes(q)) ||
      c.lastMessage.toLowerCase().includes(q)
    );
  });

  const getInitials = (name) =>
    (name || '?')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  const getRandomColor = (id) => {
    const colors = ['#2EC4B6', '#FF8C42', '#6C5CE7', '#00B894', '#E17055', '#74B9FF'];
    const n = parseInt(String(id).replace(/\D/g, '').slice(-2) || '0', 10);
    return colors[n % colors.length];
  };

  const openChat = (item) => {
    navigation.navigate('Chat', {
      conversationId: item.id,
      participantId: item.participantId,
      contactName: item.participantName,
      orderCode: item.orderId,
    });
  };

  const renderContactItem = ({ item }) => (
    <TouchableOpacity style={styles.contactItem} onPress={() => openChat(item)}>
      <View style={styles.avatarContainer}>
        <View style={[styles.avatarPlaceholder, { backgroundColor: getRandomColor(item.id) }]}>
          <Text style={styles.avatarText}>{item.avatarInitials || getInitials(item.participantName)}</Text>
        </View>
        {item.participantType === 'rider' && <View style={styles.riderDot} />}
      </View>

      <View style={styles.contactInfo}>
        <View style={styles.contactHeader}>
          <Text style={styles.contactName} numberOfLines={1}>
            {item.participantName}
          </Text>
          <Text style={[styles.timeText, item.unreadCount > 0 && styles.unreadTime]}>
            {item.lastMessageTime}
          </Text>
        </View>
        {item.orderId ? (
          <Text style={styles.orderTag}>Order #{item.orderId}</Text>
        ) : null}
        <View style={styles.messageRow}>
          <Text
            style={[styles.lastMessage, item.unreadCount > 0 && styles.unreadMessage]}
            numberOfLines={1}
          >
            {item.lastMessage || 'No messages yet'}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header navigation={navigation} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderContactItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            filtered.length === 0 && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListHeaderComponent={
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search riders or orders..."
                placeholderTextColor={COLORS.textSecondary}
                value={search}
                onChangeText={setSearch}
              />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={60} color={COLORS.textSecondary} />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyHint}>
                When a rider accepts your order, open the order and tap Chat with rider. Conversations
                will appear here.
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
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  emptyList: {
    flexGrow: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: 16,
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '700',
  },
  riderDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  contactInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  contactName: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: SPACING.sm,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  unreadTime: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  orderTag: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
    marginRight: SPACING.sm,
  },
  unreadMessage: {
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  emptyHint: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
});

export default MessagesScreen;
