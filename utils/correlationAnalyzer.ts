/**
 * Factor correlations for the Insights tab.
 *
 * WHY THIS FILE WAS REWRITTEN
 *
 * The previous implementation pooled every symptom together, compared
 * against no baseline, and reported anything appearing twice. That is
 * the indication-bias trap the story engine's adversarial tests exist
 * to catch: someone who only logs when they feel terrible would get a
 * confident "When you log ice, severity drops 3.2 points (5 times)" —
 * regression to the mean, dressed as a finding.
 *
 * Worse, it disagreed with the Story report. The same data could
 * produce a confident claim on the Insights tab and silence in the
 * clinical summary, which undermines the entire premise that this app
 * does not assert things it cannot support.
 *
 * This now DELEGATES to the same pipeline the Story report uses:
 * paired within-episode comparison, stratified per symptom, filtered
 * by effect size, subsample stability, and a permutation p-value
 * (see utils/storyStats.ts). The two screens cannot contradict each
 * other because they are the same computation.
 *
 * The exported shape is kept backwards-compatible so the old report
 * path and storyEngine keep working, with confidence fields added.
 */

import { CustomSymptom, SymptomEntry } from '../types/models';
import { buildHealthEvents, filterEventsToRange } from './healthEvents';
import { buildFactorFindings, buildRejectedFactors } from './storyFindings';
import { confidenceOf, ConfidenceTier } from './storyConfidence';

export interface FactorCorrelation {
  factor: string;
  type: 'trigger' | 'relief';
  occurrences: number;
  /**
   * Difference in severity CHANGE between readings with this factor
   * and readings without it, for the same symptom. Negative means
   * severity fell further than it did otherwise.
   *
   * Note this is no longer "average severity when logged" — that
   * number was the source of the original bug. It is a contrast
   * between two changes, which is what makes it interpretable.
   */
  avgSeverityChange: number;
  /** Retained for compatibility. Now the stability score, 0-100. */
  improvementRate: number;
  /** Pairing window in hours. */
  timeWindow: number;
  /** Which symptom this was measured within. */
  symptomLabel: string;
  confidence: ConfidenceTier;
  confidenceLabel: string;
  /** Readings behind the comparison. */
  support: number;
}

/** A factor that was tested and found NOT to hold. */
export interface CheckedFactor {
  factor: string;
  symptomLabel: string;
  reason: 'tooFewPaired' | 'differenceTooSmall' | 'notStable';
}

/** Trailing-window convenience — "last N days from today". */
function eventsForRange(
  entries: SymptomEntry[],
  days: number,
  customSymptoms: CustomSymptom[],
) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return filterEventsToRange(buildHealthEvents(entries, customSymptoms), start, end);
}

/**
 * Explicit start/end range — what a custom-range picker needs.
 *
 * Kept alongside the trailing-window version above rather than
 * replacing it: existing preset buttons (7 days, 30 days) are
 * naturally "from N days ago to today" and reads more simply that
 * way, while a custom range genuinely needs two independent
 * endpoints. Both funnel into the same buildFactorFindings /
 * buildRejectedFactors pipeline either way, so there is exactly one
 * statistical engine behind either entry point.
 */
function eventsForDateRange(
  entries: SymptomEntry[],
  startDate: Date,
  endDate: Date,
  customSymptoms: CustomSymptom[],
) {
  return filterEventsToRange(buildHealthEvents(entries, customSymptoms), startDate, endDate);
}

/**
 * Correlations over the trailing `days` window, strongest first.
 *
 * Returns only findings that clear the same bar as the clinical
 * report. Expect this to return an empty list often — that is the
 * engine working, not failing.
 */
