/**
 * Firestore sync service.
 *
 * Deliberately has zero knowledge of any Zustand store — it only
 * pushes/pulls plain data. This keeps the dependency direction
 * one-way (stores → this file), avoiding a circular import between
 * stores and sync. The only file allowed to know about both stores
 * and this service is services/syncOrchestrator.ts.
 *
 * Every function is a silent no-op when signed out, and fails soft
 * (a console warning, never a thrown error) so a sync hiccup never
 * breaks the local-first experience.
 *
 * DATA SENSITIVITY: never log document contents, only collection
 * names in warnings.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';

import { auth, db as maybeDb } from './firebaseConfig';

/**
 * Non-null Firestore handle. Every caller runs only after
 * `currentUid()` returned non-null, which already proves the handle
 * exists; this cast keeps that proof from leaking into a dozen
 * redundant null checks.
 */
const db = maybeDb as NonNullable<typeof maybeDb>;
import {
  CustomSymptom,
  Medication,
  SymptomEntry,
  SymptomOnset,
  UserProfile,
  WellnessCheckIn,
} from '../types/models';

function currentUid(): string | null {
  // Null when Firebase isn't configured for this build, which makes
  // every sync function below a silent no-op — exactly the behaviour
  // already used for "signed out". Local-first means the app never
  // depended on any of this succeeding.
  if (auth === null || db === null) return null;
  return auth.currentUser?.uid ?? null;
}

/**
 * Runtime shape checks for data coming back from Firestore.
 *
 * Firestore Security Rules (see firestore.rules) are the real
 * security boundary — they're what stop one user from reading or
 * writing another user's documents. These checks are a second,
 * independent layer: even trusted, rule-permitted data shouldn't be
 * cast blindly, since a stale app version, a manual edit in the
 * Firebase console, or a future schema change could otherwise hand a
 * malformed object straight to a store and crash the app. Mirrors the
 * same light-validation pattern already used in every services/xStorage.ts
 * file for local data.
 */
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

function isMedication(value: unknown): value is Medication {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string' && typeof candidate.name === 'string';
}

function isCustomSymptom(value: unknown): value is CustomSymptom {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.label === 'string' &&
    typeof candidate.icon === 'string'
  );
}

function isUserProfile(value: unknown): value is UserProfile {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string' && typeof candidate.displayName === 'string';
}

async function pushCollection<T extends { id: string }>(
  collectionName: string,
  items: T[],
): Promise<void> {
  const uid = currentUid();
  if (!uid || items.length === 0) return;

  try {
    const batch = writeBatch(db);
    const colRef = collection(db, 'users', uid, collectionName);
    for (const item of items) {
      batch.set(doc(colRef, item.id), item);
    }
    await batch.commit();
  } catch {
    console.warn(`[syncService] Could not push ${collectionName} to cloud.`);
  }
}

/**
 * Pulls a collection and filters out any document that doesn't match
 * the expected shape, rather than trusting Firestore data blindly.
 * A malformed or corrupted single document is dropped silently
 * instead of crashing the merge for every other valid record.
 */
async function pullCollection<T>(
  collectionName: string,
  isValid: (value: unknown) => value is T,
): Promise<T[]> {
  const uid = currentUid();
  if (!uid) return [];

  try {
    const snapshot = await getDocs(collection(db, 'users', uid, collectionName));
    return snapshot.docs.map((docSnap) => docSnap.data()).filter(isValid);
  } catch {
    console.warn(`[syncService] Could not pull ${collectionName} from cloud.`);
    return [];
  }
}

export const syncEntriesToCloud = (entries: SymptomEntry[]) =>
  pushCollection('symptom_entries', entries);
export const pullEntriesFromCloud = () =>
  pullCollection<SymptomEntry>('symptom_entries', isSymptomEntry);

export const syncMedicationsToCloud = (medications: Medication[]) =>
  pushCollection('medications', medications);
export const pullMedicationsFromCloud = () =>
  pullCollection<Medication>('medications', isMedication);

export const syncCustomSymptomsToCloud = (customSymptoms: CustomSymptom[]) =>
  pushCollection('custom_symptoms', customSymptoms);
export const pullCustomSymptomsFromCloud = () =>
  pullCollection<CustomSymptom>('custom_symptoms', isCustomSymptom);

