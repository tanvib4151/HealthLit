/**
 * Story pipeline — stages 1-3: symptom extraction, entity resolution,
 * and structured health events.
 *
 * This is the front half of the Symptoms-to-Story pipeline:
 *
 *   raw entries -> extraction -> entity resolution -> health events
 *                -> timeline -> patterns -> change detection -> report
 *
 * Everything here is pure, deterministic, on-device code. NO LLM is
 * involved at any stage of building a story, which is both the cheap
 * option and the correct one: a report handed to a doctor has to be
 * traceable to the exact numbers the patient logged.
 *
 * ENTITY RESOLUTION exists because the same real-world thing can be
 * written several ways over months of logging — a custom symptom
 * typed as "Brain fog" once and "brain  fog" later is one symptom,
 * not two, and counting it as two quietly understates how often it
 * happens. Resolution is limited to case, spacing, punctuation, and a
 * small explicit synonym table. It never guesses that two different
 * words mean the same thing.
 *
 * DATA SENSITIVITY: never log events or their notes.
 */

import { CustomSymptom, SymptomEntry } from '../types/models';
import { getRegionLabel } from './bodyRegions';
import { dateKeyLocal } from './entryStats';
import { DURATION_OPTIONS, getSymptomOption } from './symptoms';

/** One logged symptom occurrence, normalized and ready to analyze. */
export interface HealthEvent {
  entryId: string;
  /** Canonical key for grouping — resolved, never shown to the user. */
  symptomKey: string;
  /** Display label, e.g. "Headache". */
  symptomLabel: string;
  severity: number;
  durationMinutes: number | null;
  /** e.g. "1–3 hours"; null when duration wasn't recorded. */
  durationLabel: string | null;
  /** Canonical trigger labels. */
  triggers: string[];
  /** Canonical relief/intervention labels. */
  reliefFactors: string[];
  /** "Feels like" descriptors, canonicalized. */
  qualities: string[];
  /** Human-readable body region labels. */
  bodyRegions: string[];
  /** Medication ids recorded against this reading. */
  medicationIds: string[];
  /** Impact note and free note, in that order, blanks removed. */
  notes: string[];
  at: Date;
  /** YYYY-MM-DD, device-local. */
  dateKey: string;
  /** 0-23. */
  hour: number;
  /** 0 = Sunday. */
  weekday: number;
}

/**
 * Explicit synonym table. Deliberately tiny and hand-written: an
 * automatic similarity match would eventually merge two genuinely
 * different symptoms, and in a clinical summary that is a much worse
 * error than leaving two spellings separate.
 */
const FACTOR_SYNONYMS: Record<string, string> = {
  meds: 'Medication',
  medications: 'Medication',
  medicine: 'Medication',
  painkillers: 'Medication',
  'pain killers': 'Medication',
  sleeping: 'Sleep',
  napping: 'Sleep',
  nap: 'Sleep',
  resting: 'Rest',
  water: 'Hydration',
  drinking_water: 'Hydration',
  'heat pack': 'Heat',
  heating_pad: 'Heat',
  'heating pad': 'Heat',
  'ice pack': 'Ice',
  cold: 'Ice',
  stress_at_work: 'Stress',
  stressed: 'Stress',
  anxiety: 'Stress',
  'bad sleep': 'Poor sleep',
  'lack of sleep': 'Poor sleep',
  insomnia: 'Poor sleep',
  exercise: 'Physical activity',
  'working out': 'Physical activity',
  walking: 'Physical activity',
};

/** Lowercase, collapse whitespace, drop trailing punctuation. */
function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]+$/g, '');
}

/** Sentence case, preserving anything the user capitalized mid-word. */
function toDisplayLabel(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed === '') return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Resolves one free-text factor to its canonical display label.
 * Exported so the pattern engine and the report can agree on names.
 */
export function resolveFactorLabel(value: string): string {
  const key = normalizeKey(value);
  const synonym = FACTOR_SYNONYMS[key];
  if (synonym) return synonym;
  return toDisplayLabel(key);
}

