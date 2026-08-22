/**
 * HealthLit design tokens.
 *
 * Single source of truth for color, spacing, radius, typography, and
 * elevation. Supports light and dark palettes — every screen and
 * component gets its theme via the useTheme() hook (hooks/useTheme.ts),
 * never by importing a static object, so switching modes actually
 * updates the UI. See hooks/useTheme.ts for why.
 *
 * Palette is derived from the HealthLit Figma designs: a calm, soft
 * lavender base with pink accents. High contrast is reserved for text
 * and interactive elements so the interface stays readable under pain
 * and fatigue conditions — in both light and dark mode.
 */

/**
 * ============================================================
 * COLOR RULES — read before adding a color anywhere
 * ============================================================
 *
 * This palette was fine; the way it was USED was not. An audit found
 * `primary` (purple) referenced 63 times across screens while
 * `accentPink` was used once and `warning` twice. Purple was doing
 * every job at once — buttons, links, selected states, decorative
 * icons, chart lines, badges — so nothing read as a deliberate
 * choice. When everything is emphasized, nothing is.
 *
 * The rules below exist so color carries MEANING rather than being
 * reached for by habit:
 *
 *   primary (purple)
 *     Primary actions and navigation ONLY. Buttons you tap, the tab
 *     bar indicator, links, the current selection. If it is not
 *     tappable and not selected, it is not purple.
 *
 *   ink / inkSecondary / inkMuted
 *     The default for everything else, including decorative and
 *     structural icons. Most icons should be ink-colored. An icon in
 *     purple beside a purple button beside a purple chip is the
 *     problem this rule prevents.
 *
 *   success / warning / danger
 *     Real status only — a genuine improvement, a genuine caution, a
 *     genuine problem. Never decoration, never "this needs a bit of
 *     color".
 *
 *   accentPink
 *     Reserved as the Story/report accent, so the flagship feature
 *     has a visual identity distinct from "this is a button".
 *
 *   symptom tints (see utils/symptoms.ts)
 *     Fixed per symptom and constant across light/dark. This is the
 *     one place the app already used color correctly: each symptom
 *     owns exactly one hue, which is what makes them recognisable at
 *     a glance. Do not repurpose these.
 *
 * Before using a color, ask: does this communicate something a user
 * needs, or am I decorating? If it is decoration, use ink.
 */

export type ColorScheme = 'light' | 'dark';

export interface Colors {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  accentPink: string;
  accentPinkSoft: string;
  ink: string;
  inkSecondary: string;
  inkMuted: string;
  onPrimary: string;
  info: string;
  infoSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
}

const lightColors: Colors = {
  // Base surfaces
  background: '#F7F4FB',
  surface: '#FFFFFF',
  surfaceMuted: '#F4F0FB',
  border: '#ECE6F6',

  // Brand
  primary: '#7C6BD6',
  primaryPressed: '#6A59C4',
  primarySoft: '#EDE8FB',
  accentPink: '#F09CBB',
  accentPinkSoft: '#FCE9F1',

  // Text
  ink: '#241F3A',
  inkSecondary: '#6E6887',
  inkMuted: '#9C96B4',
  onPrimary: '#FFFFFF',

  // Semantic
  info: '#5B9BD8',
  infoSoft: '#E7F1FB',
  success: '#3FAF8C',
  successSoft: '#E2F5EE',
  warning: '#DE9A36',
  warningSoft: '#FBF0DC',
  danger: '#D65C77',
  dangerSoft: '#FAE6EC',
};

const darkColors: Colors = {
  // Base surfaces
  background: '#18141F',
  surface: '#231D2E',
  surfaceMuted: '#2B2438',
  border: '#3A3348',

  // Brand — brightened slightly so it still pops against a dark surface
  primary: '#9683E8',
  primaryPressed: '#A996EE',
  primarySoft: '#332C4A',
  accentPink: '#F4AFC7',
  accentPinkSoft: '#452C39',

  // Text
  ink: '#F1EEF9',
  inkSecondary: '#B7B0CF',
  inkMuted: '#8A82A6',
  onPrimary: '#1A1626',

  // Semantic — dark-tinted "soft" backgrounds instead of light pastels
  info: '#7FB0E0',
  infoSoft: '#20303F',
  success: '#5FC9A0',
  successSoft: '#1E362E',
  warning: '#E8B25F',
  warningSoft: '#3A2E1C',
  danger: '#E38A9E',
  dangerSoft: '#3A242C',
};

