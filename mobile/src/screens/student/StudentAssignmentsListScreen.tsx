import React, { useCallback, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { listMyHomeworkAssignments, StudentHomeworkAssignment } from '../../api/homework';
import { ApiError } from '../../api/client';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { Touchable } from '../../components/Touchable';
import { colors, radius, spacing } from '../../theme';
import { formatDate } from '../../utils/format';
import type { StudentAssignmentsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<StudentAssignmentsStackParamList, 'AssignmentsList'>;

export function StudentAssignmentsListScreen({ navigation }: Props): React.JSX.Element {
  const [assignments, setAssignments] = useState<StudentHomeworkAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listMyHomeworkAssignments();
      data.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
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
      <Text style={styles.heading}>Assignments</Text>
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
            <Text style={styles.title}>{a.title}</Text>
            <Text style={styles.muted}>{a.subject.name} · {a.teacher.name}</Text>
            <View style={styles.footerRow}>
              <Text style={styles.due}>Due {formatDate(a.dueDate)}</Text>
              <Badge label={a.submitted ? 'Submitted' : 'Pending'} tone={a.submitted ? 'success' : 'warning'} />
            </View>
          </Card>
        </Touchable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '800', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  touchable: { borderRadius: radius.lg, overflow: 'hidden' },
  card: { gap: spacing.xs },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  due: { fontSize: 13, color: colors.textMuted },
});
