/**
 * Story pipeline — progression, monthly trends, and symptom sequences.
 *
 * Three detectors that answer "what changed?", which is the question
 * clinicians care about most and the one a raw diary answers worst.
 *
 * A NOTE ON SEQUENCES, BECAUSE THIS IS THE DANGEROUS ONE
 *
 * The obvious version of this feature mines free-form chains —
 * "poor sleep → fatigue → dizziness → headache, appeared 6 times".
 * That is not built here and should not be built. With even a modest
 * symptom vocabulary, the number of candidate four-step sequences
 * runs to the hundreds, tested against perhaps sixty logged days.
 * At that ratio some sequence recurring six times is close to
 * guaranteed by chance, in the same way that enough coin flips
 * guarantee a run of six heads somewhere. A four-step chain also
 * reads far more authoritatively than a single correlation, so the
 * error would be both more likely and more damaging.
 *
 * What IS built: PAIRWISE, directional, time-windowed links, each
 * tested individually against the base rate of the follower. A longer
 * chain may be assembled for display only when every link in it
 * independently cleared the bar — never mined as a shape in its own
 * right.
 *
 * Every rate here is compared against what independence would
 * predict. "Fatigue preceded 61% of headaches" means nothing on its
 * own if fatigue is recorded on 60% of all days; the finding is the
 * GAP between observed and expected, not the raw percentage.
 */

import {
  distinctDayKeys,
  groupBySymptom,
  HealthEvent,
} from './healthEvents';
import { formatDayLabelLong } from './storyTimeline';
import { createRandom, hashString } from './storyStats';

/* --------------------------- Progression ---------------------------- */

export type ProgressionState =
  | 'new'
  | 'increasing'
  | 'decreasing'
  | 'persistent'
  | 'resolved'
  | 'steady';

export interface ProgressionFinding {
  symptomLabel: string;
  state: ProgressionState;
  /** Days recorded in the report window. */
  recentDays: number;
  /** Days recorded across the comparable earlier period. */
  earlierDays: number;
  /** Per-week rate now and before, for an honest comparison. */
  recentPerWeek: number;
  earlierPerWeek: number;
  /** For 'new' and 'resolved'. */
  dateKey: string | null;
  /** Days since last recorded, for 'resolved'. */
  daysSince: number | null;
  /** Length of the report window, carried so descriptions need not
   *  reconstruct it by dividing a rate — which was fragile and could
   *  produce a nonsense denominator on sparse data. */
  windowDays: number;
  entryIds: string[];
}

/** Rate change below this is not a change worth naming. */
const MIN_RATE_RATIO = 1.5;
/** Days without a recorded symptom before calling it resolved. */
const RESOLVED_DAYS = 14;
/** Share of window days needed to call something persistent. */
const PERSISTENT_SHARE = 0.7;
/** Minimum days recorded before any progression claim. */
const MIN_DAYS_FOR_PROGRESSION = 3;

function perWeek(days: number, windowDays: number): number {
  if (windowDays <= 0) return 0;
  return (days / windowDays) * 7;
}

/**
 * Classifies each symptom's trajectory.
 *
 * Compares RATES rather than raw counts, because an uneven window
 * length would otherwise manufacture change: 8 days in a 30-day
 * window and 8 days in a 60-day baseline are very different things.
 */
