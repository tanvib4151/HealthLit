/**
 * Story pipeline — content determination (document planning).
 *
 * Turns health events into FINDINGS: atomic, scored, evidence-bearing
 * claims. Nothing here writes a sentence — that's the realizer's job
 * (utils/storyNlg.ts). Splitting the two is what stops the report
 * reading like a database dump: the planner can compare candidate
 * facts against each other, drop the weak ones, and merge related
 * ones, none of which is possible when each fact renders itself the
 * moment it's computed.
 *
 * Every finding carries `entryIds` — the exact entries its numbers
 * came from. That provenance is what makes the report tappable, what
 * lets the golden tests verify every printed number is re-derivable,
 * and what backs the claim that this engine hallucinates nothing.
 *
 * SALIENCE decides what makes the page. A report that prints every
 * detector's output is exhausting and buries the important line. Each
 * finding scores on:
 *   - effect size (how big is the difference)
 *   - support (how many observations stand behind it)
 *   - stability (did it survive resampling)
 *   - novelty (is this the first time we're saying it)
 * and sections take the top N.
 */

import {
  distinctDayKeys,
  groupBySymptom,
  HealthEvent,
  meanOf,
  tally,
} from './healthEvents';
import {
  analyzePairedFactor,
  applyFDR,
  MIN_MEANINGFUL_DELTA,
  BaselineComparison,
  compareGroup,
  compareToBaseline,
  GroupContrast,
  hashString,
  median,
  PairableEvent,
  PairedFactorResult,
  STABILITY_THRESHOLD,
} from './storyStats';
import { ExtractedDescriptor, extractDescriptors, significantDescriptors } from './symptomLexicon';

export type FindingKind =
  | 'symptomProfile'
  | 'factorEffect'
  | 'medicationEffect'
  | 'baselineChange'
  | 'weekdayContrast'
  | 'timeOfDayConcentration'
  | 'cooccurrence'
  | 'onset'
  | 'firstTime'
  | 'noteDescriptor'
  | 'dataQuality';

export interface Finding {
  /** Stable id — same data always produces the same id. */
  id: string;
  kind: FindingKind;
  /** Which symptom this concerns, if any. */
  symptomLabel?: string;
  /** Structured values the realizer turns into prose. */
  facts: Record<string, string | number | string[] | null>;
  /** Entries the numbers were derived from. */
  entryIds: string[];
  /** 0-1; how much this deserves space on the page. */
  salience: number;
  /** 0-1 resampling agreement, where applicable. */
  stability: number;
}

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
];

/** Symptom needs this many entries before factor analysis is attempted. */
const MIN_ENTRIES_FOR_FACTOR_ANALYSIS = 8;

function toPairable(event: HealthEvent): PairableEvent {
  return {
    entryId: event.entryId,
    symptomKey: event.symptomKey,
    severity: event.severity,
    at: event.at,
    triggers: event.triggers,
    reliefFactors: event.reliefFactors,
    medicationIds: event.medicationIds ?? [],
  };
}

/**
 * Squashes a raw magnitude into 0-1. Severity deltas beyond ~3 points
 * are not meaningfully more notable than 3, so the curve saturates
 * rather than letting one extreme finding dominate every ranking.
 */
function magnitudeScore(value: number, saturationPoint: number): number {
  return Math.min(1, Math.abs(value) / saturationPoint);
}

/** More observations is better, with diminishing returns after ~15. */
function supportScore(count: number): number {
  return Math.min(1, Math.log10(count + 1) / Math.log10(16));
}

/* -------------------------- Symptom profiles ------------------------ */

