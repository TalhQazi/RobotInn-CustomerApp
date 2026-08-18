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
    let unsubscribe = null;

    const unsubAuth = auth().onAuthStateChanged((user) => {
      if (typeof unsubscribe === 'function') {
        try { unsubscribe(); } catch (_) {}
        unsubscribe = null;
      }

      if (!user) {
        setUnreadCount(0);
        return;
      }

      unsubscribe = firestore()
        .collection('notifications')
        .where('userId', '==', user.uid)
        .where('read', '==', false)
        .onSnapshot(
          (snapshot) => {
            if (!snapshot) return;
            setUnreadCount(snapshot.size);
          },
          (err) => {
            console.warn('Notification unread count listener error:', err?.message || err);
          }
        );
    });

    return () => {
      if (typeof unsubAuth === 'function') {
        try { unsubAuth(); } catch (_) {}
      }
      if (typeof unsubscribe === 'function') {
        try { unsubscribe(); } catch (_) {}
      }
    };
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
