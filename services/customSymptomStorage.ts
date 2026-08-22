/**
 * Custom symptom persistence service (repository pattern), mirroring
 * services/entryStorage.ts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { CustomSymptom } from '../types/models';

const STORAGE_KEY = 'healthlit.custom_symptoms.v1';

function isCustomSymptom(value: unknown): value is CustomSymptom {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.label === 'string' &&
    typeof candidate.icon === 'string'
  );
}

export async function loadCustomSymptoms(): Promise<CustomSymptom[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isCustomSymptom);
  } catch {
    console.warn('[customSymptomStorage] Could not read saved custom symptoms.');
    return [];
  }
}

export async function saveCustomSymptoms(symptoms: CustomSymptom[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(symptoms));
    return true;
  } catch {
    console.warn('[customSymptomStorage] Could not save custom symptoms.');
    return false;
  }
}
