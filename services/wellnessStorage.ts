/**
 * Wellness check-in persistence (repository pattern).
 *
 * Mirrors services/entryStorage.ts. The store only calls
 * loadCheckIns / saveCheckIns, so Firestore slots in behind these
 * with no store or UI changes.
 *
 * DATA SENSITIVITY: mental health data is among the most sensitive
 * this app holds. Never logged, never included in any diagnostic
 * message, and failures emit a generic warning only.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { WellnessCheckIn } from '../types/models';

const STORAGE_KEY = 'healthlit.wellness_checkins.v1';

function isCheckIn(value: unknown): value is WellnessCheckIn {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.mood === 'number' &&
    candidate.mood >= 1 &&
    candidate.mood <= 5 &&
    typeof candidate.loggedAt === 'string'
  );
}

export async function loadCheckIns(): Promise<WellnessCheckIn[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCheckIn);
  } catch {
    console.warn('[wellnessStorage] Could not read saved check-ins.');
    return [];
  }
}

export async function saveCheckIns(checkIns: WellnessCheckIn[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(checkIns));
    return true;
  } catch {
    console.warn('[wellnessStorage] Could not save check-ins.');
    return false;
  }
}

export async function clearCheckIns(): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    console.warn('[wellnessStorage] Could not clear check-ins.');
    return false;
  }
}
