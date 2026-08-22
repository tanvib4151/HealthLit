/**
 * Golden-file tests for the story engine.
 *
 * Run:   npx tsx tools/storyGolden.ts
 * Bless: npx tsx tools/storyGolden.ts --update
 *
 * No test runner and no new dependencies — deliberately. Adding jest
 * to an Expo SDK 57 project means another round of peer-dependency
 * conflicts, and this needs to be runnable on a laptop mid-session,
 * not configured.
 *
 * Three things are checked on every synthetic patient:
 *
 *  1. SNAPSHOT. The full report text is compared against a committed
 *     golden file. Any wording or statistics change shows up as a
 *     reviewable diff instead of a surprise in front of a doctor.
 *
 *  2. LANGUAGE. Generated text is linted for causal, diagnostic,
 *     predictive, and advisory constructions. A violation fails the
 *     run — the regulatory guardrail is now mechanical rather than
 *     something the next person has to remember.
 *
 *  3. PROVENANCE. Every sentence that states a number must cite the
 *     entries it came from, and every cited entry must exist. This is
 *     what backs the claim that the engine cannot hallucinate: an
 *     uncited figure is a failed build.
 *
 * There is also an ADVERSARIAL assertion (see `severityOnly`) that
 * fails if the engine claims a relief factor worked for a patient who
 * only ever logs at peak severity. That patient's apparent
 * improvement is regression to the mean, and reporting it as an
 * effect was the exact bug this rewrite exists to fix.
 */

import * as fs from 'fs';
import * as path from 'path';

import { lintGeneratedText } from '../utils/storyLanguage';
import {
  buildStoryReport,
  generatedTextOf,
  storyReportToPlainText,
} from '../utils/storyReport';
import { ALL_PROFILES, buildPatient, PatientProfile } from './syntheticPatients';

const GOLDEN_DIR = path.join(__dirname, 'golden');
const UPDATE = process.argv.includes('--update');

interface Failure {
  patient: string;
  check: string;
  detail: string;
}

const failures: Failure[] = [];

function reportFor(profile: PatientProfile) {
  const patient = buildPatient(profile);
  const endDate = new Date(patient.now);
  const startDate = new Date(patient.now);
  startDate.setDate(startDate.getDate() - 29);

  return {
    patient,
    report: buildStoryReport(patient.entries, {
      startDate,
      endDate,
      medications: patient.medications,
      onsets: patient.onsets,
      now: patient.now,
    }),
  };
}

function checkSnapshot(profile: PatientProfile, text: string): void {
  const file = path.join(GOLDEN_DIR, `${profile}.txt`);
  if (UPDATE || !fs.existsSync(file)) {
    fs.mkdirSync(GOLDEN_DIR, { recursive: true });
    fs.writeFileSync(file, text);
    console.log(`  blessed golden: ${profile}.txt`);
    return;
  }
  const expected = fs.readFileSync(file, 'utf8');
  if (expected === text) return;

  const expectedLines = expected.split('\n');
  const actualLines = text.split('\n');
  const diff: string[] = [];
  for (let i = 0; i < Math.max(expectedLines.length, actualLines.length); i++) {
    if (expectedLines[i] !== actualLines[i]) {
      diff.push(`    line ${i + 1}`);
      diff.push(`      - ${expectedLines[i] ?? '(missing)'}`);
      diff.push(`      + ${actualLines[i] ?? '(missing)'}`);
      if (diff.length > 30) break;
    }
  }
  failures.push({ patient: profile, check: 'snapshot', detail: diff.join('\n') });
}

function checkLanguage(profile: PatientProfile, report: ReturnType<typeof reportFor>['report']): void {
  const userLabels = Object.values(report.entryIndex).map((event) => event.symptomLabel);
  const violations = lintGeneratedText(generatedTextOf(report), userLabels);
  if (violations.length === 0) return;
  failures.push({
    patient: profile,
    check: 'language',
    detail: violations
      .map((violation) => `    "${violation.match}" (${violation.reason})\n      in: ${violation.context}`)
      .join('\n'),
  });
}

function checkProvenance(
  profile: PatientProfile,
  report: ReturnType<typeof reportFor>['report'],
): void {
  const problems: string[] = [];
  const knownIds = new Set(Object.keys(report.entryIndex));

  for (const section of report.sections) {
    for (const item of section.body) {
      // A DERIVED sentence containing a statistic must cite its
      // evidence. Reference and user sentences legitimately have
      // none — they restate the medication list or the person's own
      // words rather than computing anything from readings.
      const hasNumber = /\d/.test(item.text);
      if (hasNumber && item.source === 'derived' && item.entryIds.length === 0) {
        problems.push(`    uncited figure in [${section.key}]: ${item.text}`);
      }
      for (const entryId of item.entryIds) {
        if (!knownIds.has(entryId)) {
          problems.push(`    cites unknown entry ${entryId} in [${section.key}]`);
        }
      }
    }
  }

  if (problems.length > 0) {
    failures.push({ patient: profile, check: 'provenance', detail: problems.slice(0, 15).join('\n') });
  }
}

/**
 * The adversarial check. `severityOnly` logs only at peak severity and
 * records Heat on a quarter of those readings. Severity always falls
 * afterwards — for every reading, with or without Heat — because it
 * started at a peak. Any claim that Heat made a difference is the
 * engine crediting regression to the mean to an intervention.
 */
function checkNoRegressionArtefact(report: ReturnType<typeof reportFor>['report']): void {
  const offending = report.findings.filter(
    (finding) =>
      finding.kind === 'factorEffect' &&
      `${finding.facts.factor}`.toLowerCase() === 'heat',
  );
  if (offending.length > 0) {
    failures.push({
      patient: 'severityOnly',
      check: 'regression-artefact',
      detail:
        '    Engine reported an effect for "Heat" on a patient who only logs at peak\n' +
        '    severity. Severity falls after every reading regardless; this is\n' +
        '    regression to the mean being misreported as an effect.',
    });
  }
}

/** The constant patient has no real patterns; the report must not invent any. */
function checkNoInventedPatterns(report: ReturnType<typeof reportFor>['report']): void {
  const claimed = report.findings.filter(
    (finding) => finding.kind === 'factorEffect' || finding.kind === 'weekdayContrast',
  );
  if (claimed.length > 0) {
    failures.push({
      patient: 'constant',
      check: 'invented-pattern',
      detail:
        `    Reported ${claimed.length} pattern finding(s) for a patient whose data is\n` +
        `    uniform noise: ${claimed.map((f) => f.id).join(', ')}`,
    });
  }
}

function main(): void {
  console.log('Story engine golden tests\n');

  for (const profile of ALL_PROFILES) {
    const { report } = reportFor(profile);
    const text = storyReportToPlainText(report);

    console.log(
      `${profile}: ${report.meta.entryCount} entries, ` +
        `${report.sections.filter((s) => s.body.length > 0).length}/9 sections, ` +
        `${report.findings.length} findings`,
    );

    checkSnapshot(profile, text);
    checkLanguage(profile, report);
    checkProvenance(profile, report);
    if (profile === 'severityOnly') checkNoRegressionArtefact(report);
    if (profile === 'constant') checkNoInventedPatterns(report);
  }

  console.log('');
  if (failures.length === 0) {
    console.log('PASS — all checks green.');
    return;
  }

  console.log(`FAIL — ${failures.length} problem(s):\n`);
  for (const failure of failures) {
    console.log(`  [${failure.patient}] ${failure.check}`);
    console.log(failure.detail);
    console.log('');
  }
  process.exitCode = 1;
}

main();
