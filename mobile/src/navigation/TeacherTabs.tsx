import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AnnouncementsStackNavigator } from './AnnouncementsStackNavigator';
import { brandedHeaderOptions } from './brandedHeaderOptions';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ClassAttendanceHistoryScreen } from '../screens/teacher/ClassAttendanceHistoryScreen';
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
      <ClassesStack.Screen name="ClassAttendanceHistory" component={ClassAttendanceHistoryScreen} />
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
      <Tab.Screen
        name="Announcements"
        component={AnnouncementsStackNavigator}
        options={{ title: 'Announcements', headerShown: false }}
      />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}
