/**
 * Story pipeline — report assembly.
 *
 * Composes the nine required sections from scored findings, realized
 * through the NLG layer. The pipeline in full:
 *
 *   entries
 *     -> healthEvents      extraction + entity resolution
 *     -> storyStats        paired, stratified, stability-filtered
 *     -> storyFindings     scored claims carrying their evidence
 *     -> storyNlg          aggregation, references, connectives
 *     -> here              section assembly + ordering
 *
 * Deterministic end to end. No model call, no network, no randomness
 * that isn't seeded from the data itself. Every sentence carries the
 * entry ids behind it, so any figure in the report can be traced to
 * the readings that produced it.
 *
 * WHAT THIS WILL NOT SAY: no causes, no conditions, no predictions,
 * no advice. utils/storyLanguage.ts enforces that mechanically and
 * the golden tests fail the build on a violation — it is no longer
 * left to whoever writes the next sentence to remember.
 */

import { CustomSymptom, Medication, SymptomEntry, SymptomOnset, UserProfile } from '../types/models';
import {
  buildHealthEvents,
  dateKeyFromLocalDate,
  daysInRange,
  distinctDayKeys,
  filterEventsToRange,
  groupBySymptom,
  HealthEvent,
  meanOf,
} from './healthEvents';
import {
  buildChangeFindings,
  buildRejectedFactors,
  RejectedFactor,
  buildCooccurrenceFindings,
  buildDataQualityFinding,
  buildFactorFindings,
  buildNoteFindings,
  buildSymptomFindings,
  buildTimeFindings,
  Finding,
  selectFindings,
} from './storyFindings';
import { buildStoryCharts, ChartSpec } from './storyCharts';
import { SAFE_PHRASING } from './storyLanguage';
import {
  paragraph,
  plural,
  realizeBaselineChange,
  realizeCooccurrence,
  realizeDataQuality,
  realizeFactorEffect,
  realizeNoteDescriptors,
  realizeOnset,
  realizeSymptomProfile,
  realizeTimeOfDayGroup,
  realizeWeekday,
  ReferenceTracker,
  Sentence,
  sentence,
  unpackCounts,
  listPhrase,
  num,
} from './storyNlg';
import { median } from './storyStats';
import {
  assembleChain,
  buildProgressionFindings,
  buildSymptomLinks,
  describeLink,
  describeProgression,
} from './storyProgression';
import { confidenceSummary } from './storyConfidence';
import {
  buildTimeline,
  countLoggedDays,
  formatDayLabelLong,
  Timeline,
} from './storyTimeline';

export type StorySectionKey =
  | 'reason'
  | 'onset'
  | 'change'
  | 'experience'
  | 'frequency'
  | 'patterns'
  | 'relief'
  | 'cooccurring'
  | 'medications';

export interface StorySection {
  key: StorySectionKey;
  title: string;
  /** Realized sentences, each carrying its own provenance. */
  body: Sentence[];
  /** True for the one section the app cannot derive. */
  userAuthored?: boolean;
}

export interface StoryReportMeta {
  startDateKey: string;
  endDateKey: string;
  rangeLabel: string;
  daysInRange: number;
  daysLogged: number;
  entryCount: number;
  symptomCount: number;
  medianSeverity: number | null;
  maxSeverity: number | null;
  generatedAt: string;
  patientName: string | null;
}

export interface StoryReport {
  meta: StoryReportMeta;
  sections: StorySection[];
  timeline: Timeline;
  /** Every finding considered, for the evidence viewer. */
  findings: Finding[];
  /**
   * Charts the data supports, in reading order. Built as pure specs
   * so the app and the printed report render identical numbers from
   * one source rather than each drawing its own version.
   */
  charts: ChartSpec[];
  /** entryId -> the reading itself, for tap-to-inspect. */
  entryIndex: Record<string, HealthEvent>;
}

export const SECTION_TITLES: Record<StorySectionKey, string> = {
  reason: "Why I'm seeking care",
  onset: 'When it started',
  change: 'How it has changed',
  experience: "What I'm experiencing",
  frequency: 'Frequency and duration',
  patterns: 'Patterns and possible triggers',
  relief: 'Factors that improve the condition',
  cooccurring: 'Other symptoms experienced alongside',
  medications: 'Medications and interventions tried',
};

