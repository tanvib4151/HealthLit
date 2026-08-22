/**
 * Story pipeline — microplanning and realization.
 *
 * Findings in, prose out. This is the half of a natural-language
 * generation pipeline the first version skipped entirely: every fact
 * went straight from computation to a format string, which is exactly
 * why the output read like a database with punctuation.
 *
 * Three things happen here that a template can't do:
 *
 *  AGGREGATION — related facts merge into one sentence instead of
 *  occupying a bullet each. "Fatigue: 17 entries on 17 days" and
 *  "Fatigue: described as heavy" become one clause.
 *
 *  REFERRING EXPRESSIONS — a symptom is named on first mention and
 *  pronominalised after. Repeating "your headache" six times in a
 *  paragraph is the clearest tell of machine-written text.
 *
 *  DISCOURSE CONNECTIVES — "however", "alongside this", "by contrast"
 *  chosen from the RELATIONSHIP between adjacent findings, not at
 *  random. Randomised phrasing variety reads uncanny; variation
 *  should carry meaning or not exist.
 *
 * PROVENANCE: every Sentence carries the entry ids behind it. That's
 * what makes the report tappable and what lets the golden tests
 * assert that each printed number is re-derivable from its cited
 * entries. A sentence with no provenance is a bug.
 */

import { Finding } from './storyFindings';
import { formatDayLabelLong } from './storyTimeline';

/**
 * Where a sentence's content came from.
 *
 * `derived` sentences state figures computed from readings and MUST
 * cite them — the golden tests fail the build on an uncited figure,
 * which is what makes "every number is traceable" an enforced
 * property rather than a slogan.
 *
 * `reference` sentences restate something the user entered elsewhere
 * (their medication list), and `user` sentences are their own words
 * or a prompt to write them. Neither derives from readings, so
 * neither carries entry ids — marking them as derived would imply
 * evidence that doesn't exist.
 */
export type SentenceSource = 'derived' | 'reference' | 'user';

/** A generated sentence and the evidence behind it. */
export interface Sentence {
  text: string;
  /** Entries this sentence's numbers came from. */
  entryIds: string[];
  /** Findings realized in this sentence. */
  findingIds: string[];
  source: SentenceSource;
}

export function sentence(
  text: string,
  entryIds: string[],
  findingIds: string[],
  source: SentenceSource = 'derived',
): Sentence {
  return { text: text.replace(/\s+/g, ' ').trim(), entryIds, findingIds, source };
}

/* ------------------------------ Helpers ----------------------------- */

export function plural(count: number, singular: string, pluralForm?: string): string {
  return count === 1 ? singular : pluralForm ?? `${singular}s`;
}

