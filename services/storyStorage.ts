/**
 * Story override persistence service (repository pattern).
 *
 * Holds the text a user has written to replace a generated section —
 * most often "Why I'm seeking care", which the app cannot derive and
 * shouldn't try to. Keyed by section, not by date range, so edits
 * survive changing the report window.
 *
 * Mirrors services/profileStorage.ts: the store only calls
 * `loadStoryOverrides` / `saveStoryOverrides`, so Firestore can slot
 * in behind these later with no store or UI changes.
 *
 * DATA SENSITIVITY: these are the user's own words about their
 * health. Never log the values, only generic failure warnings.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'healthlit.story_overrides.v1';

export type StoryOverrides = Record<string, string>;

function isStoryOverrides(value: unknown): value is StoryOverrides {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (item) => typeof item === 'string',
  );
}

/** Returns an empty object when nothing has been edited yet. */
export async function loadStoryOverrides(): Promise<StoryOverrides> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};

    const parsed: unknown = JSON.parse(raw);
    return isStoryOverrides(parsed) ? parsed : {};
  } catch {
    console.warn('[storyStorage] Could not read saved story edits.');
    return {};
  }
}

/** Persists all overrides. Returns false on failure. */
export async function saveStoryOverrides(overrides: StoryOverrides): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    return true;
  } catch {
    console.warn('[storyStorage] Could not save story edits.');
    return false;
  }
}

/** Removes every saved edit (used by Clear All Data). */
export async function clearStoryOverrides(): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    console.warn('[storyStorage] Could not clear story edits.');
    return false;
  }
}
