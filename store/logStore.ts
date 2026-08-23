/**
 * Symptom logging store (Zustand).
 *
 * Holds the in-progress wizard draft and the list of saved entries.
 * Entries are persisted on-device through services/entryStorage and
 * hydrated once at app launch (see app/_layout.tsx).
 *
 * DATA SENSITIVITY: never log draft or entry contents to the console.
 *
 * MULTI-SYMPTOM DESIGN (v2 — per-symptom cards):
 * Selecting several symptoms in one session creates one INDEPENDENT
 * draft card per symptom. Duration, triggers, relief factors,
 * qualities, body regions, and notes are now recorded PER SYMPTOM
 * rather than shared across the session — "my headache was 7/10 for
 * most of the day, helped by a quiet room" and "my fatigue was 4/10
 * all day, nothing helped" are different clinical facts and were
 * previously being flattened into one shared context.
 *
 * Only `occurredAt` stays shared: it's answering "when did this
 * episode happen", asked once before the cards.
 *
 * Each card is COMMITTED INDEPENDENTLY the moment its Save button is
 * pressed (see `saveSymptomCard`). Abandoning a session halfway keeps
 * whatever was already saved, which matters for a user in pain who
 * may not finish. One SymptomEntry per symptom, never a blended
 * compound record — every screen and analytics function keeps working
 * unchanged because the data it sees is still ordinary individual
 * SymptomEntry records.
 */

import { create } from 'zustand';

import { loadEntries, saveEntries } from '../services/entryStorage';
import { syncEntriesToCloud } from '../services/syncService';
import { SymptomEntry } from '../types/models';
import { generateId } from '../utils/id';
import { mergeById } from '../utils/syncMerge';
import { DURATION_OPTIONS } from '../utils/symptoms';

/** Everything recorded for ONE symptom within a logging session. */
export interface PerSymptomDraft {
  symptomType: string;
  /** null until the user touches the ruler for this card. */
  severity: number | null;
  /** Key into DURATION_OPTIONS; null until chosen. */
  durationKey: string | null;
  triggers: string[];
  reliefFactors: string[];
  /** "Feels like" descriptors for THIS symptom. */
  qualities: string[];
  /** Body region ids for THIS symptom. */
  bodyRegions: string[];
  /** The patient's own words for how this symptom feels. */
  feelsLikeNote: string;
  /** Medications taken for THIS symptom around this reading. */
  medicationIds: string[];
  impactNote: string;
  note: string;
  /** True once this card has been committed to a real entry. */
  saved: boolean;
  /** Id of the entry this card created (or is editing). */
  entryId: string | null;
}

export interface LogDraft {
  /** One card per selected symptom, in selection order. */
  symptomDrafts: PerSymptomDraft[];
  /**
   * When the symptom actually happened — defaults to right now, but
   * can be moved to an earlier day/time so a forgotten entry doesn't
   * have to be logged as if it happened this instant. Becomes each
   * entry's `loggedAt`; `createdAt`/`updatedAt` always reflect when
   * the record itself was saved, not the backdated moment. Shared
   * across the session: it's one question about one episode.
   */
  occurredAt: Date;
}

function createEmptySymptomDraft(symptomType: string): PerSymptomDraft {
  return {
    symptomType,
    severity: null,
    durationKey: null,
    triggers: [],
    reliefFactors: [],
    qualities: [],
    bodyRegions: [],
    feelsLikeNote: '',
    medicationIds: [],
    impactNote: '',
    note: '',
    saved: false,
    entryId: null,
  };
}

