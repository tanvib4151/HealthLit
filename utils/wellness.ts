/**
 * Mental wellness vocabulary and helpers.
 *
 * The scale is 1-5 with words, not a 0-10 number and not faces. Words
 * because a number invites arithmetic that does not mean anything
 * ("your mood averaged 2.7"), and five points because people can
 * genuinely distinguish five levels of how they feel and cannot
 * meaningfully distinguish eleven.
 *
 * Tags are DESCRIPTIVE STATES, never diagnostic terms. "Low" and
 * "Anxious" describe how a day felt; "depressed" and "anxiety" name
 * conditions, and an app must not hand a patient a word their doctor
 * has not used. Positive states are included in equal measure so the
 * check-in is not purely deficit-framed — a tracker that only offers
 * ways to say you feel bad teaches people to look for bad.
 */

export interface MoodOption {
  value: 1 | 2 | 3 | 4 | 5;
  label: string;
  /** Constant across light and dark, like symptom accents. */
  color: string;
}

export const MOOD_OPTIONS: MoodOption[] = [
  { value: 1, label: 'Very low', color: '#B0728F' },
  { value: 2, label: 'Low', color: '#C98FA0' },
  { value: 3, label: 'OK', color: '#9C93C4' },
  { value: 4, label: 'Good', color: '#6FA9C7' },
  { value: 5, label: 'Very good', color: '#5C9E8A' },
];

export const WELLNESS_TAGS: string[] = [
  'Calm',
  'Content',
  'Motivated',
  'Rested',
  'Anxious',
  'Overwhelmed',
  'Irritable',
  'Frustrated',
  'Lonely',
  'Drained',
];

export function moodLabel(mood: number): string {
  const match = MOOD_OPTIONS.find((option) => option.value === mood);
  return match ? match.label : 'Not recorded';
}

export function moodColor(mood: number): string {
  const match = MOOD_OPTIONS.find((option) => option.value === mood);
  return match ? match.color : '#B9B4C7';
}

/** Consecutive recent check-ins at or below this count as a low stretch. */
export const LOW_MOOD_THRESHOLD = 2;
/** How many in a row before the app gently offers support. */
export const LOW_MOOD_RUN_LENGTH = 5;

/**
 * Whether the most recent check-ins show a sustained low stretch.
 *
 * Deliberately conservative. A bad day is a bad day, and an app that
 * reacts to one is an app people stop being honest with. Five
 * consecutive low check-ins is a pattern worth gently acknowledging.
 *
 * This is NOT a screening tool and NOT a diagnosis — it decides
 * whether to show a supportive card, nothing more.
 */
export function hasSustainedLowMood(
  checkIns: { mood: number; loggedAt: string }[],
): boolean {
  const recent = [...checkIns]
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
    .slice(0, LOW_MOOD_RUN_LENGTH);

  return (
    recent.length === LOW_MOOD_RUN_LENGTH &&
    recent.every((item) => item.mood <= LOW_MOOD_THRESHOLD)
  );
}
