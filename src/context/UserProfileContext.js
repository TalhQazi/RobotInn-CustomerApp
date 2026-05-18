import React, { createContext, useCallback, useContext, useState } from 'react';
import { getData, storeData } from '../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../utils/constants';
import { usersAPI } from '../services/api';

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
    setStats({
      totalOrders: merged.totalOrders ?? 0,
      activeOrders: merged.activeOrders ?? 0,
      completedOrders: merged.completedOrders ?? 0,
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const cached = await getData(ASYNC_STORAGE_KEYS.USER_DATA);
      if (cached) {
        setUser(cached);
        setStats({
          totalOrders: cached.totalOrders ?? 0,
          activeOrders: cached.activeOrders ?? 0,
          completedOrders: cached.completedOrders ?? 0,
        });
      }

      const response = await usersAPI.getProfile();
      if (response.success && response.data) {
        await applyProfileData(response.data);
      }
    } catch (error) {
      console.error('refreshProfile error:', error);
    } finally {
      setLoadingProfile(false);
    }
  }, [applyProfileData]);

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
