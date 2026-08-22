/**
 * Theme mode preference store (Zustand).
 *
 * Just one persisted string — simple enough that it doesn't need the
 * full repository-pattern service file the way entries/profile/etc.
 * do; AsyncStorage is used directly here.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeModePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'healthlit.theme_mode.v1';

interface ThemeModeStoreState {
  preference: ThemeModePreference;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setPreference: (preference: ThemeModePreference) => void;
}

function isValidPreference(value: unknown): value is ThemeModePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export const useThemeModeStore = create<ThemeModeStoreState>((set) => ({
  preference: 'system',
  hydrated: false,

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      set({
        preference: isValidPreference(stored) ? stored : 'system',
        hydrated: true,
      });
    } catch {
      console.warn('[themeModeStore] Could not read saved theme preference.');
      set({ hydrated: true });
    }
  },

  setPreference: (preference) => {
    set({ preference });
    AsyncStorage.setItem(STORAGE_KEY, preference).catch(() => {
      console.warn('[themeModeStore] Could not save theme preference.');
    });
  },
}));
