import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Switch, Image, ScrollView, Modal, Animated } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import { getData, storeData } from '../../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../../utils/constants';

const SETTINGS_STORAGE_KEY = 'app_settings';

const SettingsScreen = ({ navigation }) => {
  const [user, setUser] = useState({ name: 'Fawad', email: 'fawad@example.com', profilePic: null });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [language, setLanguage] = useState('English');
  const [isPhotoModalVisible, setPhotoModalVisible] = useState(false);

  useEffect(() => {
    const load = async () => {
      const userData = await getData(ASYNC_STORAGE_KEYS.USER_DATA);
      if (userData) setUser(userData);

      const settings = await getData(SETTINGS_STORAGE_KEY);
      if (settings) {
        if (typeof settings.notificationsEnabled === 'boolean') {
          setNotificationsEnabled(settings.notificationsEnabled);
        }
        if (settings.language) setLanguage(settings.language);
      }
    };

    load();
  }, []);

  const persistSettings = async (next) => {
    await storeData(SETTINGS_STORAGE_KEY, next);
  };

  const handleToggleNotifications = async (value) => {
    setNotificationsEnabled(value);
    await persistSettings({ notificationsEnabled: value, language });
  };

  const handleSetLanguage = async (nextLanguage) => {
    setLanguage(nextLanguage);
    await persistSettings({ notificationsEnabled: notificationsEnabled, language: nextLanguage });
  };

  const handleProfilePicUpdate = () => {
    setPhotoModalVisible(true);
  };

  const setSamplePhoto = async () => {
    const samplePic = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&q=80';
    const updatedUser = { ...user, profilePic: samplePic };
    setUser(updatedUser);
    await storeData(ASYNC_STORAGE_KEYS.USER_DATA, updatedUser);
    setPhotoModalVisible(false);
  };

  const removePhoto = async () => {
    const updatedUser = { ...user, profilePic: null };
    setUser(updatedUser);
    await storeData(ASYNC_STORAGE_KEYS.USER_DATA, updatedUser);
    setPhotoModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header navigation={navigation} title="Settings" showBackButton={true} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <TouchableOpacity onPress={handleProfilePicUpdate} style={styles.avatarWrapper} activeOpacity={0.9}>
              <View style={styles.avatar}>
                {user.profilePic ? (
                  <Image source={{ uri: user.profilePic }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{user.name ? user.name.charAt(0) : 'F'}</Text>
                )}
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={16} color={COLORS.white} />
                </View>
              </View>
            </TouchableOpacity>

            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user.name || 'User'}</Text>
              <Text style={styles.profileEmail}>{user.email || ''}</Text>
              <TouchableOpacity onPress={handleProfilePicUpdate} style={styles.changePhotoBtn}>
                <Ionicons name="image-outline" size={16} color={COLORS.primary} />
                <Text style={styles.changePhotoText}>Change photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>App Settings</Text>

        <Card style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIconWrap}>
                <Ionicons name="notifications-outline" size={20} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.settingTitle}>Notifications</Text>
                <Text style={styles.settingSub}>Enable or disable push notifications</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#CBD5E1', true: `${COLORS.primary}55` }}
              thumbColor={notificationsEnabled ? COLORS.primary : '#94A3B8'}
            />
          </View>
        </Card>

        <Card style={styles.settingCard}>
          <View style={styles.settingRowTop}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIconWrap}>
                <Ionicons name="language-outline" size={20} color={COLORS.secondary} />
              </View>
              <View>
                <Text style={styles.settingTitle}>Language</Text>
                <Text style={styles.settingSub}>Choose your preferred language</Text>
              </View>
            </View>
          </View>

          <View style={styles.languageRow}>
            <TouchableOpacity
              style={[styles.langChip, language === 'English' && styles.langChipActive]}
              onPress={() => handleSetLanguage('English')}
              activeOpacity={0.9}
            >
              <Text style={[styles.langChipText, language === 'English' && styles.langChipTextActive]}>English</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langChip, language === 'Urdu' && styles.langChipActive]}
              onPress={() => handleSetLanguage('Urdu')}
              activeOpacity={0.9}
            >
              <Text style={[styles.langChipText, language === 'Urdu' && styles.langChipTextActive]}>Urdu</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>

      {/* Custom Bottom Sheet Modal for Profile Picture */}
      <Modal
        visible={isPhotoModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPhotoModalVisible(false)} />
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Change Profile Picture</Text>
            
            <TouchableOpacity style={styles.sheetOption} onPress={setSamplePhoto} activeOpacity={0.7}>
              <View style={[styles.sheetIconWrap, { backgroundColor: `${COLORS.primary}15` }]}>
                <Ionicons name="image-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.sheetOptionText}>Use Sample Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetOption} onPress={removePhoto} activeOpacity={0.7}>
              <View style={[styles.sheetIconWrap, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </View>
              <Text style={[styles.sheetOptionText, { color: '#EF4444' }]}>Remove Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setPhotoModalVisible(false)} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  profileCard: {
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    marginRight: SPACING.md,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarImage: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: '800',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  profileEmail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: `${COLORS.primary}12`,
  },
  changePhotoText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  settingCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  settingRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.md,
  },
  settingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  settingSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  languageRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  langChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  langChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}12`,
  },
  langChipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  langChipTextActive: {
    color: COLORS.primary,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sheetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  sheetOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  cancelBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
});

export default SettingsScreen;