export function buildSymptomFindings(events: HealthEvent[]): Finding[] {
  const groups = groupBySymptom(events);
  const findings: Finding[] = [];
  const totalEntries = events.length;

  groups.forEach((groupEvents, key) => {
    const severities = groupEvents.map((event) => event.severity);
    const days = distinctDayKeys(groupEvents);
    const label = groupEvents[0].symptomLabel;

    const qualities = tally(groupEvents, (event) => event.qualities);
    const regions = tally(groupEvents, (event) => event.bodyRegions);
    const durations = tally(groupEvents, (event) =>
      event.durationLabel !== null ? [event.durationLabel] : [],
    );

    findings.push({
      id: `profile:${key}`,
      kind: 'symptomProfile',
      symptomLabel: label,
      facts: {
        entryCount: groupEvents.length,
        dayCount: days.length,
        medianSeverity: median(severities),
        meanSeverity: meanOf(severities),
        minSeverity: Math.min(...severities),
        maxSeverity: Math.max(...severities),
        firstDateKey: days[0],
        lastDateKey: days[days.length - 1],
        topQualities: qualities.slice(0, 3).map((item) => `${item.label}|${item.count}`),
        topRegions: regions.slice(0, 3).map((item) => `${item.label}|${item.count}`),
        topDurations: durations.slice(0, 3).map((item) => `${item.label}|${item.count}`),
        durationMissing: groupEvents.filter((event) => event.durationLabel === null).length,
      },
      entryIds: groupEvents.map((event) => event.entryId),
      // The dominant symptom is the spine of the report.
      salience: 0.5 + 0.5 * (groupEvents.length / Math.max(totalEntries, 1)),
      stability: 1,
    });
  });

  return findings;
}

/* --------------------------- Factor effects ------------------------- */

/**
 * Paired, per-symptom factor analysis.
 *
 * Stratification is the point: pooling every symptom together lets a
 * factor that mostly co-occurs with a severe symptom look like it
 * raises severity, when all it really tracks is which symptom was
 * being logged.
 */
/**
 * A factor that was tested and did NOT produce a reportable finding.
 *
 * These used to be discarded. Reporting them is more scientifically
 * honest than silence: "we checked sleep against your headaches and
 * found no consistent relationship across 14 nights" is a real
 * result, and its absence lets a reader assume the question was never
 * asked. It also stops the report reading as though the engine only
 * ever finds things.
 */
export interface RejectedFactor {
  factor: string;
  symptomLabel: string;
  /** Why it did not qualify. */
  reason: 'tooFewPaired' | 'differenceTooSmall' | 'notStable';
  /** Paired readings available, where known. */
  pairedCount: number;
}

export function buildFactorFindings(events: HealthEvent[]): Finding[] {
  return buildFactorAnalysis(events).findings;
}

/** Factors tested but not reported, with the reason each was dropped. */
export function buildRejectedFactors(events: HealthEvent[]): RejectedFactor[] {
  return buildFactorAnalysis(events).rejected;
}

