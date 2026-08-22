/**
 * Daily reminder scheduling.
 *
 * A symptom diary is only as good as its adherence — a report built
 * from four scattered entries is exactly the thing the story gate
 * exists to refuse. A gentle daily nudge is the single largest lever
 * on whether this app is useful to someone in three months.
 *
 * DESIGN CONSTRAINTS
 *
 * Local notifications only. No push service, no server, no device
 * token, nothing transmitted — which also means nothing to disclose
 * in the privacy nutrition labels beyond what is already there.
 *
 * The notification text deliberately contains NO health information.
 * It appears on a lock screen, potentially in front of other people,
 * so it says "time for your check-in" and never names a symptom, a
 * severity, or a streak the user might not want read over their
 * shoulder.
 *
 * EVERY call here is defensive. `expo-notifications` is a native
 * module: it is absent on web, can be denied at the OS level, and
 * behaves differently across platforms. A reminder failing to
 * schedule must never break the app, so every entry point catches and
 * returns a boolean rather than throwing.
 */

import { Platform } from 'react-native';

/** Stable id so rescheduling replaces rather than accumulates. */
const CHANNEL_ID = 'healthlit-daily-reminder';

type NotificationsModule = typeof import('expo-notifications');

/**
 * Loaded at call time rather than imported at module scope.
 *
 * A static import would run on web too, where the module has no
 * native backing, and would pull the dependency into the launch path
 * of an app that works perfectly well without it. Requiring it lazily
 * means an install that somehow lacks the package degrades to
 * "reminders unavailable" instead of a white screen at startup.
 */
function loadNotifications(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

export function remindersSupported(): boolean {
  return loadNotifications() !== null;
}

/** Asks for permission. Returns false if denied or unavailable. */
export async function requestReminderPermission(): Promise<boolean> {
  const Notifications = loadNotifications();
  if (Notifications === null) return false;

  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    // canAskAgain false means the user denied it in Settings; asking
    // again would silently resolve to denied, so report honestly.
    if (existing.canAskAgain === false) return false;

    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    console.warn('[reminderService] Permission request failed.');
    return false;
  }
}

/**
 * Schedules (or reschedules) the daily reminder at a local time.
 * Cancels any existing reminder first so repeated saves can't stack
 * up into several notifications a day.
 */
export async function scheduleDailyReminder(
  hour: number,
  minute: number,
): Promise<boolean> {
  const Notifications = loadNotifications();
  if (Notifications === null) return false;

  try {
    await cancelDailyReminder();

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Daily check-in',
        importance: Notifications.AndroidImportance.DEFAULT,
        // No vibration or sound: this is a gentle nudge for someone
        // who may be unwell, not an alarm. null rather than [0] —
        // both silence it, but null states the intent instead of
        // encoding "vibrate for zero milliseconds".
        vibrationPattern: null,
        sound: null,
      });
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time for your check-in',
        body: 'A few seconds now makes your next appointment easier.',
        // No health data in the payload — see the note at the top.
        data: { kind: 'daily-reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });
    return true;
  } catch {
    console.warn('[reminderService] Could not schedule reminder.');
    return false;
  }
}

export async function cancelDailyReminder(): Promise<boolean> {
  const Notifications = loadNotifications();
  if (Notifications === null) return false;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return true;
  } catch {
    console.warn('[reminderService] Could not cancel reminder.');
    return false;
  }
}

/** "8:00 PM" — for the settings row. */
export function formatReminderTime(hour: number, minute: number): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
