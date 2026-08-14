import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import * as academic from '../../api/academic';
import type { AcademicYear } from '../../api/academic';
import * as holidaysApi from '../../api/holidays';
import type { Holiday } from '../../api/holidays';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateField } from '../../components/DateField';
import { LoadingView } from '../../components/LoadingView';
import { NamedItemList } from '../../components/NamedItemList';
import { Screen } from '../../components/Screen';
import { Touchable } from '../../components/Touchable';
import { colors, fonts, radius, spacing } from '../../theme';

export function AcademicSetupScreen(): React.JSX.Element {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('academic.manage');

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [classes, setClasses] = useState<academic.SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [sections, setSections] = useState<academic.Section[]>([]);
  const [subjects, setSubjects] = useState<academic.Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const [newYearName, setNewYearName] = useState('');
  const [newYearCurrent, setNewYearCurrent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyYearId, setBusyYearId] = useState<number | null>(null);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [holidayError, setHolidayError] = useState<string | null>(null);
  const [busyHolidayId, setBusyHolidayId] = useState<number | null>(null);

  const loadYears = useCallback(async () => {
    try {
      setYears(await academic.listAcademicYears());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load academic years');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadYears();
    void holidaysApi.listHolidays().then(setHolidays);
  }, [loadYears]);

  const loadClasses = useCallback(async (yearId: number) => {
    setClasses(await academic.listClasses(yearId));
  }, []);

  useEffect(() => {
    if (selectedYearId === null) {
      setClasses([]);
      return;
    }
    void loadClasses(selectedYearId);
  }, [selectedYearId, loadClasses]);

  const loadSectionsAndSubjects = useCallback(async (classId: number) => {
    const [sectionRows, subjectRows] = await Promise.all([academic.listSections(classId), academic.listSubjects(classId)]);
    setSections(sectionRows);
    setSubjects(subjectRows);
  }, []);

  useEffect(() => {
    if (selectedClassId === null) {
      setSections([]);
      setSubjects([]);
      return;
    }
    void loadSectionsAndSubjects(selectedClassId);
  }, [selectedClassId, loadSectionsAndSubjects]);

  const selectYear = (id: number) => {
    setSelectedYearId((prev) => (prev === id ? null : id));
    setSelectedClassId(null);
  };

  const submitNewYear = async () => {
    if (!newYearName.trim()) return;
    setError(null);
    try {
      await academic.createAcademicYear(newYearName.trim(), newYearCurrent);
      setNewYearName('');
      setNewYearCurrent(false);
      await loadYears();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create academic year');
    }
  };

  const setCurrent = async (id: number) => {
    setBusyYearId(id);
    setError(null);
    try {
      await academic.updateAcademicYear(id, { isCurrent: true });
      await loadYears();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update academic year');
    } finally {
      setBusyYearId(null);
    }
  };

  const deleteYear = (year: AcademicYear) => {
    Alert.alert(`Delete academic year "${year.name}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyYearId(year.id);
          setError(null);
          try {
            await academic.deleteAcademicYear(year.id);
            if (selectedYearId === year.id) setSelectedYearId(null);
            await loadYears();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete academic year');
          } finally {
            setBusyYearId(null);
          }
        },
      },
    ]);
  };

  const submitNewHoliday = async () => {
    if (!newHolidayDate.trim() || !newHolidayName.trim()) return;
    setHolidayError(null);
    try {
      await holidaysApi.createHoliday(newHolidayDate.trim(), newHolidayName.trim());
      setNewHolidayDate('');
      setNewHolidayName('');
      setHolidays(await holidaysApi.listHolidays());
    } catch (err) {
      setHolidayError(err instanceof ApiError ? err.message : 'Failed to add holiday');
    }
  };

  const deleteHoliday = (holiday: Holiday) => {
    Alert.alert(`Delete holiday "${holiday.name}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyHolidayId(holiday.id);
          setHolidayError(null);
          try {
            await holidaysApi.deleteHoliday(holiday.id);
            setHolidays((prev) => prev.filter((h) => h.id !== holiday.id));
          } catch (err) {
            setHolidayError(err instanceof ApiError ? err.message : 'Failed to delete holiday');
          } finally {
            setBusyHolidayId(null);
          }
        },
      },
    ]);
  };

  const selectedYear = years.find((y) => y.id === selectedYearId) ?? null;
  const selectedClass = classes.find((c) => c.id === selectedClassId) ?? null;

  if (loading) return <LoadingView />;

  return (
    <Screen>
      <Text style={styles.heading}>Academic Setup</Text>
      <Text style={styles.subtitle}>Academic year → classes → sections &amp; subjects.</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Academic years</Text>
        {years.length === 0 && <Text style={styles.muted}>No academic years yet.</Text>}
        {years.map((year) => (
          <View key={year.id} style={[styles.yearRow, selectedYearId === year.id && styles.yearRowSelected]}>
            <Touchable style={styles.yearNameWrap} onPress={() => selectYear(year.id)}>
              <Text style={styles.yearName}>{year.name}</Text>
              {year.isCurrent && <Badge label="Current" tone="primary" />}
            </Touchable>
            {canManage && (
              <View style={styles.actions}>
                {!year.isCurrent && (
                  <Touchable style={styles.iconBtn} onPress={() => setCurrent(year.id)} disabled={busyYearId === year.id}>
                    <Text style={styles.iconBtnText}>Set current</Text>
                  </Touchable>
                )}
                <Touchable style={styles.iconBtn} onPress={() => deleteYear(year)} disabled={busyYearId === year.id}>
                  <Text style={styles.iconBtnDanger}>{busyYearId === year.id ? 'Deleting…' : 'Delete'}</Text>
                </Touchable>
              </View>
            )}
          </View>
        ))}

        {canManage && (
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              value={newYearName}
              onChangeText={setNewYearName}
              placeholder="e.g. 2026-27"
              placeholderTextColor={colors.textMuted}
            />
            <Touchable style={styles.checkboxRow} onPress={() => setNewYearCurrent((v) => !v)}>
              <View style={[styles.checkbox, newYearCurrent && styles.checkboxChecked]} />
              <Text style={styles.checkboxLabel}>Current</Text>
            </Touchable>
            <Button label="Add year" onPress={submitNewYear} disabled={!newYearName.trim()} />
          </View>
        )}
      </Card>

      {selectedYear && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Classes in {selectedYear.name}</Text>
          <NamedItemList
            items={classes}
            canManage={canManage}
            onAdd={async (name) => {
              await academic.createClass(name, selectedYear.id);
              await loadClasses(selectedYear.id);
            }}
            onRename={async (id, name) => {
              await academic.updateClass(id, name);
              await loadClasses(selectedYear.id);
            }}
            onDelete={async (id) => {
              await academic.deleteClass(id);
              if (selectedClassId === id) setSelectedClassId(null);
              await loadClasses(selectedYear.id);
            }}
            onSelect={(id) => setSelectedClassId((prev) => (prev === id ? null : id))}
            selectedId={selectedClassId}
            addPlaceholder="e.g. 1, 2, 10"
            emptyText="No classes yet for this academic year."
          />
        </Card>
      )}

      {selectedClass && (
        <>
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Sections in Class {selectedClass.name}</Text>
            <NamedItemList
              items={sections}
              canManage={canManage}
              onAdd={async (name) => {
                await academic.createSection(name, selectedClass.id);
                await loadSectionsAndSubjects(selectedClass.id);
              }}
              onRename={async (id, name) => {
                await academic.updateSection(id, name);
                await loadSectionsAndSubjects(selectedClass.id);
              }}
              onDelete={async (id) => {
                await academic.deleteSection(id);
                await loadSectionsAndSubjects(selectedClass.id);
              }}
              addPlaceholder="e.g. A, B"
              emptyText="No sections yet for this class."
            />
          </Card>

          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Subjects in Class {selectedClass.name}</Text>
            <NamedItemList
              items={subjects}
              canManage={canManage}
              onAdd={async (name) => {
                await academic.createSubject(name, selectedClass.id);
                await loadSectionsAndSubjects(selectedClass.id);
              }}
              onRename={async (id, name) => {
                await academic.updateSubject(id, name);
                await loadSectionsAndSubjects(selectedClass.id);
              }}
              onDelete={async (id) => {
                await academic.deleteSubject(id);
                await loadSectionsAndSubjects(selectedClass.id);
              }}
              addPlaceholder="e.g. Mathematics"
              emptyText="No subjects yet for this class."
            />
          </Card>
        </>
      )}

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Holidays</Text>
        <Text style={styles.muted}>Excluded from attendance % calculations in Reports.</Text>

        {holidayError && <Text style={styles.error}>{holidayError}</Text>}
        {holidays.length === 0 && <Text style={styles.muted}>No holidays set yet.</Text>}

        {holidays.map((holiday) => (
          <View key={holiday.id} style={styles.holidayRow}>
            <Text style={styles.holidayText}>
              {holiday.date.slice(0, 10)} — {holiday.name}
            </Text>
            {canManage && (
              <Touchable style={styles.iconBtn} onPress={() => deleteHoliday(holiday)} disabled={busyHolidayId === holiday.id}>
                <Text style={styles.iconBtnDanger}>{busyHolidayId === holiday.id ? 'Deleting…' : 'Delete'}</Text>
              </Touchable>
            )}
          </View>
        ))}

        {canManage && (
          <View style={styles.holidayAddRow}>
            <DateField label="Date" value={newHolidayDate} onChange={setNewHolidayDate} />
            <TextInput
              style={styles.addInput}
              value={newHolidayName}
              onChangeText={setNewHolidayName}
              placeholder="e.g. Independence Day"
              placeholderTextColor={colors.textMuted}
            />
            <Button
              label="Add holiday"
              onPress={submitNewHoliday}
              disabled={!newHolidayDate.trim() || !newHolidayName.trim()}
            />
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, marginTop: -spacing.sm },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  card: { gap: spacing.sm },
  cardTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  yearRowSelected: { backgroundColor: colors.primaryTint, borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  yearNameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  yearName: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.md },
  iconBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.xs },
  iconBtnText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.primary },
  iconBtnDanger: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.danger },
  addRow: { gap: spacing.sm, marginTop: spacing.sm },
  addInput: {
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
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  checkbox: { width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxLabel: { fontSize: 14, fontFamily: fonts.body, color: colors.text },
  holidayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  holidayText: { flex: 1, fontSize: 14, fontFamily: fonts.body, color: colors.text },
  holidayAddRow: { gap: spacing.sm, marginTop: spacing.sm },
});
