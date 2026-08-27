import React, { useCallback, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { EXAM_TYPE_LABELS, Exam, deleteExamSchedule, getExam } from '../../api/exams';
import { useAuth } from '../../auth/AuthContext';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorView } from '../../components/ErrorView';
import { IconButton } from '../../components/IconButton';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { Touchable } from '../../components/Touchable';
import { colors, fonts, radius, spacing } from '../../theme';
import type { ManageStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ManageStackParamList, 'ExamDetail'>;

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

// The exam umbrella screen: name/type header + a "Class schedules" list, one
// card per independent ExamSchedule ("+ Add class" schedules another class
// with its own dates and subject list). Each card's "Manage" opens
// ExamScheduleDetailScreen for that one class's subject management.
export function ExamDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { examId } = route.params;
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('exam.edit');
  const canCreate = hasPermission('exam.create');
  const canDelete = hasPermission('exam.delete');

  const [exam, setExam] = useState<Exam | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const row = await getExam(examId);
      setExam(row);
      navigation.setOptions({ title: row.name });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load exam');
    } finally {
      setLoading(false);
    }
  }, [examId, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleRemoveSchedule = (schedule: Exam['schedules'][number]) => {
    Alert.alert(
      `Remove ${schedule.class.name} from this exam?`,
      "This deletes its dates, subjects and any marks entered for it. Can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = await deleteExamSchedule(examId, schedule.id);
              setExam(updated);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : 'Could not remove class');
            }
          },
        },
      ],
    );
  };

  if (loading) return <LoadingView />;
  if (error && !exam) return <Screen><ErrorView message={error} onRetry={load} /></Screen>;
  if (!exam) return <Screen><Text style={styles.muted}>Exam not found.</Text></Screen>;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{exam.name}</Text>
        {canEdit && (
          <Button label="Edit" variant="secondary" onPress={() => navigation.navigate('ExamForm', { exam })} />
        )}
      </View>
      <View style={styles.subtitleRow}>
        <Badge label={EXAM_TYPE_LABELS[exam.type]} tone="muted" />
        {exam.startDate && exam.endDate && (
          <Text style={styles.subtitle}>
            {toDateInputValue(exam.startDate)} – {toDateInputValue(exam.endDate)}
          </Text>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Class schedules</Text>
        {canCreate && (
          <Button label="+ Add class" onPress={() => navigation.navigate('AddExamSchedule', { examId })} />
        )}
      </View>

      {exam.schedules.length === 0 && (
        <Card><Text style={styles.muted}>No classes scheduled yet.</Text></Card>
      )}

      {exam.schedules.map((s) => (
        <Touchable
          key={s.id}
          onPress={() => navigation.navigate('ExamScheduleDetail', { examId, scheduleId: s.id })}
          style={styles.touchable}
        >
          <Card style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardHeadMain}>
                <Text style={styles.className} numberOfLines={1}>
                  {s.class.name} · {s.academicYear.name}
                </Text>
                <Badge label={s.status === 'PUBLISHED' ? 'Published' : 'Draft'} tone={s.status === 'PUBLISHED' ? 'success' : 'muted'} />
              </View>
              {canDelete && (
                <IconButton
                  name="trash-outline"
                  variant="compact"
                  color={colors.danger}
                  onPress={() => handleRemoveSchedule(s)}
                />
              )}
            </View>
            <Text style={styles.muted}>
              {toDateInputValue(s.startDate)} – {toDateInputValue(s.endDate)} · {s.subjects.length} subject
              {s.subjects.length === 1 ? '' : 's'}
            </Text>
          </Card>
        </Touchable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text, flexShrink: 1 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subtitle: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  sectionTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  touchable: { borderRadius: radius.lg, overflow: 'hidden' },
  card: { gap: spacing.xs },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardHeadMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  className: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.text, flexShrink: 1 },
});
