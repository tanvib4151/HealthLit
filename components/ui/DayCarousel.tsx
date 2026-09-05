import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { dateKeyFromDate, formatRelativeDayLabel } from '../../utils/entryStats';
import { useTheme } from '../../hooks/useTheme';

const DAY_TICK_WIDTH = 76;
const INITIAL_DAYS_BACK = 90;
const LOAD_MORE_DAYS = 180;
const MAX_DAYS_BACK = 3650;

function buildRecentDayOptions(daysBack: number): { dateKey: string; label: string }[] {
  const options: { dateKey: string; label: string }[] = [];
  for (let i = 0; i < daysBack; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    options.push({ dateKey: dateKeyFromDate(date), label: formatRelativeDayLabel(date) });
  }
  return options;
}

function daysBetweenTodayAnd(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - target.getTime()) / 86400000));
}

export function DayCarousel({
  selectedDate,
  onSelectDate,
  accessibilityLabelPrefix = 'Day',
}: {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  accessibilityLabelPrefix?: string;
}) {
  const theme = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollRef = React.useRef<any>(null);
  // Always include the controlled date instead of silently displaying
  // index 0 when a caller supplies a date outside the default 90 days.
  const requiredDays = Math.min(MAX_DAYS_BACK, daysBetweenTodayAnd(selectedDate) + 1);
  const [daysBack, setDaysBack] = useState(Math.max(INITIAL_DAYS_BACK, requiredDays));

  useEffect(() => {
    if (requiredDays > daysBack) setDaysBack(requiredDays);
  }, [requiredDays, daysBack]);

  const dayOptions = useMemo(
    () => [...buildRecentDayOptions(daysBack)].reverse(),
    [daysBack],
  );
  const selectedDateKey = dateKeyFromDate(selectedDate);
  const foundIndex = dayOptions.findIndex((option) => option.dateKey === selectedDateKey);
  const selectedDayIndex = foundIndex >= 0 ? foundIndex : Math.max(0, dayOptions.length - 1);

  const scrollX = React.useRef(new Animated.Value(selectedDayIndex * DAY_TICK_WIDTH)).current;
  const latestScrollX = React.useRef(selectedDayIndex * DAY_TICK_WIDTH);
  const wheelSettleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPositioned = React.useRef(false);

  useEffect(() => {
    const id = scrollX.addListener(({ value }) => {
      latestScrollX.current = value;
    });
    return () => scrollX.removeListener(id);
  }, [scrollX]);

  useEffect(() => () => {
    if (wheelSettleTimer.current) clearTimeout(wheelSettleTimer.current);
  }, []);

  const sidePadding = Math.max(0, containerWidth / 2 - DAY_TICK_WIDTH / 2);
  const maxIndex = dayOptions.length - 1;

  useEffect(() => {
    if (containerWidth <= 0 || foundIndex < 0) return;
    // Position controlled/external changes imperatively. Keeping
    // contentOffset on every render made React fight native momentum.
    if (!hasPositioned.current) hasPositioned.current = true;
    latestScrollX.current = selectedDayIndex * DAY_TICK_WIDTH;
    scrollX.setValue(latestScrollX.current);
    scrollRef.current?.scrollTo({ x: latestScrollX.current, animated: false });
  }, [containerWidth, foundIndex, selectedDayIndex, scrollX]);

  const snapToIndex = (rawIndex: number, animated: boolean) => {
    const clamped = Math.max(0, Math.min(maxIndex, Math.round(rawIndex)));
    const [year, month, day] = dayOptions[clamped].dateKey.split('-').map(Number);
    const next = new Date(selectedDate);
    next.setFullYear(year, month - 1, day);
    latestScrollX.current = clamped * DAY_TICK_WIDTH;
    onSelectDate(next);
    if (animated) {
      scrollRef.current?.scrollTo({ x: latestScrollX.current, animated: true });
    }
  };

  const loadEarlierDays = () => {
    const added = Math.min(LOAD_MORE_DAYS, MAX_DAYS_BACK - daysBack);
    if (added <= 0) return;
    const shiftedIndex = selectedDayIndex + added;
    setDaysBack((current) => current + added);
    requestAnimationFrame(() => {
      const x = shiftedIndex * DAY_TICK_WIDTH;
      latestScrollX.current = x;
      scrollX.setValue(x);
      scrollRef.current?.scrollTo({ x, animated: false });
    });
  };

  const canLoadEarlier = daysBack < MAX_DAYS_BACK;

  const handleScrollSettle = () => {
    // snapToInterval has already physically snapped the ScrollView.
    // Only commit state here; an animated second scroll caused bounce
    // loops at the oldest/newest edges on iOS.
    snapToIndex(latestScrollX.current / DAY_TICK_WIDTH, false);
  };

  const handleWheel = (event: any) => {
    if (Platform.OS !== 'web') return;
    event.preventDefault?.();
    const delta = event.deltaY ?? 0;
    const nextX = Math.max(0, Math.min(maxIndex * DAY_TICK_WIDTH, latestScrollX.current + delta));
    latestScrollX.current = nextX;
    scrollRef.current?.scrollTo({ x: nextX, animated: false });
    if (wheelSettleTimer.current) clearTimeout(wheelSettleTimer.current);
    wheelSettleTimer.current = setTimeout(handleScrollSettle, 120);
  };

  const styles = useMemo(
    () => StyleSheet.create({
      carouselCard: { borderRadius: theme.radius.xl, backgroundColor: theme.colors.surfaceMuted, paddingVertical: theme.spacing.lg, overflow: 'hidden' as const },
      centerMarker: { position: 'absolute' as const, top: 0, bottom: 0, left: '50%' as const, width: 3, marginLeft: -1.5, borderRadius: 2, backgroundColor: theme.colors.primary },
      tick: { width: DAY_TICK_WIDTH, alignItems: 'center' as const, justifyContent: 'center' as const },
      tickPill: { paddingHorizontal: theme.spacing.md, paddingVertical: 6, borderRadius: theme.radius.pill },
      tickPillSelected: { backgroundColor: theme.colors.primary },
      tickLabel: { fontFamily: theme.fonts.semibold, color: theme.colors.ink, fontSize: 14 },
      tickLabelSelected: { color: theme.colors.onPrimary },
      loadEarlierRow: { alignItems: 'center' as const, paddingVertical: theme.spacing.sm },
      loadEarlierText: { ...theme.typography.caption, color: theme.colors.primary, fontFamily: theme.fonts.semibold },
    }), [theme]);

  return (
    <View>
      <View
        style={styles.carouselCard}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        // @ts-expect-error react-native-web forwards onWheel.
        onWheel={handleWheel}
        accessibilityRole="adjustable"
        accessibilityLabel={`${accessibilityLabelPrefix}, ${dayOptions[selectedDayIndex]?.label ?? ''}`}
      >
        <View pointerEvents="none" style={styles.centerMarker} />
        {containerWidth > 0 && (
          <Animated.ScrollView
            ref={scrollRef}
            horizontal
            bounces={false}
            overScrollMode="never"
            showsHorizontalScrollIndicator={false}
            snapToInterval={DAY_TICK_WIDTH}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: sidePadding }}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
            scrollEventThrottle={16}
            onMomentumScrollEnd={handleScrollSettle}
            onScrollEndDrag={(e) => {
              if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.05) handleScrollSettle();
            }}
          >
            {dayOptions.map((option, index) => {
              const distance = scrollX.interpolate({ inputRange: [(index - 1) * DAY_TICK_WIDTH, index * DAY_TICK_WIDTH, (index + 1) * DAY_TICK_WIDTH], outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' });
              const scale = scrollX.interpolate({ inputRange: [(index - 1) * DAY_TICK_WIDTH, index * DAY_TICK_WIDTH, (index + 1) * DAY_TICK_WIDTH], outputRange: [0.85, 1.08, 0.85], extrapolate: 'clamp' });
              const isSelected = index === selectedDayIndex;
              return (
                <Pressable key={option.dateKey} onPress={() => snapToIndex(index, true)} style={styles.tick}>
                  <Animated.View style={[styles.tickPill, isSelected && styles.tickPillSelected, { opacity: distance, transform: [{ scale }] }]}>
                    <Text style={[styles.tickLabel, isSelected && styles.tickLabelSelected]}>{option.label}</Text>
                  </Animated.View>
                </Pressable>
              );
            })}
          </Animated.ScrollView>
        )}
      </View>
      {canLoadEarlier && (
        <Pressable onPress={loadEarlierDays} hitSlop={10} style={styles.loadEarlierRow} accessibilityRole="button" accessibilityLabel="Load earlier days">
          <Text style={styles.loadEarlierText}>Need to go back further? Load earlier days</Text>
        </Pressable>
      )}
    </View>
  );
}
