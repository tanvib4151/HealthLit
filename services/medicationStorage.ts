/**
 * Medication persistence service (repository pattern), mirroring
 * services/entryStorage.ts.
 *
 * DATA SENSITIVITY: never log medication contents. Failures emit a
 * generic warning only.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Medication } from '../types/models';

const STORAGE_KEY = 'healthlit.medications.v1';

function isMedication(value: unknown): value is Medication {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string' && typeof candidate.name === 'string';
}

export async function loadMedications(): Promise<Medication[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isMedication);
  } catch {
    console.warn('[medicationStorage] Could not read saved medications.');
    return [];
  }
}

export async function saveMedications(medications: Medication[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(medications));
    return true;
  } catch {
    console.warn('[medicationStorage] Could not save medications.');
    return false;
  }
}
