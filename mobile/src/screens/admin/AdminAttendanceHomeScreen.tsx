import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { colors, fonts, spacing } from '../../theme';
import type { AdminAttendanceStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminAttendanceStackParamList, 'AttendanceHome'>;

export function AdminAttendanceHomeScreen({ navigation }: Props): React.JSX.Element {
  const { hasPermission } = useAuth();

  return (
    <Screen>
      <View>
        <Text style={styles.heading}>Attendance</Text>
        <Text style={styles.subtitle}>Look up student or staff attendance.</Text>
      </View>

      {hasPermission('attendance.student.mark') && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Mark attendance</Text>
          <Text style={styles.muted}>Mark attendance from scratch for any class, section and date.</Text>
          <Button label="Open" variant="secondary" onPress={() => navigation.navigate('MarkAttendance')} />
        </Card>
      )}

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>By class &amp; date</Text>
        <Text style={styles.muted}>View and correct attendance already marked for a class.</Text>
        <Button label="Open" variant="secondary" onPress={() => navigation.navigate('ClassAttendance')} />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>By student</Text>
        <Text style={styles.muted}>Search for any student and view their full history.</Text>
        <Button label="Open" variant="secondary" onPress={() => navigation.navigate('StudentSearch')} />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Staff attendance</Text>
        <Text style={styles.muted}>Filter by date and mark or correct any teacher's attendance.</Text>
        <Button label="Open" variant="secondary" onPress={() => navigation.navigate('StaffAttendance')} />
      </Card>
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
