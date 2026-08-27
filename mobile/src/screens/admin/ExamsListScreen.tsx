import React, { useCallback, useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as academic from '../../api/academic';
import { ApiError } from '../../api/client';
import { EXAM_TYPE_LABELS, Exam, ExamScheduleStatus, ExamType, deleteExam, listExams } from '../../api/exams';
import { PAGE_SIZE } from '../../api/pagination';
import { useAuth } from '../../auth/AuthContext';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorView } from '../../components/ErrorView';
import { IconButton } from '../../components/IconButton';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { Touchable } from '../../components/Touchable';
import { colors, fonts, radius, spacing } from '../../theme';
import type { ManageStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ManageStackParamList, 'ExamsList'>;

const EXAM_TYPES: ExamType[] = ['CLASS_TEST', 'UNIT_TEST', 'MID_TERM', 'TERM_EXAM', 'FINAL_EXAM', 'OTHER'];
const STATUSES: ExamScheduleStatus[] = ['DRAFT', 'PUBLISHED'];

export function ExamsListScreen({ navigation }: Props): React.JSX.Element {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('exam.create');
  const canDelete = hasPermission('exam.delete');

  const [exams, setExams] = useState<Exam[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [years, setYears] = useState<academic.AcademicYear[]>([]);
  const [classes, setClasses] = useState<academic.SchoolClass[]>([]);
  const [yearId, setYearId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [type, setType] = useState<ExamType | null>(null);
  const [status, setStatus] = useState<ExamScheduleStatus | null>(null);

  useEffect(() => {
    void academic.listAcademicYears().then(setYears);
  }, []);

  useEffect(() => {
    if (yearId === null) {
      setClasses([]);
      setClassId(null);
      return;
    }
    void academic.listClasses(yearId).then(setClasses);
  }, [yearId]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await listExams({
        academicYearId: yearId ?? undefined,
        classId: classId ?? undefined,
        type: type ?? undefined,
        status: status ?? undefined,
        page: 1,
        limit: PAGE_SIZE,
      });
      setExams(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load exams');
    } finally {
      setLoading(false);
    }
  }, [yearId, classId, type, status]);

  const loadMore = async () => {
    if (!exams) return;
    setLoadingMore(true);
    try {
      const nextPage = Math.floor(exams.length / PAGE_SIZE) + 1;
      const result = await listExams({
        academicYearId: yearId ?? undefined,
        classId: classId ?? undefined,
        type: type ?? undefined,
        status: status ?? undefined,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      setExams((prev) => [...(prev ?? []), ...result.items]);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load more exams');
    } finally {
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleDelete = (exam: Exam) => {
    Alert.alert('Delete exam', `Delete "${exam.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExam(exam.id);
            setExams((prev) => (prev ?? []).filter((e) => e.id !== exam.id));
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not delete exam');
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingView />;
  if (error && !exams) return <Screen><ErrorView message={error} onRetry={load} /></Screen>;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Exams</Text>
        {canCreate && <Button label="+ New" onPress={() => navigation.navigate('ExamForm', undefined)} />}
      </View>
      <Text style={styles.subtitle}>Class tests, unit tests and term exams across the school.</Text>

      <Card style={styles.filtersCard}>
        <SelectField
          label="Academic year"
          value={yearId}
          onChange={setYearId}
          placeholder="All years"
          options={years.map((y) => ({ value: y.id, label: y.name }))}
        />
        {yearId !== null && (
          <SelectField
            label="Class"
            value={classId}
            onChange={setClassId}
            placeholder="All classes"
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
        )}
        <SelectField
          label="Type"
          value={type}
          onChange={setType}
          placeholder="All types"
          options={EXAM_TYPES.map((t) => ({ value: t, label: EXAM_TYPE_LABELS[t] }))}
        />
        <SelectField
          label="Status"
          value={status}
          onChange={setStatus}
          placeholder="All statuses"
          options={STATUSES.map((s) => ({ value: s, label: s === 'PUBLISHED' ? 'Published' : 'Draft' }))}
        />
      </Card>

      {error && exams && <Text style={styles.error}>{error}</Text>}

      {exams && exams.length === 0 && (
        <Card><Text style={styles.muted}>No exams found. Try clearing your filters, or create the first one.</Text></Card>
      )}

      {exams?.map((e) => (
        <Touchable
          key={e.id}
          onPress={() => navigation.navigate('ExamDetail', { examId: e.id })}
          style={styles.touchable}
        >
          <Card style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardHeadMain}>
                <Text style={styles.name} numberOfLines={1}>
                  {e.name}
                </Text>
                <Badge label={EXAM_TYPE_LABELS[e.type]} tone="muted" />
              </View>
              {canDelete && (
                <IconButton
                  name="trash-outline"
                  variant="compact"
                  color={colors.danger}
                  onPress={() => handleDelete(e)}
                />
              )}
            </View>

            {e.schedules.length === 0 ? (
              <Text style={styles.muted}>No classes scheduled yet.</Text>
            ) : (
              <View style={styles.classChips}>
                {e.schedules.map((s) => (
                  <Badge key={s.id} label={s.class.name} tone={s.status === 'PUBLISHED' ? 'success' : 'muted'} />
                ))}
              </View>
            )}
          </Card>
        </Touchable>
      ))}

      {exams && exams.length > 0 && exams.length < total && (
        <Button label={`Load more (${exams.length} of ${total})`} variant="secondary" onPress={() => void loadMore()} loading={loadingMore} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  filtersCard: { gap: spacing.sm },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  touchable: { borderRadius: radius.lg, overflow: 'hidden' },
  card: { gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardHeadMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  name: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text, flexShrink: 1 },
  classChips: { flexDirection: 'row', flexWrap: 'wrap', marginRight: -spacing.xs, marginBottom: -spacing.xs, gap: spacing.xs },
});
