import React, { useCallback, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { EXAM_TYPE_LABELS, ScheduleReportCard, getExamReportCard } from '../../api/exams';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { colors, fonts, spacing } from '../../theme';
import type { ManageStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ManageStackParamList, 'ExamReportCard'>;

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

// Full class's cross-subject standing for one schedule — every active
// student, sorted by rank. A student's total/rank stays blank until every
// subject on the schedule has a recorded mark for them.
export function ExamReportCardScreen({ route, navigation }: Props): React.JSX.Element {
  const { examId, scheduleId } = route.params;

  const [report, setReport] = useState<ScheduleReportCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getExamReportCard(examId, scheduleId);
      setReport(data);
      navigation.setOptions({ title: `${data.exam.name} — Report Card` });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load report card');
    } finally {
      setLoading(false);
    }
  }, [examId, scheduleId, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) return <LoadingView />;
  if (error) return <Screen><ErrorView message={error} onRetry={load} /></Screen>;
  if (!report) return <Screen><Text style={styles.muted}>Report card not found.</Text></Screen>;

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{report.exam.name}</Text>
        <Badge label={report.schedule.status === 'PUBLISHED' ? 'Published' : 'Draft'} tone={report.schedule.status === 'PUBLISHED' ? 'success' : 'muted'} />
      </View>
      <Text style={styles.subtitle}>
        {EXAM_TYPE_LABELS[report.exam.type]} · {report.schedule.class.name} · {toDateInputValue(report.schedule.startDate)} –{' '}
        {toDateInputValue(report.schedule.endDate)}
      </Text>

      {report.rows.map((row) => (
        <Card key={row.student.id} style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>{row.total.rank ?? '—'}</Text>
            </View>
            <View style={styles.studentInfo}>
              <Text style={styles.name}>{row.student.name}</Text>
              <Text style={styles.muted}>
                {row.section.name} · {row.student.admissionNo ?? 'No admission no.'}
              </Text>
            </View>
          </View>

          <View style={styles.subjectsWrap}>
            {row.subjects.map((cell) => {
              const column = report.subjects.find((s) => s.examSubjectId === cell.examSubjectId);
              return (
                <View key={cell.examSubjectId} style={styles.subjectChip}>
                  <Text style={styles.subjectChipLabel}>{column?.subject.name}</Text>
                  <Text style={styles.subjectChipValue}>
                    {cell.isAbsent ? 'Absent' : cell.marksObtained !== null ? cell.marksObtained : '—'}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              Total: {row.total.totalObtained !== null ? `${row.total.totalObtained}/${row.total.totalMax}` : '—'}
            </Text>
            <Text style={styles.totalLabel}>{row.total.percentage !== null ? `${row.total.percentage}%` : '—'}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text, flexShrink: 1 },
  subtitle: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  card: { gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: 14, fontFamily: fonts.headingBold, color: colors.primary },
  studentInfo: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.text },
  subjectsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  subjectChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  subjectChipLabel: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
  subjectChipValue: { fontSize: 12, fontFamily: fonts.bodySemiBold, color: colors.text },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text },
});