/* ----------------------------- Sections ----------------------------- */

function buildReasonSection(
  profiles: Finding[],
  meta: StoryReportMeta,
): StorySection {
  if (profiles.length === 0) {
    return { key: 'reason', title: SECTION_TITLES.reason, body: [], userAuthored: true };
  }

  const primary = profiles[0];
  const label = primary.symptomLabel ?? 'this symptom';
  const dayCount = Number(primary.facts.dayCount ?? 0);
  const medianSeverity = Number(primary.facts.medianSeverity ?? 0);

  const others = profiles
    .slice(1, 4)
    .map((finding) => (finding.symptomLabel ?? '').toLowerCase())
    .filter((text) => text !== '');

  const body: Sentence[] = [
    sentence(
      `Over the ${meta.daysInRange} ${plural(meta.daysInRange, 'day')} from ` +
        `${formatDayLabelLong(meta.startDateKey)} to ${formatDayLabelLong(meta.endDateKey)}, ` +
        `I recorded ${label.toLowerCase()} on ${dayCount} ${plural(dayCount, 'day')}, ` +
        `typically ${num(medianSeverity)}/10.`,
      primary.entryIds,
      [primary.id],
    ),
  ];

  if (others.length > 0) {
    body.push(
      sentence(
        `I also recorded ${listPhrase(others)} during this period.`,
        profiles.slice(1, 4).flatMap((finding) => finding.entryIds),
        profiles.slice(1, 4).map((finding) => finding.id),
      ),
    );
  }

  body.push(
    sentence(
      'Replace this with your own words before your appointment — what you ' +
        'want looked at, and what you are hoping to get out of the visit.',
      [],
      [],
      'user',
    ),
  );

  return { key: 'reason', title: SECTION_TITLES.reason, body, userAuthored: true };
}

/**
 * "When it started" now distinguishes reported onset from first log
 * entry. Those are different facts, and conflating them — as the
 * first version did — silently understates how long someone has been
 * unwell, sometimes by years.
 */
function buildOnsetSection(
  profiles: Finding[],
  onsets: SymptomOnset[],
  symptomTypeByLabel: Map<string, string>,
  firstTime: { symptomLabel: string; firstDateKey: string; entryIds: string[] }[],
): StorySection {
  const body: Sentence[] = [];

  for (const profile of profiles.slice(0, 5)) {
    const label = profile.symptomLabel ?? '';
    const symptomType = symptomTypeByLabel.get(label);
    const onset = onsets.find((item) => item.symptomType === symptomType);
    body.push(
      realizeOnset(
        label,
        onset ? onset.onsetDate : null,
        `${profile.facts.firstDateKey ?? ''}`,
        profile.entryIds,
        profile.id,
      ),
    );
    if (onset && onset.note !== null && onset.note.trim() !== '') {
      body.push(
        sentence(`My note on when it began: ${onset.note.trim()}`, [], [], 'reference'),
      );
    }
  }

  for (const item of firstTime) {
    body.push(
      sentence(
        `${item.symptomLabel} appears for the first time anywhere in my logs on ` +
          `${formatDayLabelLong(item.firstDateKey)}.`,
        item.entryIds,
        [],
      ),
    );
  }

  return { key: 'onset', title: SECTION_TITLES.onset, body };
}

function buildChangeSection(
  changes: Finding[],
  progression: ReturnType<typeof buildProgressionFindings>,
  references: ReferenceTracker,
): StorySection {
  references.reset();

  // Progression states first: "new", "increasing", "resolved" are the
  // things a clinician scans for, and they answer a different
  // question from severity drift.
  const progressionBody = progression
    .filter((item) => item.state !== 'steady')
    .slice(0, 5)
    .map((item) => sentence(describeProgression(item), item.entryIds, []));

  const body =
    changes.length > 0
      ? paragraph(changes.slice(0, 4), (finding, connective) =>
          realizeBaselineChange(finding, references, connective),
        )
      : [
          sentence(
            'There is not enough history before this period to compare against, ' +
              'so this period stands on its own.',
            [],
            [],
            'reference',
          ),
        ];

  return {
    key: 'change',
    title: SECTION_TITLES.change,
    body: [...progressionBody, ...body],
  };
}

