import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { AttendanceStatus } from '../../api/attendance';
import { ApiError } from '../../api/client';
import {
  getTeacherSelfServeConfig,
  listMyTeacherAttendance,
  markTeacherAttendance,
  TeacherAttendanceRecord,
} from '../../api/teacherAttendance';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { Touchable } from '../../components/Touchable';
import { ATTENDANCE_STATUS_META } from '../../constants';
import type { TeacherDashboardStackParamList } from '../../navigation/types';
import { colors, fonts, radius, spacing } from '../../theme';
import { formatDate, todayIsoDate } from '../../utils/format';

type Props = NativeStackScreenProps<TeacherDashboardStackParamList, 'MyAttendance'>;

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'];

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatWorked(mins?: number | null): string {
  if (mins == null || mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** "in 08:03 · out 17:12 · 9h 9m" — or the pre-check-out fallback. */
function sessionLine(r: TeacherAttendanceRecord): string {
  if (r.method !== 'QR') return `Marked by ${r.markedBy.name}`;
  const parts: string[] = [];
  if (r.checkInAt) parts.push(`in ${formatTime(r.checkInAt)}`);
  else if (r.markedAt) parts.push(`in ${formatTime(r.markedAt)}`);
  if (r.checkOutAt) parts.push(`out ${formatTime(r.checkOutAt)}`);
  const worked = formatWorked(r.workedMinutes);
  if (worked) parts.push(worked);
  return parts.length ? parts.join(' · ') : 'QR check-in';
}
const TONE_COLORS = {
  success: { bg: colors.successTint, fg: colors.success },
  danger: { bg: colors.dangerTint, fg: colors.danger },
  warning: { bg: colors.warningTint, fg: colors.warning },
  info: { bg: colors.infoTint, fg: colors.info },
} as const;

export function MyAttendanceScreen({ navigation }: Props): React.JSX.Element {
  const today = todayIsoDate();
  const [history, setHistory] = useState<TeacherAttendanceRecord[] | null>(null);
  const [manualMarkEnabled, setManualMarkEnabled] = useState(true);
  const [checkoutEnabled, setCheckoutEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [data, config] = await Promise.all([
        listMyTeacherAttendance(),
        getTeacherSelfServeConfig(),
      ]);
      data.sort((a, b) => b.date.localeCompare(a.date));
      setHistory(data);
      setManualMarkEnabled(config.manualMarkEnabled);
      setCheckoutEnabled(config.checkout.enabled);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your attendance');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleMark = async (status: AttendanceStatus) => {
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await markTeacherAttendance({ date: today, status });
      setHistory((prev) => [updated, ...(prev ?? []).filter((r) => r.date !== today)]);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Could not mark attendance');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingView />;
  if (error || !history) return <Screen><ErrorView message={error ?? 'No data'} onRetry={load} /></Screen>;

  const todayRecord = history.find((r) => r.date === today) ?? null;
  const todayStatus = todayRecord?.status ?? null;
  const todayMeta = todayStatus ? ATTENDANCE_STATUS_META[todayStatus] : null;
  const checkedIn = !!todayRecord?.checkInAt;
  const checkedOut = !!todayRecord?.checkOutAt;
  const scanLabel =
    checkoutEnabled && checkedIn && !checkedOut
      ? 'Scan to check out'
      : checkedIn
        ? 'Scan again'
        : 'Scan to check in';

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <Card style={styles.card}>
        <Text style={styles.heading}>Today ({formatDate(today)})</Text>
        {todayMeta ? (
          <View style={styles.todayLine}>
            <Badge label={todayMeta.label} tone={todayMeta.tone} />
            <Text style={styles.muted}>{sessionLine(todayRecord!)}</Text>
          </View>
        ) : (
          <Text style={styles.muted}>Not checked in yet.</Text>
        )}
        <Button label={scanLabel} onPress={() => navigation.navigate('ScanAttendance')} />
        {manualMarkEnabled && <Text style={styles.orLabel}>or set it manually</Text>}
        {manualMarkEnabled && (
        <View style={styles.statusRow}>
          {STATUSES.map((status) => {
            const meta = ATTENDANCE_STATUS_META[status];
            const tone = TONE_COLORS[meta.tone];
            const active = todayStatus === status;
            return (
              <Touchable
                key={status}
                onPress={() => handleMark(status)}
                disabled={saving}
                rippleColor={tone.bg}
                style={[styles.statusChip, active && { backgroundColor: tone.bg }]}
              >
                <Text style={[styles.statusChipText, active && { color: tone.fg }]}>{meta.label}</Text>
              </Touchable>
            );
          })}
        </View>
        )}
        {saveError && <Text style={styles.error}>{saveError}</Text>}
      </Card>

      <Text style={styles.sectionTitle}>Recent history</Text>
      {history.length === 0 ? (
        <Card><Text style={styles.muted}>No attendance marked yet.</Text></Card>
      ) : (
        history.slice(0, 14).map((r) => {
          const meta = ATTENDANCE_STATUS_META[r.status];
          return (
            <Card key={r.id} style={styles.row}>
              <View>
                <Text style={styles.date}>{formatDate(r.date)}</Text>
                <Text style={styles.muted}>{sessionLine(r)}</Text>
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
  card: { gap: spacing.sm },
  heading: { fontSize: 15, fontFamily: fonts.headingBold, color: colors.text },
  todayLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  orLabel: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  sectionTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text, marginTop: spacing.sm },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  date: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusRow: { flexDirection: 'row', gap: spacing.xs },
  statusChip: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surfaceHover,
    overflow: 'hidden',
  },
  statusChipText: { fontSize: 12, fontFamily: fonts.bodySemiBold, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
});