export function listPhrase(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "1.4" — one decimal, no trailing ".0" noise for whole numbers. */
export function num(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

/** Parses the "Label|count" pairs the findings layer packs into facts. */
export function unpackCounts(values: unknown): { label: string; count: number }[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((item): item is string => typeof item === 'string')
    .map((item) => {
      const [label, count] = item.split('|');
      return { label, count: Number(count) };
    })
    .filter((item) => item.label !== undefined && !Number.isNaN(item.count));
}

function fact(finding: Finding, key: string): string | number | null {
  const value = finding.facts[key];
  if (Array.isArray(value)) return null;
  return value ?? null;
}

function str(finding: Finding, key: string): string {
  const value = fact(finding, key);
  return value === null ? '' : `${value}`;
}

function n(finding: Finding, key: string): number {
  const value = fact(finding, key);
  return typeof value === 'number' ? value : Number(value ?? 0);
}

/**
 * Tracks which symptoms have been named, so later mentions can use a
 * pronoun. Scoped per section — a pronoun whose antecedent was three
 * sections ago is worse than a repeated noun.
 */
export class ReferenceTracker {
  private mentioned = new Set<string>();
  private lastMentioned: string | null = null;

  /**
   * SUBJECT position — safe to pronominalize when this symptom was
   * also the subject of the previous sentence.
   *
   * Pronouns are only ever produced here, and only in this position.
   * The golden tests caught why: used as a noun modifier, "it"
   * produces both ungrammatical output ("it readings") and, worse,
   * sentences whose antecedent is the wrong symptom —
   * "Inflammation was recorded on 30 of the 30 days that it was
   * recorded" reads as inflammation referring to itself. In a
   * document handed to a clinician that is not a style problem, it is
   * a statement about the wrong symptom.
   */
  referSubject(label: string): string {
    if (this.lastMentioned === label) return 'it';
    this.lastMentioned = label;
    this.mentioned.add(label);
    return label;
  }

  /** Names without pronominalizing, and marks it as the current topic. */
  refer(label: string): string {
    this.lastMentioned = label;
    this.mentioned.add(label);
    return label;
  }

  /**
   * MODIFIER position ("headache entries", "40% of headache
   * readings"). Never pronominalized — see referSubject.
   */
  referLower(label: string): string {
    this.lastMentioned = label;
    this.mentioned.add(label);
    return label.toLowerCase();
  }

  /** True if this symptom has already been named in this section. */
  hasMentioned(label: string): boolean {
    return this.mentioned.has(label);
  }

  reset(): void {
    this.lastMentioned = null;
    this.mentioned.clear();
  }
}

/**
 * Picks a connective from the relationship between two findings.
 *
 * Contrast gets "however"; agreement gets "alongside this". When
 * there's no meaningful relation, nothing is added — a connective
 * that doesn't mark a real relation is just noise.
 */
export function connectiveFor(previous: Finding, next: Finding): string {
  const previousDirection = str(previous, 'direction');
  const nextDirection = str(next, 'direction');

  if (previousDirection !== '' && nextDirection !== '') {
    if (previousDirection !== nextDirection) return 'By contrast, ';
    return 'Similarly, ';
  }
  if (previous.symptomLabel !== undefined && previous.symptomLabel === next.symptomLabel) {
    return 'Alongside this, ';
  }
  return '';
}

/* --------------------------- Realizers ------------------------------ */

/**
 * Symptom profile, aggregated into one flowing sentence rather than a
 * label-colon-stats line.
 */
export function realizeSymptomProfile(
  finding: Finding,
  references: ReferenceTracker,
  isPrimary: boolean,
): Sentence {
  const label = finding.symptomLabel ?? 'This symptom';
  const dayCount = n(finding, 'dayCount');
  const entryCount = n(finding, 'entryCount');
  const medianSeverity = n(finding, 'medianSeverity');
  const minSeverity = n(finding, 'minSeverity');
  const maxSeverity = n(finding, 'maxSeverity');

  const qualities = unpackCounts(finding.facts.topQualities);
  const regions = unpackCounts(finding.facts.topRegions);

  const opener = isPrimary
    ? `${references.refer(label)} was the most frequently recorded symptom`
    : `${references.refer(label)} was recorded less often`;

  const clauses: string[] = [
    `${opener} — ${dayCount} ${plural(dayCount, 'day')}, ` +
      `${entryCount} ${plural(entryCount, 'reading')}, ` +
      `typically ${num(medianSeverity)}/10 and ranging from ${num(minSeverity)} to ${num(maxSeverity)}`,
  ];

  if (qualities.length > 0) {
    const described = listPhrase(
      qualities.map((item) => `${item.label.toLowerCase()} (${item.count})`),
    );
    clauses.push(`most often described as ${described}`);
  }

  if (regions.length > 0) {
    const located = listPhrase(
      regions.map((item) => `${item.label.toLowerCase()} (${item.count})`),
    );
    clauses.push(`and marked at ${located}`);
  }

  return sentence(`${clauses.join(', ')}.`, finding.entryIds, [finding.id]);
}

/**
 * A paired factor effect.
 *
 * Wording is load-bearing. The comparison being described is
 * change-with versus change-without, so the sentence says exactly
 * that — "fell further than it did otherwise" — rather than the
 * shorter and false "reduced severity by 1.4 points". Counts are
 * always attached so the reader can weigh the claim themselves.
 */
export function realizeFactorEffect(
  finding: Finding,
  references: ReferenceTracker,
  connective = '',
): Sentence {
  const factor = str(finding, 'factor');
  const symptom = finding.symptomLabel ?? 'this symptom';
  const withCount = n(finding, 'withCount');
  const withoutCount = n(finding, 'withoutCount');
  const contrast = n(finding, 'contrast');
  const improved = contrast < 0;
  const magnitude = num(Math.abs(contrast));

  const movement = improved
    ? `severity fell about ${magnitude} ${plural(Math.abs(contrast), 'point')} further than it did otherwise`
    : `severity rose about ${magnitude} ${plural(Math.abs(contrast), 'point')} more than it did otherwise`;

  // Explicit rather than lowercasing the first character generically:
  // a symptom label like "Brain Fog" must keep its capitals, so a
  // blanket lowerFirst() would corrupt other realizers. Spelling both
  // forms out is duller and correct.
  const opener = connective === ''
    ? 'In the readings that followed'
    : 'in the readings that followed';

  const text =
    `${connective}${opener} ${references.referLower(symptom)} entries ` +
    `where ${factor.toLowerCase()} was recorded, ${movement} ` +
    `(${withCount} such ${plural(withCount, 'reading')}, against ${withoutCount} without).`;

  return sentence(text, finding.entryIds, [finding.id]);
}

/** Change measured against the person's own prior history. */
export function realizeBaselineChange(
  finding: Finding,
  references: ReferenceTracker,
  connective = '',
): Sentence {
  const symptom = finding.symptomLabel ?? 'This symptom';
  const direction = str(finding, 'direction');
  const windowMedian = n(finding, 'windowMedian');
  const baselineMedian = n(finding, 'baselineMedian');
  const windowCount = n(finding, 'windowCount');
  const baselineCount = n(finding, 'baselineCount');

  if (direction === 'steady') {
    return sentence(
      `${connective}${references.referSubject(symptom)} was about the same as ` +
        `before this period — typically ${num(windowMedian)}/10 now against ` +
        `${num(baselineMedian)}/10 across ${baselineCount} earlier ${plural(baselineCount, 'reading')}.`,
      finding.entryIds,
      [finding.id],
    );
  }

  return sentence(
    `${connective}${references.referSubject(symptom)} ran ${direction} in this period than ` +
      `beforehand — typically ${num(windowMedian)}/10 across ${windowCount} ` +
      `${plural(windowCount, 'reading')}, against ${num(baselineMedian)}/10 across ` +
      `${baselineCount} earlier ${plural(baselineCount, 'reading')}.`,
    finding.entryIds,
    [finding.id],
  );
}

export function realizeWeekday(finding: Finding, references: ReferenceTracker): Sentence {
  const symptom = finding.symptomLabel ?? 'this symptom';
  const dayName = str(finding, 'dayName');
  const groupMedian = n(finding, 'groupMedian');
  const otherMedian = n(finding, 'otherMedian');
  const groupCount = n(finding, 'groupCount');
  const direction = str(finding, 'direction');

  return sentence(
    `${dayName} readings of ${references.referLower(symptom)} ran ${direction} than the rest of the week ` +
      `— typically ${num(groupMedian)}/10 across ${groupCount} ${plural(groupCount, 'reading')}, ` +
      `against ${num(otherMedian)}/10 otherwise.`,
    finding.entryIds,
    [finding.id],
  );
}

/**
 * Time-of-day concentration.
 *
 * Framed as when logging happened, with the ambiguity stated openly:
 * this is as likely to reflect a daily routine as the symptom itself,
 * and asserting otherwise would be an inference.
 */
export function realizeTimeOfDay(finding: Finding, references: ReferenceTracker): Sentence {
  const symptom = finding.symptomLabel ?? 'this symptom';
  const percent = n(finding, 'percent');
  const count = n(finding, 'count');
  const total = n(finding, 'total');
  const bucket = str(finding, 'bucket');

  return sentence(
    `${percent}% of ${references.referLower(symptom)} readings (${count} of ${total}) were recorded in the ` +
      `${bucket} — which may reflect when it is most noticeable, or simply when logging fits the day.`,
    finding.entryIds,
    [finding.id],
  );
}

/**
 * Several symptoms sharing one time bucket, merged.
 *
 * Emitting a near-identical sentence per symptom is the exact
 * padding that aggregation exists to remove — three symptoms all
 * logged in the morning is one observation about a routine, not
 * three findings.
 */
export function realizeTimeOfDayGroup(findings: Finding[]): Sentence {
  if (findings.length === 1) {
    return realizeTimeOfDay(findings[0], new ReferenceTracker());
  }
  const bucket = str(findings[0], 'bucket');
  const labels = listPhrase(
    findings.map((finding) => (finding.symptomLabel ?? '').toLowerCase()),
  );
  const total = findings.reduce((sum, finding) => sum + n(finding, 'total'), 0);
  const count = findings.reduce((sum, finding) => sum + n(finding, 'count'), 0);

  return sentence(
    `Readings of ${labels} were recorded almost entirely in the ${bucket} ` +
      `(${count} of ${total}) — which may reflect when they are most noticeable, ` +
      `or simply when logging fits the day.`,
    findings.flatMap((finding) => finding.entryIds),
    findings.map((finding) => finding.id),
  );
}

export function realizeCooccurrence(finding: Finding, references: ReferenceTracker): Sentence {
  const symptom = finding.symptomLabel ?? 'the main symptom';
  const otherLabel = str(finding, 'otherLabel');
  const sharedDays = n(finding, 'sharedDays');
  const primaryDays = n(finding, 'primaryDays');
  const percent = n(finding, 'percent');

  return sentence(
    `${otherLabel} was recorded on ${sharedDays} of the ${primaryDays} ` +
      `${plural(primaryDays, 'day')} that ${references.referLower(symptom)} was recorded (${percent}%).`,
    finding.entryIds,
    [finding.id],
  );
}

/**
 * Descriptors mined from free-text notes.
 *
 * Always attributed to the notes, and kept separate from tapped
 * chips: a chip is a deliberate assertion, a parsed word is the app's
 * reading of someone's phrasing. Collapsing that distinction would
 * put words in a patient's mouth.
 */
export function realizeNoteDescriptors(findings: Finding[]): Sentence | null {
  if (findings.length === 0) return null;

  const described = listPhrase(
    findings
      .slice(0, 6)
      .map((finding) => `${str(finding, 'label').toLowerCase()} (${n(finding, 'count')})`),
  );

  return sentence(
    `Recurring words from my own written notes: ${described}. ` +
      `These were read from the notes rather than selected from a list.`,
    findings.flatMap((finding) => finding.entryIds),
    findings.map((finding) => finding.id),
  );
}

export function realizeDataQuality(finding: Finding): Sentence {
  const daysLogged = n(finding, 'daysLogged');
  const daysInRange = n(finding, 'daysInRange');
  const entryCount = n(finding, 'entryCount');
  const missingDuration = n(finding, 'missingDuration');

  const durationNote =
    missingDuration > 0
      ? ` Duration was not recorded for ${missingDuration} of them.`
      : '';

  return sentence(
    `${entryCount} ${plural(entryCount, 'reading')} recorded on ${daysLogged} of ` +
      `${daysInRange} ${plural(daysInRange, 'day')}.${durationNote}`,
    finding.entryIds,
    [finding.id],
  );
}

export function realizeOnset(
  symptomLabel: string,
  onsetDateKey: string | null,
  firstLoggedDateKey: string,
  entryIds: string[],
  findingId: string,
): Sentence {
  if (onsetDateKey !== null) {
    return sentence(
      `${symptomLabel} began on ${formatDayLabelLong(onsetDateKey)} (recorded by me), ` +
        `and first appears in my logs on ${formatDayLabelLong(firstLoggedDateKey)}.`,
      entryIds,
      [findingId],
    );
  }
  return sentence(
    `${symptomLabel} first appears in my logs on ${formatDayLabelLong(firstLoggedDateKey)}. ` +
      `I have not recorded when it actually began.`,
    entryIds,
    [findingId],
  );
}

/**
 * Joins realized sentences into a paragraph, inserting connectives
 * where adjacent findings genuinely relate.
 */
export function paragraph(
  findings: Finding[],
  realize: (finding: Finding, connective: string) => Sentence,
): Sentence[] {
  return findings.map((finding, index) => {
    const previous = findings[index - 1];
    const connective = previous === undefined ? '' : connectiveFor(previous, finding);
    return realize(finding, connective);
  });
}