function buildFactorAnalysis(events: HealthEvent[]): {
  findings: Finding[];
  rejected: RejectedFactor[];
} {
  const groups = groupBySymptom(events);
  const findings: Finding[] = [];
  const rejected: RejectedFactor[] = [];
  const candidates: {
    result: PairedFactorResult;
    label: string;
    kind: FindingKind;
  }[] = [];

  groups.forEach((groupEvents, key) => {
    if (groupEvents.length < MIN_ENTRIES_FOR_FACTOR_ANALYSIS) return;

    const pairable = groupEvents.map(toPairable);
    const label = groupEvents[0].symptomLabel;

    const channels: {
      channel: 'trigger' | 'relief' | 'medication';
      values: string[];
      kind: FindingKind;
    }[] = [
      {
        // Mental wellness tags are deliberately NOT a channel here.
        // People with chronic physical conditions are routinely told
        // their symptoms are psychological; an engine that reports
        // "severity rose after entries where Anxious was recorded"
        // hands that framing a number to stand on. Mood is described
        // and co-occurrence is reported, but it is never analysed as
        // a driver of physical severity.
        channel: 'trigger',
        values: [...new Set(groupEvents.flatMap((event) => event.triggers))],
        kind: 'factorEffect',
      },
      {
        channel: 'relief',
        values: [...new Set(groupEvents.flatMap((event) => event.reliefFactors))],
        kind: 'factorEffect',
      },
      {
        channel: 'medication',
        values: [...new Set(groupEvents.flatMap((event) => event.medicationIds ?? []))],
        kind: 'medicationEffect',
      },
    ];

    for (const { channel, values, kind } of channels) {
      for (const value of values) {
        const result = analyzePairedFactor(pairable, key, value, channel);

        if (result === null) {
          // Never had enough paired readings to compare at all.
          rejected.push({
            factor: value,
            symptomLabel: label,
            reason: 'tooFewPaired',
            pairedCount: 0,
          });
          continue;
        }

        // PHASE ONE: keep everything that clears effect size and
        // stability. The p-value gate is deliberately NOT applied per
        // comparison here — see phase two.
        if (
          Math.abs(result.contrast) < MIN_MEANINGFUL_DELTA ||
          result.stability < STABILITY_THRESHOLD
        ) {
          rejected.push({
            factor: value,
            symptomLabel: label,
            reason:
              Math.abs(result.contrast) < MIN_MEANINGFUL_DELTA
                ? 'differenceTooSmall'
                : 'notStable',
            pairedCount: result.withCount,
          });
          continue;
        }

        candidates.push({ result, label, kind });
      }
    }
  });

  // PHASE TWO: correct across EVERY comparison in the report at once.
  //
  // This is why the p-value is not applied inline above. Filtering
  // each comparison at p <= 0.05 independently controls the error
  // rate of one test while leaving the report as a whole inflated —
  // thirty comparisons at 5% each means roughly a 1-in-5 chance of at
  // least one spurious finding. Benjamini-Hochberg needs the full
  // family in hand to compute its threshold, so the decision has to
  // happen here rather than in the loop.
  const survivors = applyFDR(candidates, (candidate) => candidate.result.pValue);
  const survivorKeys = new Set(
    survivors.map(
      (candidate) => `${candidate.result.symptomKey}|${candidate.result.factor}`,
    ),
  );

  for (const candidate of candidates) {
    const key = `${candidate.result.symptomKey}|${candidate.result.factor}`;
    if (survivorKeys.has(key)) {
      findings.push(
        factorToFinding(candidate.result, candidate.label, candidate.kind),
      );
    } else {
      // Dropped by the correction, not by its own numbers. Still
      // worth reporting as checked-and-not-found.
      rejected.push({
        factor: candidate.result.factor,
        symptomLabel: candidate.label,
        reason: 'notStable',
        pairedCount: candidate.result.withCount,
      });
    }
  }

  return {
    findings: findings.sort((a, b) => b.salience - a.salience),
    rejected,
  };
}

function factorToFinding(
  result: PairedFactorResult,
  symptomLabel: string,
  kind: FindingKind,
): Finding {
  return {
    id: `factor:${result.symptomKey}:${result.channel}:${result.factor}`,
    kind,
    symptomLabel,
    facts: {
      factor: result.factor,
      channel: result.channel,
      withCount: result.withCount,
      withoutCount: result.withoutCount,
      medianDeltaWith: result.medianDeltaWith,
      medianDeltaWithout: result.medianDeltaWithout,
      contrast: result.contrast,
      medianSeverityAtRecord: result.medianSeverityAtRecord,
      unpairedCount: result.unpairedCount,
      direction: result.contrast < 0 ? 'improved' : 'worsened',
    },
    entryIds: result.entryIds,
    salience:
      0.45 * magnitudeScore(result.contrast, 3) +
      0.35 * supportScore(result.withCount) +
      0.2 * result.stability,
    stability: result.stability,
  };
}

/* ------------------------- Change vs baseline ----------------------- */

