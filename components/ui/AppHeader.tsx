import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../hooks/useTheme';

/**
 * HealthLit brand header, shown at the top of primary tab screens.
 * Matches the Figma: pink heart badge + wordmark.
 */
export function AppHeader() {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.xl,
          paddingVertical: theme.spacing.md,
        },
        badge: {
          width: 34,
          height: 34,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.accentPink,
          alignItems: 'center',
          justifyContent: 'center',
        },
        brand: {
          ...theme.typography.heading,
          fontSize: 20,
        },
      }),
    [theme],
  );

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Ionicons name="heart" size={18} color={theme.colors.onPrimary} />
      </View>
      <Text style={styles.brand} accessibilityRole="header">
        HealthLit
      </Text>
    </View>
  );
}
