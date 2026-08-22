/**
 * Demo data generator.
 *
 * Builds a realistic patient history so every feature has something
 * real to show without days of manual logging. Used only by the
 * "Load Demo Data" developer tool on the Profile screen; never runs
 * automatically, and never touches Firestore even if signed in.
 *
 * WHY THIS WAS REWRITTEN
 *
 * The previous generator encoded its "patterns" the way the old
 * statistics measured them: severity was adjusted at the moment of
 * logging, so an entry recording Rest simply had a lower number
 * attached to it. That is precisely the shape of INDICATION BIAS the
 * v3 engine exists to reject, so the new engine — correctly — found
 * nothing in it, and three sections of the demo report read "not
 * enough data".
 *
 * The v3 engine measures CHANGE BETWEEN PAIRED READINGS: a factor
 * recorded at one reading, then the same symptom read again within
 * 24 hours. For an effect to be visible it has to genuinely exist in
 * that structure. So this generator produces EPISODES — an onset
 * reading and a recovery reading a few hours later — where the
 * recovery is genuinely larger when a medication was taken.
 *
 * Nothing here is tuned to trip a threshold. The effects are real
 * properties of the generated data; the engine finds them because
 * they are there, and would report nothing if they weren't. That
 * distinction is the whole point of the rewrite and is worth
 * protecting if this file is edited later.
 *
 * What this dataset contains, and why:
 *  - 100 days of history, so a 30-day report window has ~70 days of
 *    prior baseline to compare against ("How it has changed").
 *  - Migraine-pattern headaches as paired episodes, with a triptan
 *    linked to some of them and a genuinely better recovery when it
 *    was taken ("Medications", "Patterns").
 *  - Poor sleep preceding worse trajectories, not merely worse
 *    moments ("Patterns and possible triggers").
 *  - Daily fatigue at a steadier, lower level, improving over the
 *    recent window ("How it has changed", co-occurrence).
 *  - Free-text notes containing lexicon terms AND a negation, so
 *    note mining has something to find and something to correctly
 *    ignore.
 *  - 16 of the last 20 days logged, clearing the story gate.
 *
 * SEEDED. The old generator used Math.random(), so every load
 * produced a different app and no two demos matched. This one is
 * deterministic: the same dataset every time, which matters when
 * recording a demo video or when a reviewer follows written steps.
 */

import { CustomSymptom, Medication, SymptomEntry } from '../types/models';
import { ProfileFields } from '../store/profileStore';
import { createRandom } from './storyStats';
import { SYMPTOM_QUALITIES } from './symptomQualities';

const BRAIN_FOG_ID = 'demo_brain_fog';
const MED_TRIPTAN_ID = 'demo_med_triptan';
const MED_AMITRIPTYLINE_ID = 'demo_med_amitriptyline';

/** Days of history generated. The report window is the last 30. */
const TOTAL_DAYS = 100;

export interface DemoDataset {
  entries: SymptomEntry[];
  medications: Medication[];
  customSymptoms: CustomSymptom[];
  profile: ProfileFields;
}

