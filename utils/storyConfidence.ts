/**
 * Pattern confidence tiers.
 *
 * Every finding already carries a `stability` score (agreement across
 * 200 seeded resamples) and a support count. This turns those two
 * numbers into a label a patient and a clinician can both read at a
 * glance.
 *
 * WHY LABELS RATHER THAN A PERCENTAGE
 * "Stability 0.87" is meaningless to anyone who has not read the
 * resampling code. "Strong pattern — 27 readings" is immediately
 * actionable. The underlying numbers stay available in the evidence
 * sheet for anyone who wants them.
 *
 * WHY THIS MATTERS MORE THAN IT LOOKS
 * The single most dangerous property of any pattern engine is
 * presenting a coincidence with the same confidence as a real
 * finding. Tiers make the difference visible in the output itself,
 * rather than relying on the reader to remember that some findings
 * rest on 4 readings and others on 40.
 *
 * HONEST LIMITATION: these thresholds are reasoned, not empirically
 * calibrated. tools/powerStudy.ts measures what they actually deliver
 * in false-positive and detection terms; until that has been run and
 * the numbers reviewed, treat the boundaries as sensible defaults
 * rather than validated ones.
 */

import { Finding } from './storyFindings';

export type ConfidenceTier = 'strong' | 'moderate' | 'early';

export interface Confidence {
  tier: ConfidenceTier;
  label: string;
  /** One line explaining what the tier means, in plain words. */
  meaning: string;
  /** Observations behind the finding. */
  support: number;
  stability: number;
}

const TIER_COPY: Record<ConfidenceTier, { label: string; meaning: string }> = {
  strong: {
    label: 'Strong pattern',
    meaning: 'Held up consistently across many readings.',
  },
  moderate: {
    label: 'Possible pattern',
    meaning: 'Held up across a moderate number of readings.',
  },
  early: {
    label: 'Early signal',
    meaning: 'Based on few readings — could still be coincidence.',
  },
};

/** Observations needed for each tier, alongside a stability floor. */
const STRONG_SUPPORT = 15;
const STRONG_STABILITY = 0.95;
const MODERATE_SUPPORT = 8;
const MODERATE_STABILITY = 0.85;

/**
 * Reads a finding's own support count. Different finding kinds record
 * their sample size under different names, so this checks each rather
 * than assuming one shape.
 */
export function supportCountOf(finding: Finding): number {
  const candidates = [
    finding.facts.withCount,
    finding.facts.groupCount,
    finding.facts.windowCount,
    finding.facts.entryCount,
    finding.facts.sharedDays,
    finding.facts.count,
  ];
  for (const value of candidates) {
    if (typeof value === 'number' && value > 0) return value;
  }
  return finding.entryIds.length;
}

export function confidenceOf(finding: Finding): Confidence {
  const support = supportCountOf(finding);
  const stability = finding.stability;

  // BOTH conditions must hold. High stability on 4 observations is
  // not a strong pattern — it means four points agreed with each
  // other, which small samples do easily and often.
  let tier: ConfidenceTier = 'early';
  if (support >= STRONG_SUPPORT && stability >= STRONG_STABILITY) tier = 'strong';
  else if (support >= MODERATE_SUPPORT && stability >= MODERATE_STABILITY) {
    tier = 'moderate';
  }

  return { tier, ...TIER_COPY[tier], support, stability };
}

/** "Strong pattern · 27 readings" — for a chip beside a claim. */
export function confidenceSummary(finding: Finding): string {
  const confidence = confidenceOf(finding);
  return `${confidence.label} · ${confidence.support} ${
    confidence.support === 1 ? 'reading' : 'readings'
  }`;
}

/**
 * Plain-language explanation of why a finding was shown.
 *
 * Powers "Why am I seeing this?". Deliberately states the arithmetic
 * rather than describing it — a reader who disagrees should be able
 * to check the sum themselves.
 */
export function explainFinding(finding: Finding): string[] {
  const confidence = confidenceOf(finding);
  const lines: string[] = [];

  const withCount = finding.facts.withCount;
  const withoutCount = finding.facts.withoutCount;

  if (typeof withCount === 'number' && typeof withoutCount === 'number') {
    lines.push(
      `Compared ${withCount} ${withCount === 1 ? 'reading' : 'readings'} where this was ` +
        `recorded against ${withoutCount} where it was not, for the same symptom.`,
    );
    lines.push(
      'Each reading was matched to the next reading of that symptom within 24 hours, ' +
        'so the comparison is how much severity CHANGED, not how bad it was at the time.',
    );
  } else {
    lines.push(
      `Based on ${confidence.support} ${confidence.support === 1 ? 'reading' : 'readings'} in this period.`,
    );
  }

  lines.push(
    `The result held in ${Math.round(confidence.stability * 100)}% of 200 tests that ` +
      'each re-ran the comparison on a random 70% of the data. Findings that only ' +
      'appear in the full set are dropped.',
  );

  lines.push(confidence.meaning);
  return lines;
}
