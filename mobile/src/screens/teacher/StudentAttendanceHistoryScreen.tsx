import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { AttendanceRecord, getStudentAttendanceHistory } from '../../api/attendance';
import { ApiError } from '../../api/client';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateField } from '../../components/DateField';
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
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [history, setHistory] = useState<AttendanceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      setHistory(await getStudentAttendanceHistory(studentId, { from: from || undefined, to: to || undefined }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load attendance history');
    } finally {
      setLoading(false);
    }
  }, [studentId, from, to]);

  // load() depends on [studentId, from, to], so this re-fetches on first
  // focus, whenever the date range changes while focused, and on refocus.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const clearRange = () => {
    setFrom('');
    setTo('');
  };

  if (loading) return <LoadingView />;
  if (error && !history) return <Screen><ErrorView message={error} onRetry={load} /></Screen>;

  const presentCount = history?.filter((r) => r.status === 'PRESENT').length ?? 0;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View>
        <Text style={styles.heading}>{studentName}</Text>
        <Text style={styles.subtitle}>{admissionNo} · {className} - {sectionName}</Text>
      </View>

      <Card style={styles.filters}>
        <DateField label="From" value={from} onChange={setFrom} placeholder="All time" maximumDate={to ? new Date(`${to}T00:00:00`) : undefined} />
        <DateField label="To" value={to} onChange={setTo} placeholder="Today" minimumDate={from ? new Date(`${from}T00:00:00`) : undefined} />
        {(from || to) && <Button label="Clear range" variant="secondary" onPress={clearRange} />}
      </Card>

      {error && history && <Text style={styles.error}>{error}</Text>}

      {history && (
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryText}>
            {presentCount} of {history.length} days present{from || to ? ' in this range' : ''}
          </Text>
        </Card>
      )}

      <Text style={styles.sectionTitle}>History</Text>
      {!history || history.length === 0 ? (
        <Card><Text style={styles.muted}>No attendance recorded {from || to ? 'in this range' : 'yet'}.</Text></Card>
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
  filters: { gap: spacing.md },
  summaryCard: { alignItems: 'center' },
  summaryText: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.primary },
  sectionTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text, marginTop: spacing.sm },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  date: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
