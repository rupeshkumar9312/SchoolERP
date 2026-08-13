import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import * as academic from '../../api/academic';
import { ApiError } from '../../api/client';
import * as reports from '../../api/reports';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataRowText } from '../../components/DataRow';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { Touchable } from '../../components/Touchable';
import { colors, fonts, radius, spacing } from '../../theme';
import { buildCsv } from '../../utils/csv';
import { shareTextFile } from '../../utils/download';

type Tab = 'summary' | 'defaulters' | 'staff';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'defaulters', label: 'Defaulters' },
  { id: 'staff', label: 'Staff' },
];

function percentLabel(percent: number | null): string {
  return percent === null ? '—' : `${percent}%`;
}

export function ReportsScreen(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('summary');

  const [years, setYears] = useState<academic.AcademicYear[]>([]);
  const [classes, setClasses] = useState<academic.SchoolClass[]>([]);
  const [sections, setSections] = useState<academic.Section[]>([]);
  const [yearId, setYearId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [threshold, setThreshold] = useState('75');

  const [summary, setSummary] = useState<reports.AttendanceSummary | null>(null);
  const [defaulters, setDefaulters] = useState<reports.DefaultersReport | null>(null);
  const [staff, setStaff] = useState<reports.StaffAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void academic.listAcademicYears().then(setYears);
  }, []);

  useEffect(() => {
    if (yearId === null) {
      setClasses([]);
      return;
    }
    void academic.listClasses(yearId).then(setClasses);
  }, [yearId]);

  useEffect(() => {
    if (classId === null) {
      setSections([]);
      return;
    }
    void academic.listSections(classId).then(setSections);
  }, [classId]);

  const filters = { classId: classId ?? undefined, sectionId: sectionId ?? undefined, from: from || undefined, to: to || undefined };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'summary') {
        setSummary(await reports.getAttendanceSummary(filters));
      } else if (tab === 'defaulters') {
        setDefaulters(await reports.getDefaulters({ ...filters, threshold: Number(threshold) || 75 }));
      } else {
        setStaff(await reports.getStaffAttendanceSummary({ from: filters.from, to: filters.to }));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load report');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, classId, sectionId, from, to, threshold]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportSummaryCsv = async () => {
    if (!summary) return;
    setExporting(true);
    try {
      const csv = buildCsv(
        ['Admission No.', 'Name', 'Class', 'Section', 'Present', 'Absent', 'Late', 'Leave', 'Total Marked', 'Percent'],
        summary.students.map((s) => [
          s.student.admissionNo,
          s.student.name,
          s.class.name,
          s.section.name,
          s.present,
          s.absent,
          s.late,
          s.leave,
          s.totalMarked,
          s.percent ?? '',
        ]),
      );
      await shareTextFile(csv, `attendance-summary-${summary.range.from}-to-${summary.range.to}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share CSV');
    } finally {
      setExporting(false);
    }
  };

  const exportDefaultersCsv = async () => {
    if (!defaulters) return;
    setExporting(true);
    try {
      const csv = buildCsv(
        ['Admission No.', 'Name', 'Class', 'Section', 'Present', 'Total Marked', 'Percent'],
        defaulters.defaulters.map((s) => [
          s.student.admissionNo,
          s.student.name,
          s.class.name,
          s.section.name,
          s.present,
          s.totalMarked,
          s.percent ?? '',
        ]),
      );
      await shareTextFile(csv, `defaulters-below-${defaulters.threshold}pct-${defaulters.range.from}-to-${defaulters.range.to}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share CSV');
    } finally {
      setExporting(false);
    }
  };

  const exportStaffCsv = async () => {
    if (!staff) return;
    setExporting(true);
    try {
      const csv = buildCsv(
        ['Teacher', 'Present', 'Absent', 'Late', 'Leave', 'Total Marked', 'Percent'],
        staff.teachers.map((t) => [t.teacher.name, t.present, t.absent, t.late, t.leave, t.totalMarked, t.percent ?? '']),
      );
      await shareTextFile(csv, `staff-attendance-${staff.range.from}-to-${staff.range.to}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen>
      <View>
        <Text style={styles.heading}>Reports</Text>
        <Text style={styles.subtitle}>Turn attendance data into decisions.</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Touchable
              key={t.id}
              onPress={() => setTab(t.id)}
              rippleColor={colors.primaryTint}
              style={[styles.tabChip, active && styles.tabChipActive]}
            >
              <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{t.label}</Text>
            </Touchable>
          );
        })}
      </View>

      <Card style={styles.card}>
        {tab !== 'staff' && (
          <>
            <SelectField
              label="Academic year"
              value={yearId}
              onChange={(id) => {
                setYearId(id);
                setClassId(null);
                setSectionId(null);
              }}
              placeholder="All years"
              options={years.map((y) => ({ value: y.id, label: y.name }))}
            />
            {yearId !== null && (
              <SelectField
                label="Class"
                value={classId}
                onChange={(id) => {
                  setClassId(id);
                  setSectionId(null);
                }}
                placeholder="All classes"
                options={classes.map((c) => ({ value: c.id, label: c.name }))}
              />
            )}
            {classId !== null && (
              <SelectField label="Section" value={sectionId} onChange={setSectionId} placeholder="All sections" options={sections.map((s) => ({ value: s.id, label: s.name }))} />
            )}
          </>
        )}
        <View>
          <Text style={styles.label}>From</Text>
          <TextInput style={styles.input} value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
        </View>
        <View>
          <Text style={styles.label}>To</Text>
          <TextInput style={styles.input} value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
        </View>
        {tab === 'defaulters' && (
          <View>
            <Text style={styles.label}>Threshold %</Text>
            <TextInput style={styles.input} value={threshold} onChangeText={setThreshold} keyboardType="number-pad" placeholderTextColor={colors.textMuted} />
          </View>
        )}
      </Card>

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <LoadingView />
      ) : (
        <>
          {tab === 'summary' && summary && (
            <>
              <Card style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>Attendance % by class</Text>
                  <Text style={styles.muted}>
                    {summary.range.from} to {summary.range.to}
                  </Text>
                </View>
                {summary.classSummaries.length === 0 ? (
                  <Text style={styles.muted}>No attendance records in this range.</Text>
                ) : (
                  summary.classSummaries.map((c) => (
                    <View key={c.class.id} style={styles.barRow}>
                      <Text style={styles.barLabel}>{c.class.name}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${c.percent ?? 0}%` }]} />
                      </View>
                      <Text style={styles.barValue}>{percentLabel(c.percent)}</Text>
                    </View>
                  ))
                )}
              </Card>

              <Card style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>Per-student breakdown</Text>
                  {summary.students.length > 0 && (
                    <Button label={exporting ? 'Sharing…' : 'Share CSV'} variant="secondary" onPress={exportSummaryCsv} loading={exporting} />
                  )}
                </View>
                {summary.students.length === 0 ? (
                  <Text style={styles.muted}>No students to show.</Text>
                ) : (
                  summary.students.map((s) => (
                    <Card key={s.student.id} style={styles.rowCard}>
                      <View style={styles.rowCardHead}>
                        <Text style={styles.rowCardTitle}>{s.student.name}</Text>
                        <Badge label={percentLabel(s.percent)} tone="primary" />
                      </View>
                      <DataRowText label="Admission No." value={s.student.admissionNo} />
                      <DataRowText label="Class" value={`${s.class.name}-${s.section.name}`} />
                      <DataRowText label="Present / Absent / Late / Leave" value={`${s.present} / ${s.absent} / ${s.late} / ${s.leave}`} />
                    </Card>
                  ))
                )}
              </Card>
            </>
          )}

          {tab === 'defaulters' && defaulters && (
            <Card style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>
                  Below {defaulters.threshold}% ({defaulters.range.from} to {defaulters.range.to})
                </Text>
                {defaulters.defaulters.length > 0 && (
                  <Button label={exporting ? 'Sharing…' : 'Share CSV'} variant="secondary" onPress={exportDefaultersCsv} loading={exporting} />
                )}
              </View>
              {defaulters.defaulters.length === 0 ? (
                <Text style={styles.muted}>No student in this range falls below the selected threshold.</Text>
              ) : (
                defaulters.defaulters.map((s) => (
                  <Card key={s.student.id} style={styles.rowCard}>
                    <View style={styles.rowCardHead}>
                      <Text style={styles.rowCardTitle}>{s.student.name}</Text>
                      <Badge label={percentLabel(s.percent)} tone="danger" />
                    </View>
                    <DataRowText label="Admission No." value={s.student.admissionNo} />
                    <DataRowText label="Class" value={`${s.class.name}-${s.section.name}`} />
                    <DataRowText label="Present / Marked" value={`${s.present} / ${s.totalMarked}`} />
                  </Card>
                ))
              )}
            </Card>
          )}

          {tab === 'staff' && staff && (
            <Card style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>
                  Staff attendance ({staff.range.from} to {staff.range.to})
                </Text>
                {staff.teachers.length > 0 && (
                  <Button label={exporting ? 'Sharing…' : 'Share CSV'} variant="secondary" onPress={exportStaffCsv} loading={exporting} />
                )}
              </View>
              {staff.teachers.length === 0 ? (
                <Text style={styles.muted}>No staff attendance records in this range.</Text>
              ) : (
                staff.teachers.map((t) => (
                  <Card key={t.teacher.id} style={styles.rowCard}>
                    <View style={styles.rowCardHead}>
                      <Text style={styles.rowCardTitle}>{t.teacher.name}</Text>
                      <Badge label={percentLabel(t.percent)} tone="primary" />
                    </View>
                    <DataRowText label="Present / Absent / Late / Leave" value={`${t.present} / ${t.absent} / ${t.late} / ${t.leave}`} />
                  </Card>
                ))
              )}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  subtitle: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: spacing.sm },
  tabChip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  tabChipActive: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  tabChipText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.textMuted },
  tabChipTextActive: { color: colors.primary },
  card: { gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { flex: 1, fontSize: 16, fontFamily: fonts.headingBold, color: colors.text },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
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
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { width: 56, fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.text },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceHover, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  barValue: { width: 44, textAlign: 'right', fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.text },
  rowCard: { gap: 0, backgroundColor: colors.bg },
  rowCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.xs },
  rowCardTitle: { flex: 1, fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text },
});
