/**
 * Symptom onset persistence service (repository pattern).
 *
 * Mirrors services/medicationStorage.ts — the store only calls
 * `loadOnsets` / `saveOnsets`, so Firestore slots in behind these two
 * functions later with zero store or UI changes.
 *
 * DATA SENSITIVITY: onset dates and their notes ("after the crash")
 * are health data. Never logged; failures emit a generic warning.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { SymptomOnset } from '../types/models';

const STORAGE_KEY = 'healthlit.symptom_onsets.v1';

function isSymptomOnset(value: unknown): value is SymptomOnset {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.symptomType === 'string' &&
    typeof candidate.onsetDate === 'string'
  );
}

/** Returns an empty list if nothing saved or the data is unreadable. */
export async function loadOnsets(): Promise<SymptomOnset[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSymptomOnset);
  } catch {
    console.warn('[onsetStorage] Could not read saved onset dates.');
    return [];
  }
}

/** Persists all onsets. Returns false on failure. */
export async function saveOnsets(onsets: SymptomOnset[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(onsets));
    return true;
  } catch {
    console.warn('[onsetStorage] Could not save onset dates.');
    return false;
  }
}

/** Removes every saved onset (used by Clear All Data). */
export async function clearOnsets(): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    console.warn('[onsetStorage] Could not clear onset dates.');
    return false;
  }
}
