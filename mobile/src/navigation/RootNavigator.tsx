import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { LoadingView } from '../components/LoadingView';
import { ForcedChangePasswordScreen } from '../screens/ForcedChangePasswordScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { UnsupportedRoleScreen } from '../screens/UnsupportedRoleScreen';
import { AdminTabs } from './AdminTabs';
import { brandedHeaderOptions } from './brandedHeaderOptions';
import { StudentTabs } from './StudentTabs';
import { TeacherTabs } from './TeacherTabs';

const STUDENT_ROLE = 'STUDENT';
const TEACHER_ROLE = 'TEACHER';
// DIRECTOR/PRINCIPAL/ADMIN share one "Management" permission set server-side
// (see backend/prisma/seed.ts), and SUPER_ADMIN holds every permission
// unconditionally — all four get the same admin mobile experience.
const ADMIN_TIER_ROLES = ['SUPER_ADMIN', 'DIRECTOR', 'PRINCIPAL', 'ADMIN'];

const Stack = createNativeStackNavigator();

export function RootNavigator(): React.JSX.Element {
  const { status, user } = useAuth();

  if (status === 'loading') return <LoadingView />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {status === 'unauthenticated' || !user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : user.mustChangePassword ? (
        <Stack.Screen
          name="ChangePassword"
          component={ForcedChangePasswordScreen}
          options={{ headerShown: true, ...brandedHeaderOptions }}
        />
      ) : user.role.name === STUDENT_ROLE ? (
        <Stack.Screen name="StudentApp" component={StudentTabs} />
      ) : user.role.name === TEACHER_ROLE ? (
        <Stack.Screen name="TeacherApp" component={TeacherTabs} />
      ) : ADMIN_TIER_ROLES.includes(user.role.name) ? (
        <Stack.Screen name="AdminApp" component={AdminTabs} />
      ) : (
        <Stack.Screen
          name="Unsupported"
          component={UnsupportedRoleScreen}
          options={{ headerShown: true, ...brandedHeaderOptions }}
        />
      )}
    </Stack.Navigator>
  );
}
