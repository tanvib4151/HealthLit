/**
 * User profile store (Zustand).
 *
 * Holds the single-user profile: name, condition, doctor, and
 * emergency contact. Feeds the "Patient Information" header on the
 * PDF doctor report.
 *
 * DATA SENSITIVITY: never log profile contents to the console.
 */

import { create } from 'zustand';

import { clearProfile as clearStoredProfile, loadProfile, saveProfile } from '../services/profileStorage';
import { syncProfileToCloud } from '../services/syncService';
import { UserProfile } from '../types/models';
import { generateId } from '../utils/id';
import { mergeSingle } from '../utils/syncMerge';

export interface ProfileFields {
  displayName: string;
  condition: string | null;
  dateOfBirth: string | null;
  primaryDoctor: string | null;
  emergencyContact: string | null;
}

interface ProfileStoreState {
  profile: UserProfile | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Creates or updates the profile with the given fields. */
  updateProfile: (fields: ProfileFields) => Promise<void>;
  /** Sets a demo profile directly. Never syncs to cloud. */
  loadDemoProfile: (fields: ProfileFields) => void;
  /** Wipes the profile (local only). */
  clearProfile: () => void;
  /** Merges a cloud profile into local (newer updatedAt wins). Called once after sign-in. */
  mergeRemoteProfile: (remote: UserProfile | null) => void;
}

export const useProfileStore = create<ProfileStoreState>((set, get) => ({
  profile: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const stored = await loadProfile();
    set({ profile: stored, hydrated: true });
  },

  updateProfile: async (fields) => {
    const now = new Date().toISOString();
    const existing = get().profile;

    const profile: UserProfile = {
      id: existing?.id ?? generateId('profile'),
      displayName: fields.displayName,
      condition: fields.condition,
      dateOfBirth: fields.dateOfBirth,
      primaryDoctor: fields.primaryDoctor,
      emergencyContact: fields.emergencyContact,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      schemaVersion: 1,
    };

    set({ profile });
    void saveProfile(profile);
    void syncProfileToCloud(profile);
  },

  loadDemoProfile: (fields) => {
    const now = new Date().toISOString();
    const profile: UserProfile = {
      id: generateId('profile'),
      displayName: fields.displayName,
      condition: fields.condition,
      dateOfBirth: fields.dateOfBirth,
      primaryDoctor: fields.primaryDoctor,
      emergencyContact: fields.emergencyContact,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    };
    set({ profile });
    void saveProfile(profile);
  },

  clearProfile: () => {
    set({ profile: null });
    void clearStoredProfile();
  },

  mergeRemoteProfile: (remote) => {
    const merged = mergeSingle(get().profile, remote);
    set({ profile: merged });
    if (merged) void saveProfile(merged);
  },
}));
