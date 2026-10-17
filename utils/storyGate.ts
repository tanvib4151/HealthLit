/** Compatibility helper: summaries never require a logging streak. */
import { SymptomEntry } from '../types/models';
import { dateKeyLocal } from './entryStats';
export function evaluateStoryGate(entries: SymptomEntry[], _now = new Date()) {
  return { unlocked: true, daysLogged: new Set(entries.map(e => dateKeyLocal(e.loggedAt))).size,
    requiredDays: 0, windowDays: 0, daysRemaining: 0, progress: 1 };
}
