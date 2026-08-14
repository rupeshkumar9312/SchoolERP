import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

/** Every role's tab navigator (Student/Teacher/Admin) names its
 * announcements tab "Announcements", so this resolves correctly regardless
 * of which one is currently mounted. */
export function navigateToAnnouncements(): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Announcements' as never);
  }
}
