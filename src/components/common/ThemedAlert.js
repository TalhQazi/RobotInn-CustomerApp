import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS } from '../../theme/colors';
import { SPACING, BORDER_RADIUS } from '../../theme/spacing';

const ThemedAlert = ({ visible, title, message, buttons = [], onRequestClose }) => {
  const safeButtons = Array.isArray(buttons) && buttons.length > 0
    ? buttons
    : [{ text: 'OK', onPress: onRequestClose }];

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.primary]}
            style={styles.header}
          >
            <Text style={styles.title} numberOfLines={2}>{title || 'Alert'}</Text>
          </LinearGradient>

          {!!message && (
            <Text style={styles.message}>{message}</Text>
          )}

          <View style={styles.buttonRow}>
            {safeButtons.map((b, idx) => {
              const isCancel = b?.style === 'cancel';
              const onPress = () => {
                if (typeof b?.onPress === 'function') b.onPress();
                if (typeof onRequestClose === 'function') onRequestClose();
              };

              return (
                <TouchableOpacity
                  key={`${b?.text || 'btn'}-${idx}`}
                  activeOpacity={0.9}
                  onPress={onPress}
                  style={[styles.button, isCancel ? styles.cancelButton : styles.primaryButton]}
                >
                  <Text style={[styles.buttonText, isCancel ? styles.cancelButtonText : styles.primaryButtonText]}>
                    {b?.text || 'OK'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  title: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
  },
  message: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: 15,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.lg,
    paddingTop: SPACING.md,
  },
  button: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  cancelButton: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  cancelButtonText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  buttonText: {
    fontSize: 14,
  },
});

export default ThemedAlert;
