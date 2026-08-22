/**
 * Clinical-language guardrail.
 *
 * HealthLit must describe patterns without suggesting a diagnosis or
 * a cause. Under the FDA's Clinical Decision Support framing,
 * "severity was 1.4 points lower alongside X" is general wellness;
 * "X is causing your headaches" is a regulated medical device claim.
 * The line is what the software asserts, not how it was implemented.
 *
 * Until now that line was a discipline: whoever wrote the next
 * sentence template had to remember it. That fails eventually. This
 * module makes it MECHANICAL — generated text is checked against a
 * banned-construction list, and the golden tests fail the build on a
 * violation. A regression here is a test failure, not a regulatory
 * incident discovered in the wild.
 *
 * Scope note: this checks GENERATED text only. Anything the user
 * typed themselves — notes, an edited section — is their own words
 * about their own body and is never rewritten or blocked. The
 * distinction matters: the constraint is on what the APP claims.
 */

export interface LanguageViolation {
  /** The matched phrase. */
  match: string;
  /** Why it's disallowed. */
  reason: string;
  /** The sentence it appeared in. */
  context: string;
}

interface BannedPattern {
  pattern: RegExp;
  reason: string;
}

/**
 * Ordered roughly by severity of the claim. Word-boundary anchored so
 * innocuous substrings don't trip them ("indicates" is banned;
 * "indicator" inside a variable name never reaches this text).
 */
const BANNED: BannedPattern[] = [
  // Causal assertions
  { pattern: /\bcaus(e|es|ed|ing)\b/i, reason: 'asserts causation' },
  { pattern: /\bdue to\b/i, reason: 'asserts causation' },
  { pattern: /\bbecause of\b/i, reason: 'asserts causation' },
  { pattern: /\bresults? (in|from)\b/i, reason: 'asserts causation' },
  { pattern: /\bleads? to\b/i, reason: 'asserts causation' },
  { pattern: /\btriggered by\b/i, reason: 'asserts causation' },
  { pattern: /\bresponsible for\b/i, reason: 'asserts causation' },
  { pattern: /\bdriv(e|es|en|ing) (your|the)\b/i, reason: 'asserts causation' },

  // Diagnostic / inferential
  { pattern: /\bindicat(e|es|ing|ive)\b/i, reason: 'diagnostic inference' },
  { pattern: /\bsuggests?\b/i, reason: 'diagnostic inference' },
  { pattern: /\bconsistent with\b/i, reason: 'diagnostic inference' },
  { pattern: /\bsigns? of\b/i, reason: 'diagnostic inference' },
  { pattern: /\bsymptomatic of\b/i, reason: 'diagnostic inference' },
  { pattern: /\bpoints? to\b/i, reason: 'diagnostic inference' },
  { pattern: /\bdiagnos(is|es|ed|tic)\b/i, reason: 'diagnostic claim' },
  { pattern: /\bcondition (is|appears|may be)\b/i, reason: 'diagnostic claim' },
  { pattern: /\blikely (a|an|the|caused|due)\b/i, reason: 'diagnostic inference' },

  // Prediction
  { pattern: /\bwill (likely |probably )?(worsen|improve|increase|decrease)\b/i, reason: 'prediction' },
  { pattern: /\bexpect(ed)? to\b/i, reason: 'prediction' },
  { pattern: /\bat risk of\b/i, reason: 'risk claim' },
  { pattern: /\bpredict(s|ed|ion)?\b/i, reason: 'prediction' },
  { pattern: /\bflare[- ]?up (is|coming|likely)\b/i, reason: 'prediction' },

  // Treatment advice
  { pattern: /\byou should\b/i, reason: 'clinical recommendation' },
  { pattern: /\btry (taking|using|increasing|reducing)\b/i, reason: 'clinical recommendation' },
  { pattern: /\brecommend(s|ed|ation)?\b/i, reason: 'clinical recommendation' },
  { pattern: /\b(increase|decrease|stop|start) (your|taking)\b/i, reason: 'clinical recommendation' },
  { pattern: /\bavoid\b/i, reason: 'clinical recommendation' },
  { pattern: /\btreatment for\b/i, reason: 'clinical recommendation' },

  // Efficacy claims about interventions
  { pattern: /\b(works?|effective|ineffective|helps you|doesn't work)\b/i, reason: 'efficacy claim' },
  { pattern: /\bproven\b/i, reason: 'efficacy claim' },
];

/**
 * Condition names. HealthLit must never name a disease it thinks the
 * person has. Deliberately short — this catches the obvious failure
 * of a template author reaching for a plausible-sounding label, and
 * is not a substitute for review.
 *
 * NOTE: a user's own custom symptom label could legitimately contain
 * one of these words (someone tracking a known, already-diagnosed
 * condition). `lintGeneratedText` therefore takes a list of allowed
 * user-supplied labels to exempt.
 */
const CONDITION_NAMES = [
  'migraine', 'fibromyalgia', 'arthritis', 'lupus', 'endometriosis',
  'crohn', 'colitis', 'diabetes', 'multiple sclerosis', 'chronic fatigue',
  'depression', 'anxiety disorder', 'neuropathy', 'sciatica', 'anaemia',
  'anemia', 'thyroid', 'ibs', 'pots', 'ehlers',
];

/** Splits into sentences for readable violation context. */
function toSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== '');
}

