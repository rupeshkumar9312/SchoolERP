import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AnnouncementsStackNavigator } from './AnnouncementsStackNavigator';
import { brandedHeaderOptions } from './brandedHeaderOptions';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StudentAssignmentDetailScreen } from '../screens/student/StudentAssignmentDetailScreen';
import { StudentAssignmentsListScreen } from '../screens/student/StudentAssignmentsListScreen';
import { StudentAttendanceScreen } from '../screens/student/StudentAttendanceScreen';
import { StudentDashboardScreen } from '../screens/student/StudentDashboardScreen';
import { colors } from '../theme';
import type { StudentAssignmentsStackParamList, StudentTabsParamList } from './types';

const Tab = createBottomTabNavigator<StudentTabsParamList>();
const AssignmentsStack = createNativeStackNavigator<StudentAssignmentsStackParamList>();

function AssignmentsStackNavigator(): React.JSX.Element {
  return (
    <AssignmentsStack.Navigator screenOptions={brandedHeaderOptions}>
      <AssignmentsStack.Screen name="AssignmentsList" component={StudentAssignmentsListScreen} />
      <AssignmentsStack.Screen name="AssignmentDetail" component={StudentAssignmentDetailScreen} />
    </AssignmentsStack.Navigator>
  );
}

const ICONS: Record<keyof StudentTabsParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'home',
  Attendance: 'calendar',
  Assignments: 'document-text',
  Announcements: 'megaphone',
  Settings: 'settings',
};

export function StudentTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...brandedHeaderOptions,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name as keyof StudentTabsParamList]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={StudentDashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Attendance" component={StudentAttendanceScreen} options={{ title: 'Attendance' }} />
      <Tab.Screen
        name="Assignments"
        component={AssignmentsStackNavigator}
        options={{ title: 'Assignments', headerShown: false }}
      />
      <Tab.Screen
        name="Announcements"
        component={AnnouncementsStackNavigator}
        options={{ title: 'Announcements', headerShown: false }}
      />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}
