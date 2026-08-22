/**
 * Story pipeline — statistical core.
 *
 * WHY THIS FILE EXISTS
 *
 * The first version of the pattern engine compared severity on
 * entries where a factor was recorded against entries where it
 * wasn't. That comparison is structurally broken for relief factors,
 * because of INDICATION BIAS: people record "Rest" precisely because
 * severity is high. Cross-sectional means therefore make every relief
 * factor look useless or actively harmful, which is both wrong and
 * the kind of wrong a clinician spots immediately.
 *
 * What this file does instead:
 *
 *  1. PAIRED WITHIN-EPISODE comparison. For a factor recorded on an
 *     entry, look at the NEXT reading of the SAME symptom within a
 *     time window and measure the CHANGE. Each entry is its own
 *     control, so a factor recorded during bad moments is no longer
 *     penalised for the moment being bad.
 *
 *  2. CHANGE-VS-CHANGE. The paired change with the factor is compared
 *     against the paired change WITHOUT it, over the same symptom.
 *     Severity drifts down from a peak on its own (regression to the
 *     mean); comparing change to change subtracts that drift out
 *     instead of crediting it to whatever was recorded.
 *
 *  3. PER-SYMPTOM STRATIFICATION is enforced by the caller — every
 *     function here operates on one symptom's events at a time.
 *     Pooling symptoms manufactures associations: if stress is mostly
 *     logged with headaches (severe) and rest mostly with fatigue
 *     (mild), a pooled comparison "discovers" a relationship that is
 *     purely an artefact of which symptom is which.
 *
 *  4. STABILITY FILTERING via subsampling. A report runs dozens of
 *     implicit comparisons, so at small n something always looks
 *     notable. A finding is only reported if it survives repeated
 *     subsamples of the data. The resampler is a seeded PRNG, so the
 *     same entries always yield the same verdict — a report that
 *     changed its mind on refresh would be worse than useless.
 *
 * Medians, not means, throughout: with 5-15 paired observations one
 * unusual reading drags a mean somewhere indefensible.
 *
 * Pure functions. No React, no LLM, no I/O.
 */

/** Follow-up readings further out than this aren't treated as paired. */
export const PAIR_WINDOW_HOURS = 24;
/** Paired observations needed on the factor side before reporting. */
export const MIN_PAIRED_WITH = 4;
/** Paired observations needed on the comparison side. */
export const MIN_PAIRED_WITHOUT = 4;
/** Subsample rounds. Higher is smoother; 200 is ample at this data scale. */
export const STABILITY_ROUNDS = 200;
/** Fraction of observations kept per subsample round. */
export const STABILITY_SAMPLE_FRACTION = 0.7;
/** Share of rounds that must agree on direction before a finding ships. */
export const STABILITY_THRESHOLD = 0.8;
/** Median change smaller than this is not worth a clinician's attention. */
export const MIN_MEANINGFUL_DELTA = 0.75;

/* ------------------------------ Basics ------------------------------ */

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Deterministic PRNG (mulberry32). Seeded from the data itself, so
 * the stability verdict for a given set of entries never changes
 * between runs, devices, or app launches.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string — used to seed the resampler. */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/* --------------------------- Paired change -------------------------- */

/** One before/after observation for a single symptom. */
export interface PairedObservation {
  /** Entry the factor was (or wasn't) recorded on. */
  fromEntryId: string;
  /** The follow-up reading of the same symptom. */
  toEntryId: string;
  fromSeverity: number;
  toSeverity: number;
  /** toSeverity - fromSeverity. Negative = improvement. */
  delta: number;
  hoursApart: number;
}

/** Minimal event shape this module needs — keeps it decoupled. */
export interface PairableEvent {
  entryId: string;
  symptomKey: string;
  severity: number;
  at: Date;
  triggers: string[];
  reliefFactors: string[];
  medicationIds: string[];
}

export type FactorChannel = 'trigger' | 'relief' | 'medication';

