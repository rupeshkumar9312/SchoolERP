import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { navigateToAnnouncements, navigateToAssignments, navigateToResults } from './notificationNavigation';

function handleResponse(response: Notifications.NotificationResponse): void {
  const data = response.notification.request.content.data;
  if (data?.type === 'announcement') navigateToAnnouncements();
  if (data?.type === 'assignment') navigateToAssignments();
  if (data?.type === 'examResult') navigateToResults();
}

/** Wires up notification-tap handling for both cold starts (app was fully
 * closed, opened by tapping a notification) and warm taps (app already
 * running, foreground or backgrounded). Mount once near the navigation root. */
export function useNotificationResponseHandler(): void {
  useEffect(() => {
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, []);
}
