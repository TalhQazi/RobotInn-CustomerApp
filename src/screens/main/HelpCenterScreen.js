import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import Header from '../../components/common/Header';
import Ionicons from 'react-native-vector-icons/Ionicons';

const HelpCenterScreen = ({ navigation }) => {
  const [expandedIndex, setExpandedIndex] = useState(null);

  const helpItems = [
    {
      icon: 'cube-outline',
      title: 'How to place an order?',
      answer: '1. Open the RobotInn app and browse restaurants or food feeds\n2. Select items you want to order and add them to cart\n3. Go to cart and review your order\n4. Select delivery address and payment method\n5. Confirm your order and track it in real-time',
    },
    {
      icon: 'time-outline',
      title: 'What if my order is delayed?',
      answer: 'If your order is taking longer than expected:\n• Check the app for real-time order status\n• Contact the restaurant directly through the app\n• Reach out to our support team at +92 300 1234567\n• We monitor all deliveries and will proactively notify you of any delays',
    },
    {
      icon: 'card-outline',
      title: 'Payment failed, what should I do?',
      answer: 'If your payment fails:\n• Check your internet connection\n• Verify your card details are correct\n• Ensure you have sufficient balance\n• Try a different payment method\n• Contact your bank if the issue persists\n• You can also choose Cash on Delivery option',
    },
    {
      icon: 'location-outline',
      title: 'How to change delivery address?',
      answer: 'To update your delivery address:\n• Before ordering: Go to Profile > Addresses and add/select a new address\n• After placing order: Contact support immediately at +92 300 1234567\n• Note: Address can only be changed within 5 minutes of placing order',
    },
    {
      icon: 'restaurant-outline',
      title: 'Food quality issues or wrong order?',
      answer: 'We\'re sorry for any inconvenience. Please:\n• Take photos of the issue immediately\n• Report through the app within 30 minutes\n• Call our support team at +92 300 1234567\n• We offer full refund or replacement for verified issues\n• Your feedback helps us improve our service',
    },
    {
      icon: 'person-outline',
      title: 'How to manage my account?',
      answer: 'To manage your account:\n• Go to Profile screen from the main menu\n• Update profile picture, name, and email\n• Change password in Settings\n• View and manage saved addresses\n• Check order history\n• Update notification preferences',
    },
  ];

  const HelpCard = ({ item, index, isExpanded, onToggle }) => (
    <TouchableOpacity 
      style={[styles.helpCard, isExpanded && styles.helpCardExpanded]} 
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={styles.helpCardHeader}>
        <View style={styles.helpCardIconContainer}>
          <Ionicons name={item.icon} size={24} color={COLORS.primary} />
        </View>
        <View style={styles.helpCardContent}>
          <Text style={styles.helpCardTitle}>{item.title}</Text>
        </View>
        <Ionicons 
          name={isExpanded ? "chevron-up" : "chevron-down"} 
          size={20} 
          color={COLORS.textSecondary} 
        />
      </View>
      {isExpanded && (
        <View style={styles.answerContainer}>
          <Text style={styles.answerText}>{item.answer}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header
        navigation={navigation}
        title="Help Center"
        showBackButton={true}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Contact Support Section */}
        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>Contact Support</Text>
          <View style={styles.contactCards}>
            <TouchableOpacity style={styles.contactCard}>
              <Ionicons name="call-outline" size={28} color={COLORS.primary} />
              <Text style={styles.contactCardTitle}>Call Us</Text>
              <Text style={styles.contactCardSubtitle}>+92 300 1234567</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactCard}>
              <Ionicons name="mail-outline" size={28} color={COLORS.primary} />
              <Text style={styles.contactCardTitle}>Email Us</Text>
              <Text style={styles.contactCardSubtitle}>support@robotinn.com</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FAQs Section */}
        <View style={styles.faqsSection}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {helpItems.map((item, index) => (
            <HelpCard
              key={index}
              item={item}
              index={index}
              isExpanded={expandedIndex === index}
              onToggle={() => setExpandedIndex(expandedIndex === index ? null : index)}
            />
          ))}
        </View>

        {/* Bottom Note */}
        <Text style={styles.bottomNote}>
          Can't find what you're looking for?{'\n'}
          Reach out to us directly via phone or email.
        </Text>
      </ScrollView>
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
  contactSection: {
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  contactCards: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  contactCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contactCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
  },
  contactCardSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  faqsSection: {
    padding: SPACING.lg,
  },
  helpCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  helpCardExpanded: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
  },
  helpCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helpCardIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  helpCardContent: {
    flex: 1,
  },
  helpCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  answerContainer: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingLeft: 60,
  },
  answerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  bottomNote: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: SPACING.md,
    marginHorizontal: SPACING.lg,
    lineHeight: 20,
  },
});

export default HelpCenterScreen;
