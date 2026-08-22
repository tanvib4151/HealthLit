/**
 * Sync orchestrator.
 *
 * The only file in the app allowed to import both Zustand stores and
 * services/syncService — everything else keeps a one-way dependency
 * (store → syncService) to avoid circular imports. This file's job:
 * after a successful sign-in, pull everything from the cloud and
 * merge it into each store's existing local data.
 *
 * Never throws — a failed pull just means the local data (which was
 * already there before sign-in) is untouched.
 */

import { useCustomSymptomStore } from '../store/customSymptomStore';
import { useLogStore } from '../store/logStore';
import { useMedicationStore } from '../store/medicationStore';
import { useOnsetStore } from '../store/onsetStore';
import { useProfileStore } from '../store/profileStore';
import { useStoryStore } from '../store/storyStore';
import { useWellnessStore } from '../store/wellnessStore';
import {
  pullCustomSymptomsFromCloud,
  pullEntriesFromCloud,
  pullOnsetsFromCloud,
  pullMedicationsFromCloud,
  pullProfileFromCloud,
  pullStoryOverridesFromCloud,
  pullWellnessFromCloud,
} from './syncService';

/**
 * Pulls every collection from the cloud and merges each into its
 * local store. Call once, right after sign-in succeeds.
 */
export async function pullAndMergeAllFromCloud(): Promise<void> {
  try {
    const [
      remoteEntries,
      remoteMedications,
      remoteCustomSymptoms,
      remoteProfile,
      remoteOnsets,
      remoteOverrides,
      remoteWellness,
    ] = await Promise.all([
      pullEntriesFromCloud(),
      pullMedicationsFromCloud(),
      pullCustomSymptomsFromCloud(),
      pullProfileFromCloud(),
      pullOnsetsFromCloud(),
      pullStoryOverridesFromCloud(),
      pullWellnessFromCloud(),
    ]);

    useLogStore.getState().mergeRemoteEntries(remoteEntries);
    useMedicationStore.getState().mergeRemoteMedications(remoteMedications);
    useCustomSymptomStore.getState().mergeRemoteCustomSymptoms(remoteCustomSymptoms);
    useProfileStore.getState().mergeRemoteProfile(remoteProfile);
    useOnsetStore.getState().mergeRemoteOnsets(remoteOnsets);
    useStoryStore.getState().mergeRemoteOverrides(remoteOverrides);
    useWellnessStore.getState().mergeRemoteCheckIns(remoteWellness);
  } catch {
    console.warn('[syncOrchestrator] Could not complete cloud sync.');
  }
}
