/**
 * App preferences store (Zustand).
 *
 * Onboarding completion and daily reminder settings. Persisted via
 * services/appPrefsStorage; scheduling goes through
 * services/reminderService, which is defensive about the native
 * notifications module being missing or denied.
 *
 * These are the only values in the app that are not health data.
 */

import { create } from 'zustand';

import {
  AppPrefs,
  clearAppPrefs,
  DEFAULT_PREFS,
  loadAppPrefs,
  saveAppPrefs,
} from '../services/appPrefsStorage';
import {
  cancelDailyReminder,
  requestReminderPermission,
  scheduleDailyReminder,
} from '../services/reminderService';

interface AppPrefsState {
  prefs: AppPrefs;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Marks onboarding complete. */
  completeOnboarding: () => void;
  /**
   * Turns the daily reminder on or off. Returns false when enabling
   * failed — almost always because notification permission was
   * denied — so the UI can say why instead of showing a toggle that
   * silently springs back.
   */
  setReminderEnabled: (enabled: boolean) => Promise<boolean>;
  /** Changes the reminder time, rescheduling if it is enabled. */
  setReminderTime: (hour: number, minute: number) => Promise<void>;
  /** Resets everything (used by Clear All Data). */
  clearPrefs: () => void;
}

export const useAppPrefsStore = create<AppPrefsState>((set, get) => ({
  prefs: { ...DEFAULT_PREFS },
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const stored = await loadAppPrefs();
    set({ prefs: stored, hydrated: true });

    // Re-arm on launch. iOS keeps scheduled notifications across
    // restarts, but not across a reinstall or a system-level clear —
    // rescheduling here is cheap and makes the setting authoritative
    // rather than hoping the OS still remembers.
    if (stored.reminderEnabled) {
      void scheduleDailyReminder(stored.reminderHour, stored.reminderMinute);
    }
  },

  completeOnboarding: () => {
    set((state) => ({
      prefs: { ...state.prefs, onboardedAt: new Date().toISOString() },
    }));
    void saveAppPrefs(get().prefs);
  },

  setReminderEnabled: async (enabled) => {
    if (!enabled) {
      await cancelDailyReminder();
      set((state) => ({ prefs: { ...state.prefs, reminderEnabled: false } }));
      void saveAppPrefs(get().prefs);
      return true;
    }

    const permitted = await requestReminderPermission();
    if (!permitted) return false;

    const { reminderHour, reminderMinute } = get().prefs;
    const scheduled = await scheduleDailyReminder(reminderHour, reminderMinute);
    if (!scheduled) return false;

    set((state) => ({ prefs: { ...state.prefs, reminderEnabled: true } }));
    void saveAppPrefs(get().prefs);
    return true;
  },

  setReminderTime: async (hour, minute) => {
    set((state) => ({
      prefs: { ...state.prefs, reminderHour: hour, reminderMinute: minute },
    }));
    void saveAppPrefs(get().prefs);

    if (get().prefs.reminderEnabled) {
      await scheduleDailyReminder(hour, minute);
    }
  },

  clearPrefs: () => {
    void cancelDailyReminder();
    set({ prefs: { ...DEFAULT_PREFS } });
    void clearAppPrefs();
  },
}));
