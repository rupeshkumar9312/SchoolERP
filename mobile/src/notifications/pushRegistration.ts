import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerPushToken, unregisterPushToken } from '../api/pushTokens';

// Shows the notification banner/sound even while the app is open, instead
// of the OS's default of only surfacing it in the tray for a backgrounded app.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Requests permission (if not already granted/denied) and registers this
 * device's Expo push token with the backend for the signed-in user. Safe to
 * call on every login/app-launch — the server upserts by token, so a repeat
 * call is a no-op beyond a network round-trip. Never throws; a user simply
 * won't receive push notifications if any step fails or is declined. */
export async function registerForPushNotifications(): Promise<void> {
  try {
    if (!Device.isDevice) return; // push tokens aren't meaningful on most emulators/simulators

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerPushToken(token);
  } catch {
    // Best-effort — see doc comment above.
  }
}

/** Called on logout so a signed-out device stops receiving another user's
 * notifications. Also best-effort: if this fails, the token just goes stale
 * server-side (harmless — Expo's send API errors on it, we log and move on). */
export async function unregisterCurrentPushToken(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await unregisterPushToken(token);
  } catch {
    // Best-effort — see doc comment above.
  }
}
