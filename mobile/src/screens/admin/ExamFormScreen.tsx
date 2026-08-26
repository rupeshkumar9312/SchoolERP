import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../../api/client';
import { EXAM_TYPE_LABELS, ExamType, createExam, updateExam } from '../../api/exams';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateField } from '../../components/DateField';
import { Screen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { colors, fonts, radius, spacing } from '../../theme';
import type { ManageStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ManageStackParamList, 'ExamForm'>;

const EXAM_TYPES: ExamType[] = ['CLASS_TEST', 'UNIT_TEST', 'MID_TERM', 'TERM_EXAM', 'FINAL_EXAM', 'OTHER'];

// Creates/edits just the Exam umbrella (name + type + an overall date
// window). Classes — each with their own independent dates and subjects —
// are added afterwards from the exam's detail screen via "+ Add class".
export function ExamFormScreen({ route, navigation }: Props): React.JSX.Element {
  const existing = route.params?.exam;
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<ExamType>(existing?.type ?? 'UNIT_TEST');
  const [startDate, setStartDate] = useState(existing?.startDate?.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(existing?.endDate?.slice(0, 10) ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && existing) {
        await updateExam(existing.id, {
          name: name.trim(),
          type,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
      } else {
        await createExam({
          name: name.trim(),
          type,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
      }
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save exam');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Card style={styles.card}>
        <Text style={styles.heading}>{isEdit ? 'Edit exam' : 'New exam'}</Text>

        <View>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Unit Test 1"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <SelectField
          label="Type"
          value={type}
          onChange={setType}
          options={EXAM_TYPES.map((t) => ({ value: t, label: EXAM_TYPE_LABELS[t] }))}
        />

        <DateField label="Start date" value={startDate} onChange={setStartDate} />
        <DateField label="End date" value={endDate} onChange={setEndDate} minimumDate={startDate ? new Date(`${startDate}T00:00:00`) : undefined} />

        {!isEdit && (
          <Text style={styles.body}>
            Add classes to this exam afterwards, each with its own dates and subjects, from the exam's page.
          </Text>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        <Button label={isEdit ? 'Save changes' : 'Create exam'} onPress={handleSubmit} loading={submitting} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  heading: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
  body: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, lineHeight: 19 },
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
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
});