export function analyzeCorrelations(
  entries: SymptomEntry[],
  days: number,
  customSymptoms: CustomSymptom[] = [],
): FactorCorrelation[] {
  const events = eventsForRange(entries, days, customSymptoms);

  return buildFactorFindings(events)
    .filter((finding) => finding.facts.channel !== 'medication')
    .map((finding) => {
      const confidence = confidenceOf(finding);
      return {
        factor: `${finding.facts.factor}`,
        type: finding.facts.channel === 'trigger' ? ('trigger' as const) : ('relief' as const),
        occurrences: Number(finding.facts.withCount ?? 0),
        avgSeverityChange: Number(finding.facts.contrast ?? 0),
        improvementRate: Math.round(finding.stability * 100),
        timeWindow: 24,
        symptomLabel: finding.symptomLabel ?? '',
        confidence: confidence.tier,
        confidenceLabel: confidence.label,
        support: confidence.support,
      };
    })
    .sort((a, b) => Math.abs(b.avgSeverityChange) - Math.abs(a.avgSeverityChange));
}

/**
 * Factors that were tested and did not hold up.
 *
 * Surfaced so the tab can say what it checked rather than implying
 * the question was never asked.
 */
export function checkedButNotFound(
  entries: SymptomEntry[],
  days: number,
  customSymptoms: CustomSymptom[] = [],
): CheckedFactor[] {
  const events = eventsForRange(entries, days, customSymptoms);
  const reported = new Set(
    analyzeCorrelations(entries, days, customSymptoms).map((item) =>
      item.factor.toLowerCase(),
    ),
  );

  return buildRejectedFactors(events).filter(
    (item) =>
      item.reason !== 'tooFewPaired' && !reported.has(item.factor.toLowerCase()),
  );
}

/** Same computation as analyzeCorrelations, over an explicit date range. */
export function analyzeCorrelationsInRange(
  entries: SymptomEntry[],
  startDate: Date,
  endDate: Date,
  customSymptoms: CustomSymptom[] = [],
): FactorCorrelation[] {
  const events = eventsForDateRange(entries, startDate, endDate, customSymptoms);
  return buildFactorFindings(events)
    .filter((finding) => finding.facts.channel !== 'medication')
    .map((finding) => {
      const confidence = confidenceOf(finding);
      return {
        factor: `${finding.facts.factor}`,
        type: finding.facts.channel === 'trigger' ? ('trigger' as const) : ('relief' as const),
        occurrences: Number(finding.facts.withCount ?? 0),
        avgSeverityChange: Number(finding.facts.contrast ?? 0),
        improvementRate: Math.round(finding.stability * 100),
        timeWindow: 24,
        symptomLabel: finding.symptomLabel ?? '',
        confidence: confidence.tier,
        confidenceLabel: confidence.label,
        support: confidence.support,
      };
    })
    .sort((a, b) => Math.abs(b.avgSeverityChange) - Math.abs(a.avgSeverityChange));
}

/** Same computation as checkedButNotFound, over an explicit date range. */
export function checkedButNotFoundInRange(
  entries: SymptomEntry[],
  startDate: Date,
  endDate: Date,
  customSymptoms: CustomSymptom[] = [],
): CheckedFactor[] {
  const events = eventsForDateRange(entries, startDate, endDate, customSymptoms);
  const reported = new Set(
    analyzeCorrelationsInRange(entries, startDate, endDate, customSymptoms).map((item) =>
      item.factor.toLowerCase(),
    ),
  );

  return buildRejectedFactors(events).filter(
    (item) =>
      item.reason !== 'tooFewPaired' && !reported.has(item.factor.toLowerCase()),
  );
}

/**
 * Plain-language description of one correlation.
 *
 * Wording is load-bearing. The old copy — "When you log ice, severity
 * drops 3.2 points" — asserted an effect of logging. This describes
 * the actual comparison: how much severity moved afterwards, against
 * how much it moved anyway.
 */
export function describeCorrelation(corr: FactorCorrelation): string {
  const magnitude = Math.abs(corr.avgSeverityChange).toFixed(1);
  const direction = corr.avgSeverityChange < 0 ? 'fell' : 'rose';
  const symptom = corr.symptomLabel !== '' ? corr.symptomLabel.toLowerCase() : 'symptoms';

  return (
    `After ${symptom} readings where ${corr.factor.toLowerCase()} was recorded, ` +
    `severity ${direction} about ${magnitude} points more than it did otherwise ` +
    `(${corr.occurrences} ${corr.occurrences === 1 ? 'reading' : 'readings'}).`
  );
}
