/**
 * Story pipeline — stage 4: the simplified timeline.
 *
 * Two views of the same data:
 *
 *  - `days`: one point per calendar day in the range, including days
 *    with nothing logged. Gaps are real information — a doctor reading
 *    "nothing logged Jul 8-11" learns something a compacted list of
 *    only-logged-days would hide.
 *
 *  - `segments`: the SIMPLIFIED view. Consecutive days that fall in
 *    the same severity band are merged into a single run, so a 30-day
 *    report reads as a handful of phases instead of thirty rows.
 *
 * Bands are the app's existing severity vocabulary (None / Mild /
 * Moderate / Severe) so the timeline never invents a scale the rest
 * of the app doesn't use.
 *
 * Pure functions, no React, no LLM.
 */

import { dateKeyFromLocalDate, HealthEvent, meanOf } from './healthEvents';
import { severityLabel } from './symptoms';

export interface TimelineDay {
  dateKey: string;
  /** "Jul 14" — short enough for an axis label. */
  label: string;
  entryCount: number;
  /** Mean severity across everything logged that day; null if nothing. */
  avgSeverity: number | null;
  maxSeverity: number | null;
  /** Distinct symptom labels logged that day. */
  symptomLabels: string[];
}

export interface TimelineSegment {
  startDateKey: string;
  endDateKey: string;
  /** "Jul 1 – Jul 5" or "Jul 7" for a single day. */
  label: string;
  /** "Moderate", "Severe", or "Not logged". */
  band: string;
  dayCount: number;
  /** Days within this run that actually had entries. */
  loggedDayCount: number;
  entryCount: number;
  avgSeverity: number | null;
  /** The symptoms that appeared in this run, most frequent first. */
  symptomLabels: string[];
}

export interface Timeline {
  days: TimelineDay[];
  segments: TimelineSegment[];
}

const NOT_LOGGED_BAND = 'Not logged';

