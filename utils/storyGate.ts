/**
 * Story generation gate.
 *
 * A doctor-facing summary built from four scattered entries is worse
 * than no summary: it looks authoritative, reads like a full picture,
 * and isn't one. So report generation stays locked until there is
 * enough logging behind it — at least 14 of the last 20 calendar days
 * with at least one entry.
 *
 * The window is the last 20 days from today, NOT the report range the
 * user picks. A user could otherwise select a dense 3-day window and
 * satisfy any range-relative rule trivially; the gate is about
 * whether this person is logging consistently at all.
 */

import { SymptomEntry } from '../types/models';
import { dateKeyLocal } from './entryStats';
import { dateKeyFromLocalDate } from './healthEvents';

export const STORY_GATE_WINDOW_DAYS = 20;
export const STORY_GATE_REQUIRED_DAYS = 14;

export interface StoryGate {
  unlocked: boolean;
  /** Days with at least one entry inside the trailing window. */
  daysLogged: number;
  requiredDays: number;
  windowDays: number;
  /** How many more distinct days are still needed. */
  daysRemaining: number;
  /** 0-1, for a progress bar. */
  progress: number;
}

export function evaluateStoryGate(
  entries: SymptomEntry[],
  now: Date = new Date(),
): StoryGate {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (STORY_GATE_WINDOW_DAYS - 1));

  const startKey = dateKeyFromLocalDate(start);
  const endKey = dateKeyFromLocalDate(now);

  const days = new Set<string>();
  for (const entry of entries) {
    const key = dateKeyLocal(entry.loggedAt);
    if (key >= startKey && key <= endKey) days.add(key);
  }

  const daysLogged = days.size;
  return {
    unlocked: daysLogged >= STORY_GATE_REQUIRED_DAYS,
    daysLogged,
    requiredDays: STORY_GATE_REQUIRED_DAYS,
    windowDays: STORY_GATE_WINDOW_DAYS,
    daysRemaining: Math.max(0, STORY_GATE_REQUIRED_DAYS - daysLogged),
    progress: Math.min(1, daysLogged / STORY_GATE_REQUIRED_DAYS),
  };
}