function buildExperienceSection(
  profiles: Finding[],
  noteFindings: Finding[],
  references: ReferenceTracker,
): StorySection {
  references.reset();
  const body: Sentence[] = profiles
    .slice(0, 6)
    .map((finding, index) => realizeSymptomProfile(finding, references, index === 0));

  const noteSentence = realizeNoteDescriptors(noteFindings.slice(0, 6));
  if (noteSentence !== null) body.push(noteSentence);

  return { key: 'experience', title: SECTION_TITLES.experience, body };
}

function buildFrequencySection(
  profiles: Finding[],
  quality: Finding,
  references: ReferenceTracker,
): StorySection {
  references.reset();
  const body: Sentence[] = [realizeDataQuality(quality)];

  for (const profile of profiles.slice(0, 5)) {
    const label = profile.symptomLabel ?? 'This symptom';
    const dayCount = Number(profile.facts.dayCount ?? 0);
    const durations = unpackCounts(profile.facts.topDurations);
    const missing = Number(profile.facts.durationMissing ?? 0);

    if (durations.length === 0) {
      body.push(
        sentence(
          `${label} was recorded on ${dayCount} ${plural(dayCount, 'day')}, with no duration noted.`,
          profile.entryIds,
          [profile.id],
        ),
      );
      continue;
    }

    const durationText = listPhrase(
      durations.map((item) => `${item.label.toLowerCase()} (${item.count})`),
    );
    const missingText =
      missing > 0
        ? ` Duration was left blank on ${missing} ${plural(missing, 'occasion')}.`
        : '';

    body.push(
      sentence(
        `${label} was recorded on ${dayCount} ${plural(dayCount, 'day')}, ` +
          `most often lasting ${durationText}.${missingText}`,
        profile.entryIds,
        [profile.id],
      ),
    );
  }

  return { key: 'frequency', title: SECTION_TITLES.frequency, body };
}

function buildPatternsSection(
  triggers: Finding[],
  timeFindings: Finding[],
  rejected: RejectedFactor[],
  references: ReferenceTracker,
): StorySection {
  references.reset();
  const body: Sentence[] = [];

  if (triggers.length > 0) {
    body.push(
      ...paragraph(triggers, (finding, connective) => {
        const realized = realizeFactorEffect(finding, references, connective);
        // Confidence travels with the claim rather than living in a
        // legend somewhere. A reader should never have to remember
        // that one finding rests on 4 readings and another on 40.
        return sentence(
          `${realized.text} [${confidenceSummary(finding)}]`,
          realized.entryIds,
          realized.findingIds,
        );
      }),
    );
  }

  for (const finding of timeFindings) {
    if (finding.kind === 'weekdayContrast') body.push(realizeWeekday(finding, references));
  }

  // Time-of-day findings sharing a bucket are merged into one
  // sentence rather than repeated per symptom.
  const timeOfDay = timeFindings.filter(
    (finding) => finding.kind === 'timeOfDayConcentration',
  );
  const byBucket = new Map<string, Finding[]>();
  for (const finding of timeOfDay) {
    const bucket = `${finding.facts.bucket}`;
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), finding]);
  }
  byBucket.forEach((group) => body.push(realizeTimeOfDayGroup(group)));

  if (body.length === 0) {
    body.push(
      sentence(
        'No factor was recorded often enough, or consistently enough, to report ' +
          'a difference this period.',
        [],
        [],
        'reference',
      ),
    );
  } else {
    body.push(sentence(SAFE_PHRASING.associationCaveat, [], [], 'reference'));
  }

  // What was checked and found NOT to hold. Reporting only positives
  // lets a reader assume the unchecked questions were never asked,
  // and makes the engine look like it finds a pattern in everything.
  // A factor rejected for one symptom may well have been REPORTED for
  // another — poor sleep can be a real signal for headaches and noise
  // for fatigue. Listing it as "no relationship found" while a
  // finding about it sits three lines above makes the report look
  // like it is contradicting itself, so anything reported anywhere is
  // excluded here.
  const reportedFactors = new Set(
    triggers.map((finding) => `${finding.facts.factor}`.toLowerCase()),
  );
  const checked = rejected.filter(
    (item) =>
      item.reason !== 'tooFewPaired' &&
      !reportedFactors.has(item.factor.toLowerCase()),
  );
  if (checked.length > 0) {
    const described = listPhrase(
      [...new Set(checked.map((item) => item.factor.toLowerCase()))].slice(0, 6),
    );
    body.push(
      sentence(
        `Also checked, with no consistent relationship found: ${described}.`,
        [],
        [],
        'reference',
      ),
    );
  }

  return { key: 'patterns', title: SECTION_TITLES.patterns, body };
}