/** "Jul 14" from a YYYY-MM-DD key, rendered as a local calendar date. */
export function formatDayLabelShort(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** "Jul 14, 2026" — used for range headings and the printed report. */
export function formatDayLabelLong(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function bandFor(avgSeverity: number | null): string {
  if (avgSeverity === null) return NOT_LOGGED_BAND;
  return severityLabel(Math.round(avgSeverity));
}

/** Every calendar day from start to end inclusive, as YYYY-MM-DD keys. */
function eachDayKey(startDate: Date, endDate: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(endDate);
  last.setHours(0, 0, 0, 0);
  // Hard cap: a range longer than this is a data-export question, not
  // a story, and building 100k array entries would freeze the UI.
  let guard = 0;
  while (cursor.getTime() <= last.getTime() && guard < 1000) {
    keys.push(dateKeyFromLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return keys;
}

/**
 * Builds both timeline views for the given range. `events` should
 * already be filtered to that range.
 */
export function buildTimeline(
  events: HealthEvent[],
  startDate: Date,
  endDate: Date,
): Timeline {
  const byDay = new Map<string, HealthEvent[]>();
  for (const event of events) {
    const existing = byDay.get(event.dateKey);
    if (existing) existing.push(event);
    else byDay.set(event.dateKey, [event]);
  }

  const days: TimelineDay[] = eachDayKey(startDate, endDate).map((dateKey) => {
    const dayEvents = byDay.get(dateKey) ?? [];
    const severities = dayEvents.map((event) => event.severity);
    return {
      dateKey,
      label: formatDayLabelShort(dateKey),
      entryCount: dayEvents.length,
      avgSeverity: severities.length > 0 ? meanOf(severities) : null,
      maxSeverity: severities.length > 0 ? Math.max(...severities) : null,
      symptomLabels: [...new Set(dayEvents.map((event) => event.symptomLabel))],
    };
  });

  return { days, segments: compressToSegments(days, byDay) };
}

/**
 * Banding value for day `index`, smoothed over a 3-day centred window.
 *
 * Raw per-day averages flip between bands constantly — one 8/10 entry
 * on an otherwise moderate week splits the run in three. On real data
 * that produced ~19 segments across 30 days, which is not a
 * simplified timeline, it is the day table with extra steps.
 *
 * Only the BANDING decision is smoothed. Each segment's reported
 * `avgSeverity` is still the true mean of the entries inside it, so
 * no number shown to a doctor is a smoothed number.
 *
 * A single unlogged day between logged days gets absorbed into the
 * surrounding run (and still counts against `loggedDayCount`), while
 * a genuine multi-day gap has no logged neighbours in range and stays
 * its own "Not logged" run — which is the clinically meaningful case.
 */
function smoothedBandValue(days: TimelineDay[], index: number): number | null {
  const window: number[] = [];
  for (let offset = -1; offset <= 1; offset++) {
    const day = days[index + offset];
    if (day && day.avgSeverity !== null) window.push(day.avgSeverity);
  }
  if (window.length === 0) return null;
  return meanOf(window);
}

/** True (unsmoothed) mean severity across a group of days. */
function trueAverage(group: TimelineDay[], byDay: Map<string, HealthEvent[]>): number | null {
  const severities = group
    .flatMap((day) => byDay.get(day.dateKey) ?? [])
    .map((event) => event.severity);
  return severities.length > 0 ? meanOf(severities) : null;
}

/**
 * Merges consecutive days into runs.
 *
 * Two passes, for two different reasons:
 *
 *  1. Group by the SMOOTHED band, so one spiky day doesn't split an
 *     otherwise steady week into three runs.
 *  2. Then merge neighbouring runs whose TRUE averages land in the
 *     same band, so the label on a row always agrees with the number
 *     printed next to it. Smoothed grouping alone produced rows like
 *     "Severe · avg 5.0/10", which reads as a malfunction to anyone
 *     handed the report.
 *
 * Net effect: stable, few runs; every label honest.
 */
function compressToSegments(
  days: TimelineDay[],
  byDay: Map<string, HealthEvent[]>,
): TimelineSegment[] {
  if (days.length === 0) return [];

  // Pass 1 — group by smoothed band.
  const smoothed = days.map((_, index) => bandFor(smoothedBandValue(days, index)));
  const groups: TimelineDay[][] = [];
  let current: TimelineDay[] = [days[0]];
  for (let index = 1; index < days.length; index++) {
    if (smoothed[index] === smoothed[index - 1]) current.push(days[index]);
    else {
      groups.push(current);
      current = [days[index]];
    }
  }
  groups.push(current);

  // Pass 2 — merge neighbours that share a true band.
  const merged: TimelineDay[][] = [];
  for (const group of groups) {
    const previous = merged[merged.length - 1];
    if (
      previous !== undefined &&
      bandFor(trueAverage(previous, byDay)) === bandFor(trueAverage(group, byDay))
    ) {
      merged[merged.length - 1] = [...previous, ...group];
    } else {
      merged.push(group);
    }
  }

  return merged.map((group) => {
    const first = group[0];
    const last = group[group.length - 1];
    const runEvents = group.flatMap((day) => byDay.get(day.dateKey) ?? []);
    const avgSeverity = trueAverage(group, byDay);

    const symptomCounts = new Map<string, number>();
    for (const event of runEvents) {
      symptomCounts.set(
        event.symptomLabel,
        (symptomCounts.get(event.symptomLabel) ?? 0) + 1,
      );
    }

    return {
      startDateKey: first.dateKey,
      endDateKey: last.dateKey,
      label:
        first.dateKey === last.dateKey ? first.label : `${first.label} – ${last.label}`,
      band: bandFor(avgSeverity),
      dayCount: group.length,
      loggedDayCount: group.filter((day) => day.entryCount > 0).length,
      entryCount: runEvents.length,
      avgSeverity,
      symptomLabels: [...symptomCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([label]) => label),
    };
  });
}

/** Days in the range that had at least one entry. */
export function countLoggedDays(timeline: Timeline): number {
  return timeline.days.filter((day) => day.entryCount > 0).length;
}

/** The longest run of consecutive days with nothing logged. */
export function longestGapDays(timeline: Timeline): number {
  let longest = 0;
  let run = 0;
  for (const day of timeline.days) {
    if (day.entryCount === 0) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  return longest;
}