function clampSeverity(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function isoAt(daysAgo: number, hour: number, minute: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

interface EntryParams {
  symptomType: string;
  daysAgo: number;
  hour: number;
  minute?: number;
  severity: number;
  durationMinutes?: number | null;
  triggers?: string[];
  reliefFactors?: string[];
  medicationIds?: string[];
  qualities?: string[];
  bodyRegions?: string[];
  note?: string | null;
  impactNote?: string | null;
}

function buildEntry(index: number, params: EntryParams): SymptomEntry {
  const iso = isoAt(params.daysAgo, params.hour, params.minute ?? 0);
  return {
    // Deterministic ids, so a regenerated dataset is byte-identical.
    id: `demo_entry_${index}`,
    symptomType: params.symptomType,
    severity: clampSeverity(params.severity),
    durationMinutes: params.durationMinutes ?? null,
    triggers: params.triggers ?? [],
    reliefFactors: params.reliefFactors ?? [],
    impactNote: params.impactNote ?? null,
    note: params.note ?? null,
    qualities: params.qualities ?? [],
    bodyRegions: params.bodyRegions ?? [],
    medicationIds: params.medicationIds ?? [],
    loggedAt: iso,
    createdAt: iso,
    updatedAt: iso,
    schemaVersion: 1,
  };
}

/**
 * Notes are written the way people actually write them, and one
 * deliberately contains a negation ("no nausea") so the lexicon's
 * negation handling is demonstrably doing something rather than
 * merely claimed to.
 */
const HEADACHE_NOTES = [
  'Stabbing behind my right eye. Screens made it much worse.',
  'Throbbing all down one side, no nausea this time.',
  'Woke up with it. Pressure like a tight band, light sensitivity all morning.',
  'Bad one. Had to lie down in the dark for two hours.',
];

const FATIGUE_NOTES = [
  'Brain fog most of the afternoon, could not think straight.',
  'Slept badly, dragging by lunchtime.',
];

export function generateDemoDataset(): DemoDataset {
  const random = createRandom(20260813);
  const entries: SymptomEntry[] = [];
  let index = 0;
  const add = (params: EntryParams) => {
    entries.push(buildEntry(index++, params));
  };

  const headacheQualities = SYMPTOM_QUALITIES.headache ?? ['Throbbing', 'Sharp'];

  for (let daysAgo = TOTAL_DAYS; daysAgo >= 0; daysAgo--) {
    // Recent period runs genuinely milder than the older history, so
    // "How it has changed" has a real baseline shift to describe
    // rather than a manufactured one.
    const isRecent = daysAgo <= 29;
    const periodOffset = isRecent ? -1.5 : 0;

    /* ---------------------- Headache episodes ---------------------- */
    // Every third day. The cadence and the two factor assignments are
    // deliberately chosen so that neither factor is the complement of
    // the other, and so both have at least four paired readings on
    // each side inside a 30-day window.
    //
    // The first cut of this file made every episode a poor-sleep
    // episode, which left the comparison group empty and the trigger
    // silently unreported — the engine was right and the data was
    // wrong. Worth re-checking with tools/demoProbe if this cadence
    // is ever edited.
    const isEpisodeDay = daysAgo % 3 === 0;

    if (isEpisodeDay) {
      // Three factor assignments, deliberately overlapping rather
      // than complementary. Any two factors that are exact
      // complements make "without A" identical to "with B", and the
      // contrast then measures B instead of A — which is how an
      // earlier cut of this file had the engine reporting that
      // stress IMPROVED headaches. The engine was computing
      // correctly; the data was degenerate.
      const episodeIndex = daysAgo / 3;
      const tookTriptan = episodeIndex % 4 === 0 || episodeIndex % 4 === 1;
      const poorSleep = episodeIndex % 3 === 0;
      const stressed = episodeIndex % 2 === 1;

      // Onset severity. Poor sleep nights start worse AND, below,
      // recover less — the trajectory differs, not just the moment.
      const onset = 6.5 + (poorSleep ? 1.5 : 0) + periodOffset + random() * 0.8;

      add({
        symptomType: 'headache',
        daysAgo,
        hour: 8,
        minute: 30,
        severity: onset,
        durationMinutes: 270,
        // Stress is recorded often but carries NO effect on the
        // trajectory below. It should therefore not be reported —
        // a useful thing for the demo to show, since an engine that
        // finds something to say about every factor is an engine
        // that is guessing.
        triggers: [
          ...(poorSleep ? ['Poor sleep'] : []),
          ...(stressed ? ['Stress'] : []),
        ],
        // Quiet room is recorded on MOST episodes regardless of
        // whether the triptan was taken. Making it the exact
        // complement of medication (the first cut of this file) meant
        // "without quiet room" was identical to "with triptan", and
        // the engine correctly — but uselessly — reported that
        // recovery was worse after quiet room. That is a genuine
        // limitation of any pairwise comparison: when one factor's
        // absence perfectly predicts another's presence, the contrast
        // measures the wrong thing. Realistic overlap avoids it here;
        // the limitation itself is noted in the handoff.
        // Note there is no generic 'Medication' relief factor here.
        // Recording the drug BOTH as a linked medication id and as a
        // free-text relief factor made the engine report the same
        // effect twice — once under the medication's name and once
        // under "Medication" — which on a chart looked like two
        // independent findings agreeing with each other.
        reliefFactors:
          daysAgo % 3 !== 1 ? ['Quiet room'] : [],
        medicationIds: tookTriptan ? [MED_TRIPTAN_ID] : [],
        qualities: [headacheQualities[index % headacheQualities.length]],
        bodyRegions: ['head'],
        note: daysAgo % 12 === 0 ? HEADACHE_NOTES[(daysAgo / 12) % HEADACHE_NOTES.length] : null,
        impactNote: onset > 8 ? 'Could not work for most of the morning.' : null,
      });

      // Nerve sensitivity genuinely follows headache onset on most —
      // not all — episode days, and is recorded on NO other days.
      // That is what makes it a real sequence rather than an artefact:
      // its base rate across the period is low, so following a
      // headache 70% of the time is genuinely more than chance.
      //
      // Contrast with fatigue, which is logged twice every day. The
      // engine correctly refuses to call "headache then fatigue" a
      // sequence, because something recorded daily follows everything.
      if (episodeIndex % 10 !== 3) {
        add({
          symptomType: 'nerve_sensitivity',
          daysAgo,
          hour: 10,
          minute: 45,
          severity: 4 + Math.round(random() * 2) + periodOffset * 0.4,
          durationMinutes: 120,
        });
      }

      // Recovery reading the same afternoon. THIS is what the engine
      // pairs against — the medication days recover substantially
      // more, and the poor-sleep days recover less.
      const recovery = 1.4 + (tookTriptan ? 2.8 : 0) - (poorSleep ? 1.6 : 0);

      add({
        symptomType: 'headache',
        daysAgo,
        hour: 14,
        minute: 15,
        severity: onset - recovery,
        durationMinutes: 120,
        qualities: ['Dull'],
        bodyRegions: ['head'],
      });
    }

    /* ------------------------- Daily fatigue ------------------------ */
    // Most days, twice — morning and evening — so fatigue also pairs.
    // Skips about one day in six, so the history looks lived-in
    // rather than mechanically perfect.
    const skipDay = daysAgo > 19 && daysAgo % 6 === 5;
    if (!skipDay) {
      const base = 4.6 + periodOffset * 0.6 + random() * 0.6;
      const rested = daysAgo % 3 === 1;

      add({
        symptomType: 'fatigue',
        daysAgo,
        hour: 9,
        minute: 45,
        severity: base,
        durationMinutes: 600,
        triggers: daysAgo % 5 === 0 ? ['Poor sleep'] : [],
        reliefFactors: rested ? ['Rest'] : [],
        note: daysAgo % 17 === 0 ? FATIGUE_NOTES[(daysAgo / 17) % FATIGUE_NOTES.length] : null,
      });

      add({
        symptomType: 'fatigue',
        daysAgo,
        hour: 20,
        minute: 30,
        // Rest genuinely helps fatigue, but modestly — a smaller,
        // more believable effect than the headache medication, which
        // also exercises the engine's ability to report two effects
        // of different sizes rather than one dominant one.
        severity: base - (rested ? 1.6 : 0.2),
        durationMinutes: 120,
      });
    }

    /* ------------------- Lower-back pain, occasional ---------------- */
    if (daysAgo % 7 === 3) {
      add({
        symptomType: 'pain',
        daysAgo,
        hour: 18,
        minute: 10,
        severity: 5.4 + periodOffset * 0.5 + random() * 0.8,
        durationMinutes: 270,
        triggers: ['Physical activity'],
        reliefFactors: ['Heat'],
        bodyRegions: ['pelvis'],
      });
    }
  }

  // A first-time custom symptom, appearing only in the last few days —
  // the "new this period" detector needs prior history to be
  // meaningful, and 100 days of it is now available.
  for (const daysAgo of [4, 2, 1]) {
    add({
      symptomType: BRAIN_FOG_ID,
      daysAgo,
      hour: 15,
      minute: 20,
      severity: 4 + Math.round(random() * 2),
      durationMinutes: 600,
    });
  }

  const createdIso = isoAt(TOTAL_DAYS, 9, 0);

  const customSymptoms: CustomSymptom[] = [
    {
      id: BRAIN_FOG_ID,
      label: 'Brain Fog',
      icon: 'help-circle-outline',
      tint: '#7C6BD6',
      tintSoft: '#EDE8FB',
      createdAt: isoAt(5, 9, 0),
      updatedAt: isoAt(5, 9, 0),
      schemaVersion: 1,
    },
  ];

  const medications: Medication[] = [
    {
      id: MED_TRIPTAN_ID,
      name: 'Sumatriptan',
      dose: '50mg',
      scheduleNote: 'As needed · At onset',
      createdAt: createdIso,
      updatedAt: createdIso,
      schemaVersion: 1,
    },
    {
      id: MED_AMITRIPTYLINE_ID,
      name: 'Amitriptyline',
      dose: '10mg',
      scheduleNote: 'Once daily · Bedtime',
      createdAt: createdIso,
      updatedAt: createdIso,
      schemaVersion: 1,
    },
  ];

  const profile: ProfileFields = {
    displayName: 'Alex Rivera',
    condition: 'Chronic migraine',
    dateOfBirth: '1994-03-12',
    primaryDoctor: 'Dr. Patel',
    emergencyContact: 'Jordan Rivera · (555) 019-2834',
  };

  return { entries, medications, customSymptoms, profile };
}
