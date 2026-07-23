import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
  Image,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import CustomInput from '../../components/common/CustomInput';
import CustomButton from '../../components/common/CustomButton';
import { COLORS } from '../../theme/colors';
import { SPACING } from '../../theme/spacing';
import { authAPI } from '../../services/api';

const { width } = Dimensions.get('window');

const CreateNewPasswordScreen = ({ route, navigation }) => {
  const { email, code } = route.params;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'success',
  });

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSubmit = async () => {
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await authAPI.verifyOTPAndResetPassword(email, code, password);
      setAlertConfig({
        title: 'Password Created! 🎉',
        message: 'Your new password has been successfully created. You can now log in.',
        type: 'success'
      });
      setAlertVisible(true);
    } catch (err) {
      let errorMessage = 'Could not update password. Please try again.';
      if (err instanceof Error) {
        errorMessage = err.message;
      }

      const isSecurityRedirect = errorMessage.includes('requires a direct reset link');
      setAlertConfig({
        title: isSecurityRedirect ? 'Check Your Email ✉️' : 'Reset Failed',
        message: isSecurityRedirect 
          ? 'We have sent a secure password reset link to your email. Please check your inbox (and spam folder), click the link to set your password, then return here to log in.'
          : errorMessage,
        type: isSecurityRedirect ? 'success' : 'error'
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
        onPress={() => navigation.goBack()}
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
                <Text style={styles.welcomeText}>Create New Password</Text>
                <Text style={styles.subtitle}>
                  Enter a new strong password below.
                </Text>
              </Animated.View>
            </View>

            <View style={styles.formCard}>
              <CustomInput
                label="New Password"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                icon={<Icon name="lock-closed-outline" size={20} color={COLORS.primary} />}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 5 }}>
                    <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>
                      {showPassword ? 'HIDE' : 'SHOW'}
                    </Text>
                  </TouchableOpacity>
                }
              />

              <CustomInput
                label="Confirm Password"
                placeholder="••••••••"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                icon={<Icon name="lock-closed-outline" size={20} color={COLORS.primary} />}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ padding: 5 }}>
                    <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>
                      {showConfirmPassword ? 'HIDE' : 'SHOW'}
                    </Text>
                  </TouchableOpacity>
                }
              />

              {error && (
                <Animated.View style={styles.errorContainer}>
                  <Icon name="alert-circle-outline" size={16} color={COLORS.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </Animated.View>
              )}

              <CustomButton
                title="Create Password"
                onPress={handleSubmit}
                loading={loading}
                style={styles.submitButton}
              />
            </View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={alertVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAlertVisible(false)}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertContent}>
            <View style={[
              styles.alertIconContainer,
              alertConfig.type === 'success' ? styles.successIcon : styles.errorIcon
            ]}>
              <Icon 
                name={alertConfig.type === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'} 
                size={40} 
                color={COLORS.white} 
              />
            </View>
            <Text style={styles.alertTitle}>{alertConfig.title}</Text>
            <Text style={styles.alertMessage}>{alertConfig.message}</Text>
            <TouchableOpacity 
              style={[
                styles.alertButton,
                alertConfig.type === 'success' ? styles.successButton : styles.errorButton
              ]}
              onPress={handleAlertConfirm}
            >
              <Text style={styles.alertButtonText}>OK</Text>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING?.padding || 20,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
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
    padding: 3,
    backgroundColor: COLORS.white,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 27,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary || COLORS.black || '#1A202C',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary || COLORS.gray || '#718096',
    textAlign: 'center',
    lineHeight: 22,
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
    backgroundColor: '#FFF5F5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FED7D7',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  submitButton: {
    marginTop: 8,
    width: '100%',
    borderRadius: 12,
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertContent: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '85%',
    maxWidth: 340,
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default CreateNewPasswordScreen;
