/**
 * HealthLit core domain models.
 *
 * These types mirror the planned Firestore collections so local and
 * remote persistence share one schema.
 *
 * DATA SENSITIVITY: every field here is health data. Never write these
 * objects to console logs, analytics events, or crash reports. All
 * persistence goes through the services layer.
 *
 * COMPATIBILITY: `qualities` and `bodyRegions` were added in Tier 1 as
 * OPTIONAL fields — entries saved before then simply lack them, so no
 * migration is needed and schemaVersion stays at 1.
 */

/** Symptom categories available in the guided logging flow. */
export const SYMPTOM_TYPES = [
  'pain',
  'fatigue',
  'headache',
  'nerve_sensitivity',
  'inflammation',
] as const;

export type SymptomType = (typeof SYMPTOM_TYPES)[number];

/** A single logged symptom occurrence. Collection: `symptom_entries`. */
export interface SymptomEntry {
  id: string;
  /**
   * A built-in SymptomType, or a CustomSymptom id (Tier 2). Kept as
   * `string` rather than the SymptomType union so custom types can be
   * stored without a schema migration; schemaVersion stays at 1.
   */
  symptomType: string;
  /** Severity on a 0–10 scale. */
  severity: number;
  /** How long the symptom lasted; null if ongoing or not provided. */
  durationMinutes: number | null;
  /** Factors the user believes worsened the symptom. */
  triggers: string[];
  /** Factors the user believes helped. */
  reliefFactors: string[];
  /** How the symptom affected the user's day, in their own words. */
  impactNote: string | null;
  /** Free-form notes. */
  note: string | null;
  /** Pain-quality descriptors, e.g. "Sharp", "Throbbing". Tier 1. */
  qualities?: string[];
  /** Body region ids (see utils/bodyRegions). Tier 1. */
  bodyRegions?: string[];
  /**
   * The patient's own description of how the symptom FEELS, typed
   * freely rather than picked from a list.
   *
   * Kept separate from `note` on purpose. `note` is a general remark
   * about the episode ("couldn't work today"); this answers one
   * specific clinical question — what does it feel like — which is
   * among the first things any clinician asks and which a fixed chip
   * list can never fully capture. Someone describing "like a band
   * tightening behind my eyes" is giving better information than any
   * combination of Sharp/Dull/Throbbing.
   *
   * Analysed by utils/symptomLexicon.ts, and quoted VERBATIM in
   * reports — never paraphrased. See the note in storyReport.ts about
   * why the patient's own words are the one thing the engine must not
   * rewrite.
   */
  feelsLikeNote?: string | null;
  /**
   * Medication ids taken for THIS symptom around this reading.
   * Optional, so entries saved before this existed simply lack it and
   * no migration is needed — schemaVersion stays 1.
   *
   * Linking medications to individual readings is what lets the story
   * engine compare severity change with and without a medication.
   * A standalone medication list can only ever say "here is what I
   * take"; this can say what happened in the readings that followed.
   */
  medicationIds?: string[];
  /** When the symptom occurred (ISO 8601). */
  loggedAt: string;
  createdAt: string;
  updatedAt: string;
  /** Bump when the shape changes incompatibly. */
  schemaVersion: 1;
}

/** A medication the user tracks. Collection: `medications`. */
export interface Medication {
  id: string;
  name: string;
  /** e.g. "60mg". Empty string if not provided. */
  dose: string;
  /** e.g. "Once daily · Morning". Null if not provided. */
  scheduleNote: string | null;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 1;
}

/** One calendar day's roll-up. Collection: `daily_logs`. */
export interface DailyLog {
  id: string;
  /** Calendar date in YYYY-MM-DD (device-local). */
  date: string;
  /** Mood on a 0–10 scale; null if not logged. */
  mood: number | null;
  /** SymptomEntry ids logged on this date. */
  entryIds: string[];
  createdAt: string;
  updatedAt: string;
  schemaVersion: 1;
}

/**
 * A daily mental wellness check-in.
 *
 * Separate from SymptomEntry on purpose. Mood is not a symptom with a
 * severity — recording it on the same 0-10 "how bad is it" scale
 * would frame a normal emotional range as pathology, and would let it
 * flow into severity averages where it does not belong.
 *
 * ONE PER LOG SESSION, not one per symptom: how someone feels
 * overall is a single fact about their day, not a property of each
 * individual symptom.
 *
 * A NOTE ON WHAT THIS MUST NEVER BECOME
 * People with chronic physical conditions are routinely told their
 * symptoms are psychological. This data exists so a patient can
 * describe their whole experience, NOT so the app can explain their
 * physical symptoms with their mood. Mood is therefore deliberately
 * excluded from the trigger/factor analysis that produces
 * "severity rose after X" claims — see utils/storyFindings.ts. It is
 * reported descriptively and as co-occurrence only.
 *
 * Collection: `wellness_checkins`.
 */
export interface WellnessCheckIn {
  id: string;
  /** 1 = very low, 5 = very good. Deliberately NOT a 0-10 severity. */
  mood: 1 | 2 | 3 | 4 | 5;
  /** Descriptive states the user tapped. Never diagnostic labels. */
  tags: string[];
  /** The user's own words. Never paraphrased anywhere. */
  note: string | null;
  /** When the day being described happened. */
  loggedAt: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 1;
}

/**
 * When a symptom actually began, as reported by the user.
 *
 * Distinct from the first logged entry, which is only when someone
 * started using the app. "When it started" is the second question
 * every clinician asks, and it is not derivable from log data — so
 * it is asked once and stored, never inferred.
 *
 * Collection: `symptom_onsets`.
 */
export interface SymptomOnset {
  id: string;
  /** Built-in SymptomType id or a CustomSymptom id. */
  symptomType: string;
  /** Approximate onset date, YYYY-MM-DD. */
  onsetDate: string;
  /** How precise that date is — "about 3 years ago" is still useful. */
  precision: 'day' | 'month' | 'year';
  /** Anything the user wants to add, e.g. "after a car accident". */
  note: string | null;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 1;
}

/**
 * A user-defined symptom type beyond the 5 built-ins (Tier 2).
 * Collection: `custom_symptoms`.
 */
export interface CustomSymptom {
  id: string;
  label: string;
  /** Ionicon name, stored as a plain string (JSON-safe). */
  icon: string;
  /** Hex color for the icon tint. */
  tint: string;
  /** Hex color for the icon's soft background circle. */
  tintSoft: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 1;
}

/** The account holder's profile. Collection: `users`. */
export interface UserProfile {
  id: string;
  displayName: string;
  condition: string | null;
  dateOfBirth: string | null;
  primaryDoctor: string | null;
  emergencyContact: string | null;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 1;
}

