import React, { useCallback, useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as academic from '../../api/academic';
import { ApiError } from '../../api/client';
import {
  ClassTeacherSection,
  TeacherAssignment,
  createAssignment,
  deleteAssignment,
  listAssignments,
  listClassTeacherOf,
  setClassTeacher,
  unsetClassTeacher,
} from '../../api/teachers';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { Touchable } from '../../components/Touchable';
import { colors, fonts, radius, spacing } from '../../theme';
import type { ManageStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ManageStackParamList, 'TeacherAssignments'>;

export function TeacherAssignmentsScreen({ route, navigation }: Props): React.JSX.Element {
  const { teacherId, teacherName } = route.params;

  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [classTeacherOf, setClassTeacherOf] = useState<ClassTeacherSection[]>([]);

  const [years, setYears] = useState<academic.AcademicYear[]>([]);
  const [classes, setClasses] = useState<academic.SchoolClass[]>([]);
  const [sections, setSections] = useState<academic.Section[]>([]);
  const [subjects, setSubjects] = useState<academic.Subject[]>([]);

  const [yearId, setYearId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [subjectIds, setSubjectIds] = useState<number[]>([]);
  const [assignAsClassTeacher, setAssignAsClassTeacher] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removingSectionId, setRemovingSectionId] = useState<number | null>(null);

  const loadAssignments = useCallback(async () => {
    setAssignments(await listAssignments(teacherId));
  }, [teacherId]);

  const loadClassTeacherOf = useCallback(async () => {
    setClassTeacherOf(await listClassTeacherOf(teacherId));
  }, [teacherId]);

  useEffect(() => {
    navigation.setOptions({ title: `Assignments — ${teacherName}` });
  }, [navigation, teacherName]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadAssignments(), loadClassTeacherOf(), academic.listAcademicYears()])
      .then(([, , yearRows]) => setYears(yearRows))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [loadAssignments, loadClassTeacherOf]);

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
      setSubjects([]);
      return;
    }
    void Promise.all([academic.listSections(classId), academic.listSubjects(classId)]).then(([s, sub]) => {
      setSections(s);
      setSubjects(sub);
    });
  }, [classId]);

  const toggleSubject = (subjectId: number) => {
    setSubjectIds((prev) => (prev.includes(subjectId) ? prev.filter((s) => s !== subjectId) : [...prev, subjectId]));
  };

  const onAssign = async () => {
    if (classId === null || sectionId === null || (subjectIds.length === 0 && !assignAsClassTeacher)) return;
    setSubmitting(true);
    setError(null);
    try {
      if (subjectIds.length > 0) {
        const [firstSubjectId, ...restSubjectIds] = subjectIds;
        await createAssignment(teacherId, {
          classId,
          sectionId,
          subjectId: firstSubjectId,
          isClassTeacher: assignAsClassTeacher,
        });
        for (const subjectId of restSubjectIds) {
          await createAssignment(teacherId, { classId, sectionId, subjectId });
        }
      } else {
        await setClassTeacher(teacherId, sectionId);
      }
      setSubjectIds([]);
      setAssignAsClassTeacher(false);
      await Promise.all([loadAssignments(), loadClassTeacherOf()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to assign');
    } finally {
      setSubmitting(false);
    }
  };

  const onRemove = (assignment: TeacherAssignment) => {
    Alert.alert('Remove assignment?', `${assignment.class.name}-${assignment.section.name} · ${assignment.subject.name}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemovingId(assignment.id);
          setError(null);
          try {
            await deleteAssignment(teacherId, assignment.id);
            await Promise.all([loadAssignments(), loadClassTeacherOf()]);
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Failed to remove assignment');
          } finally {
            setRemovingId(null);
          }
        },
      },
    ]);
  };

  const onRemoveClassTeacher = (targetSectionId: number, label: string) => {
    Alert.alert('Remove class teacher status?', label, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemovingSectionId(targetSectionId);
          setError(null);
          try {
            await unsetClassTeacher(teacherId, targetSectionId);
            await Promise.all([loadAssignments(), loadClassTeacherOf()]);
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Failed to remove class teacher status');
          } finally {
            setRemovingSectionId(null);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingView />;

  const canSubmit = classId !== null && sectionId !== null && (subjectIds.length > 0 || assignAsClassTeacher);

  return (
    <Screen>
      <Text style={styles.subtitle}>Pick a class, section and one or more subjects to assign.</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Current assignments</Text>
        {assignments.length === 0 && <Text style={styles.muted}>No assignments yet.</Text>}
        {assignments.map((a) => (
          <View key={a.id} style={styles.assignmentRow}>
            <View style={styles.assignmentInfo}>
              <Text style={styles.assignmentTitle}>
                {a.class.name}-{a.section.name} · {a.subject.name}
              </Text>
              {a.isClassTeacher && <Badge label="Class teacher" tone="primary" />}
            </View>
            <Button label={removingId === a.id ? 'Removing…' : 'Remove'} variant="danger" onPress={() => onRemove(a)} loading={removingId === a.id} />
          </View>
        ))}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Class teacher of</Text>
        <Text style={styles.muted}>Only the class teacher of a section may mark its attendance.</Text>
        {classTeacherOf.length === 0 && <Text style={styles.muted}>Not the class teacher of any section yet.</Text>}
        {classTeacherOf.map((c) => (
          <View key={c.section.id} style={styles.assignmentRow}>
            <Text style={styles.assignmentTitle}>
              {c.class.name}-{c.section.name}
            </Text>
            <Button
              label={removingSectionId === c.section.id ? 'Removing…' : 'Remove'}
              variant="danger"
              onPress={() => onRemoveClassTeacher(c.section.id, `${c.class.name}-${c.section.name}`)}
              loading={removingSectionId === c.section.id}
            />
          </View>
        ))}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Add assignment</Text>

        <SelectField
          label="Academic year"
          value={yearId}
          onChange={(id) => {
            setYearId(id);
            setClassId(null);
            setSectionId(null);
            setSubjectIds([]);
            setAssignAsClassTeacher(false);
          }}
          placeholder="Select a year"
          options={years.map((y) => ({ value: y.id, label: y.name }))}
        />

        {yearId !== null && (
          <SelectField
            label="Class"
            value={classId}
            onChange={(id) => {
              setClassId(id);
              setSectionId(null);
              setSubjectIds([]);
              setAssignAsClassTeacher(false);
            }}
            placeholder="Select a class"
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
        )}

        {classId !== null && (
          <>
            <SelectField
              label="Section"
              value={sectionId}
              onChange={setSectionId}
              placeholder="Select a section"
              options={sections.map((s) => ({ value: s.id, label: s.name }))}
            />

            {sectionId !== null && (
              <Touchable style={styles.checkboxRow} onPress={() => setAssignAsClassTeacher((v) => !v)}>
                <View style={[styles.checkbox, assignAsClassTeacher && styles.checkboxChecked]} />
                <Text style={styles.checkboxLabel}>Set as class teacher of this section (needed to mark its attendance)</Text>
              </Touchable>
            )}

            <View>
              <Text style={styles.label}>Subject(s) (optional if only setting the class teacher above)</Text>
              {subjects.length === 0 ? (
                <Text style={styles.muted}>No subjects defined for this class yet.</Text>
              ) : (
                <View style={styles.subjectChips}>
                  {subjects.map((s) => {
                    const active = subjectIds.includes(s.id);
                    return (
                      <Touchable
                        key={s.id}
                        onPress={() => toggleSubject(s.id)}
                        rippleColor={colors.primaryTint}
                        hitSlop={8}
                        style={[styles.subjectChip, active && styles.subjectChipActive]}
                      >
                        <Text style={[styles.subjectChipText, active && styles.subjectChipTextActive]}>{s.name}</Text>
                      </Touchable>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}

        <Button label={submitting ? 'Assigning…' : 'Assign'} onPress={onAssign} disabled={!canSubmit} loading={submitting} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  card: { gap: spacing.sm },
  cardTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  assignmentInfo: { flex: 1, gap: spacing.xs },
  assignmentTitle: { fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text },
  label: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.textMuted, marginBottom: spacing.xs },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  checkbox: { width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxLabel: { flex: 1, fontSize: 13, fontFamily: fonts.body, color: colors.text },
  // Explicit margins instead of `gap` — see AnnouncementFormScreen's
  // audienceRow for why (gap on a flexWrap row of Touchables has shown up
  // as visually-correct-but-untappable on Android).
  subjectChips: { flexDirection: 'row', flexWrap: 'wrap', marginRight: -spacing.sm, marginBottom: -spacing.sm },
  subjectChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  subjectChipActive: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  subjectChipText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.textMuted },
  subjectChipTextActive: { color: colors.primary },
});
