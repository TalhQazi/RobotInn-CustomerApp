import React, { useState, useEffect, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  StatusBar,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { COLORS } from '../../theme/colors';
import { BORDER_RADIUS } from '../../theme/spacing';
import { SPACING } from '../../theme/spacing';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { authAPI } from '../../services/api';
import { resetToAuth } from '../../navigation/navigationRef';
import { useNotificationUnread } from '../../context/NotificationUnreadContext';
import { useUserProfile, getAvatarUri, getUserInitial } from '../../context/UserProfileContext';

const { width, height } = Dimensions.get('window');

const Header = ({
  navigation,
  showBackButton = false,
  onBackPress,
  title,
  transparent = false,
}) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const { unreadCount, refreshUnreadCount } = useNotificationUnread();
  const { user, stats, refreshProfile } = useUserProfile();

  const avatarUri = getAvatarUri(user);
  const displayName = user?.name || 'User';
  const displayEmail = user?.email || '';

  useFocusEffect(
    React.useCallback(() => {
      refreshUnreadCount();
      refreshProfile();
    }, [refreshUnreadCount, refreshProfile])
  );

  useEffect(() => {
    if (sidebarVisible) {
      refreshUnreadCount();
      refreshProfile();
    }
  }, [sidebarVisible, refreshUnreadCount, refreshProfile]);

  const statsData = useMemo(() => {
    const total = stats.totalOrders || 0;
    const active = stats.activeOrders || 0;
    const completed = stats.completedOrders || 0;

    const progress = (value) => {
      if (total <= 0) {
        return 0;
      }
      return Math.min(1, value / total);
    };

    return [
      {
        icon: 'receipt-outline',
        label: 'Total Orders',
        value: String(total),
        color: '#554a4aff',
        progress: total > 0 ? 1 : 0,
      },
      {
        icon: 'time-outline',
        label: 'Active',
        value: String(active),
        color: '#c7b407ff',
        progress: progress(active),
      },
      {
        icon: 'checkmark-circle-outline',
        label: 'Completed',
        value: String(completed),
        color: '#4ECDC4',
        progress: progress(completed),
      },
    ];
  }, [stats]);

  const menuItems = useMemo(
    () => [
      { icon: 'person-outline', label: 'My Profile', subtitle: 'Manage your profile details', screen: 'Profile', color: '#FF6B6B', iconBg: '#FFF0F0' },
      { icon: 'time-outline', label: 'Order History', subtitle: 'View your past orders', screen: 'OrderHistory', color: '#FFA235', iconBg: '#FFF5EB' },
      { icon: 'location-outline', label: 'Saved Addresses', subtitle: 'Manage your saved locations', screen: 'MyAddresses', color: '#4ECDC4', iconBg: '#E8FAF8' },
      { icon: 'notifications-outline', label: 'Notifications', subtitle: 'View all notifications', screen: 'Notifications', color: '#A78BFA', iconBg: '#F3EEFF', badge: unreadCount },
      { icon: 'chatbubble-outline', label: 'Messages', subtitle: 'Chat with support', screen: 'Messages', color: '#60A5FA', iconBg: '#EBF4FF', badge: 0 },
      { icon: 'settings-outline', label: 'Settings', subtitle: 'Manage app preferences', screen: 'Settings', color: '#94A3B8', iconBg: '#F0F2F5' },
    ],
    [unreadCount]
  );

  const navigateToNotifications = () => {
    if (navigation.getParent()) {
      navigation.getParent().navigate('Dashboard', { screen: 'Notifications' });
    } else {
      navigation.navigate('Notifications');
    }
  };

  const handleMenuPress = (item) => {
    setSidebarVisible(false);
    if (item.screen === 'Notifications') {
      navigateToNotifications();
      return;
    }
    if (item.screen === 'Profile' && navigation.getParent()) {
      navigation.getParent().navigate('Profile', { screen: 'ProfileHome' });
      return;
    }
    if (item.screen === 'Messages' && navigation.getParent()) {
      navigation.getParent().navigate('Messages');
      return;
    }
    if (item.screen) {
      navigation.navigate(item.screen);
    }
  };

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setSidebarVisible(false);
            try {
              await authAPI.logout();
            } catch (error) {
              console.error('Logout error:', error);
            } finally {
              resetToAuth();
            }
          },
        },
      ]
    );
  };

  const renderAvatar = (sizeStyle, textStyle, imageStyle) => {
    if (avatarUri) {
      return <Image source={{ uri: avatarUri }} style={imageStyle} />;
    }
    return <Text style={textStyle}>{getUserInitial(user)}</Text>;
  };

  const renderSidebar = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={sidebarVisible}
      onRequestClose={() => setSidebarVisible(false)}
    >
      <View style={styles.sidebarOverlay}>
        <View style={styles.sidebarContainer}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.sidebarCloseButton}
            onPress={() => setSidebarVisible(false)}
          >
            <Ionicons name="arrow-forward-outline" size={22} color="#fff" />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sidebarScrollContent}
          >
            {/* User Profile Section */}
            <View style={styles.userProfileSection}>
              <View style={styles.userAvatarContainer}>
                <View style={styles.userAvatar}>
                  {renderAvatar(
                    styles.userAvatar,
                    styles.userAvatarText,
                    styles.userAvatarImage
                  )}
                </View>
                <View style={styles.userStatusDot} />
              </View>
              <Text style={styles.userName}>{displayName}</Text>
              <Text style={styles.userEmail}>{displayEmail}</Text>
            </View>

            {/* Stats Cards Section */}
            <View style={styles.statsSection}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.statsGrid}>
                {statsData.map((stat, index) => (
                  <View key={index} style={styles.statCard}>
                    <View style={[styles.statIconContainer, { backgroundColor: `${stat.color}15` }]}>
                      <Ionicons name={stat.icon} size={22} color={stat.color} />
                    </View>
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                    <View style={styles.progressBarContainer}>
                      <View style={[styles.progressBar, { width: `${stat.progress * 100}%`, backgroundColor: stat.color }]} />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Menu Items Section */}
            <View style={styles.menuSection}>
              <Text style={styles.sectionTitle}>Menu</Text>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.menuItem}
                  onPress={() => handleMenuPress(item)}
                  activeOpacity={0.7}
                >
                  {/* Colored rounded icon */}
                  <View style={[styles.menuIconContainer, { backgroundColor: item.iconBg }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>

                  {/* Label + subtitle */}
                  <View style={styles.menuItemTextBlock}>
                    <View style={styles.menuItemLabelRow}>
                      <Text style={styles.menuText}>{item.label}</Text>
                      {item.badge > 0 && (
                        <View style={styles.menuBadge}>
                          <Text style={styles.menuBadgeText}>{item.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                  </View>

                  {/* Chevron */}
                  <Ionicons name="chevron-forward" size={18} color="#C0C8D0" style={styles.menuArrow} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Footer Section */}
            <View style={styles.sidebarFooter}>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={22} color="#EF4444" />
                <View style={styles.logoutTextBlock}>
                  <Text style={styles.logoutText}>Log Out</Text>
                  <Text style={styles.logoutSubtext}>You will be logged out from the app</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.versionText}>Version 1.0.0</Text>
            </View>
          </ScrollView>
        </View>

        <TouchableOpacity
          style={styles.sidebarBackdrop}
          activeOpacity={1}
          onPress={() => setSidebarVisible(false)}
        />
      </View>
    </Modal>
  );

  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={true}
      />
      <View
        style={[
          styles.customHeader,
          !transparent && { backgroundColor: '#2EC4B6' },
          transparent && styles.transparentHeader,
        ]}
      >
        {/* Left: Back Button or Hamburger Menu */}
        <TouchableOpacity
          style={styles.headerLeftContainer}
          onPress={
            showBackButton
              ? onBackPress || (() => navigation.goBack())
              : () => setSidebarVisible(true)
          }
        >
          {showBackButton ? (
            <Ionicons name="arrow-back" size={24} color="#fff" />
          ) : (
            <View style={styles.hamburgerContainer}>
              <View style={styles.hamburgerLine} />
              <View style={[styles.hamburgerLine, styles.hamburgerLineMiddle]} />
              <View style={styles.hamburgerLine} />
            </View>
          )}
        </TouchableOpacity>

        {/* Center: Logo or Title */}
        <View style={styles.logoContainer}>
          {title ? (
            <Text style={styles.headerTitle}>{title}</Text>
          ) : (
            <>
              <Image
                source={require('../../assets/images/logo1.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.logoText}>RobotInn</Text>
            </>
          )}
        </View>

        {/* Right: Notification + Profile */}
        <View style={styles.headerRightContainer}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={navigateToNotifications}
            activeOpacity={0.9}
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{badgeLabel}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerProfileButton}
            onPress={() => {
              if (navigation.getParent()) {
                navigation.getParent().navigate('Profile', { screen: 'ProfileHome' });
              } else {
                navigation.navigate('Profile');
              }
            }}
            activeOpacity={0.9}
          >
            <View style={styles.headerAvatar}>
              {renderAvatar(
                styles.headerAvatar,
                styles.headerAvatarText,
                styles.headerAvatarImage
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {renderSidebar()}
    </>
  );
};

const styles = StyleSheet.create({
  // ─── Header bar (completely unchanged) ───────────────────────────
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1FA99D',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'android' ? Math.max((StatusBar.currentHeight || 0) - 6, 0) : 0,
    height: (Platform.OS === 'android' ? Math.max((StatusBar.currentHeight || 0) - 6, 0) : 0) + 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  transparentHeader: {
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0,
    height: (Platform.OS === 'ios' ? 50 : StatusBar.currentHeight || 0) + 60,
  },
  headerLeftContainer: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  hamburgerContainer: {
    width: 24,
    height: 18,
    justifyContent: 'space-between',
  },
  hamburgerLine: {
    width: 24,
    height: 2.5,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  hamburgerLineMiddle: {
    width: 18,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  headerAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  logoImage: {
    width: 50,
    height: 50,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerProfileButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF4444',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  // ─── Sidebar shell (unchanged) ────────────────────────────────────
  sidebarOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebarContainer: {
    width: width * 0.85,
    maxWidth: 340,
    height: '100%',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  sidebarScrollContent: {
    paddingTop: 56,
    paddingBottom: 20,
  },
  sidebarCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 50,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2EC4B6',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  // ─── Profile section (unchanged) ──────────────────────────────────
  userProfileSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  userAvatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  userAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2EC4B6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2EC4B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
  },
  userAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  userStatusDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
  },

  // ─── Stats section (unchanged) ────────────────────────────────────
  statsSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A0AAB4',
    letterSpacing: 0.8,
    marginBottom: 14,
    paddingLeft: 4,
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 8,
  },
  progressBarContainer: {
    width: '100%',
    height: 3,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },

  // ─── Menu items — updated to match screenshot ─────────────────────
  menuSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  menuItemTextBlock: {
    flex: 1,
  },
  menuItemLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A2E35',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#8E9BAA',
    marginTop: 2,
    fontWeight: '400',
  },
  menuBadge: {
    backgroundColor: '#EF4444',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  menuBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  menuArrow: {
    opacity: 0.6,
  },

  // ─── Footer / Logout — updated to match screenshot ────────────────
  sidebarFooter: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    paddingTop: 24,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFF0EF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDDCDA',
    marginBottom: 16,
  },
  logoutTextBlock: {
    flex: 1,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E74C3C',
  },
  logoutSubtext: {
    fontSize: 12,
    color: '#E57E77',
    marginTop: 2,
    fontWeight: '400',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#CBD5E1',
  },
});

export default Header;