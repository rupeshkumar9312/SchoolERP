import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing } from '../theme';
import { Touchable } from './Touchable';

interface PasswordFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
}

/** A password `TextInput` with a show/hide toggle — used anywhere a password
 * is typed in (login, change-password), never for the read-only fields
 * showing an already-generated temporary password. */
export function PasswordField({ label, value, onChangeText }: PasswordFieldProps): React.JSX.Element {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          placeholderTextColor={colors.textMuted}
        />
        <Touchable
          onPress={() => setVisible((v) => !v)}
          borderless
          hitSlop={8}
          style={styles.toggle}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        >
          <Ionicons name={visible ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
        </Touchable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.textMuted, marginBottom: spacing.xs },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.text,
    paddingVertical: spacing.sm + 2,
  },
  toggle: { padding: 4 },
});
