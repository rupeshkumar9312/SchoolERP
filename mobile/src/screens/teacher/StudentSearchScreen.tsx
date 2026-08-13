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

type Props = NativeStackScreenProps<TeacherClassesStackParamList, 'StudentSearch'>;

export function StudentSearchScreen({ navigation }: Props): React.JSX.Element {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setStudents(await listMyClassStudents());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load students');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (students ?? []).filter(
      (s) => s.name.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q),
    );
  }, [students, query]);

  if (loading) return <LoadingView />;
  if (error) return <Screen><ErrorView message={error} onRetry={load} /></Screen>;

  return (
    <Screen>
      <View>
        <Text style={styles.heading}>Search students</Text>
        <Text style={styles.subtitle}>Find any student across your classes to view their attendance history.</Text>
      </View>

      <SearchInput value={query} onChangeText={setQuery} placeholder="Search by name or admission no…" />

      {!query.trim() && (
        <Card><Text style={styles.muted}>Start typing a student's name or admission number.</Text></Card>
      )}

      {query.trim().length > 0 && filtered.length === 0 && (
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
            <DataRowText label="Name" value={s.name} />
            <DataRowText label="Admission No." value={s.admissionNo} />
            <DataRowText label="Class" value={`${s.class.name} - ${s.section.name}`} />
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
