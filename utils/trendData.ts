/**
 * Chart data builders (Step 5). Pure transforms from entries to
 * plottable series — no React, no rendering. Day math is device-local
 * via utils/entryStats.
 */

import { CustomSymptom, SymptomEntry } from '../types/models';
import { dateKeyFromDate, dateKeyLocal } from './entryStats';
import { getSymptomOption } from './symptoms';

export interface DailySeries {
  /** One value per day, oldest → newest. null = no entry that day. */
  values: (number | null)[];
  /** Axis label per day; '' hides a label to avoid crowding. */
  labels: string[];
  /** False when every value is null (nothing to plot). */
  hasData: boolean;
}

/**
 * Max severity per day over the trailing `days` window (today
 * inclusive). Max — not average — because the worst moment of a day
 * is what flare tracking and doctor conversations care about.
 */
export function buildDailySeries(
  entries: SymptomEntry[],
  days: number,
  now: Date = new Date(),
): DailySeries {
  const maxByDay = new Map<string, number>();
  for (const entry of entries) {
    const key = dateKeyLocal(entry.loggedAt);
    const current = maxByDay.get(key);
    if (current === undefined || entry.severity > current) {
      maxByDay.set(key, entry.severity);
    }
  }

  const values: (number | null)[] = [];
  const labels: string[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setDate(day.getDate() - offset);
    const key = dateKeyFromDate(day);

    values.push(maxByDay.has(key) ? (maxByDay.get(key) as number) : null);

    if (days <= 7) {
      labels.push(day.toLocaleDateString(undefined, { weekday: 'short' }));
    } else {
      // Longer ranges: label roughly weekly so the axis stays readable.
      labels.push(
        offset % 7 === 0
          ? day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : '',
      );
    }
  }

  return { values, labels, hasData: values.some((value) => value !== null) };
}

export interface SymptomFrequency {
  type: string;
  label: string;
  tint: string;
  count: number;
}

/**
 * How often each symptom was logged in the trailing `days` window,
 * most frequent first. Symptoms never logged are omitted.
 *
 * Iterates the actually-logged types directly (rather than filtering
 * the built-in list) so custom symptom types (Tier 2) show up here
 * too, instead of being silently excluded.
 */
export function buildSymptomFrequency(
  entries: SymptomEntry[],
  days: number,
  customSymptoms: CustomSymptom[] = [],
  now: Date = new Date(),
): SymptomFrequency[] {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  cutoff.setHours(0, 0, 0, 0);

  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (new Date(entry.loggedAt) >= cutoff) {
      counts.set(entry.symptomType, (counts.get(entry.symptomType) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([type, count]) => {
      const option = getSymptomOption(type, customSymptoms);
      return { type: option.type, label: option.label, tint: option.tint, count };
    })
    .sort((a, b) => b.count - a.count);
}
