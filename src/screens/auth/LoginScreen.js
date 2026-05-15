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
} from 'react-native';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';
import CustomInput from '../../components/common/CustomInput';
import CustomButton from '../../components/common/CustomButton';
import Icon from 'react-native-vector-icons/Ionicons';
import { storeData } from '../../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS } from '../../utils/constants';
import { authAPI } from '../../services/api';
import { resetToMain } from '../../navigation/navigationRef';

const { width, height } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'success', // 'success' or 'error'
    onConfirm: () => {},
  });

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  // useEffect hook - called after all state hooks
  useEffect(() => {
    // Entrance animations
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
  }, []); // Empty dependency array - runs once on mount

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password.');
      return;
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await authAPI.login(email, password);
      setLoading(false);
      
      // Show styled success alert
      setAlertConfig({
        title: 'Welcome Back!',
        message: `Welcome back, ${response.user?.name || 'User'}!`,
        type: 'success',
        onConfirm: () => {
          setAlertVisible(false);
          resetToMain();
        },
      });
      setAlertVisible(true);
    } catch (err) {
      setLoading(false);
      
      // Format user-friendly error message
      let errorMessage = 'Unable to login. Please try again.';
      
      if (err.message) {
        errorMessage = err.message;
      }
      
      // Check for backend validation errors
      if (err.errors && Array.isArray(err.errors)) {
        errorMessage = err.errors.map(e => e.message).join('\n');
      }
      
      // Specific error messages for common cases
      if (errorMessage.toLowerCase().includes('invalid credentials') || 
          errorMessage.toLowerCase().includes('invalid email or password')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (errorMessage.toLowerCase().includes('network') || 
                 errorMessage.toLowerCase().includes('failed to fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (errorMessage.toLowerCase().includes('server error')) {
        errorMessage = 'Server is temporarily unavailable. Please try again later.';
      } else if (errorMessage.toLowerCase().includes('user not found')) {
        errorMessage = 'No account found with this email. Please sign up first.';
      }
      
      // Show styled error alert
      setAlertConfig({
        title: 'Login Failed',
        message: errorMessage,
        type: 'error',
        onConfirm: () => setAlertVisible(false),
      });
      setAlertVisible(true);
    }
  };

  const handleForgotPassword = () => {
    setAlertConfig({
      title: 'Forgot Password?',
      message: 'Enter your email to reset your password.',
      type: 'error',
      onConfirm: () => setAlertVisible(false),
    });
    setAlertVisible(true);
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
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
            {/* Header with Animated Logo */}
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
                <Text style={styles.welcomeText}>Welcome Back! 👋</Text>
                <Text style={styles.subtitle}>Login to your account</Text>
              </Animated.View>
            </View>

            {/* Form Section */}
            <View style={styles.formContainer}>
              <View style={styles.formCard}>
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
                  label="Password"
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  icon={<Icon name="lock-closed-outline" size={20} color={COLORS.primary} />}
                  rightIcon={
                    <TouchableOpacity onPress={toggleShowPassword}>
                      <Icon
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                  }
                />

                {/* <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPassword}>
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity> */}

                {error && (
                  <Animated.View style={styles.errorContainer}>
                    <Icon name="alert-circle-outline" size={16} color={COLORS.error || '#FF6B6B'} />
                    <Text style={styles.errorText}>{error}</Text>
                  </Animated.View>
                )}

                <CustomButton
                  title="Login"
                  onPress={handleLogin}
                  loading={loading}
                  style={styles.loginButton}
                />
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                  <Text style={styles.signupText}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

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
                {alertConfig.type === 'success' ? 'Continue' : 'Try Again'}
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
  welcomeText: {
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: 8,
  },
  forgotPasswordText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    marginTop: 8,
    width: '100%',
    borderRadius: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    padding: 10,
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
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
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  signupText: {
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
});

export default LoginScreen;