function channelValues(event: PairableEvent, channel: FactorChannel): string[] {
  if (channel === 'trigger') return event.triggers;
  if (channel === 'relief') return event.reliefFactors;
  return event.medicationIds;
}

/**
 * Builds paired observations for ONE symptom, oldest first. Each
 * entry is paired with the next reading of that same symptom, if one
 * falls inside the window.
 *
 * Entries with no follow-up are not silently dropped — the count is
 * returned so the report can state how much data the comparison
 * actually rests on. "Based on 6 of 19 entries" is a materially
 * different claim from "based on 19 entries".
 */
export function buildPairs(
  symptomEvents: PairableEvent[],
  windowHours: number = PAIR_WINDOW_HOURS,
): { pairs: PairedObservation[]; unpairedCount: number } {
  const sorted = [...symptomEvents].sort((a, b) => a.at.getTime() - b.at.getTime());
  const pairs: PairedObservation[] = [];
  let unpairedCount = 0;

  for (let index = 0; index < sorted.length; index++) {
    const current = sorted[index];
    const next = sorted[index + 1];
    if (next === undefined) {
      unpairedCount += 1;
      continue;
    }
    const hoursApart =
      (next.at.getTime() - current.at.getTime()) / (1000 * 60 * 60);
    if (hoursApart > windowHours || hoursApart < 0) {
      unpairedCount += 1;
      continue;
    }
    pairs.push({
      fromEntryId: current.entryId,
      toEntryId: next.entryId,
      fromSeverity: current.severity,
      toSeverity: next.severity,
      delta: next.severity - current.severity,
      hoursApart,
    });
  }

  return { pairs, unpairedCount };
}

export interface PairedFactorResult {
  factor: string;
  channel: FactorChannel;
  symptomKey: string;
  /** Paired observations where the factor was recorded. */
  withCount: number;
  /** Paired observations for the same symptom without it. */
  withoutCount: number;
  /** Median severity change following entries with the factor. */
  medianDeltaWith: number;
  /** Median severity change following entries without it. */
  medianDeltaWithout: number;
  /**
   * medianDeltaWith - medianDeltaWithout. This is the reported effect:
   * how much more (or less) severity moved alongside this factor than
   * it moved anyway. Negative = more improvement alongside it.
   */
  contrast: number;
  /** Median severity at the moment the factor was recorded. */
  medianSeverityAtRecord: number;
  /** Entries with no follow-up reading, excluded from the comparison. */
  unpairedCount: number;
  /** Every entry id the numbers above were derived from. */
  entryIds: string[];
  /** Share of subsample rounds agreeing with the reported direction. */
  stability: number;
  /**
   * Empirical probability of a contrast this large arising from
   * chance alone. Lower is stronger evidence.
   */
  pValue: number;
}

/**
 * Paired analysis of one factor within one symptom.
 *
 * Returns null when either side lacks enough paired observations —
 * silence beats a number nobody should act on.
 */
export function analyzePairedFactor(
  symptomEvents: PairableEvent[],
  symptomKey: string,
  factor: string,
  channel: FactorChannel,
  windowHours: number = PAIR_WINDOW_HOURS,
): PairedFactorResult | null {
  const { pairs, unpairedCount } = buildPairs(symptomEvents, windowHours);
  const byId = new Map(symptomEvents.map((event) => [event.entryId, event]));

  const withPairs: PairedObservation[] = [];
  const withoutPairs: PairedObservation[] = [];

  for (const pair of pairs) {
    const source = byId.get(pair.fromEntryId);
    if (source === undefined) continue;
    if (channelValues(source, channel).includes(factor)) withPairs.push(pair);
    else withoutPairs.push(pair);
  }

  if (withPairs.length < MIN_PAIRED_WITH) return null;
  if (withoutPairs.length < MIN_PAIRED_WITHOUT) return null;

  const deltasWith = withPairs.map((pair) => pair.delta);
  const deltasWithout = withoutPairs.map((pair) => pair.delta);
  const medianDeltaWith = median(deltasWith);
  const medianDeltaWithout = median(deltasWithout);
  const contrast = medianDeltaWith - medianDeltaWithout;

  const seed = hashString(`${symptomKey}|${channel}|${factor}`);
  const stability = assessStability(deltasWith, deltasWithout, contrast, seed);
  const pValue = permutationPValue(deltasWith, deltasWithout, contrast, seed);

  const entryIds = [
    ...new Set([
      ...withPairs.flatMap((pair) => [pair.fromEntryId, pair.toEntryId]),
      ...withoutPairs.flatMap((pair) => [pair.fromEntryId, pair.toEntryId]),
    ]),
  ];

  return {
    factor,
    channel,
    symptomKey,
    withCount: withPairs.length,
    withoutCount: withoutPairs.length,
    medianDeltaWith,
    medianDeltaWithout,
    contrast,
    medianSeverityAtRecord: median(withPairs.map((pair) => pair.fromSeverity)),
    unpairedCount,
    entryIds,
    stability,
    pValue,
  };
}

