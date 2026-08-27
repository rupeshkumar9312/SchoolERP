import React from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { Touchable } from './Touchable';

interface IconButtonProps {
  name: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  size?: number;
  color?: string;
  /** Slightly larger than the default 36 — used where it's the only control
   * in its row and could otherwise read as too small a target. */
  variant?: 'default' | 'compact';
}

/** A single tap target for one icon — the kebab trigger on a list card, a
 * close button, anything that doesn't carry a label. Ripple + press-scale
 * come from Touchable, same as every other tappable surface in the app. */
export function IconButton({
  name,
  onPress,
  size = 20,
  color = colors.textMuted,
  variant = 'default',
}: IconButtonProps): React.JSX.Element {
  return (
    <Touchable
      onPress={onPress}
      borderless
      hitSlop={8}
      style={[styles.base, variant === 'compact' && styles.compact]}
    >
      <Ionicons name={name} size={size} color={color} />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHover,
  },
  compact: { width: 32, height: 32 },
});
