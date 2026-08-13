import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { HeaderLogo } from '../components/HeaderLogo';
import { HeaderLogoutButton } from '../components/HeaderLogoutButton';
import { AnnouncementsScreen } from '../screens/AnnouncementsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StudentAssignmentDetailScreen } from '../screens/student/StudentAssignmentDetailScreen';
import { StudentAssignmentsListScreen } from '../screens/student/StudentAssignmentsListScreen';
import { StudentAttendanceScreen } from '../screens/student/StudentAttendanceScreen';
import { StudentDashboardScreen } from '../screens/student/StudentDashboardScreen';
import { colors } from '../theme';
import type { StudentAssignmentsStackParamList, StudentTabsParamList } from './types';

const Tab = createBottomTabNavigator<StudentTabsParamList>();
const AssignmentsStack = createNativeStackNavigator<StudentAssignmentsStackParamList>();

// Every screen shows the EDVANCE mark + a logout icon instead of a title —
// mirrors the web app's AppShell topbar, which is identical on every page.
const brandedHeaderOptions = {
  headerTintColor: colors.primary,
  headerTitle: () => <HeaderLogo />,
  headerTitleAlign: 'center' as const,
  headerRight: () => <HeaderLogoutButton />,
};

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
      <Tab.Screen name="Announcements" component={AnnouncementsScreen} options={{ title: 'Announcements' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}