/** Profile is a single document rather than a collection of records. */
export async function syncProfileToCloud(profile: UserProfile): Promise<void> {
  const uid = currentUid();
  if (!uid) return;

  try {
    await writeBatch(db).set(doc(db, 'users', uid, 'profile', 'main'), profile).commit();
  } catch {
    console.warn('[syncService] Could not push profile to cloud.');
  }
}

export async function pullProfileFromCloud(): Promise<UserProfile | null> {
  const uid = currentUid();
  if (!uid) return null;

  try {
    const snap = await getDoc(doc(db, 'users', uid, 'profile', 'main'));
    if (!snap.exists()) return null;
    const data = snap.data();
    return isUserProfile(data) ? data : null;
  } catch {
    console.warn('[syncService] Could not pull profile from cloud.');
    return null;
  }
}


/* ------------------------- Onsets & story edits ---------------------- */

function isSymptomOnset(value: unknown): value is SymptomOnset {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.symptomType === 'string' &&
    typeof candidate.onsetDate === 'string'
  );
}

export const syncOnsetsToCloud = (onsets: SymptomOnset[]) =>
  pushCollection('symptom_onsets', onsets);
export const pullOnsetsFromCloud = () =>
  pullCollection<SymptomOnset>('symptom_onsets', isSymptomOnset);

/**
 * Story section edits are a plain key/value map rather than a
 * collection of records, so they sync as a SINGLE document — the same
 * shape as the profile. Modelling them as a collection would mean one
 * Firestore document per edited section, which is more writes and
 * more failure modes for what is conceptually one small object.
 */
export async function syncStoryOverridesToCloud(
  overrides: Record<string, string>,
): Promise<void> {
  const uid = currentUid();
  if (!uid) return;

  try {
    await writeBatch(db)
      .set(doc(db, 'users', uid, 'story_overrides', 'main'), { overrides })
      .commit();
  } catch {
    console.warn('[syncService] Could not push story edits to cloud.');
  }
}

export async function pullStoryOverridesFromCloud(): Promise<Record<string, string>> {
  const uid = currentUid();
  if (!uid) return {};

  try {
    const snap = await getDoc(doc(db, 'users', uid, 'story_overrides', 'main'));
    if (!snap.exists()) return {};

    const raw = (snap.data() as Record<string, unknown>).overrides;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};

    // Drop any non-string value rather than trusting the document
    // wholesale, matching how pullCollection validates each record.
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === 'string') result[key] = value;
    }
    return result;
  } catch {
    console.warn('[syncService] Could not pull story edits from cloud.');
    return {};
  }
}


/* ---------------------------- Account deletion ----------------------- */

/** Every collection this app writes under users/{uid}. */
const SYNCED_COLLECTIONS = [
  'symptom_entries',
  'wellness_checkins',
  'medications',
  'custom_symptoms',
  'symptom_onsets',
  'profile',
  'story_overrides',
];

/**
 * Deletes every cloud document belonging to the signed-in user.
 *
 * Client-side deletion is used deliberately rather than a Cloud
 * Function: this app has no backend, and adding one purely to delete
 * data would mean a service account with read access to every user's
 * health records — a far larger standing risk than the operation it
 * would be protecting. The security rules already allow a user to
 * delete their own documents and nobody else's, so doing it from the
 * client is both sufficient and narrower in blast radius.
 *
 * Returns false if any collection failed, so the caller can avoid
 * deleting the auth account while data is still orphaned in Firestore.
 */
export async function deleteAllCloudData(): Promise<boolean> {
  const uid = currentUid();
  if (!uid) return true; // Nothing signed in means nothing to delete.

  try {
    for (const collectionName of SYNCED_COLLECTIONS) {
      const snapshot = await getDocs(collection(db, 'users', uid, collectionName));
      // Sequential rather than batched: a batch caps at 500 writes and
      // would need chunking, and deletion is a rare, non-latency-
      // sensitive operation where being obviously correct matters more
      // than being fast.
      for (const docSnap of snapshot.docs) {
        await deleteDoc(docSnap.ref);
      }
    }
    return true;
  } catch {
    console.warn('[syncService] Could not delete all cloud data.');
    return false;
  }
}


function isWellnessCheckIn(value: unknown): value is WellnessCheckIn {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.mood === 'number' &&
    typeof candidate.loggedAt === 'string'
  );
}

export const syncWellnessToCloud = (checkIns: WellnessCheckIn[]) =>
  pushCollection('wellness_checkins', checkIns);
export const pullWellnessFromCloud = () =>
  pullCollection<WellnessCheckIn>('wellness_checkins', isWellnessCheckIn);