/**
 * How often the observed direction survives resampling.
 *
 * Subsamples both groups (without replacement, 70%) and recomputes
 * the contrast. A finding that only holds on the exact full sample is
 * an artefact of two or three readings and shouldn't reach a doctor.
 *
 * Returns the share of rounds agreeing, 0-1.
 */
export function assessStability(
  deltasWith: number[],
  deltasWithout: number[],
  observedContrast: number,
  seed: number,
  rounds: number = STABILITY_ROUNDS,
  statistic: (values: number[]) => number = median,
): number {
  if (observedContrast === 0) return 0;
  const random = createRandom(seed);
  const direction = Math.sign(observedContrast);

  const take = (values: number[]): number[] => {
    const size = Math.max(2, Math.round(values.length * STABILITY_SAMPLE_FRACTION));
    const pool = [...values];
    // Partial Fisher-Yates: shuffle only what we need.
    for (let index = 0; index < size; index++) {
      const swap = index + Math.floor(random() * (pool.length - index));
      const temporary = pool[index];
      pool[index] = pool[swap];
      pool[swap] = temporary;
    }
    return pool.slice(0, size);
  };

  let agreements = 0;
  for (let round = 0; round < rounds; round++) {
    const contrast = statistic(take(deltasWith)) - statistic(take(deltasWithout));
    if (Math.sign(contrast) === direction) agreements += 1;
  }
  return agreements / rounds;
}

/**
 * Permutation test: how often does chance alone produce a contrast
 * this large?
 *
 * WHY THIS WAS ADDED
 *
 * tools/powerStudy.ts measured the original stability-only filter and
 * found a FALSE-POSITIVE RATE OF UP TO 28% — on data with no real
 * effect whatsoever, the engine reported one nearly a third of the
 * time. That is not a tuning problem, it is a wrong-method problem.
 *
 * The cause: severity is a coarse integer, so a median over a handful
 * of paired deltas snaps to whole or half numbers. That made
 * subsample stability nearly useless as a filter — a lumpy median
 * that reads 1.0 on the full sample reads 1.0 on most subsamples too,
 * so noise scored as "stable" almost as reliably as signal did.
 *
 * A permutation test does not care about the shape of the statistic.
 * It shuffles which observations carry the factor, recomputes the
 * contrast, and asks directly: among labellings that mean nothing,
 * how often is the result this extreme? That fraction is an empirical
 * p-value, and it controls false positives by construction rather
 * than by hoping a proxy behaves.
 *
 * Seeded, so a given dataset always yields the same verdict.
 */
