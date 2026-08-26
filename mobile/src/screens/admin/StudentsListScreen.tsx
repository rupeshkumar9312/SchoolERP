import React, { useCallback, useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as academic from '../../api/academic';
import { ApiError } from '../../api/client';
import { PAGE_SIZE } from '../../api/pagination';
import { Student, deleteStudent, listStudents } from '../../api/students';
import { useAuth } from '../../auth/AuthContext';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataRowText } from '../../components/DataRow';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { SearchInput } from '../../components/SearchInput';
import { SelectField } from '../../components/SelectField';
import { colors, fonts, spacing } from '../../theme';
import type { ManageStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ManageStackParamList, 'StudentsList'>;

export function StudentsListScreen({ navigation }: Props): React.JSX.Element {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('student.create');
  const canEdit = hasPermission('student.edit');
  const canDelete = hasPermission('student.delete');

  const [years, setYears] = useState<academic.AcademicYear[]>([]);
  const [classes, setClasses] = useState<academic.SchoolClass[]>([]);
  const [sections, setSections] = useState<academic.Section[]>([]);
  const [yearId, setYearId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const [students, setStudents] = useState<Student[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await listStudents({
        classId: classId ?? undefined,
        sectionId: sectionId ?? undefined,
        search: search.trim() || undefined,
        page: 1,
        limit: PAGE_SIZE,
      });
      setStudents(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load students');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, sectionId, search]);

  const loadMore = async () => {
    if (!students) return;
    setLoadingMore(true);
    try {
      const nextPage = Math.floor(students.length / PAGE_SIZE) + 1;
      const result = await listStudents({
        classId: classId ?? undefined,
        sectionId: sectionId ?? undefined,
        search: search.trim() || undefined,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      setStudents((prev) => [...(prev ?? []), ...result.items]);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load more students');
    } finally {
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const timeout = setTimeout(() => void load(), 250);
      return () => clearTimeout(timeout);
    }, [load]),
  );

  const handleDelete = (s: Student) => {
    Alert.alert('Delete student', `Delete ${s.name}? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(s.id);
          try {
            await deleteStudent(s.id);
            setStudents((prev) => (prev ?? []).filter((x) => x.id !== s.id));
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not delete student');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingView />;
  if (error && !students) return <Screen><ErrorView message={error} onRetry={load} /></Screen>;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Students</Text>
        {canCreate && (
          <View style={styles.headerActions}>
            <Button label="Bulk import" variant="secondary" onPress={() => navigation.navigate('StudentsBulkImport')} />
            <Button label="+ New" onPress={() => navigation.navigate('StudentForm', undefined)} />
          </View>
        )}
      </View>

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
        <SelectField
          label="Section"
          value={sectionId}
          onChange={setSectionId}
          placeholder="All sections"
          options={sections.map((s) => ({ value: s.id, label: s.name }))}
        />
      )}
      <SearchInput value={search} onChangeText={setSearch} placeholder="Name or admission no." />

      {error && students && <Text style={styles.error}>{error}</Text>}

      {students && students.length === 0 && (
        <Card><Text style={styles.muted}>No students found. Try clearing your filters, or admit a new student.</Text></Card>
      )}

      {students?.map((s) => (
        <Card key={s.id} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.name}>{s.name}</Text>
            <Badge label={s.isActive ? 'Active' : 'Inactive'} tone={s.isActive ? 'success' : 'muted'} />
          </View>
          <DataRowText label="Admission No." value={s.admissionNo ?? '—'} />
          <DataRowText label="Class" value={`${s.class.name}-${s.section.name}`} />
          <DataRowText label="Guardian" value={s.guardianName ?? '—'} />

          {(canEdit || canDelete) && (
            <View style={styles.actions}>
              {canEdit && (
                <View style={styles.actionHalf}>
                  <Button label="Edit" variant="secondary" onPress={() => navigation.navigate('StudentForm', { student: s })} />
                </View>
              )}
              {canDelete && (
                <View style={styles.actionHalf}>
                  <Button label="Delete" variant="danger" onPress={() => handleDelete(s)} loading={deletingId === s.id} />
                </View>
              )}
            </View>
          )}
        </Card>
      ))}

      {students && students.length > 0 && students.length < total && (
        <Button label={`Load more (${students.length} of ${total})`} variant="secondary" onPress={() => void loadMore()} loading={loadingMore} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  muted: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  card: { gap: spacing.xs },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionHalf: { flex: 1 },
});
