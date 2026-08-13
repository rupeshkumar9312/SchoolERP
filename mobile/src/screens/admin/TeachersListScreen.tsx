import React, { useCallback, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { Teacher, deleteTeacher, listTeachers } from '../../api/teachers';
import { useAuth } from '../../auth/AuthContext';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataRowText } from '../../components/DataRow';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { colors, fonts, spacing } from '../../theme';
import { formatDate } from '../../utils/format';
import type { ManageStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ManageStackParamList, 'TeachersList'>;

export function TeachersListScreen({ navigation }: Props): React.JSX.Element {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('teacher.create');
  const canEdit = hasPermission('teacher.edit');
  const canDelete = hasPermission('teacher.delete');
  const canAssign = hasPermission('teacher.assign');
  const showActions = canEdit || canDelete || canAssign;

  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTeachers(await listTeachers());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load teachers');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleDelete = (t: Teacher) => {
    Alert.alert('Delete teacher', `Delete ${t.name}? This removes their login too and can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(t.id);
          try {
            await deleteTeacher(t.id);
            setTeachers((prev) => (prev ?? []).filter((x) => x.id !== t.id));
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not delete teacher');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingView />;
  if (error && !teachers) return <Screen><ErrorView message={error} onRetry={load} /></Screen>;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Teachers</Text>
        {canCreate && <Button label="+ New" onPress={() => navigation.navigate('TeacherForm', undefined)} />}
      </View>

      {error && teachers && <Text style={styles.error}>{error}</Text>}

      {teachers && teachers.length === 0 && (
        <Card><Text style={styles.muted}>No teachers yet. Add your first teacher to get started.</Text></Card>
      )}

      {teachers?.map((t) => (
        <Card key={t.id} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.name}>{t.name}</Text>
            <Badge label={t.isActive ? 'Active' : 'Inactive'} tone={t.isActive ? 'success' : 'muted'} />
          </View>
          <DataRowText label="Email" value={t.email} />
          <DataRowText label="Phone" value={t.phone ?? '—'} />
          <DataRowText label="Qualification" value={t.qualification ?? '—'} />
          <DataRowText label="Joined" value={formatDate(t.joiningDate)} />

          {showActions && (
            <View style={styles.actions}>
              {canAssign && (
                <View style={styles.actionThird}>
                  <Button
                    label="Assignments"
                    variant="secondary"
                    onPress={() => navigation.navigate('TeacherAssignments', { teacherId: t.id, teacherName: t.name })}
                  />
                </View>
              )}
              {canEdit && (
                <View style={styles.actionThird}>
                  <Button label="Edit" variant="secondary" onPress={() => navigation.navigate('TeacherForm', { teacher: t })} />
                </View>
              )}
              {canDelete && (
                <View style={styles.actionThird}>
                  <Button label="Delete" variant="danger" onPress={() => handleDelete(t)} loading={deletingId === t.id} />
                </View>
              )}
            </View>
          )}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  muted: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  card: { gap: spacing.xs },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionThird: { flex: 1 },
});
