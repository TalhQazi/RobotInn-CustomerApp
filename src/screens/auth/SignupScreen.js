import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  Modal,
  FlatList,
  TextInput
} from 'react-native';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import CustomInput from '../../components/common/CustomInput';
import CustomButton from '../../components/common/CustomButton';
import Icon from 'react-native-vector-icons/Ionicons';
import { storeData } from '../../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../../utils/constants';
import { authAPI, areasAPI } from '../../services/api';

const { width, height } = Dimensions.get('window');

// Static fallback areas - defined outside component
const STATIC_AREAS = [
  'F-6', 'F-7', 'F-8', 'F-10', 'F-11', 'G-6', 'G-7', 'G-8', 'G-9', 'G-10', 'G-11',
  'E-7', 'E-8', 'E-9', 'E-11', 'I-8', 'I-9', 'I-10', 'DHA Phase 1', 'DHA Phase 2',
  'Bahria Phase 7', 'Bahria Phase 8', 'Gulberg Residencia', 'Bani Gala'
];

const SignupScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [areaSearch, setAreaSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [areas, setAreas] = useState(STATIC_AREAS);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'success',
    onConfirm: () => {},
  });

  // Fetch areas from backend on mount
  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const response = await areasAPI.getAll();
        if (response.success && response.data && response.data.length > 0) {
          const areaNames = response.data.map(area => area.name);
          setAreas(areaNames);
        }
      } catch (err) {
        console.log('Error fetching areas:', err);
      }
    };
    fetchAreas();
  }, []);

  const filteredAreas = areaSearch
    ? areas.filter(area => area.toLowerCase().includes(areaSearch.toLowerCase()))
    : areas;

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  // useEffect for entrance animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSignup = async () => {
    if (!name || !email || !phone || !password || !confirmPassword || !selectedArea) {
      setError('Please fill all fields including phone number and area.');
      return;
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    // Phone validation - must be 5-20 characters
    if (phone.length < 5 || phone.length > 20) {
      setError('Phone number must be between 5 and 20 characters.');
      return;
    }

    if (password.length < 6) {
      setError('Password should be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await authAPI.register({
        name,
        email,
        password,
        phone,
        type: 'customer',
        area: selectedArea,
      });
      setLoading(false);
      
      // Show styled success alert
      setAlertConfig({
        title: 'Welcome to RobotInn! 🎉',
        message: 'Your account has been created successfully. Start ordering now!',
        type: 'success',
        onConfirm: () => {
          setAlertVisible(false);
          navigation.replace('Login');
        },
      });
      setAlertVisible(true);
    } catch (err) {
      setLoading(false);
      
      // Format user-friendly error message
      let errorMessage = 'An error occurred. Please try again.';
      
      if (err.message) {
        errorMessage = err.message;
      }
      
      // Check for backend validation errors
      if (err.errors && Array.isArray(err.errors)) {
        errorMessage = err.errors.map(e => e.message).join('\n');
      }
      
      // Show styled error alert
      setAlertConfig({
        title: 'Signup Failed',
        message: errorMessage,
        type: 'error',
        onConfirm: () => setAlertVisible(false),
      });
      setAlertVisible(true);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.header}>
              <Animated.View
                style={[
                  styles.logoContainer,
                  {
                    transform: [{ scale: logoScale }],
                    opacity: logoOpacity,
                  },
                ]}
              >
                <View style={styles.logoGradient}>
                  <Image
                    source={require('../../assets/images/logo1.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </View>
              </Animated.View>

              <Animated.View style={{ opacity: logoOpacity }}>
                <Text style={styles.title}>Join RobotInn 🚀</Text>
                <Text style={styles.subtitle}>Create your account</Text>
              </Animated.View>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.formCard}>
                <CustomInput
                  label="Full Name"
                  placeholder="John Doe"
                  value={name}
                  onChangeText={setName}
                  icon={<Icon name="person-outline" size={20} color={COLORS.primary} />}
                />

                <CustomInput
                  label="Email Address"
                  placeholder="customer@robotinn.com"
                  value={email}
                  onChangeText={(text) => setEmail(text.trim().toLowerCase())}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  icon={<Icon name="mail-outline" size={20} color={COLORS.primary} />}
                />

                <CustomInput
                  label="Phone Number"
                  placeholder="03123456789"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  icon={<Icon name="call-outline" size={20} color={COLORS.primary} />}
                />

                <CustomInput
                  label="Password"
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  icon={<Icon name="lock-closed-outline" size={20} color={COLORS.primary} />}
                  rightIcon={
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Icon
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                  }
                />

                <CustomInput
                  label="Confirm Password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  icon={<Icon name="shield-checkmark-outline" size={20} color={COLORS.primary} />}
                  rightIcon={
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                      <Icon
                        name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                  }
                />

                {/* Area Selection */}
                <TouchableOpacity
                  style={styles.areaSelector}
                  onPress={() => setShowAreaModal(true)}
                >
                  <Icon name="location-outline" size={20} color={COLORS.primary} style={styles.areaIcon} />
                  <Text style={selectedArea ? styles.areaTextSelected : styles.areaText}>
                    {selectedArea || 'Select Your Area'}
                  </Text>
                  <Icon name="chevron-down" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>

                {error && (
                  <Animated.View style={styles.errorContainer}>
                    <Icon name="alert-circle-outline" size={16} color={COLORS.error || '#FF6B6B'} />
                    <Text style={styles.errorText}>{error}</Text>
                  </Animated.View>
                )}

                <CustomButton
                  title="Create Account"
                  onPress={handleSignup}
                  loading={loading}
                  style={styles.signupButton}
                />

                <View style={styles.footer}>
                  <Text style={styles.footerText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.loginText}>Login</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Area Selection Modal */}
      <Modal
        visible={showAreaModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAreaModal(false)}
      >
        <View style={styles.areaModalOverlay}>
          <View style={styles.areaModalContent}>
            <View style={styles.areaModalHeader}>
              <Text style={styles.areaModalTitle}>Select Your Area</Text>
              <TouchableOpacity onPress={() => setShowAreaModal(false)}>
                <Icon name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.areaSearchContainer}>
              <Icon name="search-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.areaSearchInput}
                placeholder="Search area..."
                value={areaSearch}
                onChangeText={setAreaSearch}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
            
            <FlatList
              data={filteredAreas}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.areaItem}
                  onPress={() => {
                    setSelectedArea(item);
                    setShowAreaModal(false);
                    setAreaSearch('');
                  }}
                >
                  <Text style={styles.areaItemText}>{item}</Text>
                  {selectedArea === item && (
                    <Icon name="checkmark" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      {/* Custom Styled Alert Modal */}
      <Modal
        visible={alertVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAlertVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.alertIconContainer, alertConfig.type === 'success' ? styles.successIcon : styles.errorIcon]}>
              <Icon
                name={alertConfig.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={50}
                color={COLORS.white}
              />
            </View>
            <Text style={styles.alertTitle}>{alertConfig.title}</Text>
            <Text style={styles.alertMessage}>{alertConfig.message}</Text>
            <TouchableOpacity
              style={[styles.alertButton, alertConfig.type === 'success' ? styles.successButton : styles.errorButton]}
              onPress={alertConfig.onConfirm}
            >
              <Text style={styles.alertButtonText}>
                {alertConfig.type === 'success' ? 'Get Started' : 'Try Again'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 24,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  logoGradient: {
    width: 100,
    height: 100,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 25,
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 1,
    textAlign: 'center',
    lineHeight: 14,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  signupButton: {
    marginTop: 20,
    width: '100%',
    borderRadius: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    backgroundColor: '#FFE5E5',
    borderRadius: 10,
    gap: 8,
  },
  errorText: {
    color: COLORS.error || '#FF6B6B',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 8,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  loginText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '700',
  },
  // Custom Alert Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: 32,
    alignItems: 'center',
    width: '85%',
    maxWidth: 340,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  alertIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successIcon: {
    backgroundColor: COLORS.primary,
  },
  errorIcon: {
    backgroundColor: '#FF6B6B',
  },
  alertTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  alertButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  successButton: {
    backgroundColor: COLORS.primary,
  },
  errorButton: {
    backgroundColor: '#FF6B6B',
  },
  alertButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  // Area Selector Styles
  areaSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 12,
    marginBottom: 4,
  },
  areaIcon: {
    marginRight: 12,
  },
  areaText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  areaTextSelected: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  areaModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  areaModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  areaModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  areaModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  areaSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  areaSearchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginLeft: 8,
  },
  areaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  areaItemText: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
});

export default SignupScreen;
