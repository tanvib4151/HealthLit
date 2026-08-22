/**
 * Medication store (Tier 1, Zustand).
 *
 * Holds the list of tracked medications, persisted on-device through
 * services/medicationStorage and hydrated once at app launch (see
 * app/_layout.tsx).
 *
 * DATA SENSITIVITY: medication data is health data. Never log to console.
 */

import { create } from 'zustand';

import { loadMedications, saveMedications } from '../services/medicationStorage';
import { syncMedicationsToCloud } from '../services/syncService';
import { Medication } from '../types/models';
import { generateId } from '../utils/id';
import { mergeById } from '../utils/syncMerge';

interface MedicationStoreState {
  medications: Medication[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addMedication: (name: string, dose: string, scheduleNote: string | null) => Medication;
  removeMedication: (id: string) => void;
  updateMedication: (id: string, name: string, dose: string, scheduleNote: string | null) => void;
  /** Replaces all medications with a demo dataset. Never syncs to cloud. */
  loadDemoMedications: (medications: Medication[]) => void;
  /** Wipes all medications (local only). */
  clearAllMedications: () => void;
  /** Merges cloud medications into local (last-write-wins). Called once after sign-in. */
  mergeRemoteMedications: (remote: Medication[]) => void;
}

export const useMedicationStore = create<MedicationStoreState>((set, get) => ({
  medications: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const stored = await loadMedications();
    set({ medications: stored, hydrated: true });
  },

  addMedication: (name, dose, scheduleNote) => {
    const now = new Date().toISOString();
    const medication: Medication = {
      id: generateId('med'),
      name,
      dose,
      scheduleNote,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    };

    set((state) => ({ medications: [medication, ...state.medications] }));
    void saveMedications(get().medications);
    void syncMedicationsToCloud(get().medications);

    return medication;
  },

  removeMedication: (id) => {
    set((state) => ({
      medications: state.medications.filter((m) => m.id !== id),
    }));
    void saveMedications(get().medications);
    void syncMedicationsToCloud(get().medications);
  },

  updateMedication: (id, name, dose, scheduleNote) => {
    set((state) => ({
      medications: state.medications.map((m) =>
        m.id === id
          ? { ...m, name, dose, scheduleNote, updatedAt: new Date().toISOString() }
          : m,
      ),
    }));
    void saveMedications(get().medications);
    void syncMedicationsToCloud(get().medications);
  },

  loadDemoMedications: (medications) => {
    set({ medications });
    void saveMedications(get().medications);
  },

  clearAllMedications: () => {
    set({ medications: [] });
    void saveMedications([]);
  },

  mergeRemoteMedications: (remote) => {
    set((state) => ({ medications: mergeById(state.medications, remote) }));
    void saveMedications(get().medications);
  },
}));