export function buildChangeFindings(
  inRange: HealthEvent[],
  beforeRange: HealthEvent[],
): Finding[] {
  const inGroups = groupBySymptom(inRange);
  const beforeGroups = groupBySymptom(beforeRange);
  const findings: Finding[] = [];

  inGroups.forEach((groupEvents, key) => {
    const baseline = beforeGroups.get(key) ?? [];
    const comparison: BaselineComparison | null = compareToBaseline(
      groupEvents.map((event) => ({ entryId: event.entryId, severity: event.severity })),
      baseline.map((event) => ({ entryId: event.entryId, severity: event.severity })),
      hashString(`baseline:${key}`),
    );
    if (comparison === null) return;
    if (comparison.direction !== 'steady' && comparison.stability < 0.8) return;

    findings.push({
      id: `change:${key}`,
      kind: 'baselineChange',
      symptomLabel: groupEvents[0].symptomLabel,
      facts: {
        windowMedian: comparison.windowMedian,
        baselineMedian: comparison.baselineMedian,
        delta: comparison.delta,
        direction: comparison.direction,
        windowCount: comparison.windowCount,
        baselineCount: comparison.baselineCount,
      },
      entryIds: comparison.entryIds,
      salience:
        0.5 * magnitudeScore(comparison.delta, 3) +
        0.3 * supportScore(comparison.windowCount) +
        0.2 * comparison.stability,
      stability: comparison.stability,
    });
  });

  return findings;
}

/* ---------------------------- Time patterns ------------------------- */

export function buildTimeFindings(events: HealthEvent[]): Finding[] {
  const groups = groupBySymptom(events);
  const findings: Finding[] = [];

  groups.forEach((groupEvents, key) => {
    if (groupEvents.length < MIN_ENTRIES_FOR_FACTOR_ANALYSIS) return;
    const label = groupEvents[0].symptomLabel;

    // Weekday — every weekday tested against all other entries of the
    // same symptom, then only the strongest STABLE one is kept.
    const weekdayResults: GroupContrast[] = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      const group = groupEvents.filter((event) => event.weekday === weekday);
      const others = groupEvents.filter((event) => event.weekday !== weekday);
      const contrast = compareGroup(
        group.map((event) => ({ entryId: event.entryId, severity: event.severity })),
        others.map((event) => ({ entryId: event.entryId, severity: event.severity })),
        DAY_NAMES[weekday],
        hashString(`weekday:${key}:${weekday}`),
      );
      if (contrast !== null && contrast.stability >= 0.8) weekdayResults.push(contrast);
    }

    const strongest = weekdayResults.sort(
      (a, b) => Math.abs(b.delta) - Math.abs(a.delta),
    )[0];
    if (strongest !== undefined) {
      findings.push({
        id: `weekday:${key}:${strongest.groupLabel}`,
        kind: 'weekdayContrast',
        symptomLabel: label,
        facts: {
          dayName: strongest.groupLabel,
          groupMedian: strongest.groupMedian,
          otherMedian: strongest.otherMedian,
          delta: strongest.delta,
          groupCount: strongest.groupCount,
          direction: strongest.delta > 0 ? 'higher' : 'lower',
        },
        entryIds: strongest.entryIds,
        salience:
          0.4 * magnitudeScore(strongest.delta, 3) +
          0.3 * supportScore(strongest.groupCount) +
          0.3 * strongest.stability,
        stability: strongest.stability,
      });
    }

    // Time-of-day is reported as a CONCENTRATION of logging, never as
    // a severity claim — when someone logs says as much about their
    // routine as about their symptoms, and pretending otherwise would
    // be an inference.
    const buckets: Record<string, HealthEvent[]> = {
      morning: [], afternoon: [], evening: [], night: [],
    };
    for (const event of groupEvents) {
      if (event.hour >= 5 && event.hour < 12) buckets.morning.push(event);
      else if (event.hour >= 12 && event.hour < 17) buckets.afternoon.push(event);
      else if (event.hour >= 17 && event.hour < 22) buckets.evening.push(event);
      else buckets.night.push(event);
    }
    const [bucketName, bucketEvents] = Object.entries(buckets).sort(
      (a, b) => b[1].length - a[1].length,
    )[0];
    const proportion = bucketEvents.length / groupEvents.length;

    if (proportion >= 0.6 && bucketEvents.length >= 5) {
      findings.push({
        id: `timeofday:${key}:${bucketName}`,
        kind: 'timeOfDayConcentration',
        symptomLabel: label,
        facts: {
          bucket: bucketName,
          count: bucketEvents.length,
          total: groupEvents.length,
          percent: Math.round(proportion * 100),
        },
        entryIds: bucketEvents.map((event) => event.entryId),
        salience: 0.3 + 0.4 * magnitudeScore(proportion - 0.6, 0.4),
        stability: 1,
      });
    }
  });

  return findings;
}

