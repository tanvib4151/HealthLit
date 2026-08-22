/**
 * Custom symptom store (Zustand, Tier 2).
 *
 * Holds user-added symptom types beyond the 5 built-ins. Removing a
 * custom symptom never deletes entries logged under it — those
 * entries keep the id and fall back to an "Other" label via
 * getSymptomOption (see utils/symptoms.ts).
 */

import { create } from 'zustand';

import { loadCustomSymptoms, saveCustomSymptoms } from '../services/customSymptomStorage';
import { syncCustomSymptomsToCloud } from '../services/syncService';
import { CustomSymptom } from '../types/models';
import { generateId } from '../utils/id';
import { mergeById } from '../utils/syncMerge';

interface CustomSymptomStoreState {
  customSymptoms: CustomSymptom[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addCustomSymptom: (label: string, icon: string, tint: string, tintSoft: string) => CustomSymptom;
  removeCustomSymptom: (id: string) => void;
  /** Replaces all custom symptoms with a demo dataset. Never syncs to cloud. */
  loadDemoCustomSymptoms: (customSymptoms: CustomSymptom[]) => void;
  /** Wipes all custom symptoms (local only). */
  clearAllCustomSymptoms: () => void;
  /** Merges cloud custom symptoms into local (last-write-wins). Called once after sign-in. */
  mergeRemoteCustomSymptoms: (remote: CustomSymptom[]) => void;
}

export const useCustomSymptomStore = create<CustomSymptomStoreState>((set, get) => ({
  customSymptoms: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const stored = await loadCustomSymptoms();
    set({ customSymptoms: stored, hydrated: true });
  },

  addCustomSymptom: (label, icon, tint, tintSoft) => {
    const now = new Date().toISOString();
    const symptom: CustomSymptom = {
      id: generateId('custom_symptom'),
      label,
      icon,
      tint,
      tintSoft,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    };

    set((state) => ({ customSymptoms: [...state.customSymptoms, symptom] }));
    void saveCustomSymptoms(get().customSymptoms);
    void syncCustomSymptomsToCloud(get().customSymptoms);

    return symptom;
  },

  removeCustomSymptom: (id) => {
    set((state) => ({
      customSymptoms: state.customSymptoms.filter((symptom) => symptom.id !== id),
    }));
    void saveCustomSymptoms(get().customSymptoms);
    void syncCustomSymptomsToCloud(get().customSymptoms);
  },

  loadDemoCustomSymptoms: (customSymptoms) => {
    set({ customSymptoms });
    void saveCustomSymptoms(get().customSymptoms);
  },

  clearAllCustomSymptoms: () => {
    set({ customSymptoms: [] });
    void saveCustomSymptoms([]);
  },

  mergeRemoteCustomSymptoms: (remote) => {
    set((state) => ({ customSymptoms: mergeById(state.customSymptoms, remote) }));
    void saveCustomSymptoms(get().customSymptoms);
  },
}));
