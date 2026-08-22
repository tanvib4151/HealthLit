/**
 * Entry persistence service (repository pattern).
 *
 * The store talks only to `loadEntries` / `saveEntries` — it never
 * knows what's behind them. Today that's AsyncStorage (on-device,
 * survives restarts). The Firebase (Firestore) adapter lands behind
 * these same two functions in a later step, so swapping backends
 * changes zero UI or store code.
 *
 * ENCRYPTION PATH: when at-rest encryption is added, this file is the
 * only place that changes (encrypt before setItem, decrypt after
 * getItem — e.g. a key held in expo-secure-store).
 *
 * DATA SENSITIVITY: never log stored health data. Failures emit a
 * generic warning only.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { SymptomEntry } from '../types/models';

/** Versioned key: bump alongside schemaVersion when migrating shapes. */
const STORAGE_KEY = 'healthlit.symptom_entries.v1';

/** Light shape check so one corrupted record can't break the app. */
function isSymptomEntry(value: unknown): value is SymptomEntry {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.symptomType === 'string' &&
    typeof candidate.severity === 'number' &&
    typeof candidate.loggedAt === 'string'
  );
}

/**
 * Loads all saved entries from device storage.
 * Returns [] on first launch, missing data, or unreadable data —
 * the app must always start, even if storage is corrupted.
 */
export async function loadEntries(): Promise<SymptomEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isSymptomEntry);
  } catch {
    console.warn('[entryStorage] Could not read saved entries.');
    return [];
  }
}

/**
 * Persists the full entry list to device storage.
 * Returns false on failure so callers can surface a retry if needed.
 */
export async function saveEntries(entries: SymptomEntry[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    console.warn('[entryStorage] Could not save entries.');
    return false;
  }
}