/**
 * Relief factors, including the ones that made no measurable
 * difference. Reporting only what appeared to help would be a
 * flattering omission — "I tried heat nine times and nothing shifted"
 * is precisely the finding that changes what a clinician suggests.
 */
function buildReliefSection(
  helped: Finding[],
  noEffect: { label: string; count: number; entryIds: string[] }[],
  references: ReferenceTracker,
): StorySection {
  references.reset();
  const body: Sentence[] = [];

  if (helped.length > 0) {
    body.push(
      ...paragraph(helped, (finding, connective) => {
        const realized = realizeFactorEffect(finding, references, connective);
        return sentence(
          `${realized.text} [${confidenceSummary(finding)}]`,
          realized.entryIds,
          realized.findingIds,
        );
      }),
    );
  }

  if (noEffect.length > 0) {
    const described = listPhrase(
      noEffect.slice(0, 5).map((item) => `${item.label.toLowerCase()} (${item.count})`),
    );
    body.push(
      sentence(
        `Recorded as helping, but with no measurable difference in the readings ` +
          `that followed: ${described}.`,
        noEffect.flatMap((item) => item.entryIds),
        [],
      ),
    );
  }

  if (body.length === 0) {
    body.push(
      sentence(
        'No relief factor was recorded on enough readings with a follow-up to compare.',
        [],
        [],
        'reference',
      ),
    );
  }

  return { key: 'relief', title: SECTION_TITLES.relief, body };
}

function buildCooccurrenceSection(
  findings: Finding[],
  links: ReturnType<typeof buildSymptomLinks>,
  references: ReferenceTracker,
): StorySection {
  references.reset();

  // Directional links, each independently tested against the
  // follower's own base rate. See utils/storyProgression.ts for why
  // free-form chain mining is deliberately not done.
  const linkBody = links
    .slice(0, 3)
    .map((link) => sentence(describeLink(link), link.entryIds, []));

  const chain = assembleChain(links);
  const chainBody =
    chain.length >= 3
      ? [
          sentence(
            `Taken together, these appeared in a recurring order: ${chain.join(' → ')}. ` +
              `Each step is listed above with its own numbers; the order is what was ` +
              `recorded, not a claim that one brings on the next.`,
            links.flatMap((link) => link.entryIds),
            [],
            'reference',
          ),
        ]
      : [];

  const body =
    findings.length > 0
      ? findings.slice(0, 5).map((finding) => realizeCooccurrence(finding, references))
      : [
          sentence(
            'No other symptom was recorded on enough of the same days to report.',
            [],
            [],
            'reference',
          ),
        ];

  return {
    key: 'cooccurring',
    title: SECTION_TITLES.cooccurring,
    body: [...body, ...linkBody, ...chainBody],
  };
}

