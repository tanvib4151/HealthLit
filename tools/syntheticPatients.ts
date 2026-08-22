/**
 * Synthetic patient profiles for the golden tests.
 *
 * Five deliberately different logging personalities, each chosen
 * because it breaks a different assumption:
 *
 *  - `episodic`      clustered attacks with clear recovery readings.
 *                    The only profile where paired analysis has
 *                    plenty to work with.
 *  - `constant`      daily, low-variance, multi-symptom. Nothing
 *                    should reach significance; the report must say
 *                    so rather than manufacture a pattern.
 *  - `sparse`        logs twice a week. Below the gate, and almost
 *                    nothing should have a follow-up reading.
 *  - `severityOnly`  logs ONLY when severe. This is the profile that
 *                    fools naive statistics: every relief factor
 *                    appears to precede improvement purely through
 *                    regression to the mean.
 *  - `improving`     genuine downward trend against a worse history.
 *
 * All generation is seeded and deterministic — a golden test that
 * shifted with the wind would be worthless.
 */

import { Medication, SymptomEntry, SymptomOnset } from '../types/models';
import { createRandom } from '../utils/storyStats';

export type PatientProfile =
  | 'episodic'
  | 'constant'
  | 'sparse'
  | 'severityOnly'
  | 'improving';

export interface SyntheticPatient {
  name: PatientProfile;
  entries: SymptomEntry[];
  medications: Medication[];
  onsets: SymptomOnset[];
  /** Fixed "today" so generated reports never drift by real date. */
  now: Date;
}

/** Fixed reference date so goldens are stable forever. */
const REFERENCE_NOW = new Date('2026-06-15T12:00:00.000Z');

function isoAt(daysAgo: number, hour: number, minute = 0): string {
  const date = new Date(REFERENCE_NOW);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function clampSeverity(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value)));
}

function makeEntry(
  id: string,
  symptomType: string,
  severity: number,
  daysAgo: number,
  hour: number,
  extras: Partial<SymptomEntry> = {},
): SymptomEntry {
  return {
    id,
    symptomType,
    severity: clampSeverity(severity),
    durationMinutes: null,
    triggers: [],
    reliefFactors: [],
    impactNote: null,
    note: null,
    qualities: [],
    bodyRegions: [],
    medicationIds: [],
    loggedAt: isoAt(daysAgo, hour),
    createdAt: isoAt(daysAgo, hour),
    updatedAt: isoAt(daysAgo, hour),
    schemaVersion: 1,
    ...extras,
  };
}

const MEDS: Medication[] = [
  {
    id: 'med_a', name: 'Sumatriptan', dose: '50mg', scheduleNote: 'As needed',
    createdAt: isoAt(90, 9), updatedAt: isoAt(90, 9), schemaVersion: 1,
  },
  {
    id: 'med_b', name: 'Amitriptyline', dose: '10mg', scheduleNote: 'Nightly',
    createdAt: isoAt(90, 9), updatedAt: isoAt(90, 9), schemaVersion: 1,
  },
];

