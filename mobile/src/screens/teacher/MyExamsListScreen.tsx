import React, { useCallback, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { EXAM_TYPE_LABELS, listMyExams, TeacherExamEntry } from '../../api/exams';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { Touchable } from '../../components/Touchable';
import { colors, fonts, radius, spacing } from '../../theme';
import type { TeacherExamsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TeacherExamsStackParamList, 'ExamsList'>;

function entryKey(e: TeacherExamEntry): string {
  return `${e.schedule.id}-${e.examSubject.id}-${e.section.id}`;
}

interface ExamGroup {
  exam: TeacherExamEntry['exam'];
  entries: TeacherExamEntry[];
}

// Grouped by the Exam umbrella (e.g. "Unit Test 1") rather than one flat
// card per class+section+subject — the umbrella shows once, with every
// class/section/subject the teacher teaches under it nested beneath.
function groupByExam(entries: TeacherExamEntry[]): ExamGroup[] {
  const groups = new Map<number, ExamGroup>();
  for (const entry of entries) {
    const existing = groups.get(entry.exam.id);
    if (existing) {
      existing.entries.push(entry);
    } else {
      groups.set(entry.exam.id, { exam: entry.exam, entries: [entry] });
    }
  }
  return [...groups.values()];
}

export function MyExamsListScreen({ navigation }: Props): React.JSX.Element {
  const [entries, setEntries] = useState<TeacherExamEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      setEntries(await listMyExams());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load exams');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) return <LoadingView />;
  if (error) return <Screen><ErrorView message={error} onRetry={load} /></Screen>;

  const groups = entries ? groupByExam(entries) : [];

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>My Exams</Text>
        <Button label="+ New class test" onPress={() => navigation.navigate('NewClassTest')} />
      </View>
      <Text style={styles.muted}>Exams for the subjects and sections you teach.</Text>

      {entries && groups.length === 0 && (
        <Card><Text style={styles.muted}>No exams yet.</Text></Card>
      )}

      {groups.map((group) => (
        <View key={group.exam.id} style={styles.group}>
          <View style={styles.groupHeaderRow}>
            <Text style={styles.groupTitle}>{group.exam.name}</Text>
            <Badge label={EXAM_TYPE_LABELS[group.exam.type]} tone="muted" />
          </View>

          {group.entries.map((e) => (
            <Touchable
              key={entryKey(e)}
              onPress={() => navigation.navigate('MarksEntry', { entry: e })}
              style={styles.touchable}
            >
              <Card style={styles.card}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>
                    {e.class.name} - {e.section.name} · {e.examSubject.subjectName}
                  </Text>
                  <Badge
                    label={e.schedule.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                    tone={e.schedule.status === 'PUBLISHED' ? 'success' : 'muted'}
                  />
                </View>
                <View style={styles.footerRow}>
                  <Text style={styles.muted}>Max marks {e.examSubject.maxMarks}</Text>
                  <Badge label={`${e.enteredCount}/${e.totalStudents} entered`} tone="primary" />
                </View>
              </Card>
            </Touchable>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
  group: { marginTop: spacing.md },
  groupHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  groupTitle: { fontSize: 17, fontFamily: fonts.headingBold, color: colors.text },
  touchable: { borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.sm },
  card: { gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  title: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.text, flexShrink: 1 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
});
