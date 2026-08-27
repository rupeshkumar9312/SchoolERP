import React, { useCallback, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { PAGE_SIZE } from '../../api/pagination';
import { Teacher, deleteTeacher, listTeachers } from '../../api/teachers';
import { useAuth } from '../../auth/AuthContext';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataRowText } from '../../components/DataRow';
import { ErrorView } from '../../components/ErrorView';
import { IconButton } from '../../components/IconButton';
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
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await listTeachers({ page: 1, limit: PAGE_SIZE });
      setTeachers(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load teachers');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = async () => {
    if (!teachers) return;
    setLoadingMore(true);
    try {
      const nextPage = Math.floor(teachers.length / PAGE_SIZE) + 1;
      const result = await listTeachers({ page: nextPage, limit: PAGE_SIZE });
      setTeachers((prev) => [...(prev ?? []), ...result.items]);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load more teachers');
    } finally {
      setLoadingMore(false);
    }
  };

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
          try {
            await deleteTeacher(t.id);
            setTeachers((prev) => (prev ?? []).filter((x) => x.id !== t.id));
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not delete teacher');
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
            <View style={styles.cardHeadMain}>
              <Text style={styles.name} numberOfLines={1}>
                {t.name}
              </Text>
              <Badge label={t.isActive ? 'Active' : 'Inactive'} tone={t.isActive ? 'success' : 'muted'} />
            </View>
            {showActions && (
              <View style={styles.iconRow}>
                {canAssign && (
                  <IconButton
                    name="layers-outline"
                    variant="compact"
                    onPress={() => navigation.navigate('TeacherAssignments', { teacherId: t.id, teacherName: t.name })}
                  />
                )}
                {canEdit && (
                  <IconButton
                    name="create-outline"
                    variant="compact"
                    onPress={() => navigation.navigate('TeacherForm', { teacher: t })}
                  />
                )}
                {canDelete && (
                  <IconButton
                    name="trash-outline"
                    variant="compact"
                    color={colors.danger}
                    onPress={() => handleDelete(t)}
                  />
                )}
              </View>
            )}
          </View>
          <DataRowText label="Login ID" value={t.email} />
          <DataRowText label="Phone" value={t.phone ?? '—'} />
          <DataRowText label="Qualification" value={t.qualification ?? '—'} />
          <DataRowText label="Joined" value={formatDate(t.joiningDate)} />
        </Card>
      ))}

      {teachers && teachers.length > 0 && teachers.length < total && (
        <Button label={`Load more (${teachers.length} of ${total})`} variant="secondary" onPress={() => void loadMore()} loading={loadingMore} />
      )}
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
  cardHeadMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  name: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text, flexShrink: 1 },
  iconRow: { flexDirection: 'row', gap: spacing.xs },
});
