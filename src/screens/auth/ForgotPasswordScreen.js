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
import { SPACING } from '../../theme/spacing';
import CustomInput from '../../components/common/CustomInput';
import CustomButton from '../../components/common/CustomButton';
import Icon from 'react-native-vector-icons/Ionicons';
import { authAPI } from '../../services/api';

const { width } = Dimensions.get('window');

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState(1); // 1 = Enter Email, 2 = Verify Code & Enter Password
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ 
    title: '', 
    message: '', 
    type: 'success'
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
      await authAPI.sendPasswordResetEmail(email);
      setAlertConfig({
        title: 'Reset Link Sent! ✉️',
        message: `A password reset link has been sent to ${email}. Please check your inbox (and spam folder) to reset your password.`,
        type: 'success',
      });
      setAlertVisible(true);
    } catch (err) {
      let errorMessage = 'Could not send reset link. Please try again.';
      if (err instanceof Error) {
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
      });
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAlertConfirm = () => {
    setAlertVisible(false);
    if (alertConfig.type === 'success') {
      navigation.navigate('Login');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => navigation.navigate('Login')}
      >
        <Icon name="arrow-back" size={24} color={COLORS.textPrimary || COLORS.black || '#1A202C'} />
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
                  Enter your email to receive a password reset link
                </Text>
              </Animated.View>
            </View>

            <View style={styles.formContainer}>
              <Animated.View style={{ opacity: stepFadeAnim }}>
                <View style={styles.formCard}>
                  <Text style={styles.instructionText}>
                    Enter your email address and we'll send you a link to reset your password.
                  </Text>

                  <CustomInput
                    label="Email Address"
                    placeholder="customer@robotinn.com"
                    value={email}
                    onChangeText={(text) => setEmail(text.trim().toLowerCase())}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    icon={<Icon name="mail-outline" size={20} color={COLORS.primary} />}
                  />

                  {error && (
                    <Animated.View style={styles.errorContainer}>
                      <Icon name="alert-circle-outline" size={16} color={COLORS.error || '#FF6B6B'} />
                      <Text style={styles.errorText}>{error}</Text>
                    </Animated.View>
                  )}

                  <CustomButton
                    title="Send Reset Link"
                    onPress={handleSendCode}
                    loading={loading}
                    style={styles.actionButton}
                  />
                </View>
              </Animated.View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

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
                name={alertConfig.type === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                size={50}
                color={COLORS.white}
              />
            </View>
            <Text style={styles.alertTitle}>{alertConfig.title}</Text>
            <Text style={styles.alertMessage}>{alertConfig.message}</Text>
            <TouchableOpacity
              style={[styles.alertButton, alertConfig.type === 'success' ? styles.successButton : styles.errorButton]}
              onPress={handleAlertConfirm}
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
    backgroundColor: COLORS.background || '#F7FAFC',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    left: 20,
    zIndex: 10,
    padding: 8,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    shadowColor: COLORS.black || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
    paddingHorizontal: SPACING?.padding || 20,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  logoGradient: {
    width: 100,
    height: 100,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 25,
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.textPrimary || COLORS.black || '#1A202C',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary || COLORS.gray || '#718096',
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
    shadowColor: COLORS.black || '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    padding: 10,
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    color: COLORS.error,
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
    color: COLORS.textSecondary || COLORS.gray || '#718096',
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
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '85%',
    maxWidth: 340,
    shadowColor: COLORS.black || '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
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
    color: COLORS.textPrimary || COLORS.black || '#1A202C',
    marginBottom: 12,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 15,
    color: COLORS.textSecondary || COLORS.gray || '#718096',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  alertButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
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
