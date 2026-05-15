import React, { createContext, useCallback, useContext, useState } from 'react';
import { notificationsAPI } from '../services/api';

const NotificationUnreadContext = createContext({
  unreadCount: 0,
  refreshUnreadCount: async () => {},
});

export function NotificationUnreadProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await notificationsAPI.getAll({ limit: 1 });
      if (res.success) {
        setUnreadCount(res.unreadCount ?? 0);
      }
    } catch {
      setUnreadCount(0);
    }
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
