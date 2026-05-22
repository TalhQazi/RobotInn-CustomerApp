import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { COLORS } from '../../theme/colors';
import { SPACING } from '../../theme/spacing';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import ThemedAlert from '../../components/common/ThemedAlert';
import { billsAPI, uploadAPI } from '../../services/api';

const BillsScreen = ({ navigation, route }) => {
  const [bills, setBills] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState(null);
  const [proofModalVisible, setProofModalVisible] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [themedAlert, setThemedAlert] = useState({ visible: false, title: '', message: '', buttons: [] });
  const flatListRef = useRef(null);

  const fetchBills = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await billsAPI.getMyBills();
      if (response.success && response.data) {
        // Sort by date, most recent first
        const sortedBills = response.data.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });
        setBills(sortedBills);
      } else {
        showThemedAlert({
          title: 'Failed to load bills',
          message: response.message || 'Unable to fetch bills',
          buttons: [{ text: 'OK', style: 'cancel' }]
        });
      }
    } catch (error) {
      console.error('Fetch bills error:', error);
      showThemedAlert({
        title: 'Error',
        message: error.message || 'Failed to load bills',
        buttons: [{ text: 'OK', style: 'cancel' }]
      });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  // Fetch bills on initial load
  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // Fetch bills when screen is focused
  useFocusEffect(useCallback(() => {
    fetchBills();
  }, [fetchBills]));

  const showThemedAlert = ({ title, message, buttons = [] }) => {
    setThemedAlert({ visible: true, title, message, buttons });
  };

  const hideThemedAlert = () => {
    setThemedAlert({ visible: false, title: '', message: '', buttons: [] });
  };

  const handlePayBill = (bill) => {
    if (bill.status === 'paid') {
      showThemedAlert({
        title: 'Already Paid',
        message: 'This bill has already been paid.',
        buttons: [{ text: 'OK', style: 'cancel' }]
      });
      return;
    }

    setSelectedBill(bill);
    setProofModalVisible(true);
  };

  const handleSelectProofImage = async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.85,
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

      setPreviewImage(asset);
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const handleUploadProof = async () => {
    if (!selectedBill || !previewImage) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }

    setUploadingProof(true);
    try {
      console.log('Uploading proof image for bill:', selectedBill.id);

      // Step 1: Upload image to server
      const uploadRes = await uploadAPI.uploadImage({
        uri: previewImage.uri,
        name: previewImage.fileName || previewImage.uri.split('/').pop(),
        type: previewImage.type || 'image/jpeg',
      });

      console.log('Upload response:', uploadRes);

      const proofImageUrl = uploadRes?.url;
      if (!proofImageUrl) {
        throw new Error('Upload did not return an image URL');
      }

      console.log('Proof image URL:', proofImageUrl);

      // Step 2: Submit proof to backend
      const submitRes = await billsAPI.submitPaymentProof(selectedBill.id, proofImageUrl);

      if (submitRes?.success) {
        showThemedAlert({
          title: 'Success',
          message: 'Payment proof submitted successfully! Admin will verify and update your bill status.',
          buttons: [
            {
              text: 'OK',
              style: 'cancel',
              onPress: () => {
                hideThemedAlert();
                setProofModalVisible(false);
                setPreviewImage(null);
                setSelectedBill(null);
                fetchBills();
              }
            }
          ]
        });
      } else {
        throw new Error(submitRes?.message || 'Failed to submit proof');
      }
    } catch (error) {
      console.error('Upload proof error:', error);
      Alert.alert('Error', error?.message || 'Failed to upload payment proof');
    } finally {
      setUploadingProof(false);
    }
  };

  const getBillStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return COLORS.delivered;
      case 'unpaid':
        return '#F59E0B';
      case 'pending':
        return COLORS.pending;
      default:
        return '#8E9BAA';
    }
  };

  const getBillStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'checkmark-circle';
      case 'unpaid':
        return 'alert-circle';
      case 'pending':
        return 'time';
      default:
        return 'help-circle';
    }
  };

  const renderBillItem = ({ item }) => (
    <Card style={styles.billCard}>
      <View style={styles.cardHeader}>
        <View style={styles.billIdContainer}>
          <Text style={styles.billId}>Bill #{item.id?.slice(-6) || 'N/A'}</Text>
          <Text style={styles.orderReference}>Order: {item.orderId?.slice(-6) || 'N/A'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getBillStatusColor(item.status) }]}>
          <Ionicons
            name={getBillStatusIcon(item.status)}
            size={14}
            color="white"
            style={{ marginRight: 4 }}
          />
          <Text style={styles.statusText}>{item.status?.charAt(0).toUpperCase() + item.status?.slice(1) || 'Unknown'}</Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.billDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Amount:</Text>
          <Text style={styles.detailValue}>Rs. {item.amount?.toFixed(2) || '0.00'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Date:</Text>
          <Text style={styles.detailValue}>
            {new Date(item.createdAt || new Date()).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
        {item.dueDate && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Due Date:</Text>
            <Text style={[styles.detailValue, item.status === 'unpaid' && styles.dueDateWarning]}>
              {new Date(item.dueDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
        )}
        {item.description && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Description:</Text>
            <Text style={styles.detailValue}>{item.description}</Text>
          </View>
        )}
      </View>

      {item.status?.toLowerCase() === 'unpaid' && (
        <TouchableOpacity
          style={styles.payButton}
          onPress={() => handlePayBill(item)}
        >
          <Ionicons name="card-outline" size={16} color="white" style={{ marginRight: 6 }} />
          <Text style={styles.payButtonText}>Submit Payment Proof</Text>
        </TouchableOpacity>
      )}

      {item.status?.toLowerCase() === 'paid' && item.paymentProofImage && (
        <TouchableOpacity
          style={styles.viewProofButton}
          onPress={() => {
            Alert.alert(
              'Payment Proof',
              'Proof submitted on ' + new Date(item.paymentProofDate).toLocaleDateString(),
              [{ text: 'OK', style: 'cancel' }]
            );
          }}
        >
          <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginRight: 6 }} />
          <Text style={styles.viewProofText}>Proof Verified</Text>
        </TouchableOpacity>
      )}
    </Card>
  );

  const renderProofModal = () => (
    <Modal
      animationType="slide"
      transparent={false}
      visible={proofModalVisible}
      onRequestClose={() => {
        if (!uploadingProof) {
          setProofModalVisible(false);
          setPreviewImage(null);
        }
      }}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={() => {
              if (!uploadingProof) {
                setProofModalVisible(false);
                setPreviewImage(null);
              }
            }}
            disabled={uploadingProof}
          >
            <Ionicons name="close" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Submit Payment Proof</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.modalContent}
          showsVerticalScrollIndicator={false}
        >
          {selectedBill && (
            <>
              <View style={styles.billSummaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Bill Amount:</Text>
                  <Text style={styles.summaryValue}>Rs. {selectedBill.amount?.toFixed(2) || '0.00'}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Bill ID:</Text>
                  <Text style={styles.summaryValue}>#{selectedBill.id?.slice(-6) || 'N/A'}</Text>
                </View>
              </View>

              <Text style={styles.instructionTitle}>Upload Payment Proof</Text>
              <Text style={styles.instructionText}>
                Please attach a screenshot or image of your payment receipt/proof. This will be verified by our admin team.
              </Text>

              {previewImage ? (
                <View style={styles.previewContainer}>
                  <Image
                    source={{ uri: previewImage.uri }}
                    style={styles.previewImage}
                  />
                  <TouchableOpacity
                    style={styles.changePhotoButton}
                    onPress={handleSelectProofImage}
                    disabled={uploadingProof}
                  >
                    <Ionicons name="refresh" size={16} color={COLORS.primary} />
                    <Text style={styles.changePhotoText}>Change Photo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.selectImageButton}
                  onPress={handleSelectProofImage}
                  disabled={uploadingProof}
                >
                  <Ionicons name="image-outline" size={32} color={COLORS.primary} />
                  <Text style={styles.selectImageText}>Tap to Select Image</Text>
                  <Text style={styles.selectImageSubtext}>Gallery, Screenshot or Photo</Text>
                </TouchableOpacity>
              )}

              <View style={styles.acceptanceBox}>
                <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
                <Text style={styles.acceptanceText}>
                  Make sure the proof clearly shows the payment amount and transaction reference.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, uploadingProof && styles.submitButtonDisabled]}
                onPress={handleUploadProof}
                disabled={!previewImage || uploadingProof}
              >
                {uploadingProof ? (
                  <>
                    <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.submitButtonText}>Uploading...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.submitButtonText}>Submit Payment Proof</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          navigation={navigation}
          title="My Bills"
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading bills...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        navigation={navigation}
        title="My Bills"
      />
      <View style={styles.content}>
        <FlatList
          ref={flatListRef}
          data={bills}
          renderItem={renderBillItem}
          keyExtractor={(item) => item.id || Math.random().toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={fetchBills}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No bills found</Text>
              <Text style={styles.emptySubtext}>Your bills will appear here</Text>
            </View>
          }
        />
      </View>

      {renderProofModal()}

      <ThemedAlert
        visible={themedAlert.visible}
        title={themedAlert.title}
        message={themedAlert.message}
        buttons={themedAlert.buttons}
        onRequestClose={hideThemedAlert}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl + 90,
  },
  billCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  billIdContainer: {
    flex: 1,
  },
  billId: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  orderReference: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  billDetails: {
    marginBottom: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  dueDateWarning: {
    color: '#EF4444',
  },
  payButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  payButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  viewProofButton: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  viewProofText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  billSummaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  instructionText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  previewContainer: {
    marginBottom: SPACING.lg,
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    marginBottom: SPACING.md,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  changePhotoText: {
    marginLeft: 6,
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  selectImageButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    borderRadius: 12,
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    backgroundColor: '#F0FDFB',
  },
  selectImageText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: SPACING.sm,
  },
  selectImageSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  acceptanceBox: {
    flexDirection: 'row',
    backgroundColor: '#F0FDFB',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  acceptanceText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default BillsScreen;
