import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AcademicYear, listAcademicYears, listClasses, listSections, SchoolClass, Section } from '../../api/academic';
import { AttendanceRecord, AttendanceStatus, listAttendance, updateAttendance } from '../../api/attendance';
import { ApiError } from '../../api/client';
import { Card } from '../../components/Card';
import { DateField } from '../../components/DateField';
import { SelectField } from '../../components/SelectField';
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

export function ClassAttendanceScreen(): React.JSX.Element {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  const [year, setYear] = useState<AcademicYear | null>(null);
  const [klass, setKlass] = useState<SchoolClass | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [date, setDate] = useState(todayIsoDate());

  const [records, setRecords] = useState<AttendanceRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

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
      setRecords(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRecords(await listAttendance({ classId: klass.id, sectionId: section.id, date }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load attendance');
    } finally {
      setLoading(false);
    }
  }, [klass, section, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleEdit = async (record: AttendanceRecord, status: AttendanceStatus) => {
    setSavingId(record.id);
    setError(null);
    try {
      const updated = await updateAttendance(record.id, status);
      setRecords((prev) => prev?.map((r) => (r.id === record.id ? updated : r)) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update attendance');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Screen>
      <View>
        <Text style={styles.heading}>By class &amp; date</Text>
        <Text style={styles.subtitle}>View and correct attendance already marked for a class.</Text>
      </View>

      <Card style={styles.filters}>
        <SelectField
          label="Academic year"
          value={year}
          onChange={setYear}
          options={years.map((y) => ({ value: y, label: y.name }))}
        />
        <SelectField
          label="Class"
          value={klass}
          onChange={setKlass}
          options={classes.map((c) => ({ value: c, label: c.name }))}
        />
        <SelectField
          label="Section"
          value={section}
          onChange={setSection}
          options={sections.map((s) => ({ value: s, label: s.name }))}
        />
        <DateField label="Date" value={date} onChange={setDate} placeholder={todayIsoDate()} />
      </Card>

      {error && <Text style={styles.error}>{error}</Text>}

      {!klass || !section ? (
        <Card><Text style={styles.muted}>Pick a class and section above to see attendance.</Text></Card>
      ) : loading ? (
        <Card><Text style={styles.muted}>Loading…</Text></Card>
      ) : !records || records.length === 0 ? (
        <Card><Text style={styles.muted}>Nothing has been marked for this date yet.</Text></Card>
      ) : (
        records.map((r) => (
          <Card key={r.id} style={styles.recordCard}>
            <View style={styles.studentInfo}>
              <Text style={styles.name}>{r.student.name}</Text>
              <Text style={styles.muted}>{r.student.admissionNo}</Text>
            </View>
            <View style={styles.statusRow}>
              {STATUSES.map((status) => {
                const meta = ATTENDANCE_STATUS_META[status];
                const tone = TONE_COLORS[meta.tone];
                const active = r.status === status;
                return (
                  <Pressable
                    key={status}
                    onPress={() => handleEdit(r, status)}
                    disabled={savingId === r.id}
                    style={[styles.statusChip, active && { backgroundColor: tone.bg }]}
                  >
                    <Text style={[styles.statusChipText, active && { color: tone.fg }]}>{meta.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  subtitle: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
  filters: { gap: spacing.md },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  recordCard: { gap: spacing.sm },
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
