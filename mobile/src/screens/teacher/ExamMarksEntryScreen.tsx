import React, { useCallback, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../../api/client';
import { ExamMarkRosterRow, getExamMarksRoster, saveExamMarks } from '../../api/exams';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { Touchable } from '../../components/Touchable';
import { colors, fonts, radius, spacing } from '../../theme';
import type { TeacherExamsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TeacherExamsStackParamList, 'MarksEntry'>;

interface Draft {
  marks: string;
  absent: boolean;
}

export function ExamMarksEntryScreen({ route }: Props): React.JSX.Element {
  const { entry } = route.params;
  const { exam, class: klass, section, examSubject } = entry;

  const [roster, setRoster] = useState<ExamMarkRosterRow[] | null>(null);
  // Partial — a student only gets a draft entry once touched, either from an
  // already-saved mark or an explicit edit. No default value.
  const [drafts, setDrafts] = useState<Partial<Record<number, Draft>>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await getExamMarksRoster(exam.id, examSubject.subjectId, section.id);
      setRoster(rows);
      const initial: Partial<Record<number, Draft>> = {};
      for (const row of rows) {
        if (row.marksObtained !== null || row.isAbsent) {
          initial[row.student.id] = {
            marks: row.marksObtained !== null ? String(row.marksObtained) : '',
            absent: row.isAbsent,
          };
        }
      }
      setDrafts(initial);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load roster');
    } finally {
      setLoading(false);
    }
  }, [exam.id, examSubject.subjectId, section.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const setDraft = (studentId: number, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: { marks: prev[studentId]?.marks ?? '', absent: prev[studentId]?.absent ?? false, ...patch },
    }));
  };

  const touchedCount = roster?.filter((r) => {
    const d = drafts[r.student.id];
    return d && (d.absent || d.marks !== '');
  }).length ?? 0;

  const handleSubmit = async () => {
    if (!roster) return;
    setSaveError(null);
    setSavedAt(null);
    setSaving(true);
    try {
      const records = roster
        .filter((r) => {
          const d = drafts[r.student.id];
          return d && (d.absent || d.marks !== '');
        })
        .map((r) => {
          const d = drafts[r.student.id]!;
          return {
            studentId: r.student.id,
            isAbsent: d.absent,
            marksObtained: d.absent ? undefined : Number(d.marks),
          };
        });
      await saveExamMarks(exam.id, { subjectId: examSubject.subjectId, sectionId: section.id, records });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Could not save marks');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingView />;
  if (error) return <Screen><ErrorView message={error} onRetry={load} /></Screen>;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View>
        <Text style={styles.heading}>{exam.name}</Text>
        <Text style={styles.subtitle}>
          {klass.name} - {section.name} · {examSubject.subjectName}
        </Text>
        <Text style={styles.muted}>Max marks {examSubject.maxMarks}</Text>
      </View>

      {saveError && <Text style={styles.error}>{saveError}</Text>}
      {savedAt && <Text style={styles.success}>Marks saved at {savedAt}.</Text>}

      {roster && roster.length === 0 ? (
        <Card><Text style={styles.muted}>No students in this class and section.</Text></Card>
      ) : (
        <>
          <Text style={styles.cardTitle}>Roster ({roster?.length ?? 0})</Text>

          {roster?.map((r) => {
            const d = drafts[r.student.id];
            return (
              <Card key={r.student.id} style={styles.studentCard}>
                <View style={styles.studentInfo}>
                  <Text style={styles.name}>{r.student.name}</Text>
                  <Text style={styles.muted}>{r.student.admissionNo ?? '—'}</Text>
                </View>
                <View style={styles.entryRow}>
                  <TextInput
                    style={[styles.input, d?.absent && styles.inputDisabled]}
                    keyboardType="number-pad"
                    placeholder="Marks"
                    placeholderTextColor={colors.textMuted}
                    editable={!d?.absent}
                    value={d?.marks ?? ''}
                    onChangeText={(text) => setDraft(r.student.id, { marks: text.replace(/[^0-9]/g, '') })}
                  />
                  <Touchable
                    onPress={() => setDraft(r.student.id, { absent: !d?.absent })}
                    style={[styles.absentChip, d?.absent && styles.absentChipActive]}
                  >
                    <Text style={[styles.absentChipText, d?.absent && styles.absentChipTextActive]}>Absent</Text>
                  </Touchable>
                </View>
              </Card>
            );
          })}

          <Text style={styles.muted}>{touchedCount} of {roster?.length ?? 0} entered</Text>
          <Button label="Save marks" onPress={handleSubmit} loading={saving} disabled={touchedCount === 0} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  subtitle: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.text, marginTop: 2 },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
  cardTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text, marginTop: spacing.sm },
  studentCard: { gap: spacing.sm },
  studentInfo: { gap: 2 },
  name: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.text },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputDisabled: { backgroundColor: colors.surfaceHover, color: colors.textMuted },
  absentChip: {
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceHover,
  },
  absentChipActive: { backgroundColor: colors.dangerTint },
  absentChipText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.textMuted },
  absentChipTextActive: { color: colors.danger },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  success: { color: colors.success, fontSize: 13, fontFamily: fonts.body },
});