function buildMedicationsSection(
  medications: Medication[],
  medicationFindings: Finding[],
  events: HealthEvent[],
  references: ReferenceTracker,
): StorySection {
  references.reset();
  const body: Sentence[] = [];

  if (medications.length > 0) {
    const listed = medications.map((medication) => {
      const dose = medication.dose.trim() !== '' ? `, ${medication.dose.trim()}` : '';
      const schedule =
        medication.scheduleNote !== null && medication.scheduleNote.trim() !== ''
          ? ` (${medication.scheduleNote.trim()})`
          : '';
      return `${medication.name}${dose}${schedule}`;
    });
    body.push(sentence(`Medications I take: ${listPhrase(listed)}.`, [], [], 'reference'));
  } else {
    body.push(sentence('No medications are recorded in the app.', [], [], 'reference'));
  }

  const nameById = new Map(medications.map((medication) => [medication.id, medication.name]));

  if (medicationFindings.length > 0) {
    for (const finding of medicationFindings) {
      const named: Finding = {
        ...finding,
        facts: {
          ...finding.facts,
          factor: nameById.get(`${finding.facts.factor}`) ?? `${finding.facts.factor}`,
        },
      };
      body.push(realizeFactorEffect(named, references));
    }
  } else {
    const linked = events.filter((event) => event.medicationIds.length > 0).length;
    body.push(
      sentence(
        linked === 0
          ? 'No readings have a medication linked to them yet, so no comparison is possible.'
          : `${linked} ${plural(linked, 'reading')} have a medication linked, which is not yet ` +
            'enough with a follow-up reading to compare.',
        [],
        [],
        'reference',
      ),
    );
  }

  const interventions = new Map<string, { count: number; entryIds: string[] }>();
  for (const event of events) {
    for (const factor of event.reliefFactors) {
      const existing = interventions.get(factor) ?? { count: 0, entryIds: [] };
      existing.count += 1;
      existing.entryIds.push(event.entryId);
      interventions.set(factor, existing);
    }
  }

  if (interventions.size > 0) {
    const tried = [...interventions.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6);
    body.push(
      sentence(
        `Non-drug interventions recorded: ${listPhrase(
          tried.map(([label, data]) => `${label.toLowerCase()} (${data.count})`),
        )}.`,
        tried.flatMap(([, data]) => data.entryIds),
        [],
      ),
    );
  }

  return { key: 'medications', title: SECTION_TITLES.medications, body };
}

/* ------------------------------ Builder ----------------------------- */

export interface BuildStoryOptions {
  startDate: Date;
  endDate: Date;
  medications?: Medication[];
  profile?: UserProfile | null;
  customSymptoms?: CustomSymptom[];
  onsets?: SymptomOnset[];
  now?: Date;
}

