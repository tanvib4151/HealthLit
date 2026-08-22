/**
 * Symptom onset store (Zustand).
 *
 * Holds when each tracked symptom actually began, as reported by the
 * user. Persisted through services/onsetStorage — the store never
 * touches AsyncStorage directly.
 *
 * This exists because "when did it start" is the second question in
 * any consultation and is NOT derivable from log data. The first
 * logged entry is when someone downloaded the app, which is a
 * different fact and was previously being presented in its place.
 *
 * DATA SENSITIVITY: never log onset notes.
 */

import { create } from 'zustand';

import { clearOnsets, loadOnsets, saveOnsets } from '../services/onsetStorage';
import { syncOnsetsToCloud } from '../services/syncService';
import { SymptomOnset } from '../types/models';
import { generateId } from '../utils/id';

interface OnsetStoreState {
  onsets: SymptomOnset[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Creates or replaces the onset record for a symptom type. */
  setOnset: (
    symptomType: string,
    onsetDate: string,
    precision: SymptomOnset['precision'],
    note?: string | null,
  ) => void;
  removeOnset: (symptomType: string) => void;
  getOnset: (symptomType: string) => SymptomOnset | undefined;
  clearAllOnsets: () => void;
  /**
   * Merges cloud onsets into the local list, last-write-wins by
   * updatedAt. Called once after sign-in.
   */
  mergeRemoteOnsets: (remote: SymptomOnset[]) => void;
}

export const useOnsetStore = create<OnsetStoreState>((set, get) => ({
  onsets: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const stored = await loadOnsets();
    set((state) => {
      const existing = new Set(state.onsets.map((onset) => onset.symptomType));
      return {
        onsets: [
          ...state.onsets,
          ...stored.filter((onset) => !existing.has(onset.symptomType)),
        ],
        hydrated: true,
      };
    });
  },

  setOnset: (symptomType, onsetDate, precision, note = null) => {
    const now = new Date().toISOString();
    set((state) => {
      const existing = state.onsets.find((onset) => onset.symptomType === symptomType);
      const record: SymptomOnset = existing
        ? { ...existing, onsetDate, precision, note, updatedAt: now }
        : {
            id: generateId('onset'),
            symptomType,
            onsetDate,
            precision,
            note,
            createdAt: now,
            updatedAt: now,
            schemaVersion: 1,
          };
      return {
        onsets: [
          ...state.onsets.filter((onset) => onset.symptomType !== symptomType),
          record,
        ],
      };
    });
    void saveOnsets(get().onsets);
    void syncOnsetsToCloud(get().onsets);
  },

  removeOnset: (symptomType) => {
    set((state) => ({
      onsets: state.onsets.filter((onset) => onset.symptomType !== symptomType),
    }));
    void saveOnsets(get().onsets);
  },

  getOnset: (symptomType) =>
    get().onsets.find((onset) => onset.symptomType === symptomType),

  clearAllOnsets: () => {
    set({ onsets: [] });
    void clearOnsets();
  },

  mergeRemoteOnsets: (remote) => {
    set((state) => {
      const byType = new Map(state.onsets.map((onset) => [onset.symptomType, onset]));
      for (const incoming of remote) {
        const existing = byType.get(incoming.symptomType);
        // Keyed by symptomType rather than id: the same symptom
        // recorded on two devices produces two different ids for what
        // is conceptually one fact, and merging by id would leave
        // both.
        if (existing === undefined || incoming.updatedAt > existing.updatedAt) {
          byType.set(incoming.symptomType, incoming);
        }
      }
      return { onsets: [...byType.values()] };
    });
    void saveOnsets(get().onsets);
  },
}));