/** Resolves a list, dropping blanks and duplicates that collapse together. */
function resolveList(values: string[] | undefined): string[] {
  if (!values || values.length === 0) return [];
  const seen = new Map<string, string>();
  for (const raw of values) {
    if (typeof raw !== 'string' || raw.trim() === '') continue;
    const label = resolveFactorLabel(raw);
    if (label === '') continue;
    if (!seen.has(label.toLowerCase())) seen.set(label.toLowerCase(), label);
  }
  return [...seen.values()];
}

function durationLabelFor(minutes: number | null): string | null {
  if (minutes === null) return null;
  const match = DURATION_OPTIONS.find((option) => option.minutes === minutes);
  return match ? match.label : null;
}

/**
 * Stage 1-3. Converts raw entries into normalized health events,
 * oldest first. Entries with an unparseable timestamp are dropped
 * rather than silently dated to the epoch, which would corrupt every
 * downstream date calculation.
 */
export function buildHealthEvents(
  entries: SymptomEntry[],
  customSymptoms: CustomSymptom[] = [],
): HealthEvent[] {
  const events: HealthEvent[] = [];

  for (const entry of entries) {
    const at = new Date(entry.loggedAt);
    if (Number.isNaN(at.getTime())) continue;
    if (typeof entry.severity !== 'number' || Number.isNaN(entry.severity)) continue;

    const option = getSymptomOption(entry.symptomType, customSymptoms);
    const notes = [entry.impactNote, entry.note]
      .filter((text): text is string => typeof text === 'string' && text.trim() !== '')
      .map((text) => text.trim());

    events.push({
      entryId: entry.id,
      // Custom symptoms are resolved by LABEL, not by id: renaming or
      // recreating a custom symptom shouldn't split its history in two.
      symptomKey: normalizeKey(option.label),
      symptomLabel: option.label,
      severity: entry.severity,
      durationMinutes: entry.durationMinutes,
      durationLabel: durationLabelFor(entry.durationMinutes),
      triggers: resolveList(entry.triggers),
      reliefFactors: resolveList(entry.reliefFactors),
      qualities: resolveList(entry.qualities),
      bodyRegions: (entry.bodyRegions ?? []).map((id) => getRegionLabel(id)),
      medicationIds: entry.medicationIds ?? [],
      notes,
      at,
      dateKey: dateKeyLocal(entry.loggedAt),
      hour: at.getHours(),
      weekday: at.getDay(),
    });
  }

  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Inclusive-by-calendar-day filter between two dates. */
export function filterEventsToRange(
  events: HealthEvent[],
  startDate: Date,
  endDate: Date,
): HealthEvent[] {
  const startKey = dateKeyFromLocalDate(startDate);
  const endKey = dateKeyFromLocalDate(endDate);
  return events.filter((event) => event.dateKey >= startKey && event.dateKey <= endKey);
}

/** YYYY-MM-DD for a Date, using local calendar days (not UTC). */
export function dateKeyFromLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Number of calendar days covered by a range, inclusive of both ends. */
export function daysInRange(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return Math.max(1, diff + 1);
}

/** Groups events by their canonical symptom, most-logged first. */
export function groupBySymptom(events: HealthEvent[]): Map<string, HealthEvent[]> {
  const groups = new Map<string, HealthEvent[]>();
  for (const event of events) {
    const existing = groups.get(event.symptomKey);
    if (existing) existing.push(event);
    else groups.set(event.symptomKey, [event]);
  }
  return new Map(
    [...groups.entries()].sort((a, b) => b[1].length - a[1].length),
  );
}

/** Distinct calendar days present in a set of events. */
export function distinctDayKeys(events: HealthEvent[]): string[] {
  return [...new Set(events.map((event) => event.dateKey))].sort();
}

export function meanOf(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Counts occurrences of each label across events, highest first. */
export function tally(
  events: HealthEvent[],
  pick: (event: HealthEvent) => string[],
): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    for (const label of pick(event)) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
