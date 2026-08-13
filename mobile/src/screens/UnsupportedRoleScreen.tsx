import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { colors, spacing } from '../theme';

export function UnsupportedRoleScreen(): React.JSX.Element {
  const { user, logout } = useAuth();

  return (
    <Screen scroll={false}>
      <Card style={styles.card}>
        <Text style={styles.heading}>This app is for students and teachers only</Text>
        <Text style={styles.body}>
          Your account ({user?.role.name}) doesn't have access to the EDVANCE mobile app. Please use
          the web dashboard instead.
        </Text>
        <Button label="Log out" variant="secondary" onPress={logout} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
});
