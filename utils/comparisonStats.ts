/**
 * Week-over-week comparison stats (Tier 2). Pure transform, no React.
 * "This week" = the last 7 days including today; "last week" = the
 * 7 days before that — rolling windows, not calendar weeks, so the
 * comparison is always meaningful regardless of what day it is.
 */

import { SymptomEntry } from '../types/models';

export interface WeekStats {
  avgSeverity: number | null;
  count: number;
}

export interface WeekComparison {
  thisWeek: WeekStats;
  lastWeek: WeekStats;
  /** thisWeek.avgSeverity - lastWeek.avgSeverity; null if either side has no data. */
  severityDelta: number | null;
  countDelta: number;
}

function statsForWindow(entries: SymptomEntry[], start: Date, end: Date): WeekStats {
  const inWindow = entries.filter((entry) => {
    const loggedAt = new Date(entry.loggedAt);
    return loggedAt >= start && loggedAt < end;
  });

  if (inWindow.length === 0) {
    return { avgSeverity: null, count: 0 };
  }

  const avgSeverity =
    inWindow.reduce((sum, entry) => sum + entry.severity, 0) / inWindow.length;

  return { avgSeverity, count: inWindow.length };
}

export function getWeekComparison(
  entries: SymptomEntry[],
  now: Date = new Date(),
): WeekComparison {
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(startOfThisWeek.getDate() - 6);
  startOfThisWeek.setHours(0, 0, 0, 0);

  const endOfThisWeek = new Date(now);
  endOfThisWeek.setDate(endOfThisWeek.getDate() + 1);
  endOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const thisWeek = statsForWindow(entries, startOfThisWeek, endOfThisWeek);
  const lastWeek = statsForWindow(entries, startOfLastWeek, startOfThisWeek);

  const severityDelta =
    thisWeek.avgSeverity !== null && lastWeek.avgSeverity !== null
      ? thisWeek.avgSeverity - lastWeek.avgSeverity
      : null;

  return {
    thisWeek,
    lastWeek,
    severityDelta,
    countDelta: thisWeek.count - lastWeek.count,
  };
}
