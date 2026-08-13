import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { AttendanceRecord, getStudentAttendanceHistory } from '../../api/attendance';
import { ApiError } from '../../api/client';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { ATTENDANCE_STATUS_META } from '../../constants';
import { colors, fonts, spacing } from '../../theme';
import { formatDate } from '../../utils/format';
import type { StudentRef } from '../../navigation/types';

// Deliberately not typed against a specific stack's ParamList — this screen
// is pushed from both TeacherClassesStackParamList and
// AdminAttendanceStackParamList, and only ever reads route.params.
interface Props {
  route: { params: StudentRef };
}

export function StudentAttendanceHistoryScreen({ route }: Props): React.JSX.Element {
  const { studentId, studentName, admissionNo, className, sectionName } = route.params;
  const [history, setHistory] = useState<AttendanceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      setHistory(await getStudentAttendanceHistory(studentId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load attendance history');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) return <LoadingView />;
  if (error || !history) return <Screen><ErrorView message={error ?? 'No data'} onRetry={load} /></Screen>;

  const presentCount = history.filter((r) => r.status === 'PRESENT').length;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View>
        <Text style={styles.heading}>{studentName}</Text>
        <Text style={styles.subtitle}>{admissionNo} · {className} - {sectionName}</Text>
      </View>

      <Card style={styles.summaryCard}>
        <Text style={styles.summaryText}>
          {presentCount} of {history.length} days present
        </Text>
      </Card>

      <Text style={styles.sectionTitle}>History</Text>
      {history.length === 0 ? (
        <Card><Text style={styles.muted}>No attendance recorded yet.</Text></Card>
      ) : (
        history.map((r) => {
          const meta = ATTENDANCE_STATUS_META[r.status];
          return (
            <Card key={r.id} style={styles.row}>
              <View>
                <Text style={styles.date}>{formatDate(r.date)}</Text>
                <Text style={styles.muted}>Marked by {r.markedBy.name}</Text>
              </View>
              <Badge label={meta.label} tone={meta.tone} />
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  subtitle: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
  summaryCard: { alignItems: 'center' },
  summaryText: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.primary },
  sectionTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text, marginTop: spacing.sm },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  date: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
