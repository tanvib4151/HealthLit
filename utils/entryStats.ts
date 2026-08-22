/**
 * Pure, testable stat helpers over symptom entries. No React, no
 * storage — just data in, numbers out. Used by the Home dashboard
 * (Step 4) and History (Step 5).
 *
 * All day math is device-local: a symptom logged at 11pm belongs to
 * that calendar day as the user experienced it.
 */

import { SymptomEntry } from '../types/models';

/** Local calendar day key, YYYY-MM-DD. */
export function dateKeyFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Local calendar day key for an ISO timestamp. */
export function dateKeyLocal(iso: string): string {
  return dateKeyFromDate(new Date(iso));
}

/** Entries logged on the current local calendar day. */
export function getTodayEntries(
  entries: SymptomEntry[],
  now: Date = new Date(),
): SymptomEntry[] {
  const todayKey = dateKeyFromDate(now);
  return entries.filter((entry) => dateKeyLocal(entry.loggedAt) === todayKey);
}

/**
 * The most recent entry of a given symptom type already logged on a
 * specific day, if any. Used to offer "add another reading" vs
 * "edit that one" instead of silently creating a look-alike duplicate
 * when someone logs the same symptom twice in one day.
 */
export function findLatestEntryForSymptomOnDay(
  entries: SymptomEntry[],
  symptomType: string,
  dateKey: string,
): SymptomEntry | null {
  const matches = entries.filter(
    (entry) => entry.symptomType === symptomType && dateKeyLocal(entry.loggedAt) === dateKey,
  );
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))[0];
}

export interface TodayStats {
  /**
   * Highest severity logged today, or null if nothing logged. The
   * worst moment of the day is what matters for flare tracking.
   */
  maxSeverity: number | null;
  /** Number of symptoms logged today. */
  count: number;
}

export function getTodayStats(
  entries: SymptomEntry[],
  now: Date = new Date(),
): TodayStats {
  const today = getTodayEntries(entries, now);
  if (today.length === 0) {
    return { maxSeverity: null, count: 0 };
  }
  return {
    maxSeverity: Math.max(...today.map((entry) => entry.severity)),
    count: today.length,
  };
}

/**
 * Consecutive days with at least one entry. If nothing is logged yet
 * today, the streak counts up to yesterday — a user shouldn't see
 * their streak reset at breakfast before they've had a chance to log.
 */
export function getStreakDays(
  entries: SymptomEntry[],
  now: Date = new Date(),
): number {
  const loggedDays = new Set(entries.map((entry) => dateKeyLocal(entry.loggedAt)));

  const cursor = new Date(now);
  if (!loggedDays.has(dateKeyFromDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (loggedDays.has(dateKeyFromDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Streak lengths worth a quiet acknowledgment (Tier 2 gamification).
 * Deliberately only ever used to celebrate — there is no companion
 * function that flags a *broken* streak; the app never shames a gap.
 */
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365];

export function isStreakMilestone(streak: number): boolean {
  return STREAK_MILESTONES.includes(streak);
}

/** "2:41 PM" in the device locale. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "9:00 AM" for a given hour/minute — used by fixed time-of-day pickers. */
export function formatHourMinute(hour: number, minute: number): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return formatTime(date.toISOString());
}

/**
 * Coarse time-of-day bucket for a given hour (0-23).
 *
 * Single source of truth for these boundaries — utils/storyFindings.ts
 * uses the same ranges when deciding whether a symptom concentrates in
 * a particular part of the day, and this now backs the "Morning
 * (9:00 AM)" style labels shown on individual entries. Keeping one
 * definition means a report can never disagree with itself about
 * what "morning" means.
 */
export function timeOfDayBucket(hour: number): 'Morning' | 'Afternoon' | 'Evening' | 'Night' {
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 22) return 'Evening';
  return 'Night';
}

/**
 * "Morning (9:00 AM)" for a specific logged moment.
 *
 * Used where a report shows an individual reading's time — the bucket
 * word gives an at-a-glance sense of the day, the exact time in
 * parentheses keeps it checkable against what was actually logged.
 */
export function formatTimeWithBucket(iso: string): string {
  const date = new Date(iso);
  return `${timeOfDayBucket(date.getHours())} (${formatTime(iso)})`;
}

/** "Today", "Yesterday", or "Jul 3" for a YYYY-MM-DD day key. */
export function formatDayLabel(dateKey: string, now: Date = new Date()): string {
  if (dateKey === dateKeyFromDate(now)) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === dateKeyFromDate(yesterday)) return 'Yesterday';

  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