export function buildProgressionFindings(
  inRange: HealthEvent[],
  beforeRange: HealthEvent[],
  windowDays: number,
  now: Date = new Date(),
): ProgressionFinding[] {
  const recentGroups = groupBySymptom(inRange);
  const earlierGroups = groupBySymptom(beforeRange);

  // The baseline period's span, so rates are comparable.
  const earlierDayKeys = distinctDayKeys(beforeRange);
  const earlierSpan =
    earlierDayKeys.length === 0
      ? 0
      : Math.max(
          1,
          Math.round(
            (new Date(earlierDayKeys[earlierDayKeys.length - 1]).getTime() -
              new Date(earlierDayKeys[0]).getTime()) /
              86400000,
          ) + 1,
        );

  const findings: ProgressionFinding[] = [];
  const allKeys = new Set([...recentGroups.keys(), ...earlierGroups.keys()]);

  allKeys.forEach((key) => {
    const recent = recentGroups.get(key) ?? [];
    const earlier = earlierGroups.get(key) ?? [];
    const label = (recent[0] ?? earlier[0]).symptomLabel;

    const recentDayKeys = distinctDayKeys(recent);
    const earlierDays = distinctDayKeys(earlier).length;
    const recentDays = recentDayKeys.length;

    const recentRate = perWeek(recentDays, windowDays);
    const earlierRate = perWeek(earlierDays, earlierSpan);

    const base = {
      symptomLabel: label,
      recentDays,
      earlierDays,
      recentPerWeek: recentRate,
      earlierPerWeek: earlierRate,
      windowDays,
      entryIds: [...recent, ...earlier].map((event) => event.entryId),
    };

    // RESOLVED — was present before, absent for a good while now.
    if (recent.length === 0 && earlier.length > 0) {
      const lastSeen = distinctDayKeys(earlier).slice(-1)[0];
      const daysSince = Math.round(
        (now.getTime() - new Date(lastSeen).getTime()) / 86400000,
      );
      if (daysSince >= RESOLVED_DAYS) {
        findings.push({
          ...base,
          state: 'resolved',
          dateKey: lastSeen,
          daysSince,
        });
      }
      return;
    }

    if (recentDays < MIN_DAYS_FOR_PROGRESSION) return;

    // NEW — needs real prior history for "new" to mean anything.
    if (earlier.length === 0 && beforeRange.length >= 7) {
      findings.push({
        ...base,
        state: 'new',
        dateKey: recentDayKeys[0],
        daysSince: null,
      });
      return;
    }

    // PERSISTENT — recorded on most days of the window.
    if (recentDays / windowDays >= PERSISTENT_SHARE) {
      findings.push({ ...base, state: 'persistent', dateKey: null, daysSince: null });
      return;
    }

    if (earlierRate === 0) return;

    const ratio = recentRate / earlierRate;
    if (ratio >= MIN_RATE_RATIO) {
      findings.push({ ...base, state: 'increasing', dateKey: null, daysSince: null });
    } else if (ratio <= 1 / MIN_RATE_RATIO) {
      findings.push({ ...base, state: 'decreasing', dateKey: null, daysSince: null });
    } else {
      findings.push({ ...base, state: 'steady', dateKey: null, daysSince: null });
    }
  });

  // Most clinically notable first.
  const order: ProgressionState[] = [
    'new', 'increasing', 'persistent', 'decreasing', 'resolved', 'steady',
  ];
  return findings.sort(
    (a, b) => order.indexOf(a.state) - order.indexOf(b.state),
  );
}

/** One plain sentence per progression state. */
export function describeProgression(finding: ProgressionFinding): string {
  const label = finding.symptomLabel;
  const now = finding.recentPerWeek.toFixed(1).replace(/\.0$/, '');
  const before = finding.earlierPerWeek.toFixed(1).replace(/\.0$/, '');

  switch (finding.state) {
    case 'new':
      return `${label} is new in this period — first recorded ${formatDayLabelLong(
        finding.dateKey ?? '',
      )}, and not present anywhere earlier in my logs.`;
    case 'increasing':
      return `${label} has become more frequent — about ${now} days a week now, against ${before} before this period.`;
    case 'decreasing':
      return `${label} has become less frequent — about ${now} days a week now, against ${before} before this period.`;
    case 'persistent':
      return `${label} has been recorded on ${finding.recentDays} of the last ${finding.windowDays} days — close to daily.`;
    case 'resolved':
      return `${label} has not been recorded for ${finding.daysSince} days. It was last logged ${formatDayLabelLong(
        finding.dateKey ?? '',
      )}.`;
    default:
      return `${label} is about as frequent as before — roughly ${now} days a week.`;
  }
}

/* ------------------------- Monthly frequency ------------------------ */

export interface MonthlyPoint {
  /** YYYY-MM */
  monthKey: string;
  label: string;
  days: number;
  entries: number;
}

