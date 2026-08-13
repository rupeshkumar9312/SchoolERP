import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';
import { AdminSummary, getAdminSummary } from '../../api/dashboard';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataRowText } from '../../components/DataRow';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { colors, fonts, radius, spacing } from '../../theme';
import { formatLongDate, greeting } from '../../utils/format';
import type { AdminTabsParamList } from '../../navigation/types';

type Props = BottomTabScreenProps<AdminTabsParamList, 'Dashboard'>;

interface BreakdownProps {
  present: number;
  absent: number;
  late: number;
  leave: number;
  totalMarked: number;
  presentPercent: number | null;
}

function Breakdown({ present, absent, late, leave, totalMarked, presentPercent }: BreakdownProps): React.JSX.Element {
  if (totalMarked === 0) return <Text style={styles.muted}>No attendance marked yet today.</Text>;
  return (
    <View style={styles.breakdown}>
      <Text style={styles.bigNumber}>{presentPercent}% present</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${presentPercent ?? 0}%` }]} />
      </View>
      <View style={styles.chipRow}>
        <Text style={styles.chip}>{present} present</Text>
        <Text style={styles.chip}>{absent} absent</Text>
        <Text style={styles.chip}>{late} late</Text>
        <Text style={styles.chip}>{leave} leave</Text>
      </View>
    </View>
  );
}

export function AdminDashboardScreen({ navigation }: Props): React.JSX.Element {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSummary(await getAdminSummary());
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

  const { totals, studentAttendanceToday: sa, teacherAttendanceToday: ta } = summary;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View>
        <Text style={styles.greeting}>{greeting()}, {user?.name}</Text>
        <Text style={styles.date}>{formatLongDate()}</Text>
        <Text style={styles.subtext}>
          {summary.academicYear ? `Academic year: ${summary.academicYear.name}` : 'No academic year is marked current yet.'}
        </Text>
      </View>

      <Card style={styles.statsCard}>
        <DataRowText label="Students" value={String(totals.students)} />
        <DataRowText label="Teachers" value={String(totals.teachers)} />
        <DataRowText label="Classes" value={String(totals.classes)} />
        <DataRowText label="Sections" value={String(totals.sections)} />
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Student attendance today</Text>
          <Text style={styles.muted}>{sa.date}</Text>
        </View>
        <Breakdown {...sa} />
        <Text style={styles.muted}>
          {sa.sectionsMarked} of {sa.totalSections} section{sa.totalSections === 1 ? '' : 's'} have marked attendance today.
        </Text>
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Staff attendance today</Text>
          <Text style={styles.muted}>{ta.date}</Text>
        </View>
        <Breakdown {...ta} />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Quick links</Text>
        <View style={styles.linkRow}>
          <View style={styles.linkHalf}>
            <Button
              label="Attendance"
              variant="secondary"
              onPress={() => navigation.navigate('Attendance', { screen: 'AttendanceHome' })}
            />
          </View>
          <View style={styles.linkHalf}>
            <Button
              label="Staff attendance"
              variant="secondary"
              onPress={() => navigation.navigate('Attendance', { screen: 'StaffAttendance' })}
            />
          </View>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: 22, fontFamily: fonts.headingBold, color: colors.text },
  date: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
  subtext: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, marginTop: spacing.xs },
  statsCard: { gap: 0, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.bg },
  card: { gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  bigNumber: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.primary },
  breakdown: { gap: spacing.xs },
  progressTrack: { height: 8, borderRadius: radius.sm, backgroundColor: colors.surfaceHover, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.sm, backgroundColor: colors.primary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { fontSize: 12, fontFamily: fonts.bodySemiBold, color: colors.textMuted },
  linkRow: { flexDirection: 'row', gap: spacing.sm },
  linkHalf: { flex: 1 },
});
