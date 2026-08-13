import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { Screen } from '../components/Screen';
import { colors, spacing } from '../theme';

export function ForcedChangePasswordScreen(): React.JSX.Element {
  const { changePassword, error, logout } = useAuth();

  return (
    <Screen>
      <Card style={styles.card}>
        <Text style={styles.heading}>Set a new password</Text>
        <Text style={styles.body}>
          This is your first login (or your password was just reset). Choose a new password before
          continuing.
        </Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <ChangePasswordForm onSubmit={changePassword} />
        <Button label="Log out instead" variant="secondary" onPress={logout} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 13 },
});