/**
 * Episode count per calendar month, per symptom.
 *
 * Counts DAYS rather than entries — someone logging a headache four
 * times in one day has not had four headaches, and counting entries
 * would make a chatty week look like a deterioration.
 */
export function buildMonthlyTrend(
  events: HealthEvent[],
  symptomKey?: string,
): MonthlyPoint[] {
  const relevant =
    symptomKey === undefined
      ? events
      : events.filter((event) => event.symptomKey === symptomKey);

  const byMonth = new Map<string, Set<string>>();
  const counts = new Map<string, number>();

  for (const event of relevant) {
    const monthKey = event.dateKey.slice(0, 7);
    const days = byMonth.get(monthKey) ?? new Set<string>();
    days.add(event.dateKey);
    byMonth.set(monthKey, days);
    counts.set(monthKey, (counts.get(monthKey) ?? 0) + 1);
  }

  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([monthKey, days]) => {
      const [year, month] = monthKey.split('-').map(Number);
      return {
        monthKey,
        label: new Date(year, month - 1, 1).toLocaleDateString(undefined, {
          month: 'short',
        }),
        days: days.size,
        entries: counts.get(monthKey) ?? 0,
      };
    });
}

/* --------------------------- Symptom links -------------------------- */

export interface SymptomLink {
  fromLabel: string;
  toLabel: string;
  /** Hours within which the follower counted. */
  windowHours: number;
  /** Occurrences of `from` followed by `to` inside the window. */
  followed: number;
  /** Total occurrences of `from`. */
  fromCount: number;
  /** Observed follow rate. */
  observedRate: number;
  /**
   * Rate expected if the two were unrelated — the follower's own base
   * rate per window. The finding is the GAP, not the raw percentage.
   */
  expectedRate: number;
  /** How many times more often than expected. */
  lift: number;
  entryIds: string[];
}

/** Occurrences of the leading symptom needed before reporting. */
const MIN_LINK_OCCURRENCES = 5;
/** Observed must exceed expected by at least this multiple. */
const MIN_LIFT = 1.6;
/** And by at least this many percentage points, to avoid tiny-base noise. */
const MIN_ABSOLUTE_GAP = 0.2;

/** Random reference points used to measure a follower's base rate. */
const NULL_SAMPLES = 400;

/**
 * How often `toEvents` occurs within `windowMs` after an arbitrary
 * moment in the logged period.
 *
 * This is the null model: if the follower is simply frequent, this
 * number will be high, and a link has to beat it to mean anything.
 */
function empiricalFollowRate(
  toEvents: HealthEvent[],
  allEvents: HealthEvent[],
  windowMs: number,
  seed: number,
): number {
  if (allEvents.length === 0 || toEvents.length === 0) return 1;

  const times = allEvents.map((event) => event.at.getTime());
  const first = Math.min(...times);
  const last = Math.max(...times);
  if (last <= first) return 1;

  const toTimes = toEvents.map((event) => event.at.getTime()).sort((a, b) => a - b);
  const random = createRandom(seed);

  let hits = 0;
  for (let sample = 0; sample < NULL_SAMPLES; sample++) {
    const reference = first + random() * (last - first);
    const found = toTimes.some(
      (time) => time > reference && time - reference <= windowMs,
    );
    if (found) hits += 1;
  }
  return hits / NULL_SAMPLES;
}

/**
 * Directional links: does B tend to follow A within a time window?
 *
 * Each pair is tested independently against B's base rate. Both a
 * multiplicative threshold and an absolute one must be cleared —
 * a lift of 3x on a base rate of 2% is arithmetically impressive and
 * clinically meaningless.
 */
