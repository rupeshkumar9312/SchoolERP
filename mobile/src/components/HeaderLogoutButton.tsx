import React from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { colors, spacing } from '../theme';
import { Touchable } from './Touchable';

export function HeaderLogoutButton(): React.JSX.Element {
  const { logout } = useAuth();

  return (
    <Touchable
      onPress={() => logout()}
      hitSlop={12}
      borderless
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel="Log out"
    >
      <Ionicons name="log-out-outline" size={22} color={colors.primary} />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: spacing.sm, marginRight: spacing.xs },
});
