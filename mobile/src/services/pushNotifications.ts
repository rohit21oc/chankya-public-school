import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiService } from './apiService';

/** Must match ANDROID_CHANNEL_ID in server/services/pushService.ts. */
export const ALERT_CHANNEL_ID = 'school-alerts';
/** Must match the 'fee_due' category the server sends with fee reminders. */
export const FEE_CATEGORY = 'fee_due';

export type PushSetupResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_A_DEVICE' | 'PERMISSION_DENIED' | 'NO_PROJECT_ID' | 'TOKEN_FAILED' | 'SERVER_REFUSED'; message: string };

let configured = false;

/** Shows a banner with sound even while the app is open, and creates the Android channel (sound + pop-up). */
export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  // Fee reminders carry a "Pay now" button right in the notification.
  try {
    await Notifications.setNotificationCategoryAsync(FEE_CATEGORY, [
      { identifier: 'PAY', buttonTitle: 'Pay now', options: { opensAppToForeground: true } },
      { identifier: 'MESSAGE', buttonTitle: 'Message school', options: { opensAppToForeground: true } },
    ]);
  } catch {
    // Buttons are a nicety; the notification still works without them.
  }
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(ALERT_CHANNEL_ID, {
        name: 'School alerts',
        description: 'Messages, notices, homework and fee reminders from the school',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 200, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        enableLights: true,
        lightColor: '#0B1F4B',
      });
    } catch {
      // The channel is only a nicety on top of the default one; keep going.
    }
  }
}

export type PushPermission = 'granted' | 'denied' | 'undetermined';

export async function getPushPermission(): Promise<PushPermission> {
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.granted ? 'granted' : p.canAskAgain === false ? 'denied' : p.status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

type PhoneToken = { kind: 'FCM' | 'EXPO'; token: string };

/**
 * Android: the Firebase (FCM) device token, straight from Google, no Expo account involved.
 * It needs google-services.json inside the build (see mobile/ANDROID_STUDIO_RELEASE.md).
 * Other platforms keep the Expo token when the build has an Expo project id.
 */
async function currentToken(): Promise<{ token?: PhoneToken; error?: PushSetupResult }> {
  try {
    if (Platform.OS === 'android') {
      const t = await Notifications.getDevicePushTokenAsync();
      const data = typeof t.data === 'string' ? t.data : '';
      if (!data) return { error: { ok: false, reason: 'TOKEN_FAILED', message: 'Could not get a notification token for this phone.' } };
      return { token: { kind: 'FCM', token: data } };
    }
    const projectId = (Constants as any)?.expoConfig?.extra?.eas?.projectId || (Constants as any)?.easConfig?.projectId;
    if (!projectId) return { error: { ok: false, reason: 'NO_PROJECT_ID', message: 'Phone notifications are not switched on in this version of the app. Messages and notices still show inside the app.' } };
    const t = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: { kind: 'EXPO', token: t.data } };
  } catch (e: any) {
    // Typical cause on Android: the build has no google-services.json (Firebase) yet.
    return { error: { ok: false, reason: 'TOKEN_FAILED', message: e?.message || 'Could not get a notification token for this phone.' } };
  }
}

const tokenBody = (t: PhoneToken) => (t.kind === 'FCM' ? { kind: 'FCM', fcmToken: t.token } : { kind: 'EXPO', expoToken: t.token });

/**
 * After sign-in: ask permission (once, by the system), get this phone's token and give it to the server
 * under the signed-in login. Safe to call on every launch: the server just refreshes the record.
 */
export async function registerDeviceForPush(options: { askPermission?: boolean } = {}): Promise<PushSetupResult> {
  const { askPermission = true } = options;
  if (!Device.isDevice) return { ok: false, reason: 'NOT_A_DEVICE', message: 'Notifications need a real phone.' };
  await configureNotifications();

  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && askPermission && perm.canAskAgain !== false) {
    perm = await Notifications.requestPermissionsAsync();
  }
  if (!perm.granted) return { ok: false, reason: 'PERMISSION_DENIED', message: 'Notifications are turned off for this app in the phone settings.' };

  const { token, error } = await currentToken();
  if (!token) return error as PushSetupResult;

  const r = await apiService.request('/api/push/register', 'POST', { ...tokenBody(token), platform: Platform.OS }, { retries: 1 });
  if (!r.ok) return { ok: false, reason: 'SERVER_REFUSED', message: r.error || 'The school server did not accept this phone.' };
  return { ok: true };
}

/** Before sign-out: this phone stops receiving this person's notifications. Never blocks sign-out. */
export async function unregisterDeviceForPush(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const { token } = await currentToken();
    if (token) await apiService.request('/api/push/unregister', 'POST', token.kind === 'FCM' ? { fcmToken: token.token } : { expoToken: token.token }, { timeoutMs: 3000, retries: 0 });
  } catch {
    // Signing out must always work.
  }
}

/** Calls back with the data of every notification the person taps (app open or in the background). */
export function onNotificationTapped(handler: (data: Record<string, any>) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data || {}) as Record<string, any>;
    // The "Message school" button opens the chat instead of the payment screen.
    handler(response.actionIdentifier === 'MESSAGE' ? { ...data, type: 'MESSAGE' } : data);
  });
  return () => sub.remove();
}

/** The notification that opened the app from a closed state, if any (handled once). */
export async function takeLaunchNotificationData(): Promise<Record<string, any> | null> {
  try {
    const last = await Notifications.getLastNotificationResponseAsync();
    if (!last) return null;
    return (last.notification.request.content.data || {}) as Record<string, any>;
  } catch {
    return null;
  }
}
