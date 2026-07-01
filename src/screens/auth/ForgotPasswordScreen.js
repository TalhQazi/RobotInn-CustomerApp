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
import { authAPI } from '../../services/api';

const { width } = Dimensions.get('window');

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState(1); // 1 = Enter Email, 2 = Verify Code & Enter Password
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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

  // Step transition animation
  const stepFadeAnim = useRef(new Animated.Value(1)).current;

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
  }, []);

  const transitionToStep = (nextStep) => {
    Animated.timing(stepFadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      setError(null);
      Animated.timing(stepFadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleSendCode = async () => {
    if (!email) {
      setError('Please enter your email address.');
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
      await authAPI.sendOTPCode(email);
      setLoading(false);

      setAlertConfig({
        title: 'Verification Code Sent! ✉️',
        message: `A 6-digit verification code has been sent to ${email}. Check your inbox (or spam) and enter it here.`,
        type: 'success',
        onConfirm: () => {
          setAlertVisible(false);
          transitionToStep(2);
        },
      });
      setAlertVisible(true);
    } catch (err) {
      setLoading(false);
      let errorMessage = 'Could not send verification code. Please try again.';
      if (err.message) {
        errorMessage = err.message;
      }
      
      if (errorMessage.toLowerCase().includes('no user') || 
          errorMessage.toLowerCase().includes('user-not-found')) {
        errorMessage = 'No user record found corresponding to this email address.';
      }

      setAlertConfig({
        title: 'Error',
        message: errorMessage,
        type: 'error',
        onConfirm: () => setAlertVisible(false),
      });
      setAlertVisible(true);
    }
  };

  const handleResetPassword = async () => {
    if (!code || code.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await authAPI.verifyOTPAndResetPassword(email, code, newPassword);
      setLoading(false);

      setAlertConfig({
        title: 'Password Updated! 🎉',
        message: 'Your password has been successfully reset in the database.',
        type: 'success',
        onConfirm: () => {
          setAlertVisible(false);
          navigation.navigate('Login');
        },
      });
      setAlertVisible(true);
    } catch (err) {
      setLoading(false);
      let errorMessage = 'Could not reset password. Please try again.';
      if (err.message) {
        errorMessage = err.message;
      }

      setAlertConfig({
        title: 'Reset Failed',
        message: errorMessage,
        type: 'error',
        onConfirm: () => setAlertVisible(false),
      });
      setAlertVisible(true);
    }
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => {
          if (step === 2) {
            transitionToStep(1);
          } else {
            navigation.navigate('Login');
          }
        }}
      >
        <Icon name="arrow-back" size={24} color={COLORS.textPrimary} />
      </TouchableOpacity>

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
                <Text style={styles.welcomeText}>Reset Password</Text>
                <Text style={styles.subtitle}>
                  {step === 1 
                    ? 'Enter your email to receive a verification code' 
                    : `Enter the code sent to ${email}`
                  }
                </Text>
              </Animated.View>
            </View>

            {/* Form Section with smooth step transition animation */}
            <Animated.View style={[styles.formContainer, { opacity: stepFadeAnim }]}>
              {step === 1 ? (
                // Step 1: Email Request
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

                  {error && (
                    <Animated.View style={styles.errorContainer}>
                      <Icon name="alert-circle-outline" size={16} color={COLORS.error || '#FF6B6B'} />
                      <Text style={styles.errorText}>{error}</Text>
                    </Animated.View>
                  )}

                  <CustomButton
                    title="Send Verification Code"
                    onPress={handleSendCode}
                    loading={loading}
                    style={styles.resetButton}
                  />
                </View>
              ) : (
                // Step 2: Code Verification and Password Reset
                <View style={styles.formCard}>
                  <CustomInput
                    label="6-Digit Verification Code"
                    placeholder="123456"
                    value={code}
                    onChangeText={(text) => setCode(text.trim().replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={6}
                    icon={<Icon name="key-outline" size={20} color={COLORS.primary} />}
                  />

                  <CustomInput
                    label="New Password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChangeText={setNewPassword}
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

                  {error && (
                    <Animated.View style={styles.errorContainer}>
                      <Icon name="alert-circle-outline" size={16} color={COLORS.error || '#FF6B6B'} />
                      <Text style={styles.errorText}>{error}</Text>
                    </Animated.View>
                  )}

                  <CustomButton
                    title="Reset Password"
                    onPress={handleResetPassword}
                    loading={loading}
                    style={styles.resetButton}
                  />

                  <View style={styles.resendContainer}>
                    <Text style={styles.resendText}>Didn't receive the code? </Text>
                    <TouchableOpacity onPress={handleSendCode}>
                      <Text style={styles.resendAction}>Resend Code</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Footer */}
              <View style={styles.footer}>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.backToLoginText}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
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
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    left: 20,
    zIndex: 10,
    padding: 8,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    paddingHorizontal: 20,
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
  resetButton: {
    marginTop: 16,
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
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  resendText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  resendAction: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 16,
  },
  backToLoginText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '700',
  },
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

export default ForgotPasswordScreen;
