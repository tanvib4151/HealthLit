import React, { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Link, Stack } from 'expo-router';

import { Screen } from '../components/ui/Screen';
import { useTheme } from '../hooks/useTheme';

/** Fallback for unmatched routes (e.g. stale deep links). */
export default function NotFoundScreen() {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        center: {
          alignItems: 'center',
          justifyContent: 'center',
        },
        title: {
          ...theme.typography.heading,
        },
        link: {
          ...theme.typography.button,
          color: theme.colors.primary,
          padding: theme.spacing.md,
        },
      }),
    [theme],
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen scroll={false} contentStyle={styles.center}>
        <Text style={styles.title}>This screen doesn't exist</Text>
        <Link href="/" style={styles.link} accessibilityRole="link">
          Go to Home
        </Link>
      </Screen>
    </>
  );
}
