import React, { useCallback, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { listMyAssignments, TeacherAssignment } from '../../api/teachers';
import { ApiError } from '../../api/client';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataRow, DataRowText } from '../../components/DataRow';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { colors, fonts, radius, spacing } from '../../theme';
import type { ClassSectionRef, TeacherClassesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TeacherClassesStackParamList, 'ClassesList'>;

function toSectionRef(a: TeacherAssignment): ClassSectionRef {
  return {
    classId: a.class.id,
    sectionId: a.section.id,
    className: a.class.name,
    sectionName: a.section.name,
  };
}

export function ClassesListScreen({ navigation }: Props): React.JSX.Element {
  const [assignments, setAssignments] = useState<TeacherAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      setAssignments(await listMyAssignments());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your classes');
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
  if (error || !assignments) return <Screen><ErrorView message={error ?? 'No data'} onRetry={load} /></Screen>;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View>
        <Text style={styles.heading}>My Classes</Text>
        <Text style={styles.subtitle}>Classes, sections and subjects assigned to you.</Text>
      </View>

      {assignments.length === 0 ? (
        <Card><Text style={styles.muted}>No assigned classes yet.</Text></Card>
      ) : (
        assignments.map((a) => (
          <Card key={a.id} style={styles.recordCard}>
            <DataRowText label="Class" value={a.class.name} />
            <DataRowText label="Section" value={a.section.name} />
            <DataRowText label="Subject" value={a.subject.name} />
            <DataRow label="Class teacher?">
              {a.isClassTeacher ? <Badge label="Yes" tone="success" /> : <Text style={styles.muted}>—</Text>}
            </DataRow>
            <View style={styles.actions}>
              {a.isClassTeacher && (
                <View style={styles.actionHalf}>
                  <Button label="Mark attendance" onPress={() => navigation.navigate('MarkAttendance', toSectionRef(a))} />
                </View>
              )}
              <View style={styles.actionHalf}>
                <Button label="Roster" variant="secondary" onPress={() => navigation.navigate('Roster', toSectionRef(a))} />
              </View>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  subtitle: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  recordCard: { gap: 0, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.bg },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionHalf: { flex: 1 },
});
