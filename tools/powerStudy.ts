/**
 * Power and false-positive study for the factor-detection engine.
 *
 * Run: npx tsx tools/powerStudy.ts
 *
 * WHAT PROBLEM THIS SOLVES
 *
 * The detection thresholds in utils/storyStats.ts — a stability floor
 * of 0.8, a minimum meaningful difference of 0.75 points, a minimum
 * of 4 paired readings each side — were chosen because they sounded
 * conservative. Nobody had measured what they actually deliver.
 *
 * "Sounds conservative" is not a claim you can put behind a document
 * a patient hands to a doctor. This measures two things instead:
 *
 *   FALSE POSITIVE RATE — feed the engine data with NO real effect
 *   and count how often it reports one anyway. This is the number
 *   that matters most. Every false positive is the app telling
 *   someone their medication works when the data says nothing.
 *
 *   POWER (detection rate) — feed the engine a KNOWN injected effect
 *   at a known size and sample count, and measure how often it finds
 *   it. This answers "how many episodes before a real effect shows
 *   up", which is the honest version of the story gate's promise.
 *
 * METHOD
 *
 * Synthetic patients are generated with a seeded PRNG. In the null
 * condition the factor is assigned at random and has no influence on
 * the recovery trajectory whatsoever. In the effect condition the
 * factor genuinely shifts recovery by a fixed amount. Everything else
 * — baseline severity, noise, timing — is identical between the two,
 * so any difference in detection rate is attributable to the effect
 * and nothing else.
 *
 * Noise is deliberately generous (severity is a self-reported integer
 * that people round and misremember), so these are conservative
 * estimates rather than flattering ones.
 *
 * READING THE RESULTS
 *
 * A false-positive rate near or below 5% is the conventional
 * expectation. Materially above that means the thresholds are too
 * loose and STABILITY_THRESHOLD or MIN_MEANINGFUL_DELTA should rise —
 * tuned against this output, not against intuition.
 *
 * Low power at small samples is EXPECTED and is not a bug: it is the
 * engine correctly refusing to claim things it cannot support. The
 * useful output is the sample size at which power becomes reasonable,
 * because that is the real answer to "how long should I log before
 * this is worth reading".
 */

import {
  analyzePairedFactor,
  applyFDR,
  createRandom,
  isReportable,
  MIN_MEANINGFUL_DELTA,
  PairableEvent,
  STABILITY_THRESHOLD,
} from '../utils/storyStats';

interface Scenario {
  /** True change in severity attributable to the factor. 0 = null. */
  trueEffect: number;
  /** Episodes generated. Roughly half will carry the factor. */
  episodes: number;
}

const TRIALS_PER_SCENARIO = 300;
const SAMPLE_SIZES = [10, 20, 40, 80];
const EFFECT_SIZES = [0, 1, 2, 3];

/**
 * One synthetic patient.
 *
 * Each episode is an onset reading plus a recovery reading six hours
 * later — the pair structure the engine actually analyses. The factor
 * is assigned by coin flip, independent of everything else, so in the
 * null condition there is genuinely nothing to find.
 */
function generatePatient(
  episodes: number,
  trueEffect: number,
  seed: number,
): PairableEvent[] {
  const random = createRandom(seed);
  const events: PairableEvent[] = [];
  const base = new Date('2026-01-01T08:00:00.000Z');

  for (let index = 0; index < episodes; index++) {
    const day = new Date(base);
    day.setDate(day.getDate() + index * 2);

    const hasFactor = random() < 0.5;

    // Onset severity is independent of the factor. This is what makes
    // the null condition a true null: if onset depended on the
    // factor, the comparison would be confounded by design.
    //
    // Centred high (around 8) deliberately. An earlier version
    // centred on 6, which meant a 3-point effect drove the follow-up
    // reading below 0 and got clamped — a FLOOR EFFECT that
    // compressed large effects and made 3-point power appear LOWER
    // than 2-point power. That was an artefact of the simulation, not
    // a property of the engine, and it would have made this whole
    // study misleading.
    const onset = 8 + Math.round((random() - 0.5) * 3);

    // Natural recovery, plus noise, plus the injected effect.
    const naturalRecovery = 1.5 + (random() - 0.5) * 2;
    const recovery = naturalRecovery + (hasFactor ? trueEffect : 0);

    const after = new Date(day);
    after.setHours(after.getHours() + 6);

    events.push({
      entryId: `e${index}a`,
      symptomKey: 'headache',
      severity: Math.max(0, Math.min(10, Math.round(onset))),
      at: day,
      triggers: [],
      reliefFactors: hasFactor ? ['TestFactor'] : [],
      medicationIds: [],
    });
    events.push({
      entryId: `e${index}b`,
      symptomKey: 'headache',
      severity: Math.max(0, Math.min(10, Math.round(onset - recovery))),
      at: after,
      triggers: [],
      reliefFactors: [],
      medicationIds: [],
    });
  }

  return events;
}

interface Result {
  scenario: Scenario;
  /** Share of trials reporting a finding at all. */
  detectionRate: number;
  /** Share of trials reporting an effect in the WRONG direction. */
  wrongDirectionRate: number;
  /** Mean contrast among detected trials. */
  meanContrast: number;
}

