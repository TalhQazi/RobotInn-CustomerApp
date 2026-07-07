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
