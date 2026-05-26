import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { chatAPI, openRiderChat } from '../../services/api';
import { getData } from '../../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../../utils/constants';

function formatMsgTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const ChatScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const {
    conversationId: initialConversationId,
    participantId,
    contactName,
    orderCode,
  } = route.params || {};

  const [conversationId, setConversationId] = useState(initialConversationId || null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [myUserId, setMyUserId] = useState(null);
  const flatListRef = useRef(null);

  useEffect(() => {
    (async () => {
      const user = await getData(ASYNC_STORAGE_KEYS.USER_DATA);
      if (user?._id) setMyUserId(String(user._id));
      else if (user?.id) setMyUserId(String(user.id));
    })();
  }, []);

  const loadMessages = useCallback(
    async (convId, silent = false) => {
      if (!convId) return;
      if (!silent) setLoading(true);
      try {
        const res = await chatAPI.getMessages(convId, { limit: 100 });
        const userData = await getData(ASYNC_STORAGE_KEYS.USER_DATA);
        const uid =
          myUserId || String(userData?._id || userData?.id || '');
        if (res.success && Array.isArray(res.data)) {
          setMessages(
            res.data.map((m) => ({
              id: String(m.id),
              text: m.text,
              sender: uid && String(m.senderId) === String(uid) ? 'me' : 'them',
              time: m.time || formatMsgTime(m.timestamp),
              status: m.read ? 'read' : 'delivered',
            }))
          );
        }
        await chatAPI.markRead(convId);
      } catch (e) {
        console.log('load messages', e);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [myUserId]
  );

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      try {
        let convId = initialConversationId || conversationId;
        if (!convId && participantId) {
          convId = await openRiderChat({
            riderId: participantId,
            orderCode,
          });
        }
        if (cancelled || !convId) {
          if (!participantId) {
            Alert.alert('Chat', 'Missing conversation. Go back and try again.');
            navigation.goBack();
          }
          return;
        }
        setConversationId(convId);
        await loadMessages(convId, true);
      } catch (e) {
        Alert.alert('Chat', e.message || 'Could not open chat');
        navigation.goBack();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [initialConversationId, participantId, orderCode]);

  // Subscribe to real-time messages via Firestore listener
  useEffect(() => {
    if (!conversationId) return;

    const unsubscribe = chatAPI.subscribeMessages(conversationId, async (data) => {
      const userData = await getData(ASYNC_STORAGE_KEYS.USER_DATA);
      const uid = myUserId || String(userData?._id || userData?.id || '');
      setMessages(
        data.map((m) => ({
          id: String(m.id),
          text: m.text,
          sender: uid && String(m.senderId) === String(uid) ? 'me' : 'them',
          time: m.time || formatMsgTime(m.createdAt),
          status: m.read ? 'read' : 'delivered',
        }))
      );
      setLoading(false);

      try {
        await chatAPI.markRead(conversationId);
      } catch (e) {
        console.log('Error marking messages as read:', e);
      }
    });

    return () => unsubscribe();
  }, [conversationId, myUserId]);

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !conversationId || sending) return;
    const text = message.trim();
    setSending(true);
    setMessage('');

    const optimistic = {
      id: `tmp-${Date.now()}`,
      text,
      sender: 'me',
      time: formatMsgTime(new Date().toISOString()),
      status: 'sent',
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await chatAPI.sendMessage(conversationId, text);
      if (res.success && res.data) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimistic.id
              ? {
                  id: String(res.data.id),
                  text: res.data.text,
                  sender: 'me',
                  time: res.data.time || formatMsgTime(res.data.timestamp),
                  status: 'delivered',
                }
              : m
          )
        );
      }
      await loadMessages(conversationId, true);
    } catch (e) {
      Alert.alert('Send failed', e.message || 'Could not send message');
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setMessage(text);
    } finally {
      setSending(false);
    }
  };

  const getInitials = (name) =>
    (name || '?')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  const renderMessage = ({ item }) => {
    const isMe = item.sender === 'me';
    return (
      <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.theirMessageRow]}>
        {!isMe && (
          <View style={styles.smallAvatar}>
            <Text style={styles.smallAvatarText}>{getInitials(contactName)}</Text>
          </View>
        )}
        <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
          <Text style={styles.messageText}>{item.text}</Text>
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>{item.time}</Text>
            {isMe && (
              <Ionicons
                name={item.status === 'read' ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={item.status === 'read' ? '#34B7F1' : '#94A3B8'}
                style={styles.messageStatus}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header — below status bar */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.xs }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{getInitials(contactName)}</Text>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerName} numberOfLines={1}>
              {contactName || 'Rider'}
            </Text>
            <Text style={styles.headerStatus} numberOfLines={1}>
              {orderCode ? `Order #${orderCode}` : 'Delivery chat'}
            </Text>
          </View>
        </View>
      </View>

      {/* Messages + input */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.chatBody}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              style={styles.flex}
              contentContainerStyle={[
                styles.messagesContainer,
                messages.length === 0 && styles.messagesContainerEmpty,
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: false })
              }
              ListEmptyComponent={
                <View style={styles.emptyChat}>
                  <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textSecondary} />
                  <Text style={styles.emptyChatText}>Say hello to your rider</Text>
                </View>
              }
            />
          )}
        </View>

        {/* Input — above home indicator, not under tab bar */}
        <View style={[styles.inputBar, { paddingBottom: bottomInset }]}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={500}
              placeholderTextColor={COLORS.textSecondary}
              editable={!!conversationId && !loading}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!message.trim() || sending || !conversationId) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!message.trim() || sending || !conversationId}
          >
            {sending ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Ionicons name="send" size={20} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ECEFF1',
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm + 4,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  backButton: {
    padding: SPACING.xs,
    marginRight: SPACING.xs,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  headerTextContainer: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerStatus: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  chatBody: {
    flex: 1,
    backgroundColor: '#ECEFF1',
  },
  messagesContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    flexGrow: 1,
  },
  messagesContainerEmpty: {
    justifyContent: 'center',
    flexGrow: 1,
  },
  emptyChat: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyChatText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    marginTop: SPACING.md,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: SPACING.sm + 4,
    alignItems: 'flex-end',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  theirMessageRow: {
    justifyContent: 'flex-start',
  },
  smallAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.xs,
  },
  smallAvatarText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.lg,
  },
  myBubble: {
    backgroundColor: '#DCF8C6',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.textPrimary,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  messageStatus: {
    marginLeft: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm + 2,
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F4F7FA',
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    marginRight: SPACING.sm,
    maxHeight: 120,
    minHeight: 44,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 16,
    color: COLORS.textPrimary,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});

export default ChatScreen;
