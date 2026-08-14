import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AnnouncementsStackNavigator } from './AnnouncementsStackNavigator';
import { brandedHeaderOptions } from './brandedHeaderOptions';
import { AcademicSetupScreen } from '../screens/admin/AcademicSetupScreen';
import { AdminAttendanceHomeScreen } from '../screens/admin/AdminAttendanceHomeScreen';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminMarkAttendanceScreen } from '../screens/admin/AdminMarkAttendanceScreen';
import { AuditLogScreen } from '../screens/admin/AuditLogScreen';
import { ClassAttendanceScreen } from '../screens/admin/ClassAttendanceScreen';
import { ManageHomeScreen } from '../screens/admin/ManageHomeScreen';
import { ReportsScreen } from '../screens/admin/ReportsScreen';
import { StaffAttendanceScreen } from '../screens/admin/StaffAttendanceScreen';
import { StudentFormScreen } from '../screens/admin/StudentFormScreen';
import { StudentsBulkImportScreen } from '../screens/admin/StudentsBulkImportScreen';
import { StudentsListScreen } from '../screens/admin/StudentsListScreen';
import { TeacherAssignmentsScreen } from '../screens/admin/TeacherAssignmentsScreen';
import { TeacherFormScreen } from '../screens/admin/TeacherFormScreen';
import { TeachersListScreen } from '../screens/admin/TeachersListScreen';
import { UserFormScreen } from '../screens/admin/UserFormScreen';
import { UsersListScreen } from '../screens/admin/UsersListScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StudentAttendanceHistoryScreen } from '../screens/teacher/StudentAttendanceHistoryScreen';
import { StudentSearchScreen } from '../screens/teacher/StudentSearchScreen';
import { colors } from '../theme';
import type { AdminAttendanceStackParamList, AdminTabsParamList, ManageStackParamList } from './types';

const Tab = createBottomTabNavigator<AdminTabsParamList>();
const AttendanceStack = createNativeStackNavigator<AdminAttendanceStackParamList>();
const ManageStack = createNativeStackNavigator<ManageStackParamList>();

function AttendanceStackNavigator(): React.JSX.Element {
  return (
    <AttendanceStack.Navigator screenOptions={brandedHeaderOptions}>
      <AttendanceStack.Screen name="AttendanceHome" component={AdminAttendanceHomeScreen} />
      <AttendanceStack.Screen name="ClassAttendance" component={ClassAttendanceScreen} />
      <AttendanceStack.Screen name="MarkAttendance" component={AdminMarkAttendanceScreen} />
      <AttendanceStack.Screen name="StaffAttendance" component={StaffAttendanceScreen} />
      <AttendanceStack.Screen name="StudentSearch" component={StudentSearchScreen} />
      <AttendanceStack.Screen name="StudentAttendanceHistory" component={StudentAttendanceHistoryScreen} />
    </AttendanceStack.Navigator>
  );
}

function ManageStackNavigator(): React.JSX.Element {
  return (
    <ManageStack.Navigator screenOptions={brandedHeaderOptions}>
      <ManageStack.Screen name="ManageHome" component={ManageHomeScreen} />
      <ManageStack.Screen name="UsersList" component={UsersListScreen} />
      <ManageStack.Screen name="UserForm" component={UserFormScreen} options={{ presentation: 'modal' }} />
      <ManageStack.Screen name="AcademicSetup" component={AcademicSetupScreen} />
      <ManageStack.Screen name="TeachersList" component={TeachersListScreen} />
      <ManageStack.Screen name="TeacherForm" component={TeacherFormScreen} options={{ presentation: 'modal' }} />
      <ManageStack.Screen name="TeacherAssignments" component={TeacherAssignmentsScreen} />
      <ManageStack.Screen name="StudentsList" component={StudentsListScreen} />
      <ManageStack.Screen name="StudentForm" component={StudentFormScreen} options={{ presentation: 'modal' }} />
      <ManageStack.Screen name="StudentsBulkImport" component={StudentsBulkImportScreen} />
      <ManageStack.Screen name="Reports" component={ReportsScreen} />
      <ManageStack.Screen name="AuditLog" component={AuditLogScreen} />
    </ManageStack.Navigator>
  );
}

const ICONS: Record<keyof AdminTabsParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'home',
  Attendance: 'calendar',
  Manage: 'briefcase',
  Announcements: 'megaphone',
  Settings: 'settings',
};

export function AdminTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...brandedHeaderOptions,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name as keyof AdminTabsParamList]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen
        name="Attendance"
        component={AttendanceStackNavigator}
        options={{ title: 'Attendance', headerShown: false }}
      />
      <Tab.Screen
        name="Manage"
        component={ManageStackNavigator}
        options={{ title: 'Manage', headerShown: false }}
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
