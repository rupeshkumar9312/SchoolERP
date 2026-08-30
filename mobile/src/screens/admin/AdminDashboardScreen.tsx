import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';
import { AdminSummary, getAdminSummary } from '../../api/dashboard';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { ATTENDANCE_STATUS_META } from '../../constants';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ClassBarChart } from '../../components/ClassBarChart';
import { DateField } from '../../components/DateField';
import { DonutChart } from '../../components/DonutChart';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { StatTile } from '../../components/StatTile';
import { AttendanceTrendChart } from '../../components/TrendChart';
import { colors, fonts, radius, spacing } from '../../theme';
import { formatLongDate, greeting, shiftIsoDate, todayIsoDate } from '../../utils/format';
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

const STATUS_ORDER: Array<{ key: 'present' | 'absent' | 'late' | 'leave'; status: keyof typeof ATTENDANCE_STATUS_META }> = [
  { key: 'present', status: 'PRESENT' },
  { key: 'absent', status: 'ABSENT' },
  { key: 'late', status: 'LATE' },
  { key: 'leave', status: 'LEAVE' },
];

/** A donut for the Present/Absent/Late/Leave composition, plus a legend row
 * beneath it — the legend is not optional decoration: these four status
 * colors sit close together for some forms of color vision, so identity
 * must never rely on the ring alone (see dataviz skill's status-color rule). */
function AttendanceChart(props: BreakdownProps): React.JSX.Element {
  const { present, absent, late, leave, totalMarked, presentPercent } = props;
  if (totalMarked === 0) return <Text style={styles.muted}>No attendance marked yet today.</Text>;

  const counts = { present, absent, late, leave };
  return (
    <View style={styles.chartRow}>
      <DonutChart
        segments={STATUS_ORDER.map(({ key, status }) => ({
          value: counts[key],
          color: colors[ATTENDANCE_STATUS_META[status].tone],
        }))}
        centerLabel={`${presentPercent ?? 0}%`}
        centerSubLabel="present"
      />
      <View style={styles.legend}>
        {STATUS_ORDER.map(({ key, status }) => {
          const meta = ATTENDANCE_STATUS_META[status];
          return (
            <View key={key} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: colors[meta.tone] }]} />
              <Text style={styles.legendLabel}>{meta.label}</Text>
              <Text style={styles.legendValue}>{counts[key]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const TODAY_ISO = todayIsoDate();

export function AdminDashboardScreen({ navigation }: Props): React.JSX.Element {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendFrom, setTrendFrom] = useState(() => shiftIsoDate(TODAY_ISO, -13));
  const [trendTo, setTrendTo] = useState(TODAY_ISO);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSummary(await getAdminSummary(trendFrom, trendTo));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load dashboard');
    } finally {
      setLoading(false);
    }
  }, [trendFrom, trendTo]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // A trend-range change while the screen is already focused (picking a
  // date doesn't blur/refocus the tab) needs its own trigger — focus alone
  // wouldn't fire again. Skips its first run since useFocusEffect above
  // already covers the initial load.
  const didMountTrendEffect = useRef(false);
  useEffect(() => {
    if (!didMountTrendEffect.current) {
      didMountTrendEffect.current = true;
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendFrom, trendTo]);

  if (loading) return <LoadingView />;
  if (error || !summary) return <Screen><ErrorView message={error ?? 'No data'} onRetry={load} /></Screen>;

  const { totals, studentAttendanceToday: sa, teacherAttendanceToday: ta } = summary;
  const sectionsMarkedPercent = sa.totalSections > 0 ? Math.round((sa.sectionsMarked / sa.totalSections) * 100) : 0;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View>
        <Text style={styles.greeting}>{greeting()}, {user?.name}</Text>
        <Text style={styles.date}>{formatLongDate()}</Text>
        <Text style={styles.subtext}>
          {summary.academicYear ? `Academic year: ${summary.academicYear.name}` : 'No academic year is marked current yet.'}
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <StatTile icon="people-outline" value={totals.students} label="Students" tint={colors.primary} tintBg={colors.primaryTint} />
        <StatTile icon="person-outline" value={totals.teachers} label="Teachers" tint={colors.primary} tintBg={colors.primaryTint} />
        <StatTile icon="book-outline" value={totals.classes} label="Classes" tint={colors.primary} tintBg={colors.primaryTint} />
        <StatTile icon="layers-outline" value={totals.sections} label="Sections" tint={colors.primary} tintBg={colors.primaryTint} />
      </View>

      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Attendance trend</Text>
        </View>
        <View style={styles.trendRangeRow}>
          <View style={styles.trendRangeField}>
            <DateField label="From" value={trendFrom} maximumDate={new Date(`${trendTo}T00:00:00`)} onChange={setTrendFrom} />
          </View>
          <View style={styles.trendRangeField}>
            <DateField
              label="To"
              value={trendTo}
              minimumDate={new Date(`${trendFrom}T00:00:00`)}
              maximumDate={new Date(`${TODAY_ISO}T00:00:00`)}
              onChange={setTrendTo}
            />
          </View>
        </View>
        <AttendanceTrendChart points={summary.studentAttendanceTrend} />
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Student attendance today</Text>
          <Text style={styles.muted}>{sa.date}</Text>
        </View>
        <AttendanceChart {...sa} />
        <View style={styles.sectionsProgress}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${sectionsMarkedPercent}%` }]} />
          </View>
          <Text style={styles.muted}>
            {sa.sectionsMarked} of {sa.totalSections} section{sa.totalSections === 1 ? '' : 's'} have marked attendance today.
          </Text>
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Staff attendance today</Text>
          <Text style={styles.muted}>{ta.date}</Text>
        </View>
        <AttendanceChart {...ta} />
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Enrollment vs. attendance by class</Text>
        </View>
        <Text style={styles.muted}>Today, lowest attendance first</Text>
        <ClassBarChart classes={summary.classAttendanceToday} />
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
  trendRangeRow: { flexDirection: 'row', gap: spacing.sm },
  trendRangeField: { flex: 1 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  legend: { flex: 1, gap: spacing.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 13, fontFamily: fonts.body, color: colors.text },
  legendValue: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.text },
  sectionsProgress: { gap: spacing.xs, marginTop: spacing.xs },
  progressTrack: { height: 8, borderRadius: radius.sm, backgroundColor: colors.surfaceHover, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.sm, backgroundColor: colors.primary },
  linkRow: { flexDirection: 'row', gap: spacing.sm },
  linkHalf: { flex: 1 },
});