export function buildStoryReport(
  entries: SymptomEntry[],
  options: BuildStoryOptions,
): StoryReport {
  const {
    startDate,
    endDate,
    medications = [],
    profile = null,
    customSymptoms = [],
    onsets = [],
    now = new Date(),
  } = options;

  const allEvents = buildHealthEvents(entries, customSymptoms);
  const inRange = filterEventsToRange(allEvents, startDate, endDate);
  const startKey = dateKeyFromLocalDate(startDate);
  const beforeRange = allEvents.filter((event) => event.dateKey < startKey);

  const timeline = buildTimeline(inRange, startDate, endDate);

  // ---- content determination ----
  const profiles = buildSymptomFindings(inRange).sort((a, b) => b.salience - a.salience);
  const factorFindings = buildFactorFindings(inRange);
  const rejectedFactors = buildRejectedFactors(inRange);
  const progression = buildProgressionFindings(
    inRange,
    beforeRange,
    daysInRange(startDate, endDate),
    now,
  );
  const symptomLinks = buildSymptomLinks(inRange);
  const changeFindings = buildChangeFindings(inRange, beforeRange);
  const timeFindings = buildTimeFindings(inRange);
  const cooccurrenceFindings = buildCooccurrenceFindings(inRange);
  const noteFindings = buildNoteFindings(inRange);
  const qualityFinding = buildDataQualityFinding(
    inRange,
    daysInRange(startDate, endDate),
    countLoggedDays(timeline),
  );

  const triggerFindings = factorFindings.filter(
    (finding) => finding.kind === 'factorEffect' && finding.facts.channel === 'trigger',
  );
  const reliefFindings = factorFindings.filter(
    (finding) => finding.kind === 'factorEffect' && finding.facts.channel === 'relief',
  );
  const medicationFindings = factorFindings.filter(
    (finding) => finding.kind === 'medicationEffect',
  );

  // Relief factors that were tried often but showed no measurable
  // difference. Surfaced deliberately — see buildReliefSection.
  const reportedReliefs = new Set(reliefFindings.map((finding) => `${finding.facts.factor}`));
  const noEffectReliefs = new Map<string, { count: number; entryIds: string[] }>();
  for (const event of inRange) {
    for (const factor of event.reliefFactors) {
      if (reportedReliefs.has(factor)) continue;
      const existing = noEffectReliefs.get(factor) ?? { count: 0, entryIds: [] };
      existing.count += 1;
      existing.entryIds.push(event.entryId);
      noEffectReliefs.set(factor, existing);
    }
  }
  const noEffectList = [...noEffectReliefs.entries()]
    .filter(([, data]) => data.count >= 4)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([label, data]) => ({ label, count: data.count, entryIds: data.entryIds }));

  // First-ever appearances, needing real prior history to mean anything.
  const firstTime: { symptomLabel: string; firstDateKey: string; entryIds: string[] }[] = [];
  if (beforeRange.length >= 7) {
    const known = new Set(beforeRange.map((event) => event.symptomKey));
    const seen = new Set<string>();
    for (const event of inRange) {
      if (known.has(event.symptomKey) || seen.has(event.symptomKey)) continue;
      seen.add(event.symptomKey);
      firstTime.push({
        symptomLabel: event.symptomLabel,
        firstDateKey: event.dateKey,
        entryIds: [event.entryId],
      });
    }
  }

  const symptomTypeByLabel = new Map<string, string>();
  for (const event of inRange) symptomTypeByLabel.set(event.symptomLabel, event.symptomKey);
  // Onsets are keyed by symptomType id, so map through the raw entries.
  const typeByLabel = new Map<string, string>();
  for (const entry of entries) {
    const event = allEvents.find((item) => item.entryId === entry.id);
    if (event) typeByLabel.set(event.symptomLabel, entry.symptomType);
  }

  const severities = inRange.map((event) => event.severity);
  const meta: StoryReportMeta = {
    startDateKey: dateKeyFromLocalDate(startDate),
    endDateKey: dateKeyFromLocalDate(endDate),
    rangeLabel: `${formatDayLabelLong(dateKeyFromLocalDate(startDate))} – ${formatDayLabelLong(
      dateKeyFromLocalDate(endDate),
    )}`,
    daysInRange: daysInRange(startDate, endDate),
    daysLogged: countLoggedDays(timeline),
    entryCount: inRange.length,
    symptomCount: new Set(inRange.map((event) => event.symptomKey)).size,
    medianSeverity: severities.length > 0 ? median(severities) : null,
    maxSeverity: severities.length > 0 ? Math.max(...severities) : null,
    generatedAt: now.toISOString(),
    patientName:
      profile !== null && profile.displayName.trim() !== '' ? profile.displayName : null,
  };

  // ---- selection + realization ----
  const mentioned = new Set<string>();
  const references = new ReferenceTracker();

  const selectedTriggers = selectFindings(triggerFindings, 4, mentioned);
  const selectedReliefs = selectFindings(reliefFindings, 4, mentioned);
  const selectedTime = selectFindings(timeFindings, 2, mentioned);
  const selectedChanges = selectFindings(changeFindings, 4, mentioned);
  const selectedCooccurrence = selectFindings(cooccurrenceFindings, 4, mentioned);

  const sections: StorySection[] = [
    buildReasonSection(profiles, meta),
    buildOnsetSection(profiles, onsets, typeByLabel, firstTime),
    buildChangeSection(selectedChanges, progression, references),
    buildExperienceSection(profiles, noteFindings, references),
    buildFrequencySection(profiles, qualityFinding, references),
    buildPatternsSection(selectedTriggers, selectedTime, rejectedFactors, references),
    buildReliefSection(selectedReliefs, noEffectList, references),
    buildCooccurrenceSection(selectedCooccurrence, symptomLinks, references),
    buildMedicationsSection(medications, medicationFindings, inRange, references),
  ];

  // Includes events from BEFORE the range: change findings compare
  // against prior history and cite those readings, so the evidence
  // viewer has to be able to show them. Indexing only the in-range
  // events left every baseline citation pointing at nothing.
  const entryIndex: Record<string, HealthEvent> = {};
  for (const event of inRange) entryIndex[event.entryId] = event;
  for (const event of beforeRange) entryIndex[event.entryId] = event;

  return {
    meta,
    sections,
    timeline,
    charts: buildStoryCharts(
      inRange,
      timeline,
      factorFindings,
      new Map(medications.map((medication) => [medication.id, medication.name])),
    ),
    findings: [
      ...profiles,
      ...factorFindings,
      ...changeFindings,
      ...timeFindings,
      ...cooccurrenceFindings,
      ...noteFindings,
      qualityFinding,
    ],
    entryIndex,
  };
}

