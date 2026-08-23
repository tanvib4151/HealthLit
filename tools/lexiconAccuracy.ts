/**
 * Measures lexicon false-positive rate against a labeled corpus.
 * Run: npx tsx tools/lexiconAccuracy.ts
 *
 * METRIC
 *
 * Primary: FALSE POSITIVE RATE = false positives / total extractions.
 * "Of everything the app claimed the patient said, what share was
 * wrong." This is the number that matters clinically, because each
 * false positive is a descriptor put into a patient's mouth in a
 * document a doctor reads.
 *
 * Also reported: recall (did we still find the real content), and a
 * per-sentence FP rate.
 *
 * Target: under 2%.
 */
import { extractDescriptors } from '../utils/symptomLexicon';
import { LEXICON_CORPUS, LexiconTestCase } from './lexiconCorpus';

interface Result {
  case: LexiconTestCase;
  found: string[];
  falsePositives: string[];
  missed: string[];
}

const results: Result[] = LEXICON_CORPUS.map((testCase) => {
  const found = extractDescriptors([{ entryId: 'e', text: testCase.text }])
    .filter((d) => d.count > 0)
    .map((d) => d.label);
  return {
    case: testCase,
    found,
    falsePositives: found.filter((f) => !testCase.expect.includes(f)),
    missed: testCase.expect.filter((e) => !found.includes(e)),
  };
});

const totalExtractions = results.reduce((n, r) => n + r.found.length, 0);
const totalFP = results.reduce((n, r) => n + r.falsePositives.length, 0);
const totalExpected = results.reduce((n, r) => n + r.case.expect.length, 0);
const totalMissed = results.reduce((n, r) => n + r.missed.length, 0);
const sentencesWithFP = results.filter((r) => r.falsePositives.length > 0).length;

const fpRate = totalExtractions === 0 ? 0 : totalFP / totalExtractions;
const recall = totalExpected === 0 ? 1 : (totalExpected - totalMissed) / totalExpected;

console.log(`Corpus: ${LEXICON_CORPUS.length} cases\n`);

// Per-group breakdown — distractors are where a large vocabulary hurts.
const groups = ['clinical', 'distractor', 'negated', 'mixed'] as const;
console.log('Group        Cases  Extractions  FalsePos   FP rate');
console.log('-----------  -----  -----------  --------   -------');
for (const group of groups) {
  const inGroup = results.filter((r) => r.case.group === group);
  const ext = inGroup.reduce((n, r) => n + r.found.length, 0);
  const fp = inGroup.reduce((n, r) => n + r.falsePositives.length, 0);
  const rate = ext === 0 ? 0 : (fp / ext) * 100;
  console.log(
    `${group.padEnd(11)}  ${String(inGroup.length).padStart(5)}  ${String(ext).padStart(11)}  ` +
      `${String(fp).padStart(8)}   ${rate.toFixed(1).padStart(6)}%`,
  );
}

if (totalFP > 0) {
  console.log('\n--- every false positive ---');
  for (const r of results.filter((x) => x.falsePositives.length > 0)) {
    console.log(`  [${r.case.group}] "${r.case.text}"`);
    console.log(`      wrongly extracted: ${r.falsePositives.join(', ')}`);
  }
}

if (totalMissed > 0) {
  console.log('\n--- misses (lower cost: verbatim text still shown to clinician) ---');
  for (const r of results.filter((x) => x.missed.length > 0)) {
    console.log(`  "${r.case.text}"\n      missed: ${r.missed.join(', ')}`);
  }
}

console.log('\n=== SUMMARY ===');
console.log(`Total extractions      ${totalExtractions}`);
console.log(`False positives        ${totalFP}`);
console.log(`FALSE POSITIVE RATE    ${(fpRate * 100).toFixed(2)}%   (target: under 2%)`);
console.log(`Sentences with any FP  ${sentencesWithFP}/${LEXICON_CORPUS.length} (${((sentencesWithFP / LEXICON_CORPUS.length) * 100).toFixed(1)}%)`);
console.log(`Recall                 ${(recall * 100).toFixed(1)}%  (${totalExpected - totalMissed}/${totalExpected} expected labels found)`);

if (fpRate > 0.02) {
  console.log('\nFAIL — false positive rate above 2%. Tighten the lexicon.');
  process.exitCode = 1;
} else {
  console.log('\nPASS — false positive rate within target.');
}
