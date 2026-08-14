import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Button } from './Button';
import { PasswordField } from './PasswordField';

interface ChangePasswordFormProps {
  onSubmit: (payload: { currentPassword: string; newPassword: string }) => Promise<void>;
  submitLabel?: string;
}

export function ChangePasswordForm({
  onSubmit,
  submitLabel = 'Set new password',
}: ChangePasswordFormProps): React.JSX.Element {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setLocalError(null);
    if (newPassword.length < 8) {
      setLocalError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('New password and confirmation do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      // Parent surfaces the server-side error message.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.form}>
      <PasswordField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} />
      <PasswordField label="New password" value={newPassword} onChangeText={setNewPassword} />
      <PasswordField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} />
      {localError && <Text style={styles.error}>{localError}</Text>}
      <Button label={submitLabel} onPress={handleSubmit} loading={submitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  error: { color: colors.danger, fontSize: 13 },
});
