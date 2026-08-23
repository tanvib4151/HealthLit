import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { dateKeyFromDate, formatRelativeDayLabel } from '../../utils/entryStats';
import { useTheme } from '../../hooks/useTheme';

const DAY_TICK_WIDTH = 76;

/**
 * Default day range shown, and how much more is added each time
 * someone taps "Load earlier days".
 *
 * Not a literal infinite list — see the fuller explanation this
 * carried when it lived inside the log flow: eagerly rendering
 * thousands of animated nodes is a real cost on slower phones, so the
 * range grows on demand instead of being pre-built in full.
 */
const INITIAL_DAYS_BACK = 90;
const LOAD_MORE_DAYS = 180;
const MAX_DAYS_BACK = 3650; // ten years

/** "Today", "Yesterday", then weekday + short date going back further. */
function buildRecentDayOptions(daysBack: number): { dateKey: string; label: string }[] {
  const options: { dateKey: string; label: string }[] = [];
  for (let i = 0; i < daysBack; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    options.push({ dateKey: dateKeyFromDate(date), label: formatRelativeDayLabel(date) });
  }
  return options;
}

/**
 * The scrolling day dial.
 *
 * Extracted out of the log flow so it can be used in more than one
 * place — originally it only lived inside the "When did this happen"
 * step; it now also drives the date picker on Home. Reusing this
 * component rather than copying its ~150 lines of scroll and
 * animation math a second time is what keeps the two pickers from
 * silently drifting apart the next time either one is edited.
 *
 * Fully controlled: the caller owns the selected date and passes it
 * back in via `selectedDate`/`onSelectDate`, so this component has no
 * opinion about where that date is ultimately used (a draft entry, a
 * Home-level default, anything else).
 */
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
  const [daysBack, setDaysBack] = useState(INITIAL_DAYS_BACK);

  // Oldest on the left, today on the right — reads like a timeline.
  const dayOptions = useMemo(
    () => [...buildRecentDayOptions(daysBack)].reverse(),
    [daysBack],
  );
  const selectedDateKey = dateKeyFromDate(selectedDate);
  const selectedDayIndex = Math.max(
    0,
    dayOptions.findIndex((option) => option.dateKey === selectedDateKey),
  );

  const scrollX = React.useRef(new Animated.Value(selectedDayIndex * DAY_TICK_WIDTH)).current;
  const latestScrollX = React.useRef(selectedDayIndex * DAY_TICK_WIDTH);
  const wheelSettleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = scrollX.addListener(({ value }) => {
      latestScrollX.current = value;
    });
    return () => scrollX.removeListener(id);
  }, [scrollX]);

  const sidePadding = Math.max(0, containerWidth / 2 - DAY_TICK_WIDTH / 2);
  const maxIndex = dayOptions.length - 1;

  const snapToIndex = (rawIndex: number, animated: boolean) => {
    const clamped = Math.max(0, Math.min(maxIndex, Math.round(rawIndex)));
    const [year, month, day] = dayOptions[clamped].dateKey.split('-').map(Number);
    // Only the calendar date changes here — hour/minute on the
    // selected date are preserved, so picking a different day never
    // silently resets a time someone already dialled in elsewhere.
    const next = new Date(selectedDate);
    next.setFullYear(year, month - 1, day);
    onSelectDate(next);
    scrollRef.current?.scrollTo({ x: clamped * DAY_TICK_WIDTH, animated });
  };

  /**
   * Grows the range backward and keeps the currently selected day
   * fixed on screen. See the log flow's original implementation notes
   * on why this is a discrete, tap-triggered correction rather than a
   * reactive one during a live scroll gesture.
   */
  const loadEarlierDays = () => {
    const added = Math.min(LOAD_MORE_DAYS, MAX_DAYS_BACK - daysBack);
    if (added <= 0) return;
    const shiftedIndex = selectedDayIndex + added;
    setDaysBack((current) => current + added);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: shiftedIndex * DAY_TICK_WIDTH, animated: false });
    });
  };

  const canLoadEarlier = daysBack < MAX_DAYS_BACK;

  const handleScrollSettle = () => {
    snapToIndex(latestScrollX.current / DAY_TICK_WIDTH, true);
  };

  const handleWheel = (event: any) => {
    if (Platform.OS !== 'web') return;
    event.preventDefault?.();
    const delta = event.deltaY ?? 0;
    const nextX = Math.max(0, Math.min(maxIndex * DAY_TICK_WIDTH, latestScrollX.current + delta));
    scrollRef.current?.scrollTo({ x: nextX, animated: false });
    if (wheelSettleTimer.current) clearTimeout(wheelSettleTimer.current);
    wheelSettleTimer.current = setTimeout(() => handleScrollSettle(), 120);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        carouselCard: {
          borderRadius: theme.radius.xl,
          backgroundColor: theme.colors.surfaceMuted,
          paddingVertical: theme.spacing.lg,
          overflow: 'hidden' as const,
        },
        centerMarker: {
          position: 'absolute' as const,
          top: 0,
          bottom: 0,
          left: '50%' as const,
          width: 3,
          marginLeft: -1.5,
          borderRadius: 2,
          backgroundColor: theme.colors.primary,
        },
        tick: {
          width: DAY_TICK_WIDTH,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        },
        // Filled pill on the selected tick rather than a text-color
        // change alone — color-only differentiation was low contrast
        // against the muted card and weaker for anyone with reduced
        // color vision. See the original fix notes in the log flow.
        tickPill: {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: 6,
          borderRadius: theme.radius.pill,
        },
        tickPillSelected: {
          backgroundColor: theme.colors.primary,
        },
        tickLabel: {
          fontFamily: theme.fonts.semibold,
          color: theme.colors.ink,
          fontSize: 14,
        },
        tickLabelSelected: {
          color: theme.colors.onPrimary,
        },
        loadEarlierRow: {
          alignItems: 'center' as const,
          paddingVertical: theme.spacing.sm,
        },
        loadEarlierText: {
          ...theme.typography.caption,
          color: theme.colors.primary,
          fontFamily: theme.fonts.semibold,
        },
      }),
    [theme],
  );

  return (
    <View>
      <View
        style={styles.carouselCard}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        // @ts-expect-error onWheel is a standard web prop that react-native-web
        // forwards; harmlessly ignored on native.
        onWheel={handleWheel}
        accessibilityRole="adjustable"
        accessibilityLabel={`${accessibilityLabelPrefix}, ${dayOptions[selectedDayIndex]?.label ?? ''}`}
      >
        <View pointerEvents="none" style={styles.centerMarker} />
        {containerWidth > 0 && (
          <Animated.ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={DAY_TICK_WIDTH}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: sidePadding }}
            contentOffset={{ x: selectedDayIndex * DAY_TICK_WIDTH, y: 0 }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false },
            )}
            scrollEventThrottle={16}
            onMomentumScrollEnd={handleScrollSettle}
            onScrollEndDrag={(e) => {
              if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.05) handleScrollSettle();
            }}
          >
            {dayOptions.map((option, index) => {
              const distance = scrollX.interpolate({
                inputRange: [
                  (index - 1) * DAY_TICK_WIDTH,
                  index * DAY_TICK_WIDTH,
                  (index + 1) * DAY_TICK_WIDTH,
                ],
                outputRange: [0.35, 1, 0.35],
                extrapolate: 'clamp',
              });
              const scale = scrollX.interpolate({
                inputRange: [
                  (index - 1) * DAY_TICK_WIDTH,
                  index * DAY_TICK_WIDTH,
                  (index + 1) * DAY_TICK_WIDTH,
                ],
                outputRange: [0.85, 1.08, 0.85],
                extrapolate: 'clamp',
              });
              const isSelected = index === selectedDayIndex;

              return (
                <Pressable
                  key={option.dateKey}
                  onPress={() => snapToIndex(index, true)}
                  style={styles.tick}
                >
                  <Animated.View
                    style={[
                      styles.tickPill,
                      isSelected && styles.tickPillSelected,
                      { opacity: distance, transform: [{ scale }] },
                    ]}
                  >
                    <Text
                      style={[styles.tickLabel, isSelected && styles.tickLabelSelected]}
                    >
                      {option.label}
                    </Text>
                  </Animated.View>
                </Pressable>
              );
            })}
          </Animated.ScrollView>
        )}
      </View>
      {canLoadEarlier && (
        <Pressable
          onPress={loadEarlierDays}
          hitSlop={10}
          style={styles.loadEarlierRow}
          accessibilityRole="button"
          accessibilityLabel="Load earlier days"
        >
          <Text style={styles.loadEarlierText}>Need to go back further? Load earlier days</Text>
        </Pressable>
      )}
    </View>
  );
}
