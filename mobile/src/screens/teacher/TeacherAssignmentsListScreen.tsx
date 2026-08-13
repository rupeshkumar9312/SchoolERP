import React, { useCallback, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { HomeworkAssignment, listHomeworkAssignments } from '../../api/homework';
import { ApiError } from '../../api/client';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { Touchable } from '../../components/Touchable';
import { colors, fonts, radius, spacing } from '../../theme';
import { formatDate } from '../../utils/format';
import type { TeacherAssignmentsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TeacherAssignmentsStackParamList, 'AssignmentsList'>;

export function TeacherAssignmentsListScreen({ navigation }: Props): React.JSX.Element {
  const [assignments, setAssignments] = useState<HomeworkAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listHomeworkAssignments();
      data.sort((a, b) => b.dueDate.localeCompare(a.dueDate));
      setAssignments(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) return <LoadingView />;
  if (error) return <Screen><ErrorView message={error} onRetry={load} /></Screen>;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Assignments</Text>
        <Button label="+ New" onPress={() => navigation.navigate('NewAssignment')} />
      </View>

      {assignments && assignments.length === 0 && (
        <Card><Text style={styles.muted}>No assignments yet.</Text></Card>
      )}
      {assignments?.map((a) => (
        <Touchable
          key={a.id}
          onPress={() => navigation.navigate('AssignmentDetail', { assignment: a })}
          style={styles.touchable}
        >
          <Card style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{a.title}</Text>
              {a.seriesId && <Badge label="weekly" tone="muted" />}
            </View>
            <Text style={styles.muted}>{a.class.name} - {a.section.name} · {a.subject.name}</Text>
            <View style={styles.footerRow}>
              <Text style={styles.due}>Due {formatDate(a.dueDate)}</Text>
              <Badge label={`${a.submittedCount}/${a.totalStudents} submitted`} tone="primary" />
            </View>
          </Card>
        </Touchable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  touchable: { borderRadius: radius.lg, overflow: 'hidden' },
  card: { gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  due: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
});