/* ------------------------------ Helpers ----------------------------- */

/** Distinct days with entries inside a range — used by the range picker. */
export function loggedDayCountInRange(
  entries: SymptomEntry[],
  startDate: Date,
  endDate: Date,
  customSymptoms: CustomSymptom[] = [],
): number {
  return distinctDayKeys(
    filterEventsToRange(buildHealthEvents(entries, customSymptoms), startDate, endDate),
  ).length;
}

/**
 * Applies the user's per-section edits over the generated text.
 * User-written lines carry no provenance — they are assertions, not
 * derivations, and marking them otherwise would be a lie.
 */
export function applySectionOverrides(
  report: StoryReport,
  overrides: Record<string, string>,
): StoryReport {
  return {
    ...report,
    sections: report.sections.map((section) => {
      const override = overrides[section.key];
      if (typeof override !== 'string' || override.trim() === '') return section;
      return {
        ...section,
        body: override
          .split('\n')
          .filter((line) => line.trim() !== '')
          .map((line) => sentence(line, [], [], 'user')),
      };
    }),
  };
}

/** All generated (non user-authored) text, for the language lint. */
export function generatedTextOf(report: StoryReport): string {
  return report.sections
    .flatMap((section) =>
      section.body
        // User-written text is excluded on purpose. The guardrail
        // constrains what the APP asserts; someone describing their
        // own body in their own words is not the app making a claim,
        // and rewriting or blocking it would be indefensible.
        .filter((item) => item.source !== 'user')
        .map((item) => item.text),
    )
    .join('\n');
}

/** Flattens a report to plain text — used for share/copy and the PDF. */
export function storyReportToPlainText(report: StoryReport): string {
  const lines: string[] = ['HealthLit — Symptom Story'];
  if (report.meta.patientName !== null) lines.push(report.meta.patientName);
  lines.push(report.meta.rangeLabel, '');

  for (const section of report.sections) {
    if (section.body.length === 0) continue;
    lines.push(section.title.toUpperCase());
    for (const item of section.body) lines.push(item.text);
    lines.push('');
  }

  // Charts can't survive a plain-text export, but their DATA can, and
  // dropping it silently would make the text version quietly less
  // complete than the PDF.
  for (const chart of report.charts) {
    lines.push(chart.title.toUpperCase());
    lines.push(chart.caption);
    lines.push(chart.table.headers.join(' | '));
    for (const row of chart.table.rows) lines.push(row.join(' | '));
    if (chart.table.note !== undefined) lines.push(chart.table.note);
    lines.push('');
  }

  return lines.join('\n');
}

/** Mean severity across a report's range — kept for the summary tiles. */
export function meanSeverityOf(report: StoryReport): number | null {
  const values = Object.values(report.entryIndex).map((event) => event.severity);
  return values.length > 0 ? meanOf(values) : null;
}

/** Groups a report's events by symptom — used by the evidence viewer. */
export function eventsBySymptom(report: StoryReport): Map<string, HealthEvent[]> {
  return groupBySymptom(Object.values(report.entryIndex));
}
