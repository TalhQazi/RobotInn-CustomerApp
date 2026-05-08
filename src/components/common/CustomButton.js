import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';

const CustomButton = ({ title, onPress, style, textStyle, type = 'primary', disabled = false, loading = false }) => {
  const animatedScale = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.spring(animatedScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(animatedScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale: animatedScale }] }]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[
          styles.button,
          type === 'secondary' ? styles.secondaryButton : styles.primaryButton,
          (disabled || loading) && styles.disabledButton,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={type === 'secondary' ? COLORS.primary : COLORS.white} />
        ) : (
          <Text
            style={[
              styles.text,
              type === 'secondary' ? styles.secondaryText : styles.primaryText,
              (disabled || loading) && styles.disabledText,
              textStyle,
            ]}
          >
            {title}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  disabledButton: {
    backgroundColor: COLORS.border,
    borderColor: COLORS.border,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  primaryText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  secondaryText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  disabledText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
});

export default CustomButton;
