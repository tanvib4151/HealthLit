import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';

interface SectionPlaceholderProps {
  title: string;
  description: string;
  /** Roadmap label, e.g. "Step 4". */
  badge?: string;
}

/**
 * Temporary stand-in for features shipping in later build steps.
 * Dashed border signals "reserved space" without visual noise.
 * Delete this component once all roadmap steps are complete.
 */
export function SectionPlaceholder({ title, description, badge }: SectionPlaceholderProps) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          borderRadius: theme.radius.xl,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceMuted,
          padding: theme.spacing.xl,
          gap: theme.spacing.sm,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        },
        title: {
          ...theme.typography.heading,
          flexShrink: 1,
        },
        badge: {
          backgroundColor: theme.colors.primarySoft,
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
        },
        badgeText: {
          ...theme.typography.caption,
          color: theme.colors.primary,
        },
        description: {
          ...theme.typography.bodySecondary,
        },
      }),
    [theme],
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}
