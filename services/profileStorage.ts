/**
 * User profile persistence service (repository pattern).
 *
 * Mirrors services/entryStorage.ts: the store only calls
 * `loadProfile` / `saveProfile`. Firebase plugs in behind these two
 * functions later with zero UI or store changes.
 *
 * DATA SENSITIVITY: profile fields (condition, emergency contact) are
 * health-adjacent data. Never log them. Failures emit a generic
 * warning only.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { UserProfile } from '../types/models';

const STORAGE_KEY = 'healthlit.user_profile.v1';

function isUserProfile(value: unknown): value is UserProfile {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string' && typeof candidate.displayName === 'string';
}

/** Returns null if no profile has been set up yet, or on unreadable data. */
export async function loadProfile(): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    return isUserProfile(parsed) ? parsed : null;
  } catch {
    console.warn('[profileStorage] Could not read saved profile.');
    return null;
  }
}

/** Persists the profile. Returns false on failure. */
export async function saveProfile(profile: UserProfile): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    console.warn('[profileStorage] Could not save profile.');
    return false;
  }
}

/** Removes the saved profile entirely (used to reset after a demo). */
export async function clearProfile(): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    console.warn('[profileStorage] Could not clear saved profile.');
    return false;
  }
}
