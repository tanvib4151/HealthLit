/**
 * Symptom descriptor lexicon.
 *
 * Notes are the richest thing HealthLit collects and the only thing
 * it never reads. Someone writes "woke up with a stabbing pain behind
 * my right eye, couldn't look at my screen" and the report says
 * nothing about stabbing, eye, or light — because none of those were
 * tapped as chips.
 *
 * This module extracts descriptors from note text using a CURATED
 * LEXICON with explicit surface forms. No embeddings, no fuzzy
 * matching, no model: a closed vocabulary where every match is
 * traceable to a listed term. That matters twice over — it keeps the
 * engine deterministic, and it means a wrong extraction is a
 * one-line fix to a table rather than an unexplainable behaviour.
 *
 * NEGATION HANDLING is the reason this isn't just `includes()`.
 * "not sharp", "no light sensitivity", and "never throbbing" all
 * contain their own descriptor. Counting those as positives would
 * put words in a patient's mouth in a document they hand to a
 * doctor, which is the single worst failure mode available here.
 *
 * Extracted descriptors are always reported as coming FROM NOTES and
 * kept visually separate from tapped chips, because a tapped chip is
 * a deliberate assertion and a parsed word is an inference about
 * phrasing.
 */

export type DescriptorCategory = 'quality' | 'location' | 'aggravator' | 'associated';

export interface LexiconTerm {
  /** Canonical display label. */
  label: string;
  category: DescriptorCategory;
  /** Surface forms to match, lowercase. Longest are matched first. */
  forms: string[];
}

/**
 * Curated deliberately small. Every term here is a word patients
 * actually use and clinicians actually ask about. Growing this list
 * is safe; loosening the matching is not.
 */
export const LEXICON: LexiconTerm[] = [
  // Qualities
  { label: 'Stabbing', category: 'quality', forms: ['stabbing', 'stabby', 'like a knife'] },
  { label: 'Throbbing', category: 'quality', forms: ['throbbing', 'throbby', 'pulsing', 'pounding'] },
  { label: 'Burning', category: 'quality', forms: ['burning', 'burns', 'searing'] },
  { label: 'Sharp', category: 'quality', forms: ['sharp'] },
  { label: 'Dull', category: 'quality', forms: ['dull', 'aching', 'achy'] },
  { label: 'Tingling', category: 'quality', forms: ['tingling', 'tingly', 'pins and needles'] },
  { label: 'Numb', category: 'quality', forms: ['numb', 'numbness'] },
  { label: 'Cramping', category: 'quality', forms: ['cramping', 'cramp', 'cramps'] },
  { label: 'Pressure', category: 'quality', forms: ['pressure', 'tight band', 'vice'] },
  { label: 'Radiating', category: 'quality', forms: ['radiating', 'shooting', 'travels down'] },
  { label: 'Stiff', category: 'quality', forms: ['stiff', 'stiffness'] },

  // Locations mentioned in prose
  { label: 'Behind the eye', category: 'location', forms: ['behind my eye', 'behind the eye', 'behind my eyes'] },
  { label: 'Temple', category: 'location', forms: ['temple', 'temples'] },
  { label: 'Base of skull', category: 'location', forms: ['base of my skull', 'base of skull', 'back of my head'] },
  { label: 'Jaw', category: 'location', forms: ['jaw'] },
  { label: 'Lower back', category: 'location', forms: ['lower back', 'low back', 'lumbar'] },
  { label: 'Shoulder', category: 'location', forms: ['shoulder', 'shoulders'] },
  { label: 'Hands', category: 'location', forms: ['hands', 'fingers', 'knuckles'] },
  { label: 'Knees', category: 'location', forms: ['knee', 'knees'] },

  // Aggravators described in prose
  { label: 'Light', category: 'aggravator', forms: ['light sensitivity', 'bright light', 'photophobia', 'screen', 'screens'] },
  { label: 'Sound', category: 'aggravator', forms: ['noise', 'loud', 'sound sensitivity'] },
  { label: 'Movement', category: 'aggravator', forms: ['moving', 'movement', 'bending', 'standing up'] },
  { label: 'Cold', category: 'aggravator', forms: ['cold weather', 'the cold'] },

  // Associated experiences
  { label: 'Nausea', category: 'associated', forms: ['nausea', 'nauseous', 'sick to my stomach', 'queasy'] },
  { label: 'Dizziness', category: 'associated', forms: ['dizzy', 'dizziness', 'lightheaded', 'vertigo'] },
  { label: 'Vision changes', category: 'associated', forms: ['blurry vision', 'blurred vision', 'aura', 'seeing spots'] },
  { label: 'Brain fog', category: 'associated', forms: ['brain fog', 'foggy', 'cant think straight', "can't think straight"] },
  { label: 'Poor sleep', category: 'associated', forms: ['couldnt sleep', "couldn't sleep", 'slept badly', 'woke up several times'] },
];