/**
 * Checks generated text for disallowed constructions.
 *
 * `userLabels` are strings the person typed themselves (custom
 * symptom names, medication names). They're exempted from the
 * condition-name check, because someone tracking their own diagnosed
 * migraines should be able to call the symptom "Migraine" without
 * the app refusing to print its own report.
 */
export function lintGeneratedText(
  text: string,
  userLabels: string[] = [],
): LanguageViolation[] {
  const violations: LanguageViolation[] = [];
  const exempt = userLabels.map((label) => label.toLowerCase());

  for (const sentence of toSentences(text)) {
    for (const banned of BANNED) {
      const match = sentence.match(banned.pattern);
      if (match) {
        violations.push({
          match: match[0],
          reason: banned.reason,
          context: sentence,
        });
      }
    }

    const lower = sentence.toLowerCase();
    for (const condition of CONDITION_NAMES) {
      if (!lower.includes(condition)) continue;
      // Skip when the mention comes from the user's own label.
      if (exempt.some((label) => label.includes(condition))) continue;
      violations.push({
        match: condition,
        reason: 'names a medical condition',
        context: sentence,
      });
    }
  }

  return violations;
}

/**
 * Throws on any violation. Intended for the golden tests, so a
 * disallowed phrase can never reach a build.
 */
export function assertNoClinicalClaims(text: string, userLabels: string[] = []): void {
  const violations = lintGeneratedText(text, userLabels);
  if (violations.length === 0) return;
  const detail = violations
    .map((violation) => `  "${violation.match}" (${violation.reason}) in: ${violation.context}`)
    .join('\n');
  throw new Error(`Disallowed clinical language in generated text:\n${detail}`);
}

/**
 * Approved vocabulary for describing an association without implying
 * a mechanism. Kept here so every section reaches for the same
 * phrasing rather than each template inventing its own.
 */
export const SAFE_PHRASING = {
  /** Factor recorded and severity fell more than usual. */
  improvedAlongside: 'severity fell further than usual in the readings that followed',
  /** Factor recorded and severity rose more than usual. */
  worsenedAlongside: 'severity rose further than usual in the readings that followed',
  /** No meaningful difference. */
  noDifference: 'severity moved about as much as it did without it',
  /** Standard hedge appended to any factor section. */
  associationCaveat:
    'These describe what was recorded close together in time. They are ' +
    'observations from self-reported entries, not established relationships.',
} as const;
