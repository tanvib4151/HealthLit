/**
 * The single source of theme truth for every screen and component.
 *
 * Resolves the user's stored preference (light / dark / system)
 * against the OS color scheme and returns a full Theme object.
 *
 * IMPORTANT: call this inside every component that needs colors,
 * typography, etc. — never import the static `theme` export from
 * utils/theme directly. A static import is read once when the file
 * first loads, so it can never react to a mode change; this hook
 * re-resolves on every render and is memoized so the returned object
 * only gets a new reference when the resolved scheme actually flips
 * (light ↔ dark), keeping any downstream `useMemo(..., [theme])`
 * style calculations efficient.
 */

import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useThemeModeStore } from '../store/themeModeStore';
import { getTheme, Theme } from '../utils/theme';

export function useTheme(): Theme {
  const preference = useThemeModeStore((state) => state.preference);
  const systemScheme = useColorScheme();

  const resolvedScheme = preference === 'system' ? (systemScheme ?? 'light') : preference;

  return useMemo(() => getTheme(resolvedScheme), [resolvedScheme]);
}
