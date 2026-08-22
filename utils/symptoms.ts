/**
 * Display metadata and option lists for the symptom logging flow.
 * Keeps content/config out of UI components so labels, icons, and
 * options can change without touching screen logic.
 */

import { Ionicons } from '@expo/vector-icons';

import { CustomSymptom } from '../types/models';
import { colors } from './theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

export interface SymptomOption {
  /** A built-in SymptomType id, or a CustomSymptom id (Tier 2). */
  type: string;
  label: string;
  icon: IoniconName;
  tint: string;
  tintSoft: string;
}

/** Order matches the Figma "What are you experiencing?" screen. */
export const SYMPTOM_OPTIONS: SymptomOption[] = [
  {
    type: 'pain',
    label: 'Pain',
    icon: 'flame-outline',
    tint: colors.danger,
    tintSoft: colors.dangerSoft,
  },
  {
    type: 'fatigue',
    label: 'Fatigue',
    icon: 'cloud-outline',
    tint: colors.primary,
    tintSoft: colors.primarySoft,
  },
  {
    type: 'headache',
    label: 'Headache',
    icon: 'pulse-outline',
    tint: colors.accentPink,
    tintSoft: colors.accentPinkSoft,
  },
  {
    type: 'nerve_sensitivity',
    label: 'Nerve Sensitivity',
    icon: 'flash-outline',
    tint: colors.warning,
    tintSoft: colors.warningSoft,
  },
  {
    type: 'inflammation',
    label: 'Inflammation',
    icon: 'heart-outline',
    tint: colors.success,
    tintSoft: colors.successSoft,
  },
];

/**
 * Resolves display info for a symptom type: checks built-ins first,
 * then the user's custom symptoms (Tier 2), and falls back to an
 * honest "Other" — never silently mislabels an unrecognized type as
 * Pain, since this is medical data shown to the user and their doctor.
 */
export function getSymptomOption(
  type: string,
  customSymptoms: CustomSymptom[] = [],
): SymptomOption {
  const builtIn = SYMPTOM_OPTIONS.find((option) => option.type === type);
  if (builtIn) return builtIn;

  const custom = customSymptoms.find((symptom) => symptom.id === type);
  if (custom) {
    return {
      type: custom.id,
      label: custom.label,
      icon: custom.icon as IoniconName,
      tint: custom.tint,
      tintSoft: custom.tintSoft,
    };
  }

  return {
    type,
    label: 'Other',
    icon: 'help-circle-outline',
    tint: colors.inkMuted,
    tintSoft: colors.surfaceMuted,
  };
}

/** Plain-language descriptor for a 0–10 severity value. */
export function severityLabel(severity: number): string {
  if (severity === 0) return 'None';
  if (severity <= 3) return 'Mild';
  if (severity <= 6) return 'Moderate';
  return 'Severe';
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

// Fixed regardless of light/dark theme — same reasoning as the app's
// symptom accent colors: recognizing "red = severe" at a glance
// matters more than matching the current color scheme.
const SEVERITY_LOW = '#3FAF8C'; // success
const SEVERITY_MID = '#DE9A36'; // warning
const SEVERITY_HIGH = '#D65C77'; // danger

/** Smooth green → amber → rose gradient across the 0–10 severity scale. */
export function severityColor(severity: number): string {
  const clamped = Math.max(0, Math.min(10, severity));
  if (clamped <= 5) return lerpColor(SEVERITY_LOW, SEVERITY_MID, clamped / 5);
  return lerpColor(SEVERITY_MID, SEVERITY_HIGH, (clamped - 5) / 5);
}

export interface DurationOption {
  key: string;
  label: string;
  /**
   * Approximate midpoint in minutes, used for trend math later
   * (Step 5). `null` = still ongoing / unknown.
   */
  minutes: number | null;
}

export const DURATION_OPTIONS: DurationOption[] = [
  { key: 'under_1h', label: 'Under 1 hour', minutes: 30 },
  { key: '1_3h', label: '1–3 hours', minutes: 120 },
  { key: '3_6h', label: '3–6 hours', minutes: 270 },
  { key: 'most_day', label: 'Most of the day', minutes: 600 },
  { key: 'ongoing', label: 'Still ongoing', minutes: null },
];

/** Common aggravating factors. Free-text nuance goes in notes. */
export const TRIGGER_OPTIONS = [
  'Stress',
  'Poor sleep',
  'Weather',
  'Physical activity',
  'Sitting too long',
  'Bright light',
  'Noise',
  'Skipped medication',
];

/** Common relieving factors. */
export const RELIEF_OPTIONS = [
  'Rest',
  'Medication',
  'Heat',
  'Ice',
  'Stretching',
  'Hydration',
  'Quiet room',
  'Sleep',
];

/**
 * Pain-quality descriptors (Tier 1) — help users articulate symptoms
 * the way clinicians ask about them.
 */
export const QUALITY_OPTIONS = [
  'Sharp',
  'Dull',
  'Throbbing',
  'Burning',
  'Stabbing',
  'Aching',
  'Tingling',
  'Radiating',
  'Pressure',
  'Cramping',
];

/** Symptom types where "feels like" descriptors apply. Built-ins only — custom symptoms don't get quality descriptors by default. */
export const QUALITY_SYMPTOMS: string[] = [
  'pain',
  'headache',
  'nerve_sensitivity',
];

/** Symptom types where the body-location step applies. Built-ins only. */
export const LOCATION_SYMPTOMS: string[] = [
  'pain',
  'inflammation',
  'nerve_sensitivity',
];
