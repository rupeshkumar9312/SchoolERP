import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AttendanceStatus } from '../../api/attendance';
import { ApiError } from '../../api/client';
import { listTeacherAttendanceForDate, markTeacherAttendance, TeacherAttendanceRecord } from '../../api/teacherAttendance';
import { listTeachers, Teacher } from '../../api/teachers';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { ATTENDANCE_STATUS_META } from '../../constants';
import { colors, fonts, radius, spacing } from '../../theme';
import { todayIsoDate } from '../../utils/format';

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'];
const TONE_COLORS = {
  success: { bg: colors.successTint, fg: colors.success },
  danger: { bg: colors.dangerTint, fg: colors.danger },
  warning: { bg: colors.warningTint, fg: colors.warning },
  info: { bg: colors.infoTint, fg: colors.info },
} as const;

export function StaffAttendanceScreen(): React.JSX.Element {
  const [date, setDate] = useState(todayIsoDate());
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [records, setRecords] = useState<TeacherAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allTeachers, attendance] = await Promise.all([listTeachers(), listTeacherAttendanceForDate(date)]);
      setTeachers(allTeachers);
      setRecords(attendance);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load staff attendance');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const onMark = async (teacherId: number, status: AttendanceStatus) => {
    setSavingId(teacherId);
    setError(null);
    try {
      const updated = await markTeacherAttendance({ teacherId, date, status });
      setRecords((prev) => [updated, ...prev.filter((r) => r.teacher.id !== teacherId)]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not mark attendance');
    } finally {
      setSavingId(null);
    }
  };

  const byTeacherId = new Map(records.map((r) => [r.teacher.id, r]));

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View>
        <Text style={styles.heading}>Staff Attendance</Text>
        <Text style={styles.subtitle}>Filter by date and mark or correct any teacher's attendance.</Text>
      </View>

      <Card style={styles.filters}>
        <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder={todayIsoDate()}
          placeholderTextColor={colors.textMuted}
        />
      </Card>

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <Card><Text style={styles.muted}>Loading…</Text></Card>
      ) : teachers.length === 0 ? (
        <Card><Text style={styles.muted}>No teachers found.</Text></Card>
      ) : (
        teachers.map((teacher) => {
          const record = byTeacherId.get(teacher.id);
          return (
            <Card key={teacher.id} style={styles.recordCard}>
              <View>
                <Text style={styles.name}>{teacher.name}</Text>
                <Text style={styles.muted}>Marked by {record?.markedBy.name ?? '—'}</Text>
              </View>
              <View style={styles.statusRow}>
                {STATUSES.map((status) => {
                  const meta = ATTENDANCE_STATUS_META[status];
                  const tone = TONE_COLORS[meta.tone];
                  const active = (record?.status ?? 'PRESENT') === status;
                  return (
                    <Pressable
                      key={status}
                      onPress={() => onMark(teacher.id, status)}
                      disabled={savingId === teacher.id}
                      style={[styles.statusChip, active && { backgroundColor: tone.bg }]}
                    >
                      <Text style={[styles.statusChipText, active && { color: tone.fg }]}>{meta.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
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
  filters: { gap: spacing.sm },
  label: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  recordCard: { gap: spacing.sm },
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
});