/**
 * Fixed, mode-independent brand/semantic accent colors used to color-
 * code symptom types (Pain, Fatigue, etc. — see utils/symptoms.ts).
 * Deliberately NOT swapped for dark mode: these act like small colored
 * tags/badges, and keeping "Pain is always this shade of red" constant
 * across modes aids fast visual recognition — the same reasoning
 * behind this app's "usable in under 3 seconds" principle. This is a
 * common, intentional dark-mode pattern (see e.g. GitHub's labels,
 * which stay colorful rather than darkening in dark mode).
 */
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/**
 * Inter — loaded in app/_layout.tsx via @expo-google-fonts/inter.
 * Each weight is its own font family name in React Native.
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Typography embeds color, so it must be rebuilt per color scheme. */
function buildTypography(colors: Colors) {
  return {
    // NEGATIVE TRACKING ON LARGE TEXT is the detail that most
    // separates considered typography from default typography. Inter
    // is designed to be tightened at display sizes; left at its
    // default spacing, large headings look loose and slightly
    // amateurish. Small text gets the opposite treatment — slightly
    // POSITIVE tracking, which measurably improves legibility at 13px
    // and below, especially for a tired reader.
    display: {
      fontSize: 30,
      lineHeight: 36,
      letterSpacing: -0.6,
      fontFamily: fonts.bold,
      color: colors.ink,
    },
    title: {
      fontSize: 24,
      lineHeight: 30,
      letterSpacing: -0.4,
      fontFamily: fonts.bold,
      color: colors.ink,
    },
    heading: {
      fontSize: 18,
      lineHeight: 24,
      letterSpacing: -0.2,
      fontFamily: fonts.semibold,
      color: colors.ink,
    },
    body: {
      fontSize: 16,
      // Generous leading — this app is read by people with fatigue and
      // brain fog, where tight line spacing measurably hurts.
      lineHeight: 24,
      fontFamily: fonts.regular,
      color: colors.ink,
    },
    bodySecondary: {
      fontSize: 15,
      lineHeight: 23,
      fontFamily: fonts.regular,
      color: colors.inkSecondary,
    },
    caption: {
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: 0.1,
      fontFamily: fonts.medium,
      color: colors.inkMuted,
    },
    /**
     * Small ALL-CAPS section label ("REPORT PERIOD", "DAY").
     *
     * These appear throughout the app and were previously styled
     * ad-hoc as `caption` + semibold at each call site. Caps text
     * REQUIRES wide tracking to be readable — without it the letters
     * jam together — so making this a real token both fixes the
     * spacing and stops six screens each inventing their own version.
     */
    overline: {
      fontSize: 11,
      lineHeight: 16,
      letterSpacing: 0.8,
      fontFamily: fonts.semibold,
      color: colors.inkMuted,
    },
    button: {
      fontSize: 16,
      lineHeight: 20,
      letterSpacing: -0.1,
      fontFamily: fonts.semibold,
    },
  } as const;
}

/**
 * Accessibility: minimum interactive element height.
 * Users in pain or with reduced motor precision need generous targets.
 */
export const touchTarget = {
  minHeight: 52,
} as const;

/**
 * Elevation.
 *
 * Deliberately SUBTLE. The previous card shadow ran at 0.24 opacity
 * with a 12px radius — heavy enough to read as a grey smudge under
 * every card, which is the single most common reason an interface
 * looks unrefined rather than considered. Quality UI separates
 * surfaces with a hairline border and a barely-perceptible lift, not
 * a visible drop shadow.
 *
 * `card` is the default: almost invisible on its own, but enough to
 * stop a white card dissolving into a near-white background.
 * `raised` is reserved for things that genuinely float above the
 * page — modals, sheets, the tab bar.
 *
 * Shadow color is tinted toward the brand's deep ink rather than pure
 * black, so the shade reads as part of the palette instead of a grey
 * wash over it.
 */
export const shadows = {
  card: {
    shadowColor: '#241F3A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  raised: {
    shadowColor: '#241F3A',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

export interface Theme {
  colors: Colors;
  spacing: typeof spacing;
  radius: typeof radius;
  fonts: typeof fonts;
  typography: ReturnType<typeof buildTypography>;
  touchTarget: typeof touchTarget;
  shadows: typeof shadows;
  scheme: ColorScheme;
}

/** Builds a complete theme object for the given color scheme. */
export function getTheme(scheme: ColorScheme): Theme {
  const colors = scheme === 'dark' ? darkColors : lightColors;
  return {
    colors,
    spacing,
    radius,
    fonts,
    typography: buildTypography(colors),
    touchTarget,
    shadows,
    scheme,
  };
}

/**
 * Static light theme — kept only as a safe fallback for any code path
 * that runs outside a component (where hooks aren't available). Every
 * screen and component should use useTheme() instead of this.
 */
export const theme: Theme = getTheme('light');