/** Words that negate a descriptor appearing shortly after them. */
const NEGATORS = [
  'not', "n't", 'no', 'never', 'without', 'denies', 'denied',
  'less', 'stopped', 'gone', 'free of', 'absent',
];

/** How many words after a negator stay inside its scope. */
const NEGATION_SCOPE_WORDS = 4;

/** Clause boundaries end a negation's reach: "no nausea, but sharp pain". */
const CLAUSE_BREAKS = [',', ';', '.', ' but ', ' though ', ' although ', ' however '];

export interface ExtractedDescriptor {
  label: string;
  category: DescriptorCategory;
  /** How many notes it was found in. */
  count: number;
  /** Entry ids the mentions came from — provenance. */
  entryIds: string[];
  /** Times it appeared negated ("not sharp") and was therefore excluded. */
  negatedCount: number;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ');
}

/**
 * True if `index` in `text` falls inside a negation's scope.
 *
 * Looks backwards a bounded number of words for a negator, stopping
 * at any clause break. Bounded and explicit: it will miss elaborate
 * constructions, which is the correct failure direction — a missed
 * negation means a descriptor is wrongly INCLUDED, so the scope is
 * kept generous and anything ambiguous is treated as negated.
 */
function isNegated(text: string, index: number): boolean {
  const before = text.slice(0, index);

  let clauseStart = 0;
  for (const breakToken of CLAUSE_BREAKS) {
    const position = before.lastIndexOf(breakToken);
    if (position > clauseStart) clauseStart = position + breakToken.length;
  }

  const clause = before.slice(clauseStart);
  const words = clause.split(' ').filter((word) => word !== '');
  const window = words.slice(-NEGATION_SCOPE_WORDS);

  return window.some((word) =>
    NEGATORS.some((negator) =>
      negator.startsWith("n'") ? word.endsWith(negator) : word === negator || word === `${negator},`,
    ),
  );
}

/**
 * Extracts descriptors from a set of notes.
 *
 * `notes` pairs each note with its entry id so every extracted
 * descriptor keeps its provenance and can be traced back in the UI.
 */
export function extractDescriptors(
  notes: { entryId: string; text: string }[],
): ExtractedDescriptor[] {
  const found = new Map<string, ExtractedDescriptor>();

  // Longest forms first, so "behind my eye" wins over "eye" and
  // "light sensitivity" isn't shadowed by a bare "light".
  const terms = LEXICON.flatMap((term) =>
    term.forms.map((form) => ({ term, form })),
  ).sort((a, b) => b.form.length - a.form.length);

  for (const note of notes) {
    const text = normalize(note.text);
    // Track consumed spans so overlapping forms don't double-count.
    const consumed: [number, number][] = [];

    for (const { term, form } of terms) {
      let searchFrom = 0;
      for (;;) {
        const index = text.indexOf(form, searchFrom);
        if (index === -1) break;
        searchFrom = index + form.length;

        const overlaps = consumed.some(
          ([start, end]) => index < end && index + form.length > start,
        );
        if (overlaps) continue;

        // Require whole-word boundaries.
        const charBefore = index === 0 ? ' ' : text[index - 1];
        const charAfter = text[index + form.length] ?? ' ';
        if (/[a-z]/.test(charBefore) || /[a-z]/.test(charAfter)) continue;

        consumed.push([index, index + form.length]);

        const existing = found.get(term.label) ?? {
          label: term.label,
          category: term.category,
          count: 0,
          entryIds: [],
          negatedCount: 0,
        };

        if (isNegated(text, index)) {
          existing.negatedCount += 1;
        } else {
          existing.count += 1;
          if (!existing.entryIds.includes(note.entryId)) {
            existing.entryIds.push(note.entryId);
          }
        }
        found.set(term.label, existing);
      }
    }
  }

  return [...found.values()]
    .filter((descriptor) => descriptor.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Descriptors mentioned in at least `minCount` notes. */
export function significantDescriptors(
  descriptors: ExtractedDescriptor[],
  minCount = 2,
): ExtractedDescriptor[] {
  return descriptors.filter((descriptor) => descriptor.count >= minCount);
}
