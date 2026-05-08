import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import Header from '../../components/common/Header';

// All products list (flat list, no categories)
const ALL_PRODUCTS = [
  { id: '1', name: 'Burger' },
  { id: '2', name: 'Pizza' },
  { id: '3', name: 'Fries' },
  { id: '4', name: 'Hot Dog' },
  { id: '5', name: 'Sandwich' },
  { id: '6', name: 'Soda' },
  { id: '7', name: 'Coffee' },
  { id: '8', name: 'Juice' },
  { id: '9', name: 'Water' },
  { id: '10', name: 'Milkshake' },
  { id: '11', name: 'Ice Cream' },
  { id: '12', name: 'Cake' },
  { id: '13', name: 'Donut' },
  { id: '14', name: 'Cookie' },
  { id: '15', name: 'Chocolate' },
  { id: '16', name: 'Noodles' },
  { id: '17', name: 'Sushi' },
  { id: '18', name: 'Rice Bowl' },
  { id: '19', name: 'Spring Roll' },
  { id: '20', name: 'Dim Sum' },
];

const AddItemsScreen = ({ navigation, route }) => {
  const { currentItems = [], onItemsSelected } = route.params || {};
  const [selectedItems, setSelectedItems] = useState(currentItems);
  const [searchQuery, setSearchQuery] = useState('');
  const [customItem, setCustomItem] = useState('');

  // Add item from product list
  const addProductItem = (product) => {
    const newItem = {
      id: Date.now().toString() + Math.random(),
      text: product.name,
      completed: false,
    };
    setSelectedItems([...selectedItems, newItem]);
  };

  // Add custom item from text input
  const addCustomItem = () => {
    if (customItem.trim()) {
      const newItem = {
        id: Date.now().toString() + Math.random(),
        text: customItem.trim(),
        completed: false,
      };
      setSelectedItems([...selectedItems, newItem]);
      setCustomItem('');
    }
  };

  // Remove item from selected list
  const removeSelectedItem = (id) => {
    setSelectedItems(selectedItems.filter(item => item.id !== id));
  };

  // Check if product is already selected
  const isProductSelected = (productName) => {
    return selectedItems.some(item => item.text === productName);
  };

  // Filter products based on search
  const filteredProducts = searchQuery
    ? ALL_PRODUCTS.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : ALL_PRODUCTS;

  // Handle Done button
  const handleDone = () => {
    if (onItemsSelected) {
      onItemsSelected(selectedItems);
    }
    navigation.goBack();
  };

  // Render product item - ROW style (one per row)
  const renderProductItem = ({ item }) => {
    const isSelected = isProductSelected(item.name);
    return (
      <TouchableOpacity
        style={[styles.productRow, isSelected && styles.productRowSelected]}
        onPress={() => addProductItem(item)}
        disabled={isSelected}
      >
        <Text style={styles.productName}>{item.name}</Text>
        {isSelected ? (
          <Ionicons name="checkmark-circle" size={24} color={COLORS.delivered} />
        ) : (
          <Ionicons name="add-circle" size={24} color={COLORS.primary} />
        )}
      </TouchableOpacity>
    );
  };

  // Render selected item
  const renderSelectedItem = ({ item, index }) => (
    <View style={styles.selectedItemRow}>
      <Text style={styles.selectedItemNumber}>{index + 1}.</Text>
      <Text style={styles.selectedItemName}>{item.text}</Text>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removeSelectedItem(item.id)}
      >
        <Ionicons name="close-circle" size={22} color="#FF6B6B" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header
        navigation={navigation}
        title="Add Items"
      />

      <View style={styles.content}>
        {/* Done Button - Top Right */}
        <View style={styles.doneButtonContainer}>
          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={COLORS.textSecondary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Products List - One per row */}
        {/* <FlatList
          data={filteredProducts}
          renderItem={renderProductItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.productsList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No products found</Text>
            </View>
          }
        /> */}

        {/* Custom Item Input */}
        <View style={styles.customInputContainer}>
          <Text style={styles.customInputLabel}>Can't find what you need?</Text>
          <View style={styles.customInputRow}>
            <TextInput
              style={styles.customInput}
              placeholder="Type custom item..."
              value={customItem}
              onChangeText={setCustomItem}
              onSubmitEditing={addCustomItem}
              placeholderTextColor={COLORS.textSecondary}
            />
            <TouchableOpacity
              style={[styles.addCustomButton, !customItem.trim() && styles.addCustomButtonDisabled]}
              onPress={addCustomItem}
              disabled={!customItem.trim()}
            >
              <Text style={styles.addCustomButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Your Menu - Selected Items */}
        {selectedItems.length > 0 && (
          <View style={styles.yourMenuContainer}>
            <View style={styles.yourMenuHeader}>
              <Ionicons name="restaurant-outline" size={20} color={COLORS.primary} />
              <Text style={styles.yourMenuTitle}>Your Menu</Text>
              <Text style={styles.yourMenuCount}>{selectedItems.length} items</Text>
            </View>
            <FlatList
              data={selectedItems}
              renderItem={renderSelectedItem}
              keyExtractor={(item) => item.id.toString()}
              style={styles.selectedItemsList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}
      </View>
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
  doneButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  doneButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginLeft: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  productsList: {
    padding: SPACING.lg,
  },
  // Product Row Style - One per row
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productRowSelected: {
    backgroundColor: COLORS.background,
    opacity: 0.7,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  customInputContainer: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  customInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  customInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  addCustomButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  addCustomButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
    opacity: 0.5,
  },
  addCustomButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  yourMenuContainer: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  yourMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  yourMenuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginLeft: SPACING.xs,
    flex: 1,
  },
  yourMenuCount: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  selectedItemsList: {
    maxHeight: 150,
  },
  selectedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  selectedItemNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    width: 30,
  },
  selectedItemName: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  removeButton: {
    padding: SPACING.xs,
  },
});

export default AddItemsScreen;
