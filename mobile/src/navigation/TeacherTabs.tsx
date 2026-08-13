import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { HeaderLogo } from '../components/HeaderLogo';
import { HeaderLogoutButton } from '../components/HeaderLogoutButton';
import { AnnouncementsScreen } from '../screens/AnnouncementsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ClassesListScreen } from '../screens/teacher/ClassesListScreen';
import { MarkAttendanceScreen } from '../screens/teacher/MarkAttendanceScreen';
import { MyAttendanceScreen } from '../screens/teacher/MyAttendanceScreen';
import { NewAssignmentScreen } from '../screens/teacher/NewAssignmentScreen';
import { RosterScreen } from '../screens/teacher/RosterScreen';
import { StudentAttendanceHistoryScreen } from '../screens/teacher/StudentAttendanceHistoryScreen';
import { StudentSearchScreen } from '../screens/teacher/StudentSearchScreen';
import { TeacherAssignmentDetailScreen } from '../screens/teacher/TeacherAssignmentDetailScreen';
import { TeacherAssignmentsListScreen } from '../screens/teacher/TeacherAssignmentsListScreen';
import { TeacherDashboardScreen } from '../screens/teacher/TeacherDashboardScreen';
import { colors } from '../theme';
import type {
  TeacherAssignmentsStackParamList,
  TeacherClassesStackParamList,
  TeacherDashboardStackParamList,
  TeacherTabsParamList,
} from './types';

const Tab = createBottomTabNavigator<TeacherTabsParamList>();
const DashboardStack = createNativeStackNavigator<TeacherDashboardStackParamList>();
const ClassesStack = createNativeStackNavigator<TeacherClassesStackParamList>();
const AssignmentsStack = createNativeStackNavigator<TeacherAssignmentsStackParamList>();

// Every screen shows the EDVANCE mark + a logout icon instead of a title —
// mirrors the web app's AppShell topbar, which is identical on every page.
const brandedHeaderOptions = {
  headerTintColor: colors.primary,
  headerTitle: () => <HeaderLogo />,
  headerTitleAlign: 'center' as const,
  headerRight: () => <HeaderLogoutButton />,
};

function DashboardStackNavigator(): React.JSX.Element {
  return (
    <DashboardStack.Navigator screenOptions={brandedHeaderOptions}>
      <DashboardStack.Screen name="DashboardHome" component={TeacherDashboardScreen} />
      <DashboardStack.Screen name="MyAttendance" component={MyAttendanceScreen} />
    </DashboardStack.Navigator>
  );
}

function ClassesStackNavigator(): React.JSX.Element {
  return (
    <ClassesStack.Navigator screenOptions={brandedHeaderOptions}>
      <ClassesStack.Screen name="ClassesList" component={ClassesListScreen} />
      <ClassesStack.Screen name="Roster" component={RosterScreen} />
      <ClassesStack.Screen name="MarkAttendance" component={MarkAttendanceScreen} />
      <ClassesStack.Screen name="StudentSearch" component={StudentSearchScreen} />
      <ClassesStack.Screen name="StudentAttendanceHistory" component={StudentAttendanceHistoryScreen} />
    </ClassesStack.Navigator>
  );
}

function AssignmentsStackNavigator(): React.JSX.Element {
  return (
    <AssignmentsStack.Navigator screenOptions={brandedHeaderOptions}>
      <AssignmentsStack.Screen name="AssignmentsList" component={TeacherAssignmentsListScreen} />
      <AssignmentsStack.Screen name="AssignmentDetail" component={TeacherAssignmentDetailScreen} />
      <AssignmentsStack.Screen name="NewAssignment" component={NewAssignmentScreen} options={{ presentation: 'modal' }} />
    </AssignmentsStack.Navigator>
  );
}

const ICONS: Record<keyof TeacherTabsParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'home',
  Classes: 'school',
  Assignments: 'document-text',
  Announcements: 'megaphone',
  Settings: 'settings',
};

export function TeacherTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...brandedHeaderOptions,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name as keyof TeacherTabsParamList]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStackNavigator}
        options={{ title: 'Dashboard', headerShown: false }}
      />
      <Tab.Screen
        name="Classes"
        component={ClassesStackNavigator}
        options={{ title: 'Classes', headerShown: false }}
      />
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