export function buildPatient(profile: PatientProfile): SyntheticPatient {
  const random = createRandom(1234);
  const entries: SymptomEntry[] = [];
  let counter = 0;
  const nextId = () => `e_${profile}_${counter++}`;

  if (profile === 'episodic') {
    // Attacks every ~5 days: an onset reading, then a follow-up a few
    // hours later. Medication and rest genuinely precede improvement.
    for (let day = 74; day >= 0; day -= 1) {
      const isAttack = day % 5 === 0;
      if (!isAttack) {
        if (day % 3 === 0) {
          entries.push(
            makeEntry(nextId(), 'fatigue', 3 + Math.floor(random() * 2), day, 20, {
              durationMinutes: 600,
              reliefFactors: ['Rest'],
            }),
          );
        }
        continue;
      }
      const peak = 7 + Math.floor(random() * 3);
      const tookMed = day % 10 === 0;
      entries.push(
        makeEntry(nextId(), 'headache', peak, day, 9, {
          durationMinutes: 270,
          triggers: day % 15 === 0 ? ['Poor sleep'] : ['Stress'],
          reliefFactors: tookMed ? ['Medication'] : ['Quiet room'],
          medicationIds: tookMed ? ['med_a'] : [],
          qualities: ['Throbbing'],
          bodyRegions: ['head'],
          note:
            day % 20 === 0
              ? 'Stabbing behind my right eye, no nausea this time, screens made it worse.'
              : null,
        }),
      );
      // Follow-up: medication cases improve more.
      const relief = tookMed ? 4 : 1.5;
      entries.push(
        makeEntry(nextId(), 'headache', peak - relief, day, 14, {
          durationMinutes: 120,
          qualities: ['Dull'],
          bodyRegions: ['head'],
        }),
      );
    }
  }

  if (profile === 'constant') {
    // Every day, three symptoms, very low variance. Nothing here is a
    // real pattern and the report must not invent one.
    for (let day = 59; day >= 0; day--) {
      for (const symptom of ['pain', 'fatigue', 'inflammation']) {
        entries.push(
          makeEntry(nextId(), symptom, 5 + (random() < 0.5 ? 0 : 1), day, 10, {
            durationMinutes: 600,
            reliefFactors: random() < 0.5 ? ['Rest'] : [],
            triggers: random() < 0.5 ? ['Weather'] : [],
          }),
        );
      }
    }
  }

  if (profile === 'sparse') {
    // Twice weekly. Below the gate; almost nothing pairs.
    for (let day = 59; day >= 0; day -= 4) {
      entries.push(
        makeEntry(nextId(), 'pain', 4 + Math.floor(random() * 4), day, 11, {
          bodyRegions: ['lower_back'],
        }),
      );
    }
  }

  if (profile === 'severityOnly') {
    // THE ADVERSARIAL CASE. Only logs when bad, always records a
    // relief factor, and the next reading is naturally lower simply
    // because it started at a peak. A naive engine reports every
    // relief factor as effective; a paired change-vs-change
    // comparison should find nothing, because the without-factor
    // readings drift down by the same amount.
    for (let day = 59; day >= 0; day -= 2) {
      const peak = 8 + Math.floor(random() * 2);
      const usesRelief = day % 4 === 0;
      entries.push(
        makeEntry(nextId(), 'pain', peak, day, 8, {
          reliefFactors: usesRelief ? ['Heat'] : [],
          triggers: ['Stress'],
        }),
      );
      entries.push(makeEntry(nextId(), 'pain', peak - 3, day, 16, {}));
    }
  }

  if (profile === 'improving') {
    // 120 days of history; the recent window is genuinely better.
    for (let day = 119; day >= 0; day--) {
      if (day % 2 === 1) continue;
      const trend = day > 30 ? 7 : 4;
      entries.push(
        makeEntry(nextId(), 'pain', trend + (random() < 0.5 ? 0 : 1), day, 9, {
          durationMinutes: 120,
          reliefFactors: ['Stretching'],
          medicationIds: day <= 40 ? ['med_b'] : [],
        }),
      );
      entries.push(
        makeEntry(nextId(), 'pain', trend + (random() < 0.5 ? -1 : 0), day, 18, {}),
      );
    }
  }

  const onsets: SymptomOnset[] =
    profile === 'episodic'
      ? [
          {
            id: 'onset_1', symptomType: 'headache', onsetDate: '2019-03-01',
            precision: 'month', note: 'Started the year I changed jobs.',
            createdAt: isoAt(90, 9), updatedAt: isoAt(90, 9), schemaVersion: 1,
          },
        ]
      : [];

  return { name: profile, entries, medications: MEDS, onsets, now: new Date(REFERENCE_NOW) };
}

export const ALL_PROFILES: PatientProfile[] = [
  'episodic', 'constant', 'sparse', 'severityOnly', 'improving',
];
