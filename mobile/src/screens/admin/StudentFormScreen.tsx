import React, { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import * as academic from '../../api/academic';
import { ApiError } from '../../api/client';
import { createStudent, getStudent, updateStudent } from '../../api/students';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateField } from '../../components/DateField';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { Touchable } from '../../components/Touchable';
import { colors, fonts, radius, spacing } from '../../theme';
import type { ManageStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ManageStackParamList, 'StudentForm'>;

const GENDER_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

export function StudentFormScreen({ route, navigation }: Props): React.JSX.Element {
  const existing = route.params?.student;
  const isEdit = !!existing;

  const [years, setYears] = useState<academic.AcademicYear[]>([]);
  const [classes, setClasses] = useState<academic.SchoolClass[]>([]);
  const [sections, setSections] = useState<academic.Section[]>([]);

  const [admissionNo, setAdmissionNo] = useState(existing?.admissionNo ?? '');
  const [name, setName] = useState(existing?.name ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(existing?.dateOfBirth?.slice(0, 10) ?? '');
  const [gender, setGender] = useState(existing?.gender ?? '');
  const [yearId, setYearId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(existing?.class.id ?? null);
  const [sectionId, setSectionId] = useState<number | null>(existing?.section.id ?? null);
  const [guardianName, setGuardianName] = useState(existing?.guardianName ?? '');
  const [guardianPhone, setGuardianPhone] = useState(existing?.guardianPhone ?? '');
  const [guardianEmail, setGuardianEmail] = useState(existing?.guardianEmail ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [admissionDate, setAdmissionDate] = useState(existing?.admissionDate.slice(0, 10) ?? '');
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLogin, setCreatedLogin] = useState<{ email: string; alias: string; temporaryPassword: string } | null>(null);

  useEffect(() => {
    void academic.listAcademicYears().then(setYears);
  }, []);

  useEffect(() => {
    if (yearId === null) {
      setClasses([]);
      return;
    }
    void academic.listClasses(yearId).then(setClasses);
  }, [yearId]);

  useEffect(() => {
    if (classId === null) {
      setSections([]);
      return;
    }
    void academic.listSections(classId).then(setSections);
  }, [classId]);

  // Preload the year/class chain for an existing student so the cascading
  // selects resolve to the right academic year even though the API only
  // stores classId/sectionId.
  useEffect(() => {
    if (!existing) return;
    setLoading(true);
    getStudent(existing.id)
      .then(async (student) => {
        const allYears = await academic.listAcademicYears();
        for (const year of allYears) {
          const yearClasses = await academic.listClasses(year.id);
          if (yearClasses.some((c) => c.id === student.class.id)) {
            setYearId(year.id);
            setClasses(yearClasses);
            break;
          }
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load student'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    setError(null);
    if (!admissionNo.trim() || !name.trim() || classId === null || sectionId === null) {
      setError('Admission number, name, class, and section are required.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        admissionNo: admissionNo.trim(),
        name: name.trim(),
        dateOfBirth: dateOfBirth.trim() || undefined,
        gender: gender || undefined,
        classId,
        sectionId,
        guardianName: guardianName.trim() || undefined,
        guardianPhone: guardianPhone.trim() || undefined,
        guardianEmail: guardianEmail.trim() || undefined,
        address: address.trim() || undefined,
        admissionDate: admissionDate.trim() || undefined,
      };
      if (isEdit && existing) {
        await updateStudent(existing.id, { ...payload, isActive });
        navigation.goBack();
      } else {
        const created = await createStudent(payload);
        setCreatedLogin(created.login);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save student');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingView />;

  if (createdLogin) {
    return (
      <Screen>
        <Card style={styles.card}>
          <Text style={styles.heading}>Student admitted</Text>
          <Text style={styles.body}>
            A portal login was created automatically. Copy these credentials now — the password can't be shown again
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
        <Text style={styles.heading}>{isEdit ? 'Edit student' : 'Admit student'}</Text>

        <View>
          <Text style={styles.label}>Admission number</Text>
          <TextInput style={styles.input} value={admissionNo} onChangeText={setAdmissionNo} placeholderTextColor={colors.textMuted} />
        </View>

        <View>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.textMuted} />
        </View>

        <DateField label="Date of birth" value={dateOfBirth} onChange={setDateOfBirth} maximumDate={new Date()} />

        <SelectField label="Gender" value={gender} onChange={setGender} options={GENDER_OPTIONS} placeholder="Prefer not to say" />

        <SelectField
          label="Academic year"
          value={yearId}
          onChange={(id) => {
            setYearId(id);
            setClassId(null);
            setSectionId(null);
          }}
          placeholder="Select a year"
          options={years.map((y) => ({ value: y.id, label: y.name }))}
        />

        <SelectField
          label="Class"
          value={classId}
          onChange={(id) => {
            setClassId(id);
            setSectionId(null);
          }}
          placeholder="Select a class"
          options={classes.map((c) => ({ value: c.id, label: c.name }))}
        />

        <SelectField label="Section" value={sectionId} onChange={setSectionId} placeholder="Select a section" options={sections.map((s) => ({ value: s.id, label: s.name }))} />

        <DateField label="Admission date" value={admissionDate} onChange={setAdmissionDate} />

        <View>
          <Text style={styles.label}>Guardian name</Text>
          <TextInput style={styles.input} value={guardianName} onChangeText={setGuardianName} placeholderTextColor={colors.textMuted} />
        </View>

        <View>
          <Text style={styles.label}>Guardian phone</Text>
          <TextInput
            style={styles.input}
            value={guardianPhone}
            onChangeText={setGuardianPhone}
            keyboardType="phone-pad"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View>
          <Text style={styles.label}>Guardian email</Text>
          <TextInput
            style={styles.input}
            value={guardianEmail}
            onChangeText={setGuardianEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View>
          <Text style={styles.label}>Address</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholderTextColor={colors.textMuted} />
        </View>

        {isEdit && (
          <Touchable style={styles.checkboxRow} onPress={() => setIsActive((v) => !v)}>
            <View style={[styles.checkbox, isActive && styles.checkboxChecked]} />
            <Text style={styles.label}>Active</Text>
          </Touchable>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        <Button label={isEdit ? 'Save changes' : 'Admit student'} onPress={handleSubmit} loading={submitting} />
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
