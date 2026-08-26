import React, { useEffect, useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../../api/client';
import { ExamSubjectInput, createExam } from '../../api/exams';
import { listMyAssignments, TeacherAssignment } from '../../api/teachers';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateField } from '../../components/DateField';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { Touchable } from '../../components/Touchable';
import { colors, fonts, radius, spacing } from '../../theme';
import type { TeacherExamsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TeacherExamsStackParamList, 'NewClassTest'>;

interface SubjectRowDraft {
  subjectId: number | null;
  maxMarks: string;
  passMarks: string;
  examDate: string;
}

const emptyRow = (): SubjectRowDraft => ({ subjectId: null, maxMarks: '', passMarks: '', examDate: '' });

// A teacher's self-serve path to a class test — scoped server-side to their
// own classes and, within a class, only the subjects they actually teach
// there. Unlike the admin "New exam" screen, class + subjects are mandatory
// here: a teacher can't create a bare umbrella and add classes later, since
// they hold no exam.edit/exam.view to come back and finish the job.
export function NewClassTestScreen({ navigation }: Props): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [classId, setClassId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rows, setRows] = useState<SubjectRowDraft[]>([emptyRow()]);

  useEffect(() => {
    listMyAssignments()
      .then(setAssignments)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your classes'))
      .finally(() => setLoading(false));
  }, []);

  const myClasses = useMemo(() => {
    const byId = new Map<number, { id: number; name: string }>();
    for (const a of assignments) byId.set(a.class.id, a.class);
    return [...byId.values()];
  }, [assignments]);

  const mySubjectsInClass = useMemo(() => {
    if (classId === null) return [];
    const byId = new Map<number, { id: number; name: string }>();
    for (const a of assignments) {
      if (a.class.id === classId) byId.set(a.subject.id, a.subject);
    }
    return [...byId.values()];
  }, [assignments, classId]);

  const updateRow = (index: number, patch: Partial<SubjectRowDraft>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));
  const pickedSubjectIds = new Set(rows.map((r) => r.subjectId).filter((id): id is number => id !== null));

  const handleSubmit = async () => {
    setError(null);
    if (classId === null || !startDate || !endDate) {
      setError('Select a class and both dates.');
      return;
    }
    const picked: ExamSubjectInput[] = [];
    for (const row of rows) {
      if (row.subjectId === null || !row.maxMarks) continue;
      picked.push({
        subjectId: row.subjectId,
        maxMarks: Number(row.maxMarks),
        passMarks: row.passMarks ? Number(row.passMarks) : undefined,
        examDate: row.examDate || undefined,
      });
    }
    if (picked.length === 0) {
      setError('Add at least one subject with a max marks value.');
      return;
    }

    setSubmitting(true);
    try {
      await createExam({
        name: name.trim(),
        type: 'CLASS_TEST',
        schedule: { classId, startDate, endDate, subjects: picked },
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create class test');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <Screen>
      <Card style={styles.card}>
        <Text style={styles.heading}>New class test</Text>
        <Text style={styles.body}>For a class and subjects you teach — you can only create class tests here.</Text>

        <View>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Class Test 1"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <SelectField
          label="Class"
          value={classId}
          onChange={(id) => {
            setClassId(id);
            setRows([emptyRow()]);
          }}
          placeholder={myClasses.length === 0 ? 'No classes assigned to you yet' : 'Select…'}
          options={myClasses.map((c) => ({ value: c.id, label: c.name }))}
        />

        <DateField label="Start date" value={startDate} onChange={setStartDate} />
        <DateField label="End date" value={endDate} onChange={setEndDate} minimumDate={startDate ? new Date(`${startDate}T00:00:00`) : undefined} />

        {classId !== null && (
          <View>
            <Text style={styles.label}>Subjects</Text>
            {rows.map((row, i) => (
              <View key={i} style={styles.subjectRow}>
                <SelectField
                  label={`Subject ${i + 1}`}
                  value={row.subjectId}
                  onChange={(id) => updateRow(i, { subjectId: id })}
                  placeholder="Select subject…"
                  options={mySubjectsInClass
                    .filter((s) => s.id === row.subjectId || !pickedSubjectIds.has(s.id))
                    .map((s) => ({ value: s.id, label: s.name }))}
                />
                <View style={styles.rowFields}>
                  <View style={styles.rowFieldHalf}>
                    <Text style={styles.label}>Max marks</Text>
                    <TextInput
                      style={styles.input}
                      value={row.maxMarks}
                      onChangeText={(v) => updateRow(i, { maxMarks: v.replace(/[^0-9]/g, '') })}
                      keyboardType="number-pad"
                      placeholder="e.g. 25"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.rowFieldHalf}>
                    <Text style={styles.label}>Pass marks</Text>
                    <TextInput
                      style={styles.input}
                      value={row.passMarks}
                      onChangeText={(v) => updateRow(i, { passMarks: v.replace(/[^0-9]/g, '') })}
                      keyboardType="number-pad"
                      placeholder="Optional"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
                <DateField
                  label="Paper date (optional)"
                  value={row.examDate}
                  onChange={(v) => updateRow(i, { examDate: v })}
                />
                {rows.length > 1 && (
                  <Touchable onPress={() => removeRow(i)} style={styles.removeRow}>
                    <Text style={styles.removeRowText}>Remove subject</Text>
                  </Touchable>
                )}
              </View>
            ))}
            <Button label="+ Add subject" variant="secondary" onPress={addRow} />
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        <Button label={submitting ? 'Creating…' : 'Create class test'} onPress={handleSubmit} loading={submitting} />
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
  subjectRow: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  rowFields: { flexDirection: 'row', gap: spacing.sm },
  rowFieldHalf: { flex: 1 },
  removeRow: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  removeRowText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.danger },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
});
