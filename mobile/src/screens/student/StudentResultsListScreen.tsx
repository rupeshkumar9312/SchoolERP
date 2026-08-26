import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { EXAM_TYPE_LABELS, getMyExamResults, StudentExamResult } from '../../api/exams';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { colors, fonts, spacing } from '../../theme';

// Published exam results only — an unpublished schedule for the student's
// class never appears in the API response at all, so there's no "locked"
// state to render here.
export function StudentResultsListScreen(): React.JSX.Element {
  const [results, setResults] = useState<StudentExamResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      setResults(await getMyExamResults());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load results');
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
      <Text style={styles.heading}>My Results</Text>
      <Text style={styles.muted}>Published exam results for your class.</Text>

      {results && results.length === 0 && (
        <Card><Text style={styles.muted}>No results yet.</Text></Card>
      )}

      {results?.map((r) => (
        <View key={r.schedule.id} style={styles.group}>
          <View style={styles.groupHeaderRow}>
            <Text style={styles.groupTitle}>{r.exam.name}</Text>
            <Badge label={EXAM_TYPE_LABELS[r.exam.type]} tone="muted" />
          </View>

          {r.subjects.map((s) => (
            <Card key={s.subject.id} style={styles.card}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{s.subject.name}</Text>
                {s.passed !== null && (
                  <Badge label={s.passed ? 'Pass' : 'Fail'} tone={s.passed ? 'success' : 'danger'} />
                )}
              </View>
              <View style={styles.footerRow}>
                <Text style={styles.muted}>
                  {s.isAbsent
                    ? 'Absent'
                    : s.marksObtained !== null
                      ? `${s.marksObtained}/${s.maxMarks} marks`
                      : 'Not graded yet'}
                </Text>
                {s.percentage !== null && <Text style={styles.muted}>{s.percentage}%</Text>}
              </View>
            </Card>
          ))}

          <Text style={styles.summary}>
            {r.summary.totalObtained !== null
              ? `Total: ${r.summary.totalObtained}/${r.summary.totalMax} (${r.summary.percentage}%)${
                  r.summary.rank !== null ? ` · Rank: ${r.summary.rank} of ${r.summary.totalStudents}` : ''
                }`
              : 'Total pending — not every subject has been graded yet.'}
          </Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
  group: { marginTop: spacing.md },
  groupHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  groupTitle: { fontSize: 17, fontFamily: fonts.headingBold, color: colors.text },
  card: { gap: spacing.xs, marginTop: spacing.sm },
  summary: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  title: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.text },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
});