function createEmptyDraft(): LogDraft {
  return { symptomDrafts: [], occurredAt: new Date() };
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

/** Newest first, by when the symptom occurred. */
function sortNewestFirst(entries: SymptomEntry[]): SymptomEntry[] {
  return [...entries].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
}

/** Reverse-maps stored minutes back to the wizard's duration option key. */
function durationKeyFromMinutes(minutes: number | null): string | null {
  const match = DURATION_OPTIONS.find((option) => option.minutes === minutes);
  return match ? match.key : null;
}

/** Editing always operates on exactly one existing entry/symptom. */
function draftFromEntry(entry: SymptomEntry): LogDraft {
  return {
    symptomDrafts: [
      {
        symptomType: entry.symptomType,
        severity: entry.severity,
        durationKey: durationKeyFromMinutes(entry.durationMinutes),
        triggers: entry.triggers,
        reliefFactors: entry.reliefFactors,
        qualities: entry.qualities ?? [],
        bodyRegions: entry.bodyRegions ?? [],
        feelsLikeNote: entry.feelsLikeNote ?? '',
        medicationIds: entry.medicationIds ?? [],
        impactNote: entry.impactNote ?? '',
        note: entry.note ?? '',
        saved: false,
        entryId: entry.id,
      },
    ],
    occurredAt: new Date(entry.loggedAt),
  };
}

/** Applies a patch to one card, leaving every other card untouched. */
function patchCard(
  draft: LogDraft,
  symptomType: string,
  patch: (card: PerSymptomDraft) => PerSymptomDraft,
): LogDraft {
  return {
    ...draft,
    symptomDrafts: draft.symptomDrafts.map((card) =>
      card.symptomType === symptomType ? patch(card) : card,
    ),
  };
}

interface LogStoreState {
  draft: LogDraft;
  /** Entry id currently being edited, or null when logging new entries. */
  editingEntryId: string | null;
  /** Newest first. Hydrated from device storage at launch. */
  entries: SymptomEntry[];
  /** True once saved entries have been loaded from device storage. */
  hydrated: boolean;
  /** Loads saved entries from storage. Safe to call more than once. */
  hydrate: () => Promise<void>;
  /** Adds or removes a symptom card from the current session. */
  toggleSymptomType: (symptomType: string) => void;
  setSeverityFor: (symptomType: string, severity: number) => void;
  setDurationKeyFor: (symptomType: string, durationKey: string) => void;
  toggleTriggerFor: (symptomType: string, trigger: string) => void;
  toggleReliefFor: (symptomType: string, relief: string) => void;
  toggleQualityFor: (symptomType: string, quality: string) => void;
  toggleBodyRegionFor: (symptomType: string, regionId: string) => void;
  setFeelsLikeNoteFor: (symptomType: string, text: string) => void;
  toggleMedicationFor: (symptomType: string, medicationId: string) => void;
  setImpactNoteFor: (symptomType: string, impactNote: string) => void;
  setNoteFor: (symptomType: string, note: string) => void;
  setOccurredAt: (occurredAt: Date) => void;
  /**
   * Copies everything except severity from one card onto another —
   * the "same as my headache" shortcut. Logging four symptoms from
   * scratch is otherwise four full passes through duration, factors,
   * and notes, which fights the 3-second principle.
   */
  copyCardDetails: (fromSymptomType: string, toSymptomType: string) => void;
  resetDraft: () => void;
  /**
   * Loads an existing entry's values into the draft and marks it as
   * the one being edited, so the wizard re-opens pre-filled instead
   * of starting blank.
   */
  startEditingEntry: (entry: SymptomEntry) => void;
  /**
   * Commits ONE card. Creates a new SymptomEntry, or updates the
   * existing one when this card is an edit of a saved entry (either
   * edit mode, or re-opening a card already saved this session).
   * Persists and syncs. Returns null if the card is missing or has no
   * severity yet.
   */
  saveSymptomCard: (symptomType: string) => SymptomEntry | null;
  /** Replaces all entries with a demo dataset. Never syncs to cloud. */
  loadDemoEntries: (entries: SymptomEntry[]) => void;
  /** Wipes all entries (local only — used to reset after a demo). */
  clearAllEntries: () => void;
  /**
   * Merges cloud entries into the local list (last-write-wins by
   * updatedAt) and persists the result. Called once after sign-in.
   */
  mergeRemoteEntries: (remote: SymptomEntry[]) => void;
}

export const useLogStore = create<LogStoreState>((set, get) => ({
  draft: createEmptyDraft(),
  editingEntryId: null,
  entries: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;

    const stored = await loadEntries();

    // Merge instead of replace: if an entry was saved before hydration
    // finished (unlikely but possible), nothing is lost.
    set((state) => {
      const existingIds = new Set(state.entries.map((entry) => entry.id));
      const merged = [
        ...state.entries,
        ...stored.filter((entry) => !existingIds.has(entry.id)),
      ];
      return { entries: sortNewestFirst(merged), hydrated: true };
    });

    // Re-persist the merged list so storage self-heals.
    void saveEntries(get().entries);
  },

  toggleSymptomType: (symptomType) =>
    set((state) => {
      const existing = state.draft.symptomDrafts.find(
        (card) => card.symptomType === symptomType,
      );
      if (existing) {
        // Deselecting drops the whole card, so a stale severity or
        // note can't silently resurface if it's picked again.
        return {
          draft: {
            ...state.draft,
            symptomDrafts: state.draft.symptomDrafts.filter(
              (card) => card.symptomType !== symptomType,
            ),
          },
        };
      }
      return {
        draft: {
          ...state.draft,
          symptomDrafts: [
            ...state.draft.symptomDrafts,
            createEmptySymptomDraft(symptomType),
          ],
        },
      };
    }),

  setSeverityFor: (symptomType, severity) =>
    set((state) => ({
      draft: patchCard(state.draft, symptomType, (card) => ({ ...card, severity })),
    })),

  setDurationKeyFor: (symptomType, durationKey) =>
    set((state) => ({
      draft: patchCard(state.draft, symptomType, (card) => ({ ...card, durationKey })),
    })),

  toggleTriggerFor: (symptomType, trigger) =>
    set((state) => ({
      draft: patchCard(state.draft, symptomType, (card) => ({
        ...card,
        triggers: toggleValue(card.triggers, trigger),
      })),
    })),

  toggleReliefFor: (symptomType, relief) =>
    set((state) => ({
      draft: patchCard(state.draft, symptomType, (card) => ({
        ...card,
        reliefFactors: toggleValue(card.reliefFactors, relief),
      })),
    })),

  toggleQualityFor: (symptomType, quality) =>
    set((state) => ({
      draft: patchCard(state.draft, symptomType, (card) => ({
        ...card,
        qualities: toggleValue(card.qualities, quality),
      })),
    })),

  toggleBodyRegionFor: (symptomType, regionId) =>
    set((state) => ({
      draft: patchCard(state.draft, symptomType, (card) => ({
        ...card,
        bodyRegions: toggleValue(card.bodyRegions, regionId),
      })),
    })),

  setFeelsLikeNoteFor: (symptomType, text) =>
    set((state) => ({
      draft: patchCard(state.draft, symptomType, (card) => ({
        ...card,
        feelsLikeNote: text,
      })),
    })),

  toggleMedicationFor: (symptomType, medicationId) =>
    set((state) => ({
      draft: patchCard(state.draft, symptomType, (card) => ({
        ...card,
        medicationIds: toggleValue(card.medicationIds, medicationId),
      })),
    })),

  setImpactNoteFor: (symptomType, impactNote) =>
    set((state) => ({
      draft: patchCard(state.draft, symptomType, (card) => ({ ...card, impactNote })),
    })),

  setNoteFor: (symptomType, note) =>
    set((state) => ({
      draft: patchCard(state.draft, symptomType, (card) => ({ ...card, note })),
    })),

  setOccurredAt: (occurredAt) =>
    set((state) => ({ draft: { ...state.draft, occurredAt } })),

  copyCardDetails: (fromSymptomType, toSymptomType) =>
    set((state) => {
      const source = state.draft.symptomDrafts.find(
        (card) => card.symptomType === fromSymptomType,
      );
      if (!source) return {};
      return {
        draft: patchCard(state.draft, toSymptomType, (card) => ({
          ...card,
          // Severity deliberately NOT copied: two symptoms being
          // equally severe is a coincidence, not a default.
          durationKey: source.durationKey,
          feelsLikeNote: source.feelsLikeNote,
          medicationIds: [...source.medicationIds],
          triggers: [...source.triggers],
          reliefFactors: [...source.reliefFactors],
          qualities: [...source.qualities],
          bodyRegions: [...source.bodyRegions],
          impactNote: source.impactNote,
          note: source.note,
        })),
      };
    }),

  resetDraft: () => set({ draft: createEmptyDraft(), editingEntryId: null }),

  startEditingEntry: (entry) =>
    set({ draft: draftFromEntry(entry), editingEntryId: entry.id }),

  saveSymptomCard: (symptomType) => {
    const { draft, entries } = get();
    const card = draft.symptomDrafts.find((item) => item.symptomType === symptomType);
    if (!card || card.severity === null) return null;

    const duration = DURATION_OPTIONS.find((option) => option.key === card.durationKey);
    const nowIso = new Date().toISOString();

    const shared = {
      symptomType: card.symptomType,
      severity: card.severity,
      durationMinutes: duration ? duration.minutes : null,
      triggers: card.triggers,
      reliefFactors: card.reliefFactors,
      qualities: card.qualities,
      bodyRegions: card.bodyRegions,
      feelsLikeNote:
        card.feelsLikeNote.trim() !== '' ? card.feelsLikeNote.trim() : null,
      medicationIds: card.medicationIds,
      impactNote: card.impactNote.trim() !== '' ? card.impactNote.trim() : null,
      note: card.note.trim() !== '' ? card.note.trim() : null,
      // loggedAt reflects when the symptom actually happened (possibly
      // backdated); createdAt/updatedAt reflect when this record was
      // written — always the real current moment.
      loggedAt: draft.occurredAt.toISOString(),
      updatedAt: nowIso,
    };

    // An existing entryId means this card is updating a real record:
    // either edit mode, or the user re-opened a card they already
    // saved earlier in this same session to correct something.
    const existing =
      card.entryId !== null ? entries.find((entry) => entry.id === card.entryId) : undefined;

    const result: SymptomEntry = existing
      ? { ...existing, ...shared }
      : {
          id: generateId('entry'),
          ...shared,
          createdAt: nowIso,
          schemaVersion: 1,
        };

    set((state) => ({
      entries: sortNewestFirst(
        existing
          ? state.entries.map((entry) => (entry.id === result.id ? result : entry))
          : [result, ...state.entries],
      ),
      draft: patchCard(state.draft, symptomType, (item) => ({
        ...item,
        saved: true,
        entryId: result.id,
      })),
    }));

    // Persist in the background; the service warns (generically) on failure.
    void saveEntries(get().entries);
    // Best-effort cloud backup — a silent no-op if not signed in.
    void syncEntriesToCloud(get().entries);

    return result;
  },

  /**
   * Replaces all entries with a fresh demo dataset for the given
   * seed (see utils/demoData.ts). Never pushes to cloud — a demo
   * dataset has no business overwriting a real signed-in account's
   * synced data.
   */
  loadDemoEntries: (entries) => {
    set({ entries: sortNewestFirst(entries) });
    void saveEntries(get().entries);
  },

  clearAllEntries: () => {
    set({ entries: [] });
    void saveEntries([]);
  },

  mergeRemoteEntries: (remote) => {
    set((state) => ({ entries: sortNewestFirst(mergeById(state.entries, remote)) }));
    void saveEntries(get().entries);
  },
}));
