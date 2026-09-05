import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';

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

/** Horizontal, virtualized day picker for long history ranges. */
export function DayPickerRow({
  selected,
  onSelect,
  rangeDays,
}: {
  selected: Date;
  onSelect: (date: Date) => void;
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
    () => StyleSheet.create({
      row: { gap: theme.spacing.sm },
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
      daySelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
      dayLabel: { ...theme.typography.caption, fontFamily: theme.fonts.semibold },
      dayLabelSelected: { color: theme.colors.onPrimary },
    }), [theme]);

  return (
    <FlatList
      horizontal
      data={options}
      keyExtractor={dateKeyFromLocalDate}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      initialNumToRender={12}
      maxToRenderPerBatch={16}
      windowSize={5}
      removeClippedSubviews
      renderItem={({ item: date }) => {
        const key = dateKeyFromLocalDate(date);
        const isSelected = key === selectedKey;
        return (
          <Pressable
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
      }}
    />
  );
}

export { startOfDay, daysAgo };
