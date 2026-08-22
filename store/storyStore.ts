/**
 * Story overrides store (Zustand).
 *
 * Holds per-section text the user has written to replace generated
 * copy. Persisted through services/storyStorage — the store never
 * touches AsyncStorage directly.
 *
 * Hydrated lazily by StoryScreen rather than at app launch: nothing
 * else in the app reads these, and a report the user isn't looking at
 * doesn't need its edits in memory.
 *
 * DATA SENSITIVITY: never log override contents.
 */

import { create } from 'zustand';

import {
  clearStoryOverrides,
  loadStoryOverrides,
  saveStoryOverrides,
  StoryOverrides,
} from '../services/storyStorage';
import { syncStoryOverridesToCloud } from '../services/syncService';

interface StoryStoreState {
  overrides: StoryOverrides;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Saves edited text for one section. Blank text clears the override. */
  setOverride: (sectionKey: string, text: string) => void;
  /** Restores one section to its generated text. */
  clearOverride: (sectionKey: string) => void;
  /** Restores every section (used by Clear All Data). */
  clearAllOverrides: () => void;
  /** Merges cloud edits in, preferring whatever is already local. */
  mergeRemoteOverrides: (remote: StoryOverrides) => void;
}

export const useStoryStore = create<StoryStoreState>((set, get) => ({
  overrides: {},
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const stored = await loadStoryOverrides();
    // Merge rather than replace, so an edit made while hydration was
    // still in flight isn't thrown away.
    set((state) => ({
      overrides: { ...stored, ...state.overrides },
      hydrated: true,
    }));
  },

  setOverride: (sectionKey, text) => {
    const trimmed = text.trim();
    set((state) => {
      const next = { ...state.overrides };
      if (trimmed === '') delete next[sectionKey];
      else next[sectionKey] = trimmed;
      return { overrides: next };
    });
    void saveStoryOverrides(get().overrides);
    void syncStoryOverridesToCloud(get().overrides);
  },

  clearOverride: (sectionKey) => {
    set((state) => {
      const next = { ...state.overrides };
      delete next[sectionKey];
      return { overrides: next };
    });
    void saveStoryOverrides(get().overrides);
  },

  clearAllOverrides: () => {
    set({ overrides: {} });
    void clearStoryOverrides();
  },

  mergeRemoteOverrides: (remote) => {
    // Local wins on conflict. These are sentences the person wrote
    // about their own health; silently replacing text they can see on
    // this device with a version from another one is the kind of loss
    // there is no undo for. A missing section is recoverable, an
    // overwritten paragraph is not.
    set((state) => ({ overrides: { ...remote, ...state.overrides } }));
    void saveStoryOverrides(get().overrides);
  },
}));
