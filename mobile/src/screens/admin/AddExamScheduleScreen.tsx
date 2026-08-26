import React, { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import * as academic from '../../api/academic';
import { ApiError } from '../../api/client';
import { ExamSubjectInput, addExamSchedule, getExam } from '../../api/exams';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateField } from '../../components/DateField';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { Touchable } from '../../components/Touchable';
import { colors, fonts, radius, spacing } from '../../theme';
import type { ManageStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ManageStackParamList, 'AddExamSchedule'>;

interface SubjectRowDraft {
  subjectId: number | null;
  maxMarks: string;
  passMarks: string;
  examDate: string;
}

const emptyRow = (): SubjectRowDraft => ({ subjectId: null, maxMarks: '', passMarks: '', examDate: '' });

// Adds one more class to an existing exam — fully independent of every
// other class already scheduled under it: its own dates, its own subject
// list picked from that class's real subjects, no name-matching, no shared
// template.
export function AddExamScheduleScreen({ route, navigation }: Props): React.JSX.Element {
  const { examId } = route.params;

  const [loading, setLoading] = useState(true);
  const [scheduledClassIds, setScheduledClassIds] = useState<Set<number>>(new Set());
  const [years, setYears] = useState<academic.AcademicYear[]>([]);
  const [classes, setClasses] = useState<academic.SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<academic.Subject[]>([]);

  const [yearId, setYearId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rows, setRows] = useState<SubjectRowDraft[]>([emptyRow()]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getExam(examId), academic.listAcademicYears()])
      .then(([exam, yearRows]) => {
        setScheduledClassIds(new Set(exam.schedules.map((s) => s.class.id)));
        setYears(yearRows);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [examId]);

  useEffect(() => {
    if (yearId === null) {
      setClasses([]);
      return;
    }
    void academic.listClasses(yearId).then(setClasses);
  }, [yearId]);

  useEffect(() => {
    if (classId === null) {
      setSubjects([]);
      return;
    }
    void academic.listSubjects(classId).then(setSubjects);
  }, [classId]);

  const availableClasses = classes.filter((c) => !scheduledClassIds.has(c.id));

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
      await addExamSchedule(examId, { classId, startDate, endDate, subjects: picked });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add class');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <Screen>
      <Card style={styles.card}>
        <Text style={styles.heading}>Add class</Text>

        <SelectField
          label="Academic year"
          value={yearId}
          onChange={(id) => {
            setYearId(id);
            setClassId(null);
            setRows([emptyRow()]);
          }}
          placeholder="Select…"
          options={years.map((y) => ({ value: y.id, label: y.name }))}
        />

        {yearId !== null && (
          <SelectField
            label="Class"
            value={classId}
            onChange={(id) => {
              setClassId(id);
              setRows([emptyRow()]);
            }}
            placeholder={availableClasses.length === 0 ? 'Every class already scheduled' : 'Select…'}
            options={availableClasses.map((c) => ({ value: c.id, label: c.name }))}
          />
        )}

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
                  options={subjects
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
                      placeholder="e.g. 50"
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
        <Button label={submitting ? 'Adding…' : 'Add class'} onPress={handleSubmit} loading={submitting} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  heading: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
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
