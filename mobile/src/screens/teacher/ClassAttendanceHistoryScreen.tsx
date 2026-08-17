import React, { useCallback, useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { AttendanceRecord, listAttendanceHistory } from '../../api/attendance';
import { ApiError } from '../../api/client';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { DateField } from '../../components/DateField';
import { ATTENDANCE_STATUS_META } from '../../constants';
import { colors, fonts, spacing } from '../../theme';
import { formatDate, shiftIsoDate, todayIsoDate } from '../../utils/format';
import type { TeacherClassesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TeacherClassesStackParamList, 'ClassAttendanceHistory'>;

export function ClassAttendanceHistoryScreen({ route }: Props): React.JSX.Element {
  const { classId, sectionId, className, sectionName } = route.params;
  const [from, setFrom] = useState(shiftIsoDate(todayIsoDate(), -7));
  const [to, setTo] = useState(todayIsoDate());
  const [history, setHistory] = useState<AttendanceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      setHistory(await listAttendanceHistory({ classId, sectionId, from: from || undefined, to: to || undefined }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load attendance history');
    } finally {
      setLoading(false);
    }
  }, [classId, sectionId, from, to]);

  // load() depends on [classId, sectionId, from, to], so this re-fetches on
  // first focus, whenever the date range changes while focused, and on refocus.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const groupedByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    for (const r of history ?? []) {
      if (!map.has(r.date)) map.set(r.date, []);
      map.get(r.date)!.push(r);
    }
    return [...map.entries()];
  }, [history]);

  const showAllTime = () => {
    setFrom('');
    setTo('');
  };

  if (loading) return <LoadingView />;
  if (error && !history) return <Screen><ErrorView message={error} onRetry={load} /></Screen>;

  const presentCount = history?.filter((r) => r.status === 'PRESENT').length ?? 0;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View>
        <Text style={styles.heading}>Attendance history</Text>
        <Text style={styles.subtitle}>{className} - {sectionName}</Text>
      </View>

      <Card style={styles.filters}>
        <DateField label="From" value={from} onChange={setFrom} placeholder="All time" maximumDate={to ? new Date(`${to}T00:00:00`) : undefined} />
        <DateField label="To" value={to} onChange={setTo} placeholder="Today" minimumDate={from ? new Date(`${from}T00:00:00`) : undefined} />
        {(from || to) && <Button label="Show all time" variant="secondary" onPress={showAllTime} />}
      </Card>

      {error && history && <Text style={styles.error}>{error}</Text>}

      {history && (
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryText}>
            {presentCount} of {history.length} records present · {groupedByDate.length} day{groupedByDate.length === 1 ? '' : 's'}
          </Text>
        </Card>
      )}

      {!history || history.length === 0 ? (
        <Card><Text style={styles.muted}>No attendance recorded {from || to ? 'in this range' : 'yet'}.</Text></Card>
      ) : (
        groupedByDate.map(([date, records]) => (
          <View key={date}>
            <Text style={styles.dateHeading}>{formatDate(date)}</Text>
            <Card style={styles.dayCard}>
              {records.map((r) => {
                const meta = ATTENDANCE_STATUS_META[r.status];
                return (
                  <View key={r.id} style={styles.studentRow}>
                    <View>
                      <Text style={styles.studentName}>{r.student.name}</Text>
                      <Text style={styles.muted}>{r.student.admissionNo ?? '—'}</Text>
                    </View>
                    <Badge label={meta.label} tone={meta.tone} />
                  </View>
                );
              })}
            </Card>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  subtitle: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.text, marginTop: 2 },
  filters: { gap: spacing.md },
  summaryCard: { alignItems: 'center' },
  summaryText: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.primary },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  dateHeading: { fontSize: 14, fontFamily: fonts.headingBold, color: colors.text, marginTop: spacing.xs, marginBottom: spacing.xs },
  dayCard: { gap: spacing.sm },
  studentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  studentName: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.text },
});
