import React, { useCallback, useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { listMyClassStudents, Student } from '../../api/students';
import { ApiError } from '../../api/client';
import { Card } from '../../components/Card';
import { DataRowText } from '../../components/DataRow';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { SearchInput } from '../../components/SearchInput';
import { Touchable } from '../../components/Touchable';
import { colors, fonts, radius, spacing } from '../../theme';
import type { TeacherClassesStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TeacherClassesStackParamList, 'Roster'>;

export function RosterScreen({ route, navigation }: Props): React.JSX.Element {
  const { classId, sectionId, className, sectionName } = route.params;
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const all = await listMyClassStudents();
      setStudents(all.filter((s) => s.class.id === classId && s.section.id === sectionId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load roster');
    } finally {
      setLoading(false);
    }
  }, [classId, sectionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students ?? [];
    return (students ?? []).filter((s) => s.name.toLowerCase().includes(q));
  }, [students, query]);

  if (loading) return <LoadingView />;
  if (error) return <Screen><ErrorView message={error} onRetry={load} /></Screen>;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View>
        <Text style={styles.heading}>{className} - {sectionName}</Text>
        <Text style={styles.subtitle}>Read-only — students in this class.</Text>
      </View>

      {students && students.length > 0 && (
        <SearchInput value={query} onChangeText={setQuery} placeholder="Search by name…" />
      )}

      {students && students.length === 0 && (
        <Card><Text style={styles.muted}>No students in this class yet.</Text></Card>
      )}

      {students && students.length > 0 && filtered.length === 0 && (
        <Card><Text style={styles.muted}>No students match "{query.trim()}".</Text></Card>
      )}

      {filtered.map((s) => (
        <Touchable
          key={s.id}
          style={styles.touchable}
          onPress={() =>
            navigation.navigate('StudentAttendanceHistory', {
              studentId: s.id,
              studentName: s.name,
              admissionNo: s.admissionNo,
              className: s.class.name,
              sectionName: s.section.name,
            })
          }
        >
          <Card style={styles.recordCard}>
            <DataRowText label="Admission No." value={s.admissionNo ?? '—'} />
            <DataRowText label="Name" value={s.name} />
            <DataRowText label="Class" value={s.class.name} />
            <DataRowText label="Section" value={s.section.name} />
            <DataRowText label="Guardian" value={s.guardianName ?? '—'} />
          </Card>
        </Touchable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  subtitle: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  touchable: { borderRadius: radius.md, overflow: 'hidden' },
  recordCard: { gap: 0, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.bg },
});
