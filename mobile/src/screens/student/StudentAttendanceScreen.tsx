import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { listMyAttendance, AttendanceRecord } from '../../api/attendance';
import { ApiError } from '../../api/client';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { ATTENDANCE_STATUS_META } from '../../constants';
import { colors, fonts, spacing } from '../../theme';
import { formatDate } from '../../utils/format';

export function StudentAttendanceScreen(): React.JSX.Element {
  const [records, setRecords] = useState<AttendanceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listMyAttendance();
      data.sort((a, b) => b.date.localeCompare(a.date));
      setRecords(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load attendance');
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
      <View>
        <Text style={styles.heading}>My Attendance</Text>
        <Text style={styles.subtitle}>Your attendance history, most recent first.</Text>
      </View>

      {records && records.length === 0 && (
        <Card><Text style={styles.muted}>No attendance records yet.</Text></Card>
      )}
      {records?.map((r) => {
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
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  subtitle: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.text },
});
