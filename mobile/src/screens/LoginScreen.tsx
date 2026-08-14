import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PasswordField } from '../components/PasswordField';
import { Touchable } from '../components/Touchable';
import { colors, radius, spacing } from '../theme';

const logo = require('../../assets/edvance-logo.png');

export function LoginScreen(): React.JSX.Element {
  const { login, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleSubmit = async () => {
    clearError();
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch {
      // error is already set on context; nothing else to do here.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={logo} style={styles.logo} resizeMode="contain" />

        <Card style={styles.card}>
          <Text style={styles.heading}>Sign in</Text>
          <View>
            <Text style={styles.label}>Email or login ID</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              placeholder="Login ID or email"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <PasswordField label="Password" value={password} onChangeText={setPassword} />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label="Log in" onPress={handleSubmit} loading={submitting} disabled={!email || !password} />
          <Touchable onPress={() => setShowForgotModal(true)} borderless style={styles.forgotTouchable}>
            <Text style={styles.forgot}>Forgot password?</Text>
          </Touchable>
        </Card>
      </ScrollView>

      <Modal visible={showForgotModal} transparent animationType="fade" onRequestClose={() => setShowForgotModal(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <Text style={styles.heading}>Forgot your password?</Text>
            <Text style={styles.modalBody}>
              Please contact your school administrator — only they can reset your password.
            </Text>
            <Button label="Got it" variant="secondary" onPress={() => setShowForgotModal(false)} />
          </Card>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  logo: { width: '80%', height: 90, alignSelf: 'center', marginBottom: spacing.xl },
  card: { gap: spacing.md },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  error: { color: colors.danger, fontSize: 13 },
  forgotTouchable: { paddingVertical: spacing.xs },
  forgot: { color: colors.primary, fontSize: 13, textAlign: 'center', fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: { width: '100%', gap: spacing.md },
  modalBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
});
