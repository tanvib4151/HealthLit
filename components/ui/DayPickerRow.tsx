import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { dateKeyFromLocalDate } from '../../utils/healthEvents';
import { formatDayLabelShort } from '../../utils/storyTimeline';

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function daysAgo(count: number, from: Date = new Date()): Date {
  const next = new Date(from);
  next.setDate(next.getDate() - count);
  return next;
}

/**
 * Horizontal scrollable day picker.
 *
 * Extracted from the Story screen so Insights can offer the same
 * custom-range control rather than a second implementation drifting
 * from this one. Plain Pressables in a ScrollView — no scroll-linked
 * interpolation, no snapping math. This is a settings control, not
 * the logging path, and cheap beats fancy on a slow phone.
 */
export function DayPickerRow({
  selected,
  onSelect,
  rangeDays,
}: {
  selected: Date;
  onSelect: (date: Date) => void;
  /** How many days back the strip scrolls. */
  rangeDays: number;
}) {
  const theme = useTheme();
  const options = useMemo(() => {
    const list: Date[] = [];
    for (let index = rangeDays - 1; index >= 0; index--) {
      list.push(startOfDay(daysAgo(index)));
    }
    return list;
  }, [rangeDays]);

  const selectedKey = dateKeyFromLocalDate(selected);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: 'row', gap: theme.spacing.sm },
        day: {
          minWidth: 64,
          minHeight: 44,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.pill,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        daySelected: {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primary,
        },
        dayLabel: {
          ...theme.typography.caption,
          fontFamily: theme.fonts.semibold,
        },
        dayLabelSelected: { color: theme.colors.onPrimary },
      }),
    [theme],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((date) => {
        const key = dateKeyFromLocalDate(date);
        const isSelected = key === selectedKey;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(date)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={formatDayLabelShort(key)}
            style={[styles.day, isSelected && styles.daySelected]}
          >
            <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>
              {formatDayLabelShort(key)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export { startOfDay, daysAgo };
