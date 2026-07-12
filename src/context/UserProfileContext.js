import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getData, storeData } from '../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../utils/constants';
import { usersAPI, ordersAPI } from '../services/api';

const defaultStats = {
  totalOrders: 0,
  activeOrders: 0,
  completedOrders: 0,
};

const UserProfileContext = createContext({
  user: null,
  stats: defaultStats,
  loadingProfile: false,
  refreshProfile: async () => {},
  updateLocalUser: async () => {},
});

export function UserProfileProvider({ children }) {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(defaultStats);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const applyProfileData = useCallback(async (profileData) => {
    if (!profileData) {
      return;
    }

    const merged = {
      ...((await getData(ASYNC_STORAGE_KEYS.USER_DATA)) || {}),
      ...profileData,
    };

    await storeData(ASYNC_STORAGE_KEYS.USER_DATA, merged);
    setUser(merged);
    
    // Initialize Zego Service for VoIP calls
    const auth = require('@react-native-firebase/auth').default;
    const userId = merged._id || merged.id || merged.uid || (auth().currentUser?.uid);
    if (userId) {
      // const { initZegoService } = require('../services/ZegoService');
      // initZegoService(userId, merged.name || merged.firstName || 'Customer');
    }
  }, []);

  const computeStatsFromOrders = useCallback(async () => {
    try {
      const res = await ordersAPI.getMyOrders({ limit: 500 });
      if (res.success && Array.isArray(res.data)) {
        const orders = res.data;
        const total = orders.length;
        const activeStatuses = ['pending', 'accepted', 'processing', 'picked', 'picked up', 'in progress'];
        const completedStatuses = ['delivered'];
        const active = orders.filter(o => activeStatuses.includes(String(o.status || '').toLowerCase())).length;
        const completed = orders.filter(o => completedStatuses.includes(String(o.status || '').toLowerCase())).length;
        setStats({ totalOrders: total, activeOrders: active, completedOrders: completed });
      }
    } catch (error) {
      console.error('computeStatsFromOrders error:', error);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const cached = await getData(ASYNC_STORAGE_KEYS.USER_DATA);
      if (cached) {
        setUser(cached);
        const auth = require('@react-native-firebase/auth').default;
        const userId = cached._id || cached.id || cached.uid || (auth().currentUser?.uid);
        if (userId) {
          // const { initZegoService } = require('../services/ZegoService');
          // initZegoService(userId, cached.name || cached.firstName || 'Customer');
        }
      }

      const response = await usersAPI.getProfile();
      if (response.success && response.data) {
        await applyProfileData(response.data);
      }

      await computeStatsFromOrders();
    } catch (error) {
      console.error('refreshProfile error:', error);
    } finally {
      setLoadingProfile(false);
    }
  }, [applyProfileData, computeStatsFromOrders]);

  useEffect(() => {
    const auth = require('@react-native-firebase/auth').default;
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        console.log("UserProfileProvider: Auth state changed - logged in UID:", firebaseUser.uid);
        refreshProfile();
      } else {
        console.log("UserProfileProvider: Auth state changed - logged out");
        setUser(null);
        setStats(defaultStats);
        try {
          // const { uninitZegoService } = require('../services/ZegoService');
          // uninitZegoService();
        } catch (e) {
          console.warn("Zego uninit warning:", e);
        }
      }
    });

    return () => unsubscribe();
  }, [refreshProfile]);

  const updateLocalUser = useCallback(async (partialUser) => {
    const current = (await getData(ASYNC_STORAGE_KEYS.USER_DATA)) || user || {};
    const merged = { ...current, ...partialUser };
    await applyProfileData(merged);
  }, [applyProfileData, user]);

  return (
    <UserProfileContext.Provider
      value={{
        user,
        stats,
        loadingProfile,
        refreshProfile,
        updateLocalUser,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  return useContext(UserProfileContext);
}

export function getAvatarUri(user) {
  return user?.avatar || user?.profilePic || null;
}

export function getUserInitial(user) {
  const name = user?.name || 'U';
  return name.charAt(0).toUpperCase();
}
