/**
 * Curated options for creating a custom symptom type (Tier 2). A
 * fixed, small palette keeps the picker fast to use and keeps colors
 * consistent with the rest of the design system, rather than opening
 * a full color/icon picker.
 */

import { Ionicons } from '@expo/vector-icons';

type IoniconName = keyof typeof Ionicons.glyphMap;

export const CUSTOM_SYMPTOM_ICONS: IoniconName[] = [
  'body-outline',
  'medical-outline',
  'thermometer-outline',
  'moon-outline',
  'eye-outline',
  'water-outline',
  'battery-dead-outline',
  'sad-outline',
  'bandage-outline',
  'accessibility-outline',
  'fitness-outline',
  'help-circle-outline',
];

export interface TintOption {
  tint: string;
  tintSoft: string;
}

/** Matches the app's existing status/accent colors from utils/theme. */
export const CUSTOM_SYMPTOM_TINTS: TintOption[] = [
  { tint: '#7C6BD6', tintSoft: '#EDE8FB' }, // primary (lavender)
  { tint: '#F09CBB', tintSoft: '#FCE9F1' }, // accent pink
  { tint: '#D65C77', tintSoft: '#FAE6EC' }, // danger (rose)
  { tint: '#DE9A36', tintSoft: '#FBF0DC' }, // warning (amber)
  { tint: '#3FAF8C', tintSoft: '#E2F5EE' }, // success (green)
];
