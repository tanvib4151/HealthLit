/**
 * App preferences persistence (repository pattern).
 *
 * Holds settings that are NOT health data: whether onboarding has
 * been completed, and the daily reminder configuration. Kept separate
 * from every other storage service on purpose — these are the only
 * values in the app that would be safe to log, and separating them
 * means the health-data services never need an exception.
 *
 * Never synced to the cloud. A reminder time is device-specific;
 * pushing it between devices would mean someone's phone starts
 * buzzing at 8am because their tablet said so.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'healthlit.app_prefs.v1';

export interface AppPrefs {
  /** ISO timestamp of when onboarding was completed, or null. */
  onboardedAt: string | null;
  /** Whether a daily logging reminder is scheduled. */
  reminderEnabled: boolean;
  /** Local hour, 0-23. */
  reminderHour: number;
  /** Local minute, 0-59. */
  reminderMinute: number;
}

export const DEFAULT_PREFS: AppPrefs = {
  onboardedAt: null,
  reminderEnabled: false,
  // Evening default: most people can account for a whole day by then,
  // and a morning reminder asks them to rate a day that hasn't happened.
  reminderHour: 20,
  reminderMinute: 0,
};

function isAppPrefs(value: unknown): value is Partial<AppPrefs> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function loadAppPrefs(): Promise<AppPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ...DEFAULT_PREFS };

    const parsed: unknown = JSON.parse(raw);
    if (!isAppPrefs(parsed)) return { ...DEFAULT_PREFS };

    // Merge over defaults so a preference added in a later version
    // doesn't come back undefined for existing users.
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    console.warn('[appPrefsStorage] Could not read preferences.');
    return { ...DEFAULT_PREFS };
  }
}

export async function saveAppPrefs(prefs: AppPrefs): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    console.warn('[appPrefsStorage] Could not save preferences.');
    return false;
  }
}

export async function clearAppPrefs(): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    console.warn('[appPrefsStorage] Could not clear preferences.');
    return false;
  }
}
