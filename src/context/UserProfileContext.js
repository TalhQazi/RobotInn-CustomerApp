import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getData, storeData, removeData } from '../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../utils/constants';
import { usersAPI, ordersAPI } from '../services/api';
import { resetToAuth } from '../navigation/navigationRef';
import { COLORS } from '../theme/colors';
import { BORDER_RADIUS } from '../theme/spacing';

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
  const [bannedModal, setBannedModal] = useState({ visible: false, reason: '' });

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
      }

      const response = await usersAPI.getProfile();
      if (response.success && response.data) {
        const profile = response.data;
        const isBanned = profile?.isBanned === true || profile?.is_banned === true || profile?.status === 'banned';
        if (isBanned) {
          const reason = profile?.banReason || profile?.ban_reason || 'Your account has been suspended by an administrator.';
          const auth = require('@react-native-firebase/auth').default;
          await auth().signOut().catch(() => {});
          try {
            const { GoogleSignin } = require('@react-native-google-signin/google-signin');
            await GoogleSignin.signOut().catch(() => {});
          } catch (_) {}
          await removeData(ASYNC_STORAGE_KEYS.AUTH_TOKEN);
          await removeData(ASYNC_STORAGE_KEYS.USER_DATA);
          setUser(null);
          setBannedModal({ visible: true, reason });
          resetToAuth();
          return;
        }
        await applyProfileData(profile);
      }

      await computeStatsFromOrders();
    } catch (error) {
      if (error?.message?.includes('BANNED') || error?.isBanned) {
        const reason = error?.banReason || error?.message?.replace('BANNED:', '').trim() || 'Your account has been suspended by an administrator.';
        setBannedModal({ visible: true, reason });
        resetToAuth();
      } else {
        console.error('refreshProfile error:', error);
      }
    } finally {
      setLoadingProfile(false);
    }
  }, [applyProfileData, computeStatsFromOrders]);

  // ── Auth listener and Real-time Firestore Ban Listener ──
  useEffect(() => {
    const auth = require('@react-native-firebase/auth').default;
    const firestore = require('@react-native-firebase/firestore').default;
    let docUnsub = null;

    const unsubscribeAuth = auth().onAuthStateChanged(async (firebaseUser) => {
      if (docUnsub) {
        docUnsub();
        docUnsub = null;
      }

      if (firebaseUser) {
        console.log("UserProfileProvider: Auth state changed - logged in UID:", firebaseUser.uid);
        refreshProfile();

        // Enforce real-time database listener on the user's profile node
        docUnsub = firestore()
          .collection('users')
          .doc(firebaseUser.uid)
          .onSnapshot(async (docSnap) => {
            if (!docSnap || !docSnap.exists) return;
            const data = docSnap.data();
            const isBanned = data?.isBanned === true || data?.is_banned === true || data?.status === 'banned';
            if (isBanned) {
              console.warn('🚨 Real-time ban detected for user:', firebaseUser.uid);
              const reason = data?.banReason || data?.ban_reason || 'Your account has been suspended by an administrator.';

              if (docUnsub) {
                docUnsub();
                docUnsub = null;
              }

              // 1. Instantly clear session state
              try {
                await auth().signOut();
                const { GoogleSignin } = require('@react-native-google-signin/google-signin');
                await GoogleSignin.signOut().catch(() => {});
              } catch (_) {}
              await removeData(ASYNC_STORAGE_KEYS.AUTH_TOKEN);
              await removeData(ASYNC_STORAGE_KEYS.USER_DATA);
              setUser(null);

              // 2. Block dashboard navigation and return customized banned layout
              setBannedModal({ visible: true, reason });
              resetToAuth();
            }
          }, (err) => {
            console.warn('User profile realtime listener error:', err?.message);
          });
      } else {
        console.log("UserProfileProvider: Auth state changed - logged out");
        setUser(null);
        setStats(defaultStats);
      }
    });

    return () => {
      unsubscribeAuth();
      if (docUnsub) {
        docUnsub();
      }
    };
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

      {/* Customized Banned Layout Modal */}
      <Modal
        visible={bannedModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setBannedModal({ visible: false, reason: '' })}
      >
        <View style={bannedStyles.overlay}>
          <View style={bannedStyles.container}>
            <View style={bannedStyles.iconCircle}>
              <Ionicons name="shield-outline" size={42} color="#EF4444" />
            </View>
            <Text style={bannedStyles.title}>Account Suspended</Text>
            <Text style={bannedStyles.subtitle}>
              Access to this account has been restricted by RobotInn Administration.
            </Text>
            <View style={bannedStyles.reasonBox}>
              <Text style={bannedStyles.reasonLabel}>Reason:</Text>
              <Text style={bannedStyles.reasonText}>
                {bannedModal.reason || 'Violating platform guidelines or terms of service.'}
              </Text>
            </View>
            <TouchableOpacity
              style={bannedStyles.actionButton}
              activeOpacity={0.85}
              onPress={() => setBannedModal({ visible: false, reason: '' })}
            >
              <Text style={bannedStyles.actionButtonText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  return useContext(UserProfileContext);
}

export function getAvatarUri(user) {
  return user?.avatar || user?.avatarUrl || user?.profilePic || user?.photoURL || user?.image || user?.imageUrl || null;
}

export function getUserInitial(user) {
  const name = user?.name || 'U';
  return name.charAt(0).toUpperCase();
}

const bannedStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FECACA',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  reasonBox: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 18,
    fontWeight: '500',
  },
  actionButton: {
    width: '100%',
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
