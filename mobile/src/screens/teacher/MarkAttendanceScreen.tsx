import React, { useCallback, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { AttendanceStatus, listAttendance, markAttendance } from '../../api/attendance';
import { ApiError } from '../../api/client';
import { listMyClassStudents, Student } from '../../api/students';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { Touchable } from '../../components/Touchable';
import { ATTENDANCE_STATUS_META } from '../../constants';
import { colors, fonts, radius, spacing } from '../../theme';
import { formatDate, todayIsoDate } from '../../utils/format';
import type { TeacherClassesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TeacherClassesStackParamList, 'MarkAttendance'>;

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'];
const today = todayIsoDate();

const TONE_COLORS = {
  success: { bg: colors.successTint, fg: colors.success },
  danger: { bg: colors.dangerTint, fg: colors.danger },
  warning: { bg: colors.warningTint, fg: colors.warning },
  info: { bg: colors.infoTint, fg: colors.info },
} as const;

export function MarkAttendanceScreen({ route }: Props): React.JSX.Element {
  const { classId, sectionId, className, sectionName } = route.params;
  const [students, setStudents] = useState<Student[] | null>(null);
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [all, existing] = await Promise.all([
        listMyClassStudents(),
        listAttendance({ classId, sectionId, date: today }),
      ]);
      const roster = all.filter((s) => s.class.id === classId && s.section.id === sectionId);
      setStudents(roster);
      const initial: Record<number, AttendanceStatus> = {};
      for (const s of roster) initial[s.id] = 'PRESENT';
      for (const record of existing) initial[record.student.id] = record.status;
      setStatuses(initial);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load roster');
    } finally {
      setLoading(false);
    }
  }, [classId, sectionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const markAllPresent = () => {
    if (!students) return;
    const next: Record<number, AttendanceStatus> = {};
    for (const s of students) next[s.id] = 'PRESENT';
    setStatuses(next);
  };

  const handleSubmit = async () => {
    if (!students) return;
    setSaveError(null);
    setSavedAt(null);
    setSaving(true);
    try {
      await markAttendance({
        classId,
        sectionId,
        date: today,
        records: students.map((s) => ({ studentId: s.id, status: statuses[s.id] ?? 'PRESENT' })),
      });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Could not save attendance');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingView />;
  if (error) return <Screen><ErrorView message={error} onRetry={load} /></Screen>;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View>
        <Text style={styles.heading}>Mark Attendance</Text>
        <Text style={styles.subtitle}>{className} - {sectionName}</Text>
        <Text style={styles.muted}>{formatDate(today)} · Attendance can only be marked for today</Text>
      </View>

      {saveError && <Text style={styles.error}>{saveError}</Text>}
      {savedAt && <Text style={styles.success}>Attendance saved at {savedAt}.</Text>}

      {students && students.length === 0 ? (
        <Card><Text style={styles.muted}>No students in this class yet.</Text></Card>
      ) : (
        <>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Roster ({students?.length ?? 0})</Text>
            <Button label="Mark all present" variant="secondary" onPress={markAllPresent} />
          </View>

          {students?.map((s) => (
            <Card key={s.id} style={styles.studentCard}>
              <View style={styles.studentInfo}>
                <Text style={styles.name}>{s.name}</Text>
                <Text style={styles.muted}>{s.admissionNo ?? '—'}</Text>
              </View>
              <View style={styles.statusRow}>
                {STATUSES.map((status) => {
                  const meta = ATTENDANCE_STATUS_META[status];
                  const tone = TONE_COLORS[meta.tone];
                  const active = statuses[s.id] === status;
                  return (
                    <Touchable
                      key={status}
                      onPress={() => setStatuses((prev) => ({ ...prev, [s.id]: status }))}
                      rippleColor={tone.bg}
                      style={[styles.statusChip, active && { backgroundColor: tone.bg }]}
                    >
                      <Text style={[styles.statusChipText, active && { color: tone.fg }]}>
                        {meta.label}
                      </Text>
                    </Touchable>
                  );
                })}
              </View>
            </Card>
          ))}

          <Button label="Save attendance" onPress={handleSubmit} loading={saving} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  subtitle: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.text, marginTop: 2 },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text },
  studentCard: { gap: spacing.sm },
  studentInfo: { gap: 2 },
  name: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.text },
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
  success: { color: colors.success, fontSize: 13, fontFamily: fonts.body },
});
