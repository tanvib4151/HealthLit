import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { useLogStore } from '../../store/logStore';
import { formatHourMinute } from '../../utils/entryStats';

const TICK_WIDTH = 68;
const START_MAX_INDEX = 95; // 11:45 PM
const END_MAX_INDEX = 96; // 12:00 AM next day

function timeLabel(index: number): string {
  if (index === 96) return '12:00 AM next day';
  const minutes = index * 15;
  return formatHourMinute(Math.floor(minutes / 60), minutes % 60);
}

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
  return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ${remainder} min`;
}

function durationFromKey(key: string | null): number | null {
  if (!key?.startsWith('exact_')) return null;
  const minutes = Number(key.slice('exact_'.length));
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

export function TimeRangePicker() {
  const theme = useTheme();
  const occurredAt = useLogStore((state) => state.draft.occurredAt);
  const symptomDrafts = useLogStore((state) => state.draft.symptomDrafts);
  const setOccurredAt = useLogStore((state) => state.setOccurredAt);
  const setDurationKeyFor = useLogStore((state) => state.setDurationKeyFor);

  const startIndex = Math.max(
    0,
    Math.min(
      START_MAX_INDEX,
      Math.round((occurredAt.getHours() * 60 + occurredAt.getMinutes()) / 15),
    ),
  );

  const storedDuration = durationFromKey(symptomDrafts[0]?.durationKey ?? null);
  const storedEndIndex = storedDuration === null
    ? null
    : Math.min(END_MAX_INDEX, startIndex + Math.round(storedDuration / 15));
  const [endIndex, setEndIndex] = useState<number | null>(storedEndIndex);

  useEffect(() => {
    if (storedEndIndex !== null) setEndIndex(storedEndIndex);
  }, [storedEndIndex]);

  const applyDuration = (nextEndIndex: number | null, nextStartIndex = startIndex) => {
    if (nextEndIndex === null) return;
    const safeEnd = Math.max(nextStartIndex + 1, Math.min(END_MAX_INDEX, nextEndIndex));
    const minutes = (safeEnd - nextStartIndex) * 15;
    const key = `exact_${minutes}`;
    useLogStore.getState().draft.symptomDrafts.forEach((card) => {
      setDurationKeyFor(card.symptomType, key);
    });
    setEndIndex(safeEnd);
  };

  const handleStart = (index: number) => {
    const nextIndex = Math.max(0, Math.min(START_MAX_INDEX, index));
    const next = new Date(occurredAt);
    const minutes = nextIndex * 15;
    next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    setOccurredAt(next);

    if (endIndex !== null) {
      const adjustedEnd = endIndex <= nextIndex
        ? Math.min(END_MAX_INDEX, nextIndex + 1)
        : endIndex;
      applyDuration(adjustedEnd, nextIndex);
    }
  };

  const handleEnd = (index: number) => {
    applyDuration(index);
  };

  const visualEndIndex = endIndex ?? Math.min(END_MAX_INDEX, startIndex + 4);
  const styles = useMemo(
    () => StyleSheet.create({
      root: { gap: theme.spacing.lg },
      summary: {
        ...theme.typography.body,
        fontFamily: theme.fonts.semibold,
        color: theme.colors.primary,
        textAlign: 'center' as const,
      },
      helper: {
        ...theme.typography.caption,
        textAlign: 'center' as const,
      },
    }),
    [theme],
  );

  return (
    <View style={styles.root}>
      <TimeRuler
        label="Start"
        selectedIndex={startIndex}
        maxIndex={START_MAX_INDEX}
        onSelect={handleStart}
      />
      <TimeRuler
        label="End"
        selectedIndex={visualEndIndex}
        maxIndex={END_MAX_INDEX}
        onSelect={handleEnd}
        unset={endIndex === null}
      />
      {endIndex === null ? (
        <Text style={styles.helper}>End time is optional — move the End ruler to set it.</Text>
      ) : (
        <Text style={styles.summary}>
          {timeLabel(startIndex)} – {timeLabel(endIndex)} · {durationLabel((endIndex - startIndex) * 15)}
        </Text>
      )}
    </View>
  );
}

function TimeRuler({
  label,
  selectedIndex,
  maxIndex,
  onSelect,
  unset = false,
}: {
  label: string;
  selectedIndex: number;
  maxIndex: number;
  onSelect: (index: number) => void;
  unset?: boolean;
}) {
  const theme = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollRef = React.useRef<any>(null);
  const scrollX = React.useRef(new Animated.Value(selectedIndex * TICK_WIDTH)).current;
  const latestScrollX = React.useRef(selectedIndex * TICK_WIDTH);
  const wheelTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = scrollX.addListener(({ value }) => {
      latestScrollX.current = value;
    });
    return () => scrollX.removeListener(id);
  }, [scrollX]);

  useEffect(() => () => {
    if (wheelTimer.current) clearTimeout(wheelTimer.current);
  }, []);

  useEffect(() => {
    if (containerWidth <= 0) return;
    const x = selectedIndex * TICK_WIDTH;
    latestScrollX.current = x;
    scrollX.setValue(x);
    scrollRef.current?.scrollTo({ x, animated: false });
  }, [containerWidth, selectedIndex, scrollX]);

  const sidePadding = Math.max(0, containerWidth / 2 - TICK_WIDTH / 2);
  const options = useMemo(
    () => Array.from({ length: maxIndex + 1 }, (_, index) => index),
    [maxIndex],
  );

  const settle = () => {
    const index = Math.max(0, Math.min(maxIndex, Math.round(latestScrollX.current / TICK_WIDTH)));
    latestScrollX.current = index * TICK_WIDTH;
    onSelect(index);
  };

  const handleWheel = (event: any) => {
    if (Platform.OS !== 'web') return;
    event.preventDefault?.();
    const nextX = Math.max(
      0,
      Math.min(maxIndex * TICK_WIDTH, latestScrollX.current + (event.deltaY ?? 0)),
    );
    latestScrollX.current = nextX;
    scrollRef.current?.scrollTo({ x: nextX, animated: false });
    if (wheelTimer.current) clearTimeout(wheelTimer.current);
    wheelTimer.current = setTimeout(settle, 120);
  };

  const styles = useMemo(
    () => StyleSheet.create({
      block: { gap: theme.spacing.xs },
      labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
      label: { ...theme.typography.caption, fontFamily: theme.fonts.semibold },
      value: { ...theme.typography.body, fontFamily: theme.fonts.semibold, color: unset ? theme.colors.inkMuted : theme.colors.primary },
      card: { borderRadius: theme.radius.xl, backgroundColor: theme.colors.surfaceMuted, paddingVertical: theme.spacing.lg, overflow: 'hidden' as const },
      marker: { position: 'absolute' as const, top: 0, bottom: 0, left: '50%' as const, width: 3, marginLeft: -1.5, borderRadius: 2, backgroundColor: theme.colors.primary },
      tick: { width: TICK_WIDTH, alignItems: 'center' as const, justifyContent: 'center' as const },
      pill: { paddingHorizontal: theme.spacing.md, paddingVertical: 6, borderRadius: theme.radius.pill },
      pillSelected: { backgroundColor: theme.colors.primary },
      tickLabel: { fontFamily: theme.fonts.semibold, color: theme.colors.ink, fontSize: 13 },
      tickLabelSelected: { color: theme.colors.onPrimary },
    }),
    [theme, unset],
  );

  return (
    <View style={styles.block}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{unset ? 'Not set' : timeLabel(selectedIndex)}</Text>
      </View>
      <View
        style={styles.card}
        onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
        // @ts-expect-error react-native-web forwards onWheel.
        onWheel={handleWheel}
        accessibilityRole="adjustable"
        accessibilityLabel={`${label} time, ${unset ? 'not set' : timeLabel(selectedIndex)}`}
        accessibilityActions={[
          { name: 'increment', label: `Later ${label.toLowerCase()} time` },
          { name: 'decrement', label: `Earlier ${label.toLowerCase()} time` },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') onSelect(Math.min(maxIndex, selectedIndex + 1));
          if (event.nativeEvent.actionName === 'decrement') onSelect(Math.max(0, selectedIndex - 1));
        }}
      >
        <View pointerEvents="none" style={styles.marker} />
        {containerWidth > 0 && (
          <Animated.ScrollView
            ref={scrollRef}
            horizontal
            bounces={false}
            overScrollMode="never"
            showsHorizontalScrollIndicator={false}
            snapToInterval={TICK_WIDTH}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: sidePadding }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false },
            )}
            scrollEventThrottle={16}
            onMomentumScrollEnd={settle}
            onScrollEndDrag={(event) => {
              if (Math.abs(event.nativeEvent.velocity?.x ?? 0) < 0.05) settle();
            }}
          >
            {options.map((index) => {
              const distance = scrollX.interpolate({
                inputRange: [(index - 1) * TICK_WIDTH, index * TICK_WIDTH, (index + 1) * TICK_WIDTH],
                outputRange: [0.35, 1, 0.35],
                extrapolate: 'clamp',
              });
              const scale = scrollX.interpolate({
                inputRange: [(index - 1) * TICK_WIDTH, index * TICK_WIDTH, (index + 1) * TICK_WIDTH],
                outputRange: [0.85, 1.08, 0.85],
                extrapolate: 'clamp',
              });
              const isSelected = !unset && index === selectedIndex;
              const showLabel = index === 96 || index % 4 === 0 || isSelected;
              return (
                <Pressable key={index} onPress={() => onSelect(index)} style={styles.tick}>
                  <Animated.View
                    style={[
                      styles.pill,
                      isSelected && styles.pillSelected,
                      { opacity: distance, transform: [{ scale }] },
                    ]}
                  >
                    <Text style={[styles.tickLabel, isSelected && styles.tickLabelSelected]}>
                      {showLabel ? timeLabel(index) : '·'}
                    </Text>
                  </Animated.View>
                </Pressable>
              );
            })}
          </Animated.ScrollView>
        )}
      </View>
    </View>
  );
}