export function permutationPValue(
  deltasWith: number[],
  deltasWithout: number[],
  observedContrast: number,
  seed: number,
  rounds = 500,
  statistic: (values: number[]) => number = median,
): number {
  const pooled = [...deltasWith, ...deltasWithout];
  const withCount = deltasWith.length;
  const random = createRandom(seed ^ 0x5f3759df);
  const target = Math.abs(observedContrast);

  let atLeastAsExtreme = 0;
  for (let round = 0; round < rounds; round++) {
    // Fisher-Yates over a copy; the first withCount entries become
    // the pseudo "with" group.
    const shuffled = [...pooled];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swap = Math.floor(random() * (index + 1));
      const temporary = shuffled[index];
      shuffled[index] = shuffled[swap];
      shuffled[swap] = temporary;
    }
    const contrast =
      statistic(shuffled.slice(0, withCount)) - statistic(shuffled.slice(withCount));
    if (Math.abs(contrast) >= target) atLeastAsExtreme += 1;
  }

  // +1 smoothing so a p-value is never exactly zero — with 500
  // rounds the smallest honest claim is "under 1 in 500", not "zero
  // chance", and reporting zero would overstate certainty.
  return (atLeastAsExtreme + 1) / (rounds + 1);
}

/** A result must clear this to be reported. */
export const MAX_P_VALUE = 0.05;

/**
 * True if a paired result is large enough, stable enough, AND
 * unlikely enough under chance to report.
 *
 * All three, deliberately. Effect size stops trivial differences
 * being reported; stability stops results that hinge on two readings;
 * the permutation p-value is what actually controls the
 * false-positive rate.
 */
export function isReportable(result: PairedFactorResult): boolean {
  return (
    Math.abs(result.contrast) >= MIN_MEANINGFUL_DELTA &&
    result.stability >= STABILITY_THRESHOLD &&
    result.pValue <= MAX_P_VALUE
  );
}

/* ------------------------- Baseline comparison ---------------------- */

export interface BaselineComparison {
  windowMedian: number;
  baselineMedian: number;
  delta: number;
  direction: 'higher' | 'lower' | 'steady';
  windowCount: number;
  baselineCount: number;
  stability: number;
  entryIds: string[];
}

/**
 * Compares a symptom's severity in the report window against that
 * person's own longer-run history BEFORE the window.
 *
 * This replaces first-half-vs-second-half change detection, which
 * systematically manufactured improvement: people start logging when
 * things are bad, so the first half of any window is biased high and
 * everything looks like it got better. An external baseline has no
 * such bias.
 *
 * Returns null when there isn't enough prior history to compare
 * against — in which case the report should say the period stands
 * alone, not invent a trend.
 */
export function compareToBaseline(
  windowSeverities: { entryId: string; severity: number }[],
  baselineSeverities: { entryId: string; severity: number }[],
  seed: number,
  minEach = 5,
): BaselineComparison | null {
  if (windowSeverities.length < minEach || baselineSeverities.length < minEach) {
    return null;
  }

  const windowValues = windowSeverities.map((item) => item.severity);
  const baselineValues = baselineSeverities.map((item) => item.severity);
  const windowMedian = median(windowValues);
  const baselineMedian = median(baselineValues);
  const delta = windowMedian - baselineMedian;

  return {
    windowMedian,
    baselineMedian,
    delta,
    direction: Math.abs(delta) < 0.5 ? 'steady' : delta > 0 ? 'higher' : 'lower',
    windowCount: windowSeverities.length,
    baselineCount: baselineSeverities.length,
    stability: assessStability(windowValues, baselineValues, delta, seed),
    entryIds: [
      ...windowSeverities.map((item) => item.entryId),
      ...baselineSeverities.map((item) => item.entryId),
    ],
  };
}

/* ---------------------------- Time patterns ------------------------- */

export interface GroupContrast {
  groupLabel: string;
  groupMedian: number;
  otherMedian: number;
  delta: number;
  groupCount: number;
  otherCount: number;
  stability: number;
  /** Permutation p-value, so weekday tests join the FDR family. */
  pValue: number;
  entryIds: string[];
}

/**
 * Compares one group of entries (a weekday, a time bucket) against
 * every other entry of the same symptom. Same stability requirement
 * as everything else — with seven weekdays and a handful of entries
 * each, one of them is always the "worst" by chance alone.
 */
