import React from 'react';
import { HeaderLogo } from '../components/HeaderLogo';
import { HeaderLogoutButton } from '../components/HeaderLogoutButton';
import { colors } from '../theme';

// Every screen shows the EDVANCE mark + a logout icon instead of a title —
// mirrors the web app's AppShell topbar, which is identical on every page.
// Shared across Student/Teacher/Admin tab and stack navigators.
export const brandedHeaderOptions = {
  headerTintColor: colors.primary,
  headerTitle: () => <HeaderLogo />,
  headerTitleAlign: 'center' as const,
  headerRight: () => <HeaderLogoutButton />,
};
