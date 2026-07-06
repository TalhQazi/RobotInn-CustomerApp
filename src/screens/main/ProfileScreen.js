import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, Image, Modal, ActivityIndicator, Animated } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import Header from '../../components/common/Header';
import { authAPI, uploadAPI, usersAPI } from '../../services/api';
import { resetToAuth } from '../../navigation/navigationRef';
import { useNotificationUnread } from '../../context/NotificationUnreadContext';
import { useUserProfile, getAvatarUri, getUserInitial } from '../../context/UserProfileContext';
import Ionicons from 'react-native-vector-icons/Ionicons';

const ProfileScreen = ({ navigation }) => {
  const { unreadCount, refreshUnreadCount } = useNotificationUnread();
  const { user, refreshProfile, updateLocalUser } = useUserProfile();
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null); // { uri, width, height }
  const [toast, setToast] = useState({ visible: false, type: 'success', title: '', message: '' });
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastScale = useRef(new Animated.Value(0.85)).current;
  const toastTimerRef = useRef(null);

  const showToast = useCallback((type, title, message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastOpacity.setValue(0);
    toastScale.setValue(0.85);
    setToast({ visible: true, type, title, message });
    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(toastScale, { toValue: 1, friction: 8, tension: 65, useNativeDriver: true }),
    ]).start();
    toastTimerRef.current = setTimeout(() => hideToast(), 2500);
  }, []);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(toastScale, { toValue: 0.85, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(prev => ({ ...prev, visible: false })));
  }, []);

  const avatarUri = getAvatarUri(user);
  const displayName = user?.name || 'User';
  const displayEmail = user?.email || '';

  useFocusEffect(
    React.useCallback(() => {
      refreshUnreadCount();
      refreshProfile();
    }, [refreshUnreadCount, refreshProfile])
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

  const handleProfilePicUpdate = async () => {
    if (uploadingAvatar) {
      return;
    }

    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: true,
        maxWidth: 500,
        maxHeight: 500,
        quality: 0.6,
      });

      if (response.didCancel) {
        return;
      }

      if (response.errorCode) {
        Alert.alert('Error', response.errorMessage || 'Could not open photo library');
        return;
      }

      const asset = response.assets?.[0];
      if (!asset?.uri) {
        Alert.alert('Error', 'Could not read the selected image');
        return;
      }

      handleUpload({
        uri: asset.uri,
        base64: asset.base64,
        name: asset.fileName,
        type: asset.type,
      });
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Could not open photo library');
    }
  };

  const handleUpload = async (imageToUpload) => {
    setUploadingAvatar(true);

    try {
      const uriToUpload = imageToUpload?.uri;
      
      if (!uriToUpload) {
        throw new Error('Image selection failed: No image URI returned');
      }

      const mime = imageToUpload.type || 'image/jpeg';
      const base64Url = `data:${mime};base64,${imageToUpload.base64}`;

      console.log('Updating profile with base64 avatar...');
      const profileRes = await usersAPI.updateProfile({ avatar: base64Url });
      console.log('Profile update response:', profileRes);
      
      if (profileRes?.success) {
        const updatedUser = profileRes?.data || { avatar: base64Url };
        await updateLocalUser(updatedUser);
        await refreshProfile();
        showToast('success', 'Success', 'Profile picture updated successfully');
      } else {
        throw new Error(profileRes?.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile picture upload error:', error);
      showToast('error', 'Error', error?.message || 'Could not update profile picture');
    } finally {
      setUploadingAvatar(false);
    }
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
            {content.split('\n').map((paragraph, index) => (
              <Text key={index} style={[styles.modalText, paragraph.trim() === '' ? { height: 8 } : { marginBottom: 4 }]}>
                {paragraph}
              </Text>
            ))}
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
          <TouchableOpacity onPress={handleProfilePicUpdate} style={styles.avatarContainer} disabled={uploadingAvatar}>
            <View style={styles.avatar}>
              {uploadingAvatar ? (
                <ActivityIndicator size="large" color={COLORS.white} />
              ) : avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.profileImage} />
              ) : (
                <Text style={styles.avatarText}>{getUserInitial(user)}</Text>
              )}
              <View style={styles.editIconContainer}>
                <Ionicons name="camera" size={16} color={COLORS.white} />
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{displayEmail}</Text>
        </View>

        {/* Quick Cards Row */}
        <View style={styles.quickCardsContainer}>
          <QuickCard 
            icon="receipt-outline" 
            title="Orders" 
            onPress={() => navigation.navigate('Requests')} 
          />
          {/* <QuickCard 
            icon="heart-outline" 
            title="Favourites" 
            onPress={() => {}} 
          /> */}
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
        content={`RobotInn is a revolutionary food delivery platform that brings you the best dining experience right to your doorstep. We connect you with top restaurants, food feeds, and robot stores in your area.

Our mission is to make food delivery faster, easier, and more enjoyable. With our advanced technology and dedicated team, we ensure your orders are delivered fresh and on time.

Thank you for choosing RobotInn!`}
      />

      {/* Terms & Policies Modal */}
      <InfoModal
        visible={termsModalVisible}
        onClose={() => setTermsModalVisible(false)}
        title="Terms & Policies"
        content={`Terms of Service:

By using RobotInn, you agree to our terms and conditions. We are committed to providing you with a safe and reliable food delivery service.

1. All orders are subject to availability
2. Delivery times may vary based on location and traffic
3. Cancellations must be made within 5 minutes of ordering
4. Refunds are processed according to our refund policy

Privacy Policy:

We respect your privacy and protect your personal information. Your data is securely stored and only used to improve your experience.

For any questions, please contact our support team.`}
      />

      {/* Styled Toast */}
      {toast.visible && (
        <Modal transparent visible animationType="none" onRequestClose={hideToast}>
          <TouchableOpacity style={styles.toastOverlay} activeOpacity={1} onPress={hideToast}>
            <Animated.View style={[styles.toastCard, { opacity: toastOpacity, transform: [{ scale: toastScale }] }]}>
              <View style={[styles.toastIconCircle, toast.type === 'success' ? styles.toastIconSuccess : styles.toastIconError]}>
                <Ionicons name={toast.type === 'success' ? 'checkmark-sharp' : 'close'} size={28} color={COLORS.white} />
              </View>
              <Text style={styles.toastTitle}>{toast.title}</Text>
              <Text style={styles.toastMessage}>{toast.message}</Text>
              <TouchableOpacity style={[styles.toastButton, toast.type === 'success' ? styles.toastBtnSuccess : styles.toastBtnError]} onPress={hideToast}>
                <Text style={styles.toastButtonText}>OK</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      )}
      )}
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
  // Toast Styles
  toastOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  toastCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    width: '88%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  toastIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  toastIconSuccess: {
    backgroundColor: COLORS.primary,
  },
  toastIconError: {
    backgroundColor: '#FF6B6B',
  },
  toastTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  toastMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  toastButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  toastBtnSuccess: {
    backgroundColor: COLORS.primary,
  },
  toastBtnError: {
    backgroundColor: '#FF6B6B',
  },
  toastButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ProfileScreen;
