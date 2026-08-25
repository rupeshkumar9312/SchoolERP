import React, { useCallback, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { EXAM_TYPE_LABELS, listMyExams, TeacherExamEntry } from '../../api/exams';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { Touchable } from '../../components/Touchable';
import { colors, fonts, radius, spacing } from '../../theme';
import type { TeacherExamsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TeacherExamsStackParamList, 'ExamsList'>;

function entryKey(e: TeacherExamEntry): string {
  return `${e.exam.id}-${e.examSubject.id}-${e.section.id}`;
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

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <Text style={styles.heading}>My Exams</Text>
      <Text style={styles.muted}>Exams for the subjects and sections you teach.</Text>

      {entries && entries.length === 0 && (
        <Card><Text style={styles.muted}>No exams yet.</Text></Card>
      )}
      {entries?.map((e) => (
        <Touchable
          key={entryKey(e)}
          onPress={() => navigation.navigate('MarksEntry', { entry: e })}
          style={styles.touchable}
        >
          <Card style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{e.exam.name}</Text>
              <Badge label={e.exam.status === 'PUBLISHED' ? 'Published' : 'Draft'} tone={e.exam.status === 'PUBLISHED' ? 'success' : 'muted'} />
            </View>
            <Text style={styles.muted}>
              {EXAM_TYPE_LABELS[e.exam.type]} · {e.class.name} - {e.section.name} · {e.examSubject.subjectName}
            </Text>
            <View style={styles.footerRow}>
              <Text style={styles.muted}>Max marks {e.examSubject.maxMarks}</Text>
              <Badge label={`${e.enteredCount}/${e.totalStudents} entered`} tone="primary" />
            </View>
          </Card>
        </Touchable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
  touchable: { borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.sm },
  card: { gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  title: { fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
});
