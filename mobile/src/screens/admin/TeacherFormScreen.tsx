import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../../api/client';
import { createTeacher, updateTeacher } from '../../api/teachers';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateField } from '../../components/DateField';
import { Screen } from '../../components/Screen';
import { Touchable } from '../../components/Touchable';
import { colors, fonts, radius, spacing } from '../../theme';
import type { ManageStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ManageStackParamList, 'TeacherForm'>;

export function TeacherFormScreen({ route, navigation }: Props): React.JSX.Element {
  const existing = route.params?.teacher;
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [qualification, setQualification] = useState(existing?.qualification ?? '');
  const [joiningDate, setJoiningDate] = useState(existing?.joiningDate.slice(0, 10) ?? '');
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdLogin, setCreatedLogin] = useState<{ email: string; alias: string; temporaryPassword: string } | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim() || !joiningDate.trim()) {
      setError('Name and joining date are required.');
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && existing) {
        await updateTeacher(existing.id, {
          name: name.trim(),
          phone: phone.trim() || undefined,
          qualification: qualification.trim() || undefined,
          joiningDate: joiningDate.trim() || undefined,
          isActive,
        });
        navigation.goBack();
      } else {
        const created = await createTeacher({
          name: name.trim(),
          phone: phone.trim() || undefined,
          qualification: qualification.trim() || undefined,
          joiningDate: joiningDate.trim(),
        });
        setCreatedLogin(created.login);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save teacher');
    } finally {
      setSubmitting(false);
    }
  };

  if (createdLogin) {
    return (
      <Screen>
        <Card style={styles.card}>
          <Text style={styles.heading}>Teacher added</Text>
          <Text style={styles.body}>
            A login was created automatically. Copy these credentials now — the password can't be shown again
            after you leave this screen.
          </Text>
          <View>
            <Text style={styles.label}>Login email</Text>
            <TextInput style={styles.input} value={createdLogin.email} editable={false} selectTextOnFocus />
          </View>
          <View>
            <Text style={styles.label}>Short login ID (use this to sign in instead)</Text>
            <TextInput style={styles.input} value={createdLogin.alias} editable={false} selectTextOnFocus />
          </View>
          <View>
            <Text style={styles.label}>Temporary password</Text>
            <TextInput style={styles.input} value={createdLogin.temporaryPassword} editable={false} selectTextOnFocus />
          </View>
          <Button label="Done" onPress={() => navigation.goBack()} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card style={styles.card}>
        <Text style={styles.heading}>{isEdit ? 'Edit teacher' : 'New teacher'}</Text>

        <View>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.textMuted} />
        </View>

        {isEdit && existing && (
          <>
            <View>
              <Text style={styles.label}>Login ID</Text>
              <TextInput style={styles.input} value={existing.email} editable={false} />
            </View>
            <View>
              <Text style={styles.label}>Edvance ID</Text>
              <TextInput style={styles.input} value={existing.edvanceId} editable={false} />
            </View>
          </>
        )}

        <View>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View>
          <Text style={styles.label}>Qualification</Text>
          <TextInput
            style={styles.input}
            value={qualification}
            onChangeText={setQualification}
            placeholder="e.g. M.Sc Mathematics"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <DateField label="Joining date" value={joiningDate} onChange={setJoiningDate} />

        {isEdit && (
          <Touchable style={styles.checkboxRow} onPress={() => setIsActive((v) => !v)}>
            <View style={[styles.checkbox, isActive && styles.checkboxChecked]} />
            <Text style={styles.label}>Active</Text>
          </Touchable>
        )}

        {!isEdit && (
          <Text style={styles.body}>A login email and temporary password will be generated automatically.</Text>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        <Button label={isEdit ? 'Save changes' : 'Create teacher'} onPress={handleSubmit} loading={submitting} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  heading: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
  body: { fontSize: 13, fontFamily: fonts.body, color: colors.text, lineHeight: 19 },
  label: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  checkbox: { width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
});
