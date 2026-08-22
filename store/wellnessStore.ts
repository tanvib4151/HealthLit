/**
 * Wellness check-in store (Zustand).
 *
 * One check-in per day. Saving twice in a day REPLACES that day's
 * entry rather than appending — "how was today" has one answer, and
 * letting it accumulate would both distort any trend and make the
 * count of low days meaningless.
 *
 * DATA SENSITIVITY: never log check-in contents.
 */

import { create } from 'zustand';

import {
  clearCheckIns,
  loadCheckIns,
  saveCheckIns,
} from '../services/wellnessStorage';
import { syncWellnessToCloud } from '../services/syncService';
import { WellnessCheckIn } from '../types/models';
import { dateKeyLocal } from '../utils/entryStats';
import { generateId } from '../utils/id';
import { hasSustainedLowMood } from '../utils/wellness';

interface WellnessState {
  checkIns: WellnessCheckIn[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Saves (or replaces) the check-in for the given day. */
  saveCheckIn: (input: {
    mood: 1 | 2 | 3 | 4 | 5;
    tags: string[];
    note: string;
    occurredAt: Date;
  }) => WellnessCheckIn;
  /** The check-in already recorded for a day, if any. */
  checkInForDate: (date: Date) => WellnessCheckIn | undefined;
  /** True when recent check-ins show a sustained low stretch. */
  showSupport: () => boolean;
  clearAllCheckIns: () => void;
  mergeRemoteCheckIns: (remote: WellnessCheckIn[]) => void;
}

function sortNewestFirst(items: WellnessCheckIn[]): WellnessCheckIn[] {
  return [...items].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
}

export const useWellnessStore = create<WellnessState>((set, get) => ({
  checkIns: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const stored = await loadCheckIns();
    set((state) => {
      const existing = new Set(state.checkIns.map((item) => item.id));
      return {
        checkIns: sortNewestFirst([
          ...state.checkIns,
          ...stored.filter((item) => !existing.has(item.id)),
        ]),
        hydrated: true,
      };
    });
  },

  saveCheckIn: ({ mood, tags, note, occurredAt }) => {
    const nowIso = new Date().toISOString();
    const dayKey = dateKeyLocal(occurredAt.toISOString());
    const existing = get().checkIns.find(
      (item) => dateKeyLocal(item.loggedAt) === dayKey,
    );

    const record: WellnessCheckIn = existing
      ? {
          ...existing,
          mood,
          tags,
          note: note.trim() !== '' ? note.trim() : null,
          updatedAt: nowIso,
        }
      : {
          id: generateId('wellness'),
          mood,
          tags,
          note: note.trim() !== '' ? note.trim() : null,
          loggedAt: occurredAt.toISOString(),
          createdAt: nowIso,
          updatedAt: nowIso,
          schemaVersion: 1,
        };

    set((state) => ({
      checkIns: sortNewestFirst(
        existing
          ? state.checkIns.map((item) => (item.id === record.id ? record : item))
          : [record, ...state.checkIns],
      ),
    }));

    void saveCheckIns(get().checkIns);
    void syncWellnessToCloud(get().checkIns);
    return record;
  },

  checkInForDate: (date) => {
    const key = dateKeyLocal(date.toISOString());
    return get().checkIns.find((item) => dateKeyLocal(item.loggedAt) === key);
  },

  showSupport: () => hasSustainedLowMood(get().checkIns),

  clearAllCheckIns: () => {
    set({ checkIns: [] });
    void clearCheckIns();
  },

  mergeRemoteCheckIns: (remote) => {
    set((state) => {
      const byDay = new Map(
        state.checkIns.map((item) => [dateKeyLocal(item.loggedAt), item]),
      );
      for (const incoming of remote) {
        const key = dateKeyLocal(incoming.loggedAt);
        const existing = byDay.get(key);
        if (existing === undefined || incoming.updatedAt > existing.updatedAt) {
          byDay.set(key, incoming);
        }
      }
      return { checkIns: sortNewestFirst([...byDay.values()]) };
    });
    void saveCheckIns(get().checkIns);
  },
}));
