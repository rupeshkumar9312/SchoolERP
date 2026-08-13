import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AcademicYear, listAcademicYears, listClasses, listSections, SchoolClass, Section } from '../../api/academic';
import { AttendanceStatus, listAttendance, markAttendance } from '../../api/attendance';
import { ApiError } from '../../api/client';
import { listStudents, Student } from '../../api/students';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { Touchable } from '../../components/Touchable';
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

export function AdminMarkAttendanceScreen(): React.JSX.Element {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  const [year, setYear] = useState<AcademicYear | null>(null);
  const [klass, setKlass] = useState<SchoolClass | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [date, setDate] = useState(todayIsoDate());

  const [students, setStudents] = useState<Student[] | null>(null);
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    void listAcademicYears().then(setYears);
  }, []);

  useEffect(() => {
    setKlass(null);
    setClasses([]);
    if (!year) return;
    void listClasses(year.id).then(setClasses);
  }, [year]);

  useEffect(() => {
    setSection(null);
    setSections([]);
    if (!klass) return;
    void listSections(klass.id).then(setSections);
  }, [klass]);

  const load = useCallback(async () => {
    if (!klass || !section || !date) {
      setStudents(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSavedAt(null);
    try {
      const [roster, existing] = await Promise.all([
        listStudents({ classId: klass.id, sectionId: section.id }),
        listAttendance({ classId: klass.id, sectionId: section.id, date }),
      ]);
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
  }, [klass, section, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const markAllPresent = () => {
    if (!students) return;
    const next: Record<number, AttendanceStatus> = {};
    for (const s of students) next[s.id] = 'PRESENT';
    setStatuses(next);
  };

  const handleSubmit = async () => {
    if (!students || !klass || !section) return;
    setSaveError(null);
    setSavedAt(null);
    setSaving(true);
    try {
      await markAttendance({
        classId: klass.id,
        sectionId: section.id,
        date,
        records: students.map((s) => ({ studentId: s.id, status: statuses[s.id] ?? 'PRESENT' })),
      });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Could not save attendance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View>
        <Text style={styles.heading}>Mark Attendance</Text>
        <Text style={styles.subtitle}>Pick a class, section and date to load the roster.</Text>
      </View>

      <Card style={styles.filters}>
        <SelectField label="Academic year" value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: y.name }))} />
        <SelectField label="Class" value={klass} onChange={setKlass} options={classes.map((c) => ({ value: c, label: c.name }))} />
        <SelectField label="Section" value={section} onChange={setSection} options={sections.map((s) => ({ value: s, label: s.name }))} />
        <View>
          <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder={todayIsoDate()} placeholderTextColor={colors.textMuted} />
        </View>
      </Card>

      {error && <Text style={styles.error}>{error}</Text>}
      {saveError && <Text style={styles.error}>{saveError}</Text>}
      {savedAt && <Text style={styles.success}>Attendance saved at {savedAt}.</Text>}

      {!klass || !section ? (
        <Card><Text style={styles.muted}>Select a class and section to load the roster.</Text></Card>
      ) : loading ? (
        <Card><Text style={styles.muted}>Loading roster…</Text></Card>
      ) : !students || students.length === 0 ? (
        <Card><Text style={styles.muted}>No students in this class and section.</Text></Card>
      ) : (
        <>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Roster ({students.length})</Text>
            <Button label="Mark all present" variant="secondary" onPress={markAllPresent} />
          </View>

          {students.map((s) => (
            <Card key={s.id} style={styles.studentCard}>
              <View style={styles.studentInfo}>
                <Text style={styles.name}>{s.name}</Text>
                <Text style={styles.muted}>{s.admissionNo}</Text>
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
                      <Text style={[styles.statusChipText, active && { color: tone.fg }]}>{meta.label}</Text>
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
  subtitle: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
  filters: { gap: spacing.md },
  label: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.textMuted, marginBottom: spacing.xs },
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
  success: { color: colors.success, fontSize: 13, fontFamily: fonts.body },
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
});
