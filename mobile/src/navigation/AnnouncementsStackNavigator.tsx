import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AnnouncementFormScreen } from '../screens/AnnouncementFormScreen';
import { AnnouncementsScreen } from '../screens/AnnouncementsScreen';
import { brandedHeaderOptions } from './brandedHeaderOptions';
import type { AnnouncementsStackParamList } from './types';

const Stack = createNativeStackNavigator<AnnouncementsStackParamList>();

// Shared by Student/Teacher/Admin tabs — identical stack, only the
// "+ New"/Edit/Delete affordances (gated on hasPermission) differ by role.
export function AnnouncementsStackNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={brandedHeaderOptions}>
      <Stack.Screen name="AnnouncementsList" component={AnnouncementsScreen} />
      <Stack.Screen name="AnnouncementForm" component={AnnouncementFormScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
