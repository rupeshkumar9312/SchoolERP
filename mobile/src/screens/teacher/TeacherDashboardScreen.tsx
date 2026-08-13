import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { getTeacherSummary, TeacherSummary } from '../../api/dashboard';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataRow, DataRowText } from '../../components/DataRow';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { ATTENDANCE_STATUS_META } from '../../constants';
import { colors, fonts, radius, spacing } from '../../theme';
import { formatLongDate, greeting } from '../../utils/format';
import type { TeacherDashboardStackParamList, TeacherTabsParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TeacherDashboardStackParamList, 'DashboardHome'>;

export function TeacherDashboardScreen({ navigation }: Props): React.JSX.Element {
  const { user } = useAuth();
  const [summary, setSummary] = useState<TeacherSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSummary(await getTeacherSummary());
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

  const myStatus = summary.myAttendanceToday ? ATTENDANCE_STATUS_META[summary.myAttendanceToday.status] : null;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View>
        <Text style={styles.greeting}>{greeting()}, {user?.name}</Text>
        <Text style={styles.date}>{formatLongDate()}</Text>
      </View>

      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Your attendance today</Text>
          <Button
            label={myStatus ? 'View / update' : 'Mark now'}
            variant="secondary"
            onPress={() => navigation.navigate('MyAttendance')}
          />
        </View>
        {myStatus ? (
          <Badge label={myStatus.label} tone={myStatus.tone} />
        ) : (
          <Text style={styles.muted}>You haven't marked your attendance for today yet.</Text>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Your homeroom sections</Text>
        {summary.classTeacherOf.length === 0 ? (
          <Text style={styles.muted}>You're not the class teacher of any section yet.</Text>
        ) : (
          summary.classTeacherOf.map((c, i) => (
            <Card key={i} style={styles.recordCard}>
              <DataRowText label="Class" value={c.class.name} />
              <DataRowText label="Section" value={c.section.name} />
              <DataRow label="Attendance today">
                <Badge
                  label={c.attendanceMarkedToday ? 'Marked' : 'Not marked'}
                  tone={c.attendanceMarkedToday ? 'success' : 'danger'}
                />
              </DataRow>
              <DataRow label="Actions">
                <Button
                  label="Mark attendance"
                  variant="secondary"
                  onPress={() =>
                    navigation
                      .getParent<BottomTabNavigationProp<TeacherTabsParamList>>()
                      ?.navigate('Classes', {
                        screen: 'MarkAttendance',
                        params: {
                          classId: c.class.id,
                          sectionId: c.section.id,
                          className: c.class.name,
                          sectionName: c.section.name,
                        },
                      })
                  }
                />
              </DataRow>
            </Card>
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Your classes</Text>
        {summary.classes.length === 0 ? (
          <Text style={styles.muted}>No classes assigned yet.</Text>
        ) : (
          summary.classes.map((c, i) => (
            <Card key={i} style={styles.recordCard}>
              <DataRowText label="Class" value={c.class.name} />
              <DataRowText label="Section" value={c.section.name} />
              <DataRowText label="Subject" value={c.subject?.name ?? '—'} />
              <DataRow label="Class teacher?">
                {c.isClassTeacher ? <Badge label="Yes" tone="success" /> : <Text style={styles.muted}>—</Text>}
              </DataRow>
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
  card: { gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  recordCard: {
    gap: 0,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
});
