import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { Screen } from '../components/Screen';
import { colors, fonts, spacing } from '../theme';
import type { TeacherTabsParamList } from '../navigation/types';

export function SettingsScreen(): React.JSX.Element {
  const { user, changePassword, error, clearError, logout } = useAuth();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Typed for the teacher tab navigator specifically — only ever used from
  // the isTeacher-gated button below, which never mounts under StudentTabs.
  const navigation = useNavigation<BottomTabNavigationProp<TeacherTabsParamList>>();
  const isTeacher = user?.role.name === 'TEACHER';

  const handleChangePassword = async (payload: { currentPassword: string; newPassword: string }) => {
    setSuccessMessage(null);
    await changePassword(payload);
    setSuccessMessage('Password updated.');
  };

  return (
    <Screen>
      <Card style={styles.card}>
        <Text style={styles.heading}>{user?.name}</Text>
        <Text style={styles.subheading}>
          {user?.email} · {user?.role.name}
        </Text>
      </Card>

      {isTeacher && (
        <Card style={styles.card}>
          <Text style={styles.heading}>My attendance</Text>
          <Text style={styles.subheading}>View your attendance history or mark today's.</Text>
          <Button
            label="View my attendance"
            variant="secondary"
            onPress={() => navigation.navigate('Dashboard', { screen: 'MyAttendance' })}
          />
        </Card>
      )}

      <Card style={styles.card}>
        <Text style={styles.heading}>Change password</Text>
        {successMessage && <Text style={styles.success}>{successMessage}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        <ChangePasswordForm
          onSubmit={handleChangePassword}
          submitLabel="Update password"
        />
      </Card>

      <Button label="Log out" variant="danger" onPress={() => { clearError(); logout(); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  heading: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text },
  subheading: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  success: { color: colors.success, fontSize: 13, fontFamily: fonts.body },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
});
