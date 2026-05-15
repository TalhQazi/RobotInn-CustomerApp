import React, { useState, useEffect, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, Image, Modal } from 'react-native';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import Header from '../../components/common/Header';
import CustomButton from '../../components/common/CustomButton';
import { getData, storeData } from '../../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../../utils/constants';
import { authAPI } from '../../services/api';
import { resetToAuth } from '../../navigation/navigationRef';
import { useNotificationUnread } from '../../context/NotificationUnreadContext';
import Ionicons from 'react-native-vector-icons/Ionicons';

const ProfileScreen = ({ navigation }) => {
  const { unreadCount, refreshUnreadCount } = useNotificationUnread();
  const [user, setUser] = useState({ name: 'Fawad', email: 'fawad@example.com', profilePic: null });
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      refreshUnreadCount();
    }, [refreshUnreadCount])
  );

  const menuItems = useMemo(
    () => [
      { icon: 'home-outline', label: 'Home', screen: 'Dashboard', color: '#2EC4B6' },
      { icon: 'receipt-outline', label: 'Order History', screen: 'OrderHistory', color: '#F59E0B' },
      { icon: 'location-outline', label: 'Saved Addresses', screen: 'MyAddresses', color: '#4ECDC4' },
      { icon: 'notifications-outline', label: 'Notifications', screen: 'Notifications', color: '#A78BFA', badge: unreadCount },
      { icon: 'chatbubble-outline', label: 'Messages', screen: 'Messages', color: '#60A5FA' },
      { icon: 'settings-outline', label: 'Settings', screen: 'Settings', color: '#94A3B8' },
    ],
    [unreadCount]
  );

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // First try to get from async storage
        let userData = await getData(ASYNC_STORAGE_KEYS.USER_DATA);
        
        // If not in storage, fetch from API
        if (!userData) {
          const response = await authAPI.getMe();
          userData = response.data || response.user;
          if (userData) {
            await storeData(ASYNC_STORAGE_KEYS.USER_DATA, userData);
          }
        }
        
        if (userData) {
          setUser({
            name: userData.name || 'User',
            email: userData.email || '',
            profilePic: userData.avatar || null,
            phone: userData.phone || '',
            area: userData.area || '',
          });
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          onPress: async () => {
            await authAPI.logout();
            resetToAuth();
          }, 
        }
      ]
    );
  };

  const handleProfilePicUpdate = () => {
    Alert.alert('Update Profile', 'Simulate profile picture update?', [
      {
        text: 'Upload Sample',
        onPress: async () => {
          const samplePic = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&q=80';
          const updatedUser = { ...user, profilePic: samplePic };
          setUser(updatedUser);
          await storeData(ASYNC_STORAGE_KEYS.USER_DATA, updatedUser);
          Alert.alert('Success', 'Profile picture updated!');
        }
      },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  const MenuItem = ({ icon, title, onPress, color, isFirst, isLast, badge = 0 }) => (
    <TouchableOpacity 
      onPress={onPress} 
      style={[
        styles.menuItem,
        isFirst && styles.menuItemFirst,
        isLast && styles.menuItemLast
      ]}
    >
      <View style={styles.menuItemLeft}>
        <View style={[styles.menuIconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <Text style={styles.menuItemText}>{title}</Text>
        {badge > 0 && (
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );

  const QuickCard = ({ icon, title, onPress }) => (
    <TouchableOpacity onPress={onPress} style={styles.quickCard}>
      <Ionicons name={icon} size={24} color={COLORS.primary} />
      <Text style={styles.quickCardText}>{title}</Text>
    </TouchableOpacity>
  );

  const InfoModal = ({ visible, onClose, title, content }) => (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.modalText}>{content}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        navigation={navigation}
        title="My Profile"
        showBackButton={true}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={handleProfilePicUpdate} style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {user.profilePic ? (
                <Image source={{ uri: user.profilePic }} style={styles.profileImage} />
              ) : (
                <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
              )}
              <View style={styles.editIconContainer}>
                <Ionicons name="camera" size={16} color={COLORS.white} />
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>

        {/* Quick Cards Row */}
        <View style={styles.quickCardsContainer}>
          <QuickCard 
            icon="receipt-outline" 
            title="Orders" 
            onPress={() => navigation.navigate('Requests')} 
          />
          <QuickCard 
            icon="heart-outline" 
            title="Favourites" 
            onPress={() => {}} 
          />
          <QuickCard 
            icon="location-outline" 
            title="Addresses" 
            onPress={() => navigation.navigate('MyAddresses')} 
          />
        </View>

        {/* Menu Section (from sidebar) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Menu</Text>
          <View style={styles.menuCard}>
            {menuItems.map((item, index) => (
              <MenuItem
                key={index}
                icon={item.icon}
                title={item.label}
                color={item.color}
                badge={item.badge || 0}
                isFirst={index === 0}
                isLast={index === menuItems.length - 1}
                onPress={() => {
                  if (item.screen === 'Dashboard' && navigation.getParent()) {
                    navigation.getParent().navigate('Dashboard');
                  } else if (item.screen === 'Messages' && navigation.getParent()) {
                    navigation.getParent().navigate('Messages');
                  } else {
                    navigation.navigate(item.screen);
                  }
                }}
              />
            ))}
          </View>
        </View>

        {/* General Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>General</Text>
          <View style={styles.menuCard}>
            <MenuItem 
              icon="help-circle-outline" 
              title="Help center" 
              color={COLORS.textSecondary}
              isFirst={true}
              isLast={false}
              onPress={() => navigation.navigate('HelpCenter')} 
            />
            <MenuItem 
              icon="document-text-outline" 
              title="Terms & policies" 
              color={COLORS.textSecondary}
              isFirst={false}
              isLast={true}
              onPress={() => setTermsModalVisible(true)} 
            />
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log out</Text>
        </TouchableOpacity>
        
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>

      {/* About Us Modal */}
      <InfoModal
        visible={aboutModalVisible}
        onClose={() => setAboutModalVisible(false)}
        title="About Us"
        content="RobotInn is a revolutionary food delivery platform that brings you the best dining experience right to your doorstep. We connect you with top restaurants, food feeds, and robot stores in your area.

Our mission is to make food delivery faster, easier, and more enjoyable. With our advanced technology and dedicated team, we ensure your orders are delivered fresh and on time.

Thank you for choosing RobotInn!"
      />

      {/* Terms & Policies Modal */}
      <InfoModal
        visible={termsModalVisible}
        onClose={() => setTermsModalVisible(false)}
        title="Terms & Policies"
        content="Terms of Service:

By using RobotInn, you agree to our terms and conditions. We are committed to providing you with a safe and reliable food delivery service.

1. All orders are subject to availability
2. Delivery times may vary based on location and traffic
3. Cancellations must be made within 5 minutes of ordering
4. Refunds are processed according to our refund policy

Privacy Policy:

We respect your privacy and protect your personal information. Your data is securely stored and only used to improve your experience.

For any questions, please contact our support team."
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: SPACING.xl,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  avatarContainer: {
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    position: 'relative',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.secondary,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 40,
    fontWeight: '800',
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  userEmail: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  editButton: {
    marginTop: SPACING.md,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  editButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  quickCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  quickCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 80,
  },
  quickCardText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '500',
    marginTop: SPACING.sm,
  },
  sectionContainer: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
    marginLeft: SPACING.sm,
  },
  menuCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemFirst: {
    borderTopLeftRadius: BORDER_RADIUS.md,
    borderTopRightRadius: BORDER_RADIUS.md,
  },
  menuItemLast: {
    borderBottomLeftRadius: BORDER_RADIUS.md,
    borderBottomRightRadius: BORDER_RADIUS.md,
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  menuBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: SPACING.xs,
  },
  menuBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  logoutButton: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.textPrimary,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  versionText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalBody: {
    padding: SPACING.lg,
    maxHeight: 400,
  },
  modalText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
});

export default ProfileScreen;