function runScenario(scenario: Scenario): Result {
  let detected = 0;
  let wrongDirection = 0;
  let contrastSum = 0;

  for (let trial = 0; trial < TRIALS_PER_SCENARIO; trial++) {
    const events = generatePatient(
      scenario.episodes,
      scenario.trueEffect,
      trial * 7919 + scenario.episodes * 104729 + Math.round(scenario.trueEffect * 31),
    );

    const result = analyzePairedFactor(events, 'headache', 'TestFactor', 'relief');
    if (result === null || !isReportable(result)) continue;

    detected += 1;
    contrastSum += result.contrast;

    // A larger recovery means severity FELL further, so a real
    // positive effect must show a negative contrast. The opposite
    // sign is a sign error, which is worse than a miss.
    if (scenario.trueEffect > 0 && result.contrast > 0) wrongDirection += 1;
  }

  return {
    scenario,
    detectionRate: detected / TRIALS_PER_SCENARIO,
    wrongDirectionRate: wrongDirection / TRIALS_PER_SCENARIO,
    meanContrast: detected > 0 ? contrastSum / detected : 0,
  };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function main(): void {
  console.log('Power and false-positive study');
  console.log(`${TRIALS_PER_SCENARIO} trials per scenario\n`);

  const results: Result[] = [];
  for (const trueEffect of EFFECT_SIZES) {
    for (const episodes of SAMPLE_SIZES) {
      results.push(runScenario({ trueEffect, episodes }));
    }
  }

  console.log('True effect | Episodes | Reported | Wrong direction | Mean contrast');
  console.log('------------|----------|----------|-----------------|--------------');
  for (const result of results) {
    const { trueEffect, episodes } = result.scenario;
    const tag = trueEffect === 0 ? 'none (null)' : `${trueEffect} points`;
    console.log(
      `${tag.padEnd(11)} | ${String(episodes).padStart(8)} | ` +
        `${percent(result.detectionRate).padStart(8)} | ` +
        `${percent(result.wrongDirectionRate).padStart(15)} | ` +
        `${result.meanContrast.toFixed(2).padStart(13)}`,
    );
  }

  const nulls = results.filter((result) => result.scenario.trueEffect === 0);
  const worstFalsePositive = Math.max(...nulls.map((result) => result.detectionRate));

  console.log('\n--- Interpretation ---');
  console.log(
    `False-positive rate (no real effect): ` +
      nulls
        .map((result) => `n=${result.scenario.episodes}: ${percent(result.detectionRate)}`)
        .join(', '),
  );
  console.log(`Worst case: ${percent(worstFalsePositive)}`);

  if (worstFalsePositive > 0.1) {
    console.log(
      '\nFAIL — false positives above 10%. The thresholds in storyStats.ts are\n' +
        'too loose. Raise STABILITY_THRESHOLD or MIN_MEANINGFUL_DELTA and re-run.',
    );
    process.exitCode = 1;
  } else if (worstFalsePositive > 0.05) {
    console.log(
      '\nMARGINAL — false positives between 5% and 10%. Acceptable for a\n' +
        'descriptive tool that labels confidence, but worth tightening.',
    );
  } else {
    console.log('\nPASS — false-positive rate within conventional expectations.');
  }

  for (const effect of EFFECT_SIZES.filter((value) => value > 0)) {
    const usable = results.find(
      (result) => result.scenario.trueEffect === effect && result.detectionRate >= 0.8,
    );
    console.log(
      usable
        ? `A real ${effect}-point effect is reliably found (80%+) from about ` +
            `${usable.scenario.episodes} episodes.`
        : `A real ${effect}-point effect was NOT reliably found at any tested ` +
            `sample size (max ${Math.max(...SAMPLE_SIZES)} episodes).`,
    );
  }
}

/* ------------------- Report-level false discovery -------------------- */

/**
 * The number that actually matters to a patient.
 *
 * A single comparison being right 99.3% of the time says little about
 * a REPORT containing thirty of them. This simulates a whole report's
 * worth of comparisons, every one of them a true null, and measures
 * how often at least one spurious finding reaches the page — with and
 * without the Benjamini-Hochberg correction.
 */
function reportLevelStudy(): void {
  const COMPARISONS = 30;
  const REPORTS = 300;
  const EPISODES = 30;

  let anyFalseUncorrected = 0;
  let anyFalseCorrected = 0;
  let totalUncorrected = 0;
  let totalCorrected = 0;

  for (let report = 0; report < REPORTS; report++) {
    const candidates = [];

    for (let comparison = 0; comparison < COMPARISONS; comparison++) {
      // Every comparison is a true null: no injected effect at all.
      const events = generatePatient(
        EPISODES,
        0,
        report * 31337 + comparison * 6151,
      );
      const result = analyzePairedFactor(events, 'headache', 'TestFactor', 'relief');
      if (result === null) continue;
      if (
        Math.abs(result.contrast) < MIN_MEANINGFUL_DELTA ||
        result.stability < STABILITY_THRESHOLD
      ) {
        continue;
      }
      candidates.push(result);
    }

    // Uncorrected: each comparison judged on its own p-value.
    const uncorrected = candidates.filter((result) => isReportable(result));
    // Corrected: the whole family judged together.
    const corrected = applyFDR(candidates, (result) => result.pValue);

    totalUncorrected += uncorrected.length;
    totalCorrected += corrected.length;
    if (uncorrected.length > 0) anyFalseUncorrected += 1;
    if (corrected.length > 0) anyFalseCorrected += 1;
  }

  console.log('\n--- Report-level false discovery ---');
  console.log(
    `${REPORTS} simulated reports, ${COMPARISONS} true-null comparisons each\n`,
  );
  console.log('                                    Per-comparison    With FDR');
  console.log(
    `Reports with >=1 false finding      ` +
      `${percent(anyFalseUncorrected / REPORTS).padStart(13)}` +
      `${percent(anyFalseCorrected / REPORTS).padStart(12)}`,
  );
  console.log(
    `False findings per report (mean)    ` +
      `${(totalUncorrected / REPORTS).toFixed(2).padStart(13)}` +
      `${(totalCorrected / REPORTS).toFixed(2).padStart(12)}`,
  );
}

main();
reportLevelStudy();
