import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import Header from '../../components/common/Header';
import { usersAPI } from '../../services/api';
import { getData, storeData } from '../../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../../utils/constants';
import { getCurrentLocationWithAddress } from '../../utils/location';
import Ionicons from 'react-native-vector-icons/Ionicons';

const parseAddressTime = (addr) => {
  if (!addr) return 0;
  const val = addr.createdAt || addr.date || addr.timestamp || addr.updatedAt;
  if (val) {
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'object' && typeof val.seconds === 'number') return val.seconds * 1000;
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  const idStr = String(addr.id || addr.addressId || addr._id || '');
  const matches = idStr.match(/\d{10,13}/);
  if (matches) {
    const num = Number(matches[0]);
    if (!isNaN(num)) return num > 1e11 ? num : num * 1000;
  }
  return 0;
};

const sortAddressesNewestFirst = (addrList) => {
  if (!Array.isArray(addrList)) return [];
  return [...addrList].sort((a, b) => {
    const tA = parseAddressTime(a);
    const tB = parseAddressTime(b);
    if (tA > 0 && tB > 0) return tB - tA;
    if (tA > 0) return -1;
    if (tB > 0) return 1;
    return 0;
  });
};

const MyAddressesScreen = ({ navigation }) => {
  const [addresses, setAddresses] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    setLoading(true);
    try {
      const response = await usersAPI.getAddresses();
      if (response?.data) {
        const formattedAddresses = response.data.map((addr) => ({
          ...addr,
          id: addr.addressId || addr._id || addr.id,
        }));
        const sorted = sortAddressesNewestFirst(formattedAddresses);
        setAddresses(sorted);
        await storeData(ASYNC_STORAGE_KEYS.ADDRESSES, sorted);
      }
    } catch (error) {
      console.error('Load addresses error:', error);
      const savedAddresses = await getData(ASYNC_STORAGE_KEYS.ADDRESSES);
      if (savedAddresses) {
        setAddresses(sortAddressesNewestFirst(savedAddresses));
      }
    } finally {
      setLoading(false);
    }
  };

  const saveAddresses = async (newAddresses) => {
    const sorted = sortAddressesNewestFirst(newAddresses);
    setAddresses(sorted);
    await storeData(ASYNC_STORAGE_KEYS.ADDRESSES, sorted);
  };

  const handleUseCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const { lat, lng, address: formattedAddress } = await getCurrentLocationWithAddress();
      setCurrentLocation({ lat, lng });
      setAddress(formattedAddress);
      if (!title.trim()) {
        const mainPart = formattedAddress.split(',')[0] || 'Current Location';
        setTitle(mainPart);
      }
      setUseCurrentLocation(true);
    } catch (error) {
      console.error('Location error:', error);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleAddAddress = async () => {
    if (!title.trim() || !address.trim()) {
      Alert.alert('Error', 'Please enter both title and address');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        address: address.trim(),
        fullAddress: address.trim(),
        formattedAddress: address.trim(),
        isCurrentLocation: useCurrentLocation,
        location: currentLocation || null,
        createdAt: new Date().toISOString(),
      };
      const response = await usersAPI.addAddress(payload);
      const newAddress = {
        ...response.data,
        id: response.data?.addressId || response.data?._id || response.data?.id || `ADR-${Date.now()}`,
        createdAt: payload.createdAt,
      };
      const updatedAddresses = sortAddressesNewestFirst([newAddress, ...addresses]);
      await saveAddresses(updatedAddresses);
      resetForm();
      setShowAddModal(false);
    } catch (error) {
      console.error('Add address error:', error);
      Alert.alert('Save failed', error.message || 'Unable to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAddress = async () => {
    if (!title.trim() || !address.trim()) {
      Alert.alert('Error', 'Please enter both title and address');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        address: address.trim(),
        fullAddress: address.trim(),
        formattedAddress: address.trim(),
        isCurrentLocation: useCurrentLocation,
        location: currentLocation || null,
        updatedAt: new Date().toISOString(),
      };
      const response = await usersAPI.updateAddress(editingAddress.addressId || editingAddress.id, payload);
      const updatedAddresses = addresses.map((addr) =>
        addr.id === (editingAddress.addressId || editingAddress.id)
          ? { ...addr, ...response.data, ...payload, id: editingAddress.id }
          : addr
      );
      await saveAddresses(updatedAddresses);
      resetForm();
      setEditingAddress(null);
      setShowAddModal(false);
    } catch (error) {
      console.error('Update address error:', error);
      Alert.alert('Update failed', error.message || 'Unable to update address');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = (id) => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await usersAPI.deleteAddress(id);
              const updatedAddresses = addresses.filter((addr) => addr.id !== id);
              await saveAddresses(updatedAddresses);
            } catch (error) {
              console.error('Delete address error:', error);
              Alert.alert('Delete failed', error.message || 'Unable to delete address');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleEditAddress = (addr) => {
    setEditingAddress(addr);
    setTitle(addr.title || '');
    setAddress(addr.address || addr.fullAddress || addr.formattedAddress || '');
    setUseCurrentLocation(addr.isCurrentLocation || false);
    setCurrentLocation(addr.location || null);
    setShowAddModal(true);
  };

  const resetForm = () => {
    setTitle('');
    setAddress('');
    setUseCurrentLocation(false);
    setCurrentLocation(null);
  };

  const renderAddressCard = (addr) => {
    const displayAddressText =
      addr.address ||
      addr.fullAddress ||
      addr.formattedAddress ||
      addr.details ||
      addr.street ||
      (addr.title ? `${addr.title}, Islamabad, Pakistan` : 'Islamabad, Pakistan');

    return (
      <View key={addr.id} style={styles.addressCard}>
        <View style={styles.addressCardContent}>
          <View style={styles.addressHeader}>
            <View style={styles.titleContainer}>
              <Ionicons
                name={addr.isCurrentLocation ? 'location' : 'location-outline'}
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.addressTitle}>{addr.title || 'Address'}</Text>
              {addr.isCurrentLocation ? (
                <View style={styles.locationBadge}>
                  <Text style={styles.locationBadgeText}>Current</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.addressActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleEditAddress(addr)}
              >
                <Ionicons name="create-outline" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDeleteAddress(addr.id)}
              >
                <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.addressText}>{displayAddressText}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header navigation={navigation} title="My Addresses" showBackButton={true} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        )}

        {/* Add New Address Button */}
        <TouchableOpacity
          style={styles.addNewButton}
          onPress={() => {
            resetForm();
            setEditingAddress(null);
            setShowAddModal(true);
          }}
        >
          <View style={styles.addNewButtonContent}>
            <View style={styles.addIconContainer}>
              <Ionicons name="add" size={24} color={COLORS.white} />
            </View>
            <View style={styles.addNewTextContainer}>
              <Text style={styles.addNewButtonTitle}>Add New Address</Text>
              <Text style={styles.addNewButtonSubtitle}>
                Save your delivery locations
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* Saved Addresses */}
        {addresses.length > 0 ? (
          <View style={styles.addressesSection}>
            <Text style={styles.sectionTitle}>Saved Addresses</Text>
            {addresses.map(renderAddressCard)}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyStateTitle}>No Addresses Saved</Text>
            <Text style={styles.emptyStateSubtitle}>
              Add your delivery addresses for quick checkout
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Address Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowAddModal(false);
          resetForm();
          setEditingAddress(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingAddress ? 'Edit Address' : 'Add New Address'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowAddModal(false);
                    resetForm();
                    setEditingAddress(null);
                  }}
                >
                  <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {/* Address Title Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Address Title</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g., Home, Office, Apartment"
                    value={title}
                    onChangeText={setTitle}
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>

                

                {/* Address Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Complete Address</Text>
                  {/* Use Current Location Button */}
                <TouchableOpacity
                  style={[
                    styles.locationButton,
                    useCurrentLocation && styles.locationButtonActive,
                  ]}
                  onPress={handleUseCurrentLocation}
                  disabled={locationLoading}
                >
                  {locationLoading ? (
                    <ActivityIndicator color={useCurrentLocation ? COLORS.white : COLORS.primary} />
                  ) : (
                    <Ionicons
                      name="locate"
                      size={20}
                      color={useCurrentLocation ? COLORS.white : COLORS.primary}
                    />
                  )}
                  <Text
                    style={[
                      styles.locationButtonText,
                      useCurrentLocation && styles.locationButtonTextActive,
                    ]}
                  >
                    {locationLoading ? 'Getting location...' : 'Use Current Location'}
                  </Text>
                </TouchableOpacity>
                   <Text style={styles.orText}>OR</Text>
               
                  <TextInput
                    style={[styles.textInput, styles.addressInput]}
                    placeholder="Enter your complete address..."
                    value={address}
                    onChangeText={(text) => {
                      setAddress(text);
                      if (useCurrentLocation) {
                        setUseCurrentLocation(false);
                        setCurrentLocation(null);
                      }
                    }}
                    placeholderTextColor={COLORS.textSecondary}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </ScrollView>

              {/* Modal Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.simpleButton, styles.cancelButton]}
                  onPress={() => {
                    setShowAddModal(false);
                    resetForm();
                    setEditingAddress(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.simpleButton, styles.saveButton]}
                  onPress={editingAddress ? handleUpdateAddress : handleAddAddress}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingAddress ? 'Update' : 'Save'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  loadingContainer: {
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  addNewButton: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  addNewButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  addNewTextContainer: {
    flex: 1,
  },
  addNewButtonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  addNewButtonSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  addressesSection: {
    gap: SPACING.md,
  },
  addressCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  addressCardContent: {
    padding: SPACING.md,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  locationBadge: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  locationBadgeText: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '600',
  },
  addressActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  actionButton: {
    padding: SPACING.xs,
  },
  addressText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  modalContainer: {
    flex: 1,
  },
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
    width: '100%',
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
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addressInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: SPACING.xs,
  },
  locationButtonActive: {
    backgroundColor: COLORS.primary,
  },
  locationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  locationButtonTextActive: {
    color: COLORS.white,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  simpleButton: {
    flex: 1,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  cancelButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  orText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginVertical: 10,
  },
});

export default MyAddressesScreen;