export function buildSymptomLinks(
  events: HealthEvent[],
  windowHours = 12,
): SymptomLink[] {
  const groups = groupBySymptom(events);
  if (groups.size < 2) return [];

  const dayCount = distinctDayKeys(events).length;
  if (dayCount < 14) return [];

  const links: SymptomLink[] = [];
  const windowMs = windowHours * 3600000;

  groups.forEach((fromEvents, fromKey) => {
    if (fromEvents.length < MIN_LINK_OCCURRENCES) return;

    groups.forEach((toEvents, toKey) => {
      if (fromKey === toKey) return;

      // The null expectation this link has to beat, measured
      // EMPIRICALLY rather than assumed.
      //
      // The first version estimated it as (days the follower appears
      // / total days) x (window / 24h). That model assumes one
      // occurrence per day spread uniformly, which is wrong for
      // anything logged twice daily — it understated the expected
      // rate and made routinely-logged symptoms look predictive of
      // everything. A symptom recorded every morning and evening will
      // follow ANY other symptom most of the time, and that is a fact
      // about logging habits, not about the body.
      //
      // Instead: drop many random reference times across the same
      // period and measure how often the follower appears within the
      // window after them. That is the actual base rate, including
      // whatever clustering the person's real routine has. Seeded, so
      // the verdict never changes between runs.
      const expectedRate = empiricalFollowRate(
        toEvents,
        events,
        windowMs,
        hashString(`link:${fromKey}:${toKey}`),
      );
      if (expectedRate >= 0.95) return;

      let followed = 0;
      const evidence: string[] = [];

      for (const from of fromEvents) {
        const match = toEvents.find((to) => {
          const gap = to.at.getTime() - from.at.getTime();
          return gap > 0 && gap <= windowMs;
        });
        if (match !== undefined) {
          followed += 1;
          evidence.push(from.entryId, match.entryId);
        }
      }

      const observedRate = followed / fromEvents.length;
      const lift = expectedRate === 0 ? 0 : observedRate / expectedRate;

      if (
        followed >= MIN_LINK_OCCURRENCES &&
        lift >= MIN_LIFT &&
        observedRate - expectedRate >= MIN_ABSOLUTE_GAP
      ) {
        links.push({
          fromLabel: fromEvents[0].symptomLabel,
          toLabel: toEvents[0].symptomLabel,
          windowHours,
          followed,
          fromCount: fromEvents.length,
          observedRate,
          expectedRate,
          lift,
          entryIds: [...new Set(evidence)],
        });
      }
    });
  });

  return links.sort((a, b) => b.lift - a.lift);
}

/**
 * Describes a link as a sequence, never as a cause.
 *
 * "was recorded before" rather than "leads to" or "triggers" — the
 * data supports the ordering and nothing more.
 */
export function describeLink(link: SymptomLink): string {
  return (
    `${link.fromLabel} was recorded before ${link.toLabel.toLowerCase()} in ` +
    `${link.followed} of ${link.fromCount} ${link.fromCount === 1 ? 'instance' : 'instances'} ` +
    `(${Math.round(link.observedRate * 100)}%), within ${link.windowHours} hours. ` +
    `Across the whole period ${link.toLabel.toLowerCase()} appears in about ` +
    `${Math.round(link.expectedRate * 100)}% of comparable windows, so it followed ` +
    `more often than its overall rate would suggest.`
  );
}

/**
 * Assembles links into a chain FOR DISPLAY ONLY.
 *
 * Every step must already be an independently validated link. This
 * walks existing edges; it never searches for chains, which is the
 * distinction that keeps it out of the multiple-comparisons trap
 * described at the top of this file.
 */
export function assembleChain(links: SymptomLink[], maxLength = 4): string[] {
  if (links.length === 0) return [];

  const byFrom = new Map<string, SymptomLink>();
  for (const link of links) {
    const existing = byFrom.get(link.fromLabel);
    if (existing === undefined || link.lift > existing.lift) {
      byFrom.set(link.fromLabel, link);
    }
  }

  const strongest = [...byFrom.values()].sort((a, b) => b.lift - a.lift)[0];
  const chain = [strongest.fromLabel, strongest.toLabel];
  const seen = new Set(chain);

  while (chain.length < maxLength) {
    const next = byFrom.get(chain[chain.length - 1]);
    if (next === undefined || seen.has(next.toLabel)) break;
    chain.push(next.toLabel);
    seen.add(next.toLabel);
  }

  return chain.length >= 2 ? chain : [];
}
