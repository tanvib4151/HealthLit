/**
 * Lexicon accuracy tests.
 * Run: npx tsx tools/lexiconProbe.ts
 *
 * Three failure classes are checked, in order of how much damage they
 * do in a clinical document:
 *
 *   FALSE POSITIVES — the app asserting a symptom the patient never
 *   described. Worst outcome; most of this file targets it.
 *
 *   MISSED NEGATIONS — "no nausea" counted as nausea. Same damage as
 *   a false positive, different cause.
 *
 *   COLLISIONS — one phrase claimed by two labels, making extraction
 *   depend on array order. Silent and hard to trace, so it fails the
 *   run outright.
 */
import {
  extractDescriptors,
  findFormCollisions,
  lexiconSize,
} from '../utils/symptomLexicon';

let failures = 0;

function labelsFor(text: string): string[] {
  return extractDescriptors([{ entryId: 'e', text }])
    .filter((d) => d.count > 0)
    .map((d) => d.label);
}

function expectPresent(text: string, ...expected: string[]) {
  const found = labelsFor(text);
  const missing = expected.filter((e) => !found.includes(e));
  if (missing.length > 0) {
    console.log(`  MISS  "${text}"\n        expected ${missing.join(', ')} — got ${found.join(', ') || '(nothing)'}`);
    failures++;
  } else {
    console.log(`  ok    ${expected.join(', ')}`);
  }
}

function expectAbsent(text: string, ...forbidden: string[]) {
  const found = labelsFor(text);
  const wrong = forbidden.filter((f) => found.includes(f));
  if (wrong.length > 0) {
    console.log(`  FALSE POSITIVE  "${text}"\n        wrongly found ${wrong.join(', ')}`);
    failures++;
  } else {
    console.log(`  ok    "${forbidden.join(', ')}" correctly not matched`);
  }
}

const size = lexiconSize();
console.log(`Lexicon: ${size.labels} labels, ${size.forms} surface forms\n`);

console.log('--- collisions (one phrase, two labels) ---');
const collisions = findFormCollisions();
if (collisions.length > 0) {
  for (const c of collisions) {
    console.log(`  COLLISION  "${c.form}" claimed by: ${c.labels.join(', ')}`);
    failures++;
  }
} else {
  console.log('  ok    no duplicated surface forms');
}

console.log('\n--- negation must exclude ---');
expectAbsent('Like a band tightening. No nausea this time.', 'Nausea');
expectAbsent('Dull heavy ache, sore to touch. Not sharp at all.', 'Sharp');
expectAbsent('Never throbbing, more of a crushing pressure.', 'Throbbing');
expectAbsent('No dizziness today, thankfully.', 'Dizziness');
expectAbsent('Nothing helped, still there.', 'Rest');
expectAbsent('Barely slept but no fever.', 'Fever');

console.log('\n--- ambiguity traps (the reason a big vocabulary is risky) ---');
expectAbsent('A lot of pressure at work this week made everything harder.', 'Pressure');
expectAbsent('Tight schedule all week, no time to rest.', 'Tight');
expectAbsent('My blood pressure was fine at the check-up.', 'Pressure');
expectPresent('Pressure behind my eyes all afternoon.', 'Pressure', 'Behind the eye');
expectPresent('Really tight chest, hard to breathe.', 'Tight', 'Chest', 'Shortness of breath');

console.log('\n--- longest-match-first ---');
expectPresent('Woke up in a cold sweat.', 'Sweating');
expectAbsent('Woke up in a cold sweat.', 'Cold weather');
expectPresent('Pain in my lower back all day.', 'Lower back');
expectAbsent('Pain in my lower back all day.', 'Upper back');
expectPresent('Pins and needles in both hands.', 'Tingling', 'Hands');

console.log('\n--- realistic free text ---');
expectPresent('Throbbing behind my right eye, worse when I bend down. Screens made it awful.',
  'Throbbing', 'Behind the eye', 'Light');
expectPresent('Sharp electric jolt down one side, then my leg went numb.',
  'Sharp', 'Electric', 'One side only', 'Legs');
expectPresent('Woke up with my jaw locked and ringing in my ears.',
  'On waking', 'Jaw', 'Locked', 'Ringing in ears');
expectPresent('Stomach twisting, threw up twice, cold sweat.',
  'Stomach', 'Twisting', 'Vomiting', 'Sweating');
expectPresent('Came on suddenly, had to lie down in a dark room. Ibuprofen helped a bit.',
  'Sudden onset', 'Dark room', 'Medication');
expectPresent('Comes and goes all day, worse at night, nothing touched it.',
  'Comes and goes', 'Worse at night', 'Nothing helped');

console.log(
  failures === 0
    ? '\nPASS — no collisions, no false positives, negation holding.'
    : `\nFAIL — ${failures} issue(s).`,
);
if (failures > 0) process.exitCode = 1;
