import React from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { Touchable } from './Touchable';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}

const RIPPLE_BY_VARIANT = {
  primary: 'rgba(255, 255, 255, 0.25)',
  secondary: colors.primaryTint,
  danger: 'rgba(255, 255, 255, 0.3)',
} as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: ButtonProps): React.JSX.Element {
  const isDisabled = disabled || loading;
  return (
    <Touchable
      onPress={onPress}
      disabled={isDisabled}
      rippleColor={RIPPLE_BY_VARIANT[variant]}
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : colors.primaryContrast} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'secondary' && styles.labelSecondary,
            variant === 'danger' && styles.labelDanger,
          ]}
        >
          {label}
        </Text>
      )}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surfaceHover, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
  disabled: { opacity: 0.5 },
  label: { color: colors.primaryContrast, fontFamily: fonts.bodySemiBold, fontSize: 15 },
  labelSecondary: { color: colors.text },
  labelDanger: { color: colors.primaryContrast },
});