export function compareGroup(
  group: { entryId: string; severity: number }[],
  others: { entryId: string; severity: number }[],
  groupLabel: string,
  seed: number,
  minGroup = 4,
  minOthers = 6,
): GroupContrast | null {
  if (group.length < minGroup || others.length < minOthers) return null;

  const groupValues = group.map((item) => item.severity);
  const otherValues = others.map((item) => item.severity);

  // MEANS here, not medians — deliberately, and for the opposite
  // reason to the paired analysis above.
  //
  // Severity is a coarse 0-10 integer. A median over a handful of
  // such values snaps to whole numbers, so two groups that genuinely
  // differ by ~0.1 can show a median gap of exactly 1.0 and sail
  // through a threshold test. That produced confident weekday claims
  // for a synthetic patient whose data was uniform noise.
  //
  // Paired deltas need a median because one wild reading can drag the
  // average; group severities are averaged over many entries where
  // the mean is both the better estimator and far less lumpy.
  const groupMean = mean(groupValues);
  const otherMean = mean(otherValues);
  const delta = groupMean - otherMean;

  if (Math.abs(delta) < 1) return null;

  return {
    groupLabel,
    groupMedian: groupMean,
    otherMedian: otherMean,
    delta,
    groupCount: group.length,
    otherCount: others.length,
    stability: assessStability(groupValues, otherValues, delta, seed, STABILITY_ROUNDS, mean),
    pValue: permutationPValue(groupValues, otherValues, delta, seed, 500, mean),
    entryIds: [...group, ...others].map((item) => item.entryId),
  };
}


/* ------------------------ Multiple comparisons ----------------------- */

/**
 * Benjamini-Hochberg false discovery rate control.
 *
 * WHY THIS IS NECESSARY
 *
 * The permutation test controls the error rate of ONE comparison. A
 * single report runs roughly thirty — every factor against every
 * symptom, plus weekdays, plus time buckets. At a 5% threshold each,
 * the chance that at least one finding in a report is spurious is
 * around 1 in 5, not 1 in 20. Per-comparison correctness does not add
 * up to per-report correctness, and the report is the thing a patient
 * hands to a doctor.
 *
 * BH controls the expected PROPORTION of false findings among those
 * reported, at level q. It is the right choice here over the stricter
 * Bonferroni correction: Bonferroni controls the probability of ANY
 * false finding, which at thirty comparisons would demand p < 0.0017
 * and silence almost everything real. For a descriptive tool that
 * labels its own confidence, "at most 5% of what we show you is
 * noise" is both achievable and honest; "we will never be wrong" is
 * neither.
 *
 * Procedure: sort p ascending, find the largest k where
 * p(k) <= (k/m) * q, and accept everything at or below p(k).
 *
 * Returns the p-value cutoff. Nothing passes when it returns 0.
 */
export const FDR_Q = 0.05;

export function benjaminiHochbergThreshold(
  pValues: number[],
  q: number = FDR_Q,
): number {
  if (pValues.length === 0) return 0;

  const sorted = [...pValues].sort((a, b) => a - b);
  const m = sorted.length;

  let cutoff = 0;
  for (let index = 0; index < m; index++) {
    // index is 0-based; k is 1-based rank.
    const k = index + 1;
    if (sorted[index] <= (k / m) * q) cutoff = sorted[index];
  }
  return cutoff;
}

/**
 * Filters candidates to those surviving FDR correction.
 *
 * The whole set must be passed in at once — that is the entire point.
 * Correcting a subset, or correcting each symptom separately, leaves
 * the same inflation it exists to remove.
 */
export function applyFDR<T>(
  candidates: T[],
  getPValue: (candidate: T) => number,
  q: number = FDR_Q,
): T[] {
  const threshold = benjaminiHochbergThreshold(candidates.map(getPValue), q);
  if (threshold === 0) return [];
  return candidates.filter((candidate) => getPValue(candidate) <= threshold);
}
