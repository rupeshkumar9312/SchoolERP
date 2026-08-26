import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { colors, fonts, spacing } from '../../theme';
import type { ManageStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ManageStackParamList, 'ManageHome'>;

export function ManageHomeScreen({ navigation }: Props): React.JSX.Element {
  const { hasPermission, user } = useAuth();
  const isSuperAdmin = user?.role.name === 'SUPER_ADMIN';

  return (
    <Screen>
      <View>
        <Text style={styles.heading}>Manage</Text>
        <Text style={styles.subtitle}>Users, academic structure, teachers and students.</Text>
      </View>

      {hasPermission('user.view') && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Users</Text>
          <Text style={styles.muted}>Manage portal logins and role assignment.</Text>
          <Button label="Open" variant="secondary" onPress={() => navigation.navigate('UsersList')} />
        </Card>
      )}

      {hasPermission('academic.view') && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Academic Setup</Text>
          <Text style={styles.muted}>Academic years, classes, sections, subjects and holidays.</Text>
          <Button label="Open" variant="secondary" onPress={() => navigation.navigate('AcademicSetup')} />
        </Card>
      )}

      {hasPermission('teacher.view') && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Teachers</Text>
          <Text style={styles.muted}>Add teachers and manage their class/subject assignments.</Text>
          <Button label="Open" variant="secondary" onPress={() => navigation.navigate('TeachersList')} />
        </Card>
      )}

      {hasPermission('student.view') && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Students</Text>
          <Text style={styles.muted}>Admit, edit and manage every student in the school.</Text>
          <Button label="Open" variant="secondary" onPress={() => navigation.navigate('StudentsList')} />
        </Card>
      )}

      {hasPermission('exam.view') && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Exams</Text>
          <Text style={styles.muted}>Define exams, schedule classes, publish results and report cards.</Text>
          <Button label="Open" variant="secondary" onPress={() => navigation.navigate('ExamsList')} />
        </Card>
      )}

      {hasPermission('academic.view') && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Reports</Text>
          <Text style={styles.muted}>Attendance summary, defaulters and staff attendance.</Text>
          <Button label="Open" variant="secondary" onPress={() => navigation.navigate('Reports')} />
        </Card>
      )}

      {isSuperAdmin && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Audit Log</Text>
          <Text style={styles.muted}>Accountability trail — who changed what, and when.</Text>
          <Button label="Open" variant="secondary" onPress={() => navigation.navigate('AuditLog')} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  subtitle: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
  card: { gap: spacing.sm },
  cardTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
});
