import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { COLORS } from '../../theme/colors';
import { BORDER_RADIUS } from '../../theme/spacing';
import { SPACING } from '../../theme/spacing';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getData } from '../../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../../utils/constants';

const { width, height } = Dimensions.get('window');

const Header = ({
  navigation,
  showBackButton = false,
  onBackPress,
  title,
  transparent = false,
}) => {
  const [user, setUser] = useState({ name: 'Fawad', email: 'fawad@example.com' });
  const [sidebarVisible, setSidebarVisible] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const userData = await getData(ASYNC_STORAGE_KEYS.USER_DATA);
      if (userData) setUser(userData);
    };
    fetchUser();
  }, []);

  const statsData = [
    { icon: 'receipt-outline', label: 'Total Orders', value: '12', color: '#554a4aff', progress: 0.8 },
    { icon: 'time-outline', label: 'Active', value: '2', color: '#c7b407ff', progress: 0.4 },
    { icon: 'checkmark-circle-outline', label: 'Completed', value: '10', color: '#4ECDC4', progress: 0.9 },
  ];

  const menuItems = [
    { icon: 'person-outline',        label: 'My Profile',      subtitle: 'Manage your profile details',  screen: 'Profile',       color: '#FF6B6B', iconBg: '#FFF0F0' },
    { icon: 'time-outline',          label: 'Order History',   subtitle: 'View your past orders',        screen: 'OrderHistory',  color: '#FFA235', iconBg: '#FFF5EB' },
    { icon: 'location-outline',      label: 'Saved Addresses', subtitle: 'Manage your saved locations',  screen: 'MyAddresses',   color: '#4ECDC4', iconBg: '#E8FAF8' },
    { icon: 'notifications-outline', label: 'Notifications',   subtitle: 'View all notifications',       screen: 'Notifications', color: '#A78BFA', iconBg: '#F3EEFF', badge: 0 },
    { icon: 'chatbubble-outline',    label: 'Messages',        subtitle: 'Chat with support',            screen: 'Messages',      color: '#60A5FA', iconBg: '#EBF4FF', badge: 0 },
    { icon: 'settings-outline',      label: 'Settings',        subtitle: 'Manage app preferences',       screen: 'Settings',      color: '#94A3B8', iconBg: '#F0F2F5' },
  ];

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
                  <Text style={styles.userAvatarText}>
                    {user.name ? user.name.charAt(0) : 'F'}
                  </Text>
                </View>
                <View style={styles.userStatusDot} />
              </View>
              <Text style={styles.userName}>{user.name || 'Fawad Khan'}</Text>
              <Text style={styles.userEmail}>{user.email || 'fawad@example.com'}</Text>
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
                  onPress={() => {
                    setSidebarVisible(false);
                    if (item.screen) navigation.navigate(item.screen);
                  }}
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
              <TouchableOpacity style={styles.logoutButton}>
                <Ionicons name="log-out-outline" size={22} color="#EF4444" />
                <View style={styles.logoutTextBlock}>
                  <Text style={styles.logoutText}>Log Out</Text>
                  <Text style={styles.logoutSubtext}>You will be logged out from the app</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.versionText}>Version 2.0.0</Text>
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
            onPress={() => {
              // Navigate to parent first, then to Notifications (works from all tabs)
              if (navigation.getParent()) {
                navigation.getParent().navigate('Dashboard', { screen: 'Notifications' });
              } else {
                navigation.navigate('Notifications');
              }
            }}
            activeOpacity={0.9}
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            <View style={styles.notificationDot} />
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
              <Text style={styles.headerAvatarText}>
                {user.name ? user.name.charAt(0) : 'F'}
              </Text>
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
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF4444',
    borderWidth: 2,
    borderColor: '#fff',
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