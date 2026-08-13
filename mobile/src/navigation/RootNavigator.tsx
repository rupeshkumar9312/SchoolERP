import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { HeaderLogo } from '../components/HeaderLogo';
import { HeaderLogoutButton } from '../components/HeaderLogoutButton';
import { LoadingView } from '../components/LoadingView';
import { ForcedChangePasswordScreen } from '../screens/ForcedChangePasswordScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { UnsupportedRoleScreen } from '../screens/UnsupportedRoleScreen';
import { colors } from '../theme';
import { StudentTabs } from './StudentTabs';
import { TeacherTabs } from './TeacherTabs';

const STUDENT_ROLE = 'STUDENT';
const TEACHER_ROLE = 'TEACHER';

const Stack = createNativeStackNavigator();

// Matches the branded header used across StudentTabs/TeacherTabs — these two
// screens sit outside the tabs but the user is still authenticated, so they
// get the same logo + logout treatment. Login has no session yet, so it
// keeps its own full-page branding instead.
const brandedHeaderOptions = {
  headerTintColor: colors.primary,
  headerTitle: () => <HeaderLogo />,
  headerTitleAlign: 'center' as const,
  headerRight: () => <HeaderLogoutButton />,
};

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
