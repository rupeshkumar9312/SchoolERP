import React, { useCallback, useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import * as academic from '../../api/academic';
import { ApiError } from '../../api/client';
import {
  Exam,
  ExamSchedule,
  ExamSubjectProgress,
  addExamSubject,
  getExam,
  getExamProgress,
  publishExamSchedule,
  removeExamSubject,
  unpublishExamSchedule,
  updateExamSchedule,
  updateExamSubject,
} from '../../api/exams';
import { useAuth } from '../../auth/AuthContext';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateField } from '../../components/DateField';
import { ErrorView } from '../../components/ErrorView';
import { IconButton } from '../../components/IconButton';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { colors, fonts, radius, spacing } from '../../theme';
import type { ManageStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ManageStackParamList, 'ExamScheduleDetail'>;

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

// One class's sitting of an Exam — its own dates and subject list, fully
// independent of every other class scheduled under the same exam.
export function ExamScheduleDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { examId, scheduleId } = route.params;
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('exam.edit');
  const canPublish = hasPermission('exam.marks.publish');

  const [exam, setExam] = useState<Exam | null>(null);
  const [schedule, setSchedule] = useState<ExamSchedule | null>(null);
  const [progress, setProgress] = useState<ExamSubjectProgress[]>([]);
  const [subjects, setSubjects] = useState<academic.Subject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingDates, setEditingDates] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [savingDates, setSavingDates] = useState(false);
  const [togglingPublish, setTogglingPublish] = useState(false);

  const [newSubjectId, setNewSubjectId] = useState<number | null>(null);
  const [newMaxMarks, setNewMaxMarks] = useState('');
  const [newPassMarks, setNewPassMarks] = useState('');
  const [addingSubject, setAddingSubject] = useState(false);

  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [rowMaxMarks, setRowMaxMarks] = useState('');
  const [rowPassMarks, setRowPassMarks] = useState('');
  const [savingRowId, setSavingRowId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const row = await getExam(examId);
      setExam(row);
      navigation.setOptions({ title: `${row.name} · ${row.schedules.find((s) => s.id === scheduleId)?.class.name ?? ''}` });
      const sch = row.schedules.find((s) => s.id === scheduleId) ?? null;
      setSchedule(sch);
      if (sch) {
        setStartDate(toDateInputValue(sch.startDate));
        setEndDate(toDateInputValue(sch.endDate));
        const [subjectRows, progressRows] = await Promise.all([
          academic.listSubjects(sch.class.id),
          getExamProgress(examId, scheduleId),
        ]);
        setSubjects(subjectRows);
        setProgress(progressRows);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load schedule');
    } finally {
      setLoading(false);
    }
  }, [examId, scheduleId, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const applyUpdatedExam = (updated: Exam) => {
    setExam(updated);
    setSchedule(updated.schedules.find((s) => s.id === scheduleId) ?? null);
  };

  const onSaveDates = async () => {
    setSavingDates(true);
    setError(null);
    try {
      const updated = await updateExamSchedule(examId, scheduleId, { startDate, endDate });
      applyUpdatedExam(updated);
      setEditingDates(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update dates');
    } finally {
      setSavingDates(false);
    }
  };

  const onTogglePublish = () => {
    if (!schedule) return;
    const publishing = schedule.status !== 'PUBLISHED';
    const doToggle = async () => {
      setTogglingPublish(true);
      setError(null);
      try {
        const updated = publishing
          ? await publishExamSchedule(examId, scheduleId)
          : await unpublishExamSchedule(examId, scheduleId);
        applyUpdatedExam(updated);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not update publish status');
      } finally {
        setTogglingPublish(false);
      }
    };

    if (publishing) {
      Alert.alert(
        "Publish this class's marks?",
        "Students in this class will immediately be able to see every subject's marks entered so far.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Publish', onPress: () => void doToggle() },
        ],
      );
    } else {
      void doToggle();
    }
  };

  const availableSubjects = schedule
    ? subjects.filter((s) => !schedule.subjects.some((es) => es.subject.id === s.id))
    : [];

  const onAddSubject = async () => {
    if (newSubjectId === null || !newMaxMarks) return;
    setAddingSubject(true);
    setError(null);
    try {
      const updated = await addExamSubject(examId, scheduleId, {
        subjectId: newSubjectId,
        maxMarks: Number(newMaxMarks),
        passMarks: newPassMarks ? Number(newPassMarks) : undefined,
      });
      applyUpdatedExam(updated);
      setProgress(await getExamProgress(examId, scheduleId));
      setNewSubjectId(null);
      setNewMaxMarks('');
      setNewPassMarks('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add subject');
    } finally {
      setAddingSubject(false);
    }
  };

  const startEditRow = (row: ExamSchedule['subjects'][number]) => {
    setEditingRowId(row.id);
    setRowMaxMarks(String(row.maxMarks));
    setRowPassMarks(row.passMarks !== null ? String(row.passMarks) : '');
  };

  const onSaveRow = async (rowId: number) => {
    setSavingRowId(rowId);
    setError(null);
    try {
      const updated = await updateExamSubject(examId, scheduleId, rowId, {
        maxMarks: rowMaxMarks ? Number(rowMaxMarks) : undefined,
        passMarks: rowPassMarks ? Number(rowPassMarks) : undefined,
      });
      applyUpdatedExam(updated);
      setEditingRowId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update subject');
    } finally {
      setSavingRowId(null);
    }
  };

  const onRemoveRow = (row: ExamSchedule['subjects'][number]) => {
    Alert.alert('Remove subject', `Remove ${row.subject.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setError(null);
          try {
            const updated = await removeExamSubject(examId, scheduleId, row.id);
            applyUpdatedExam(updated);
            setProgress(await getExamProgress(examId, scheduleId));
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not remove subject');
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingView />;
  if (error && !schedule) return <Screen><ErrorView message={error} onRetry={load} /></Screen>;
  if (!exam || !schedule) return <Screen><Text style={styles.muted}>Schedule not found.</Text></Screen>;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>
          {exam.name} · {schedule.class.name}
        </Text>
        <Badge label={schedule.status === 'PUBLISHED' ? 'Published' : 'Draft'} tone={schedule.status === 'PUBLISHED' ? 'success' : 'muted'} />
      </View>
      <Text style={styles.subtitle}>
        {schedule.academicYear.name}
        {schedule.createdBy ? ` · Added by ${schedule.createdBy.name}` : ''}
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actionsRow}>
        {canPublish && (
          <View style={styles.actionHalf}>
            <Button
              label={schedule.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
              variant={schedule.status === 'PUBLISHED' ? 'secondary' : 'primary'}
              onPress={onTogglePublish}
              loading={togglingPublish}
            />
          </View>
        )}
        <View style={styles.actionHalf}>
          <Button
            label="Report card"
            variant="secondary"
            onPress={() => navigation.navigate('ExamReportCard', { examId, scheduleId })}
          />
        </View>
      </View>

      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Dates</Text>
          {canEdit && !editingDates && (
            <IconButton name="create-outline" variant="compact" onPress={() => setEditingDates(true)} />
          )}
        </View>

        {editingDates ? (
          <>
            <DateField label="Start date" value={startDate} onChange={setStartDate} />
            <DateField label="End date" value={endDate} onChange={setEndDate} minimumDate={startDate ? new Date(`${startDate}T00:00:00`) : undefined} />
            <View style={styles.actionsRow}>
              <View style={styles.actionHalf}>
                <Button label="Save" onPress={onSaveDates} loading={savingDates} />
              </View>
              <View style={styles.actionHalf}>
                <Button label="Cancel" variant="secondary" onPress={() => setEditingDates(false)} />
              </View>
            </View>
          </>
        ) : (
          <Text style={styles.muted}>
            {startDate} – {endDate}
          </Text>
        )}
      </Card>

      <Text style={styles.sectionTitle}>Subjects</Text>

      {schedule.subjects.length === 0 && (
        <Card><Text style={styles.muted}>No subjects yet.</Text></Card>
      )}

      {schedule.subjects.map((row) => {
        const p = progress.find((x) => x.examSubjectId === row.id);
        const isEditingRow = editingRowId === row.id;
        return (
          <Card key={row.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{row.subject.name}</Text>
              <Text style={styles.muted}>{p ? `${p.enteredCount}/${p.totalStudents} entered` : ''}</Text>
            </View>

            {isEditingRow ? (
              <>
                <View style={styles.rowFields}>
                  <View style={styles.rowFieldHalf}>
                    <Text style={styles.label}>Max marks</Text>
                    <TextInput
                      style={styles.input}
                      value={rowMaxMarks}
                      onChangeText={(v) => setRowMaxMarks(v.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.rowFieldHalf}>
                    <Text style={styles.label}>Pass marks</Text>
                    <TextInput
                      style={styles.input}
                      value={rowPassMarks}
                      onChangeText={(v) => setRowPassMarks(v.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
                <View style={styles.actionsRow}>
                  <View style={styles.actionHalf}>
                    <Button label="Save" onPress={() => onSaveRow(row.id)} loading={savingRowId === row.id} />
                  </View>
                  <View style={styles.actionHalf}>
                    <Button label="Cancel" variant="secondary" onPress={() => setEditingRowId(null)} />
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.muted}>
                  Max {row.maxMarks}
                  {row.passMarks !== null ? ` · Pass ${row.passMarks}` : ''}
                </Text>
                {canEdit && (
                  <View style={styles.iconRow}>
                    <IconButton name="create-outline" variant="compact" onPress={() => startEditRow(row)} />
                    <IconButton name="trash-outline" variant="compact" color={colors.danger} onPress={() => onRemoveRow(row)} />
                  </View>
                )}
              </>
            )}
          </Card>
        );
      })}

      {canEdit && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Add subject</Text>
          {availableSubjects.length === 0 ? (
            <Text style={styles.muted}>Every subject for this class is already added.</Text>
          ) : (
            <>
              <SelectField
                label="Subject"
                value={newSubjectId}
                onChange={setNewSubjectId}
                placeholder="Select subject…"
                options={availableSubjects.map((s) => ({ value: s.id, label: s.name }))}
              />
              <View style={styles.rowFields}>
                <View style={styles.rowFieldHalf}>
                  <Text style={styles.label}>Max marks</Text>
                  <TextInput
                    style={styles.input}
                    value={newMaxMarks}
                    onChangeText={(v) => setNewMaxMarks(v.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    placeholder="e.g. 50"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={styles.rowFieldHalf}>
                  <Text style={styles.label}>Pass marks</Text>
                  <TextInput
                    style={styles.input}
                    value={newPassMarks}
                    onChangeText={(v) => setNewPassMarks(v.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    placeholder="Optional"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
              <Button label="+ Add subject" onPress={onAddSubject} loading={addingSubject} disabled={newSubjectId === null || !newMaxMarks} />
            </>
          )}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heading: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text, flexShrink: 1 },
  subtitle: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  sectionTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text, marginTop: spacing.xs },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  card: { gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.text, flexShrink: 1 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  actionHalf: { flex: 1 },
  iconRow: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'flex-end' },
  rowFields: { flexDirection: 'row', gap: spacing.sm },
  rowFieldHalf: { flex: 1 },
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
});
