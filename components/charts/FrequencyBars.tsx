import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SymptomFrequency } from '../../utils/trendData';
import { useTheme } from '../../hooks/useTheme';

interface FrequencyBarsProps {
  data: SymptomFrequency[];
}

/**
 * Horizontal frequency bars: how often each symptom was logged in the
 * selected range, most frequent first. Plain Views — no chart library
 * needed for bars.
 */
export function FrequencyBars({ data }: FrequencyBarsProps) {
  const theme = useTheme();
  const max = data.length > 0 ? data[0].count : 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: theme.spacing.md,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
        },
        label: {
          ...theme.typography.bodySecondary,
          fontWeight: '500' as const,
          width: 118,
        },
        track: {
          flex: 1,
          height: 10,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.surfaceMuted,
          overflow: 'hidden' as const,
        },
        fill: {
          height: '100%' as const,
          borderRadius: theme.radius.pill,
        },
        count: {
          ...theme.typography.caption,
          color: theme.colors.ink,
          fontWeight: '600' as const,
          width: 22,
          textAlign: 'right' as const,
        },
      }),
    [theme],
  );

  return (
    <View style={styles.container}>
      {data.map((item) => (
        <View
          key={item.type}
          style={styles.row}
          accessible
          accessibilityLabel={`${item.label}, logged ${item.count} ${
            item.count === 1 ? 'time' : 'times'
          }`}
        >
          <Text style={styles.label} numberOfLines={1}>
            {item.label}
          </Text>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: item.tint,
                  width: `${max > 0 ? (item.count / max) * 100 : 0}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.count}>{item.count}</Text>
        </View>
      ))}
    </View>
  );
}