/* ---------------------------- Co-occurrence ------------------------- */

export function buildCooccurrenceFindings(events: HealthEvent[]): Finding[] {
  const groups = groupBySymptom(events);
  const keys = [...groups.keys()];
  if (keys.length < 2) return [];

  const primaryKey = keys[0];
  const primaryEvents = groups.get(primaryKey) ?? [];
  const primaryDays = new Set(distinctDayKeys(primaryEvents));
  if (primaryDays.size < 4) return [];

  const findings: Finding[] = [];
  groups.forEach((groupEvents, key) => {
    if (key === primaryKey) return;
    const otherDays = distinctDayKeys(groupEvents);
    const shared = otherDays.filter((day) => primaryDays.has(day));
    if (shared.length < 3) return;

    const rate = shared.length / primaryDays.size;
    findings.push({
      id: `cooc:${primaryKey}:${key}`,
      kind: 'cooccurrence',
      symptomLabel: primaryEvents[0].symptomLabel,
      facts: {
        otherLabel: groupEvents[0].symptomLabel,
        sharedDays: shared.length,
        primaryDays: primaryDays.size,
        otherDays: otherDays.length,
        percent: Math.round(rate * 100),
      },
      entryIds: [
        ...primaryEvents.map((event) => event.entryId),
        ...groupEvents.map((event) => event.entryId),
      ],
      salience: 0.35 + 0.45 * rate,
      stability: 1,
    });
  });

  return findings.sort((a, b) => b.salience - a.salience);
}

/* ---------------------------- Note mining --------------------------- */

export function buildNoteFindings(events: HealthEvent[]): Finding[] {
  const notes = events.flatMap((event) =>
    event.notes.map((text) => ({ entryId: event.entryId, text })),
  );
  if (notes.length === 0) return [];

  const descriptors: ExtractedDescriptor[] = significantDescriptors(
    extractDescriptors(notes),
  );

  return descriptors.map((descriptor) => ({
    id: `note:${descriptor.label}`,
    kind: 'noteDescriptor' as FindingKind,
    facts: {
      label: descriptor.label,
      category: descriptor.category,
      count: descriptor.count,
      negatedCount: descriptor.negatedCount,
    },
    entryIds: descriptor.entryIds,
    salience: 0.25 + 0.4 * supportScore(descriptor.count),
    stability: 1,
  }));
}

/* --------------------------- Data quality --------------------------- */

/**
 * How complete the underlying data is. A clinician weighing the
 * report needs to know it rests on 12 days out of 30, and that
 * duration was skipped half the time.
 */
export function buildDataQualityFinding(
  events: HealthEvent[],
  daysInRange: number,
  daysLogged: number,
): Finding {
  const missingDuration = events.filter((event) => event.durationLabel === null).length;
  const withNotes = events.filter((event) => event.notes.length > 0).length;

  return {
    id: 'quality:coverage',
    kind: 'dataQuality',
    facts: {
      daysInRange,
      daysLogged,
      coveragePercent: Math.round((daysLogged / Math.max(daysInRange, 1)) * 100),
      entryCount: events.length,
      missingDuration,
      withNotes,
    },
    entryIds: events.map((event) => event.entryId),
    salience: 0.4,
    stability: 1,
  };
}

/* ------------------------------ Selection --------------------------- */

/**
 * Picks the top `limit` findings, penalising repetition.
 *
 * `mentioned` accumulates across sections, so a factor already
 * described in "Patterns" is less likely to be repeated verbatim in
 * "Factors that improve" — the single most common way a generated
 * report starts to feel padded.
 */
export function selectFindings(
  candidates: Finding[],
  limit: number,
  mentioned: Set<string>,
): Finding[] {
  const scored = candidates.map((finding) => {
    const noveltyPenalty = mentioned.has(finding.id) ? 0.4 : 0;
    return { finding, score: finding.salience - noveltyPenalty };
  });

  const chosen = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.finding);

  for (const finding of chosen) mentioned.add(finding.id);
  return chosen;
}
