import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import notifee from '@notifee/react-native';

const NotificationUnreadContext = createContext({
  unreadCount: 0,
  refreshUnreadCount: async () => {},
});

export function NotificationUnreadProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const unsubscribe = firestore()
      .collection('notifications')
      .where('userId', '==', user.uid)
      .where('read', '==', false)
      .onSnapshot(async (snapshot) => {
        if (!snapshot) return;
        setUnreadCount(snapshot.size);

        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const notif = change.doc.data();
            const isRecent = new Date().getTime() - new Date(notif.createdAt).getTime() < 10000; // 10 seconds

            if (isRecent) {
              // Skip if user is currently looking at this conversation
              if (notif.type === 'chat' && global.activeConversationId === notif.data?.conversationId) {
                return;
              }

              try {
                await notifee.displayNotification({
                  title: notif.title || 'New Notification',
                  body: notif.message || '',
                  android: {
                    channelId: 'default',
                    smallIcon: 'ic_launcher',
                    pressAction: { id: 'default' },
                  },
                  data: notif.data || {},
                });
              } catch (error) {
                console.warn('Failed to display local notification:', error);
              }
            }
          }
        });
      }, (err) => {
        console.error('Error listening to notifications:', err);
      });

    return () => unsubscribe();
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    // Kept for backward compatibility, count is handled in real-time by onSnapshot
  }, []);

  return (
    <NotificationUnreadContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationUnreadContext.Provider>
  );
}

export function useNotificationUnread() {
  return useContext(NotificationUnreadContext);
}
