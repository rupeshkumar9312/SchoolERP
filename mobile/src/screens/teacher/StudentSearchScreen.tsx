import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { listMyClassStudents, listStudents, Student } from '../../api/students';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Card } from '../../components/Card';
import { DataRowText } from '../../components/DataRow';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { SearchInput } from '../../components/SearchInput';
import { Touchable } from '../../components/Touchable';
import { colors, fonts, radius, spacing } from '../../theme';
import type { StudentRef } from '../../navigation/types';

// Deliberately not typed against a specific stack's ParamList — this screen
// is pushed from both TeacherClassesStackParamList and
// AdminAttendanceStackParamList.
interface Props {
  navigation: { navigate: (screen: 'StudentAttendanceHistory', params: StudentRef) => void };
}

/** ADMIN-tier (student.view) searches the whole school server-side; a
 * TEACHER has no student.view and instead filters their own /students/my-classes
 * roster client-side — same split as the web StudentAttendanceSearch component. */
export function StudentSearchScreen({ navigation }: Props): React.JSX.Element {
  const { hasPermission } = useAuth();
  const canSearchAll = hasPermission('student.view');

  const [myStudents, setMyStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!canSearchAll);
  const [query, setQuery] = useState('');

  const [results, setResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    if (canSearchAll) return;
    setError(null);
    try {
      setMyStudents(await listMyClassStudents());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load students');
    } finally {
      setLoading(false);
    }
  }, [canSearchAll]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }

    if (!canSearchAll) {
      const lower = q.toLowerCase();
      setResults(
        (myStudents ?? []).filter(
          (s) => s.name.toLowerCase().includes(lower) || (s.admissionNo?.toLowerCase().includes(lower) ?? false),
        ),
      );
      return;
    }

    setSearching(true);
    setError(null);
    const handle = setTimeout(() => {
      listStudents({ search: q })
        .then((result) => setResults(result.items))
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Search failed'))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, canSearchAll, myStudents]);

  if (loading) return <LoadingView />;
  if (error && !canSearchAll) return <Screen><ErrorView message={error} onRetry={load} /></Screen>;

  return (
    <Screen>
      <View>
        <Text style={styles.heading}>Search students</Text>
        <Text style={styles.subtitle}>
          {canSearchAll
            ? 'Find any student in the school to view their attendance history.'
            : 'Find any student across your classes to view their attendance history.'}
        </Text>
      </View>

      <SearchInput value={query} onChangeText={setQuery} placeholder="Search by name or admission no…" />

      {error && canSearchAll && <Text style={styles.error}>{error}</Text>}

      {!query.trim() && (
        <Card><Text style={styles.muted}>Start typing a student's name or admission number.</Text></Card>
      )}

      {query.trim().length > 0 && searching && (
        <Card><Text style={styles.muted}>Searching…</Text></Card>
      )}

      {query.trim().length > 0 && !searching && results.length === 0 && (
        <Card><Text style={styles.muted}>No students match "{query.trim()}".</Text></Card>
      )}

      {results.map((s) => (
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
            <DataRowText label="Admission No." value={s.admissionNo ?? '—'} />
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
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  touchable: { borderRadius: radius.md, overflow: 'hidden' },
  recordCard: { gap: 0, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.bg },
});
