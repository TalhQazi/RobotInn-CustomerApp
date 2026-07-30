import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Alert, TouchableOpacity, Image } from 'react-native';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import CustomInput from '../../components/common/CustomInput';
import CustomButton from '../../components/common/CustomButton';
import Header from '../../components/common/Header';
import { getData, storeData } from '../../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../../utils/constants';
import Ionicons from 'react-native-vector-icons/Ionicons';

const OrderScreen = ({ navigation }) => {
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState(null);

  const handleImagePick = () => {
    // Simulate image picking
    Alert.alert('Upload', 'Image Uploading... (Simulated)', [
      {
        text: 'Select Sample',
        onPress: () => setImage('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80')
      },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  const handleSaveMenu = async () => {
    if (!itemName || !quantity || !price) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      itemName,
      quantity: parseInt(quantity),
      price: parseFloat(price),
      notes,
      image: image,
    };

    const currentMenu = await getData(ASYNC_STORAGE_KEYS.CUSTOM_FOOD_MENU) || [];
    const updatedMenu = [newItem, ...currentMenu];
    await storeData(ASYNC_STORAGE_KEYS.CUSTOM_FOOD_MENU, updatedMenu);

    Alert.alert('Success', 'Food menu added to Dashboard!', [
      { text: 'View Dashboard', onPress: () => navigation.navigate('MainTabs', { screen: 'Dashboard' }) }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        navigation={navigation}
        title="Add New Food Menu"
        showBackButton={true}
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity 
            style={styles.imagePickerPlaceholder}
            onPress={handleImagePick}
          >
            {image ? (
              <Image source={{ uri: image }} style={styles.pickedImage} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={40} color={COLORS.textSecondary} />
                <Text style={styles.imagePickerText}>Upload Food Image (Optional)</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.form}>
            <CustomInput
              label="Food Name"
              placeholder="e.g. Special Biryani"
              value={itemName}
              onChangeText={setItemName}
            />
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: SPACING.sm }}>
                <CustomInput
                  label="Price (PKR)"
                  placeholder="0.00"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                <CustomInput
                  label="Quantity"
                  placeholder="1"
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <CustomInput
              label="Description"
              placeholder="Tell us about this food..."
              value={notes}
              onChangeText={setNotes}
              style={styles.notesInput}
              multiline
            />

            <CustomButton
              title="Save to Dashboard"
              onPress={handleSaveMenu}
              style={styles.addButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: 40,
  },
  imagePickerPlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  imagePickerText: {
    marginTop: 8,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  pickedImage: {
    width: '100%',
    height: '100%',
    borderRadius: BORDER_RADIUS.lg,
  },
  form: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  row: {
    flexDirection: 'row',
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: SPACING.sm,
  },
  addButton: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
  },
});

export default OrderScreen;
