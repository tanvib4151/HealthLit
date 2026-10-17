import { SymptomEntry } from '../types/models';
import { entryDateKey, formatTime, timeOfDayBucket } from './entryStats';
/** Legacy records retain their recorded timestamp; new unknown times are never presented as exact. */
export function formatEntryTiming(entry: SymptomEntry): string {
  if (entry.timingPrecision === 'unsure') return 'Time not sure';
  if (entry.timingPrecision === 'part_of_day') return entry.partOfDay ?? 'Time not sure';
  let time = formatTime(entry.loggedAt);
  try { if (entry.timezone) time = new Date(entry.loggedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: entry.timezone }); } catch { /* Fall back for invalid historical timezone names. */ }
  return `${time}${entry.timingPrecision ? '' : ' (legacy recorded time)'}`;
}
export function entryTimeBucket(entry: SymptomEntry): string | null {
  if (entry.timingPrecision === 'unsure') return null;
  if (entry.timingPrecision === 'part_of_day') return entry.partOfDay ?? null;
  return timeOfDayBucket(entryReportedHour(entry));
}
export function formatEntryDuration(entry: SymptomEntry): string {
  if (entry.durationPrecision === 'ongoing') return 'Still ongoing';
  if (entry.durationPrecision === 'approximate' && entry.durationDescription) return entry.durationDescription;
  if (entry.durationMinutes == null) return 'Duration not provided';
  return `${entry.durationPrecision === 'exact' ? '' : 'Approximate / legacy: '}${entry.durationMinutes} min of symptoms`;
}
export function formatContinuity(entry: SymptomEntry): string {
  const label = entry.continuity === 'continuous' ? 'Continuous' : entry.continuity === 'intermittent' ? 'Comes and goes' : 'Continuity not sure';
  const count = entry.continuity === 'intermittent' && entry.episodeCount != null ? `; ${entry.episodeCountPrecision === 'approximate' ? 'about ' : ''}${entry.episodeCount} episodes` : '';
  const window = entry.observationWindowMinutes != null ? `; observed across ${entry.observationWindowMinutes} min (not symptom duration)` : '';
  return label + count + window;
}
export function describeObservation(entry: SymptomEntry): string {
  return `${formatEntryTiming(entry)}; ${formatContinuity(entry)}; ${formatEntryDuration(entry)}`;
}
export function observationCoverage(entries: SymptomEntry[]): string {
  if (!entries.length) return '0 observations. No symptoms can be inferred for unlogged days.';
  const dates = entries.map(e => entryDateKey(e)).sort();
  return `${entries.length} observations on ${new Set(dates).size} recorded days; ${dates[0]} to ${dates[dates.length - 1]}. Unlogged days are unknown, not symptom-free.`;
}

export function entryReportedHour(entry: SymptomEntry): number {
  const at = new Date(entry.loggedAt);
  return entry.utcOffsetMinutes === undefined ? at.getHours() : new Date(at.getTime() + entry.utcOffsetMinutes * 60000).getUTCHours();
}
