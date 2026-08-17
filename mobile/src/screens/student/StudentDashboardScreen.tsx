import React, { useCallback, useState } from 'react';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { getStudentSummary, StudentSummary } from '../../api/dashboard';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataRowText } from '../../components/DataRow';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { ATTENDANCE_STATUS_META } from '../../constants';
import { colors, fonts, radius, spacing } from '../../theme';
import { formatDate, formatLongDate, greeting } from '../../utils/format';
import type { StudentTabsParamList } from '../../navigation/types';

type Props = BottomTabScreenProps<StudentTabsParamList, 'Dashboard'>;

export function StudentDashboardScreen({ navigation }: Props): React.JSX.Element {
  const { user } = useAuth();
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSummary(await getStudentSummary());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load dashboard');
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
  if (error || !summary) return <Screen><ErrorView message={error ?? 'No data'} onRetry={load} /></Screen>;

  const todayStatus = summary.myAttendanceToday
    ? ATTENDANCE_STATUS_META[summary.myAttendanceToday.status]
    : null;
  const presentPercent = summary.attendanceThisMonth.presentPercent;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View>
        <Text style={styles.greeting}>{greeting()}, {user?.name}</Text>
        <Text style={styles.date}>{formatLongDate()}</Text>
        <Text style={styles.subtext}>
          {summary.student.class.name} - {summary.student.section.name}
          {summary.student.admissionNo && ` · Admission No. ${summary.student.admissionNo}`}
        </Text>
      </View>

      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Today's attendance</Text>
          <Button label="View history" variant="secondary" onPress={() => navigation.navigate('Attendance')} />
        </View>
        {todayStatus ? (
          <Badge label={todayStatus.label} tone={todayStatus.tone} />
        ) : (
          <Text style={styles.muted}>Not marked yet today.</Text>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>This month's attendance</Text>
        {summary.attendanceThisMonth.totalMarked === 0 ? (
          <Text style={styles.muted}>No attendance marked yet this month.</Text>
        ) : (
          <>
            <Text style={styles.bigNumber}>{presentPercent ?? '—'}{presentPercent !== null ? '%' : ''} present</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${presentPercent ?? 0}%` }]} />
            </View>
            <Text style={styles.muted}>
              {summary.attendanceThisMonth.present} of {summary.attendanceThisMonth.totalMarked} days present
            </Text>
          </>
        )}
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Upcoming assignments</Text>
          <Button
            label="View all"
            variant="secondary"
            onPress={() => navigation.navigate('Assignments', { screen: 'AssignmentsList' })}
          />
        </View>
        {summary.upcomingAssignments.length === 0 ? (
          <Text style={styles.muted}>No upcoming assignments.</Text>
        ) : (
          summary.upcomingAssignments.map((a) => (
            <Card key={a.id} style={styles.recordCard}>
              <DataRowText label="Title" value={a.title} />
              <DataRowText label="Subject" value={a.subject.name} />
              <DataRowText label="Due date" value={formatDate(a.dueDate)} />
            </Card>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: 22, fontFamily: fonts.headingBold, color: colors.text },
  date: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
  subtext: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, marginTop: spacing.xs },
  card: { gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  bigNumber: { fontSize: 22, fontFamily: fonts.headingBold, color: colors.primary },
  progressTrack: { height: 8, borderRadius: radius.sm, backgroundColor: colors.surfaceHover, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.sm, backgroundColor: colors.primary },
  recordCard: { gap: 0, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.bg },
});
