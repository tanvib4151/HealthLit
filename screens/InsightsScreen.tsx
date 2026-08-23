import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { Screen } from '../components/ui/Screen';
import { useLogStore } from '../store/logStore';
import {
  analyzeCorrelations,
  analyzeCorrelationsInRange,
  checkedButNotFound,
  checkedButNotFoundInRange,
  describeCorrelation,
} from '../utils/correlationAnalyzer';
import { useCustomSymptomStore } from '../store/customSymptomStore';
import { useTheme } from '../hooks/useTheme';
import { DayPickerRow, daysAgo, startOfDay } from '../components/ui/DayPickerRow';
import { dateKeyFromLocalDate } from '../utils/healthEvents';
import { formatDayLabelShort } from '../utils/storyTimeline';

/**
 * Insights screen (Tier 1) — displays patterns discovered in symptom logs.
 * Shows which triggers worsen pain and which reliefs help most.
 */
export default function InsightsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const entries = useLogStore((state) => state.entries);
  // Presets stay simple trailing-window calls; Custom needs two real
  // endpoints, so it is tracked separately rather than forcing the
  // preset state to represent both shapes.
  const [rangeDays, setRangeDays] = useState<number | null>(7);
  const [customStart, setCustomStart] = useState<Date>(startOfDay(daysAgo(29)));
  const [customEnd, setCustomEnd] = useState<Date>(startOfDay(new Date()));

  // How far back the custom picker scrolls — reaches the oldest entry
  // (plus a little), same approach as the Story screen, so someone
  // with a year of history can actually select it rather than hitting
  // a fixed cutoff.
  const pickerRangeDays = useMemo(() => {
    if (entries.length === 0) return 60;
    const oldest = entries.reduce(
      (earliest, entry) => (entry.loggedAt < earliest ? entry.loggedAt : earliest),
      entries[0].loggedAt,
    );
    const days = Math.ceil((Date.now() - new Date(oldest).getTime()) / 86400000);
    return Math.min(730, Math.max(60, days + 7));
  }, [entries]);

  const customSymptoms = useCustomSymptomStore((state) => state.customSymptoms);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (rangeDays !== null) {
      return { rangeStart: startOfDay(daysAgo(rangeDays - 1)), rangeEnd: new Date() };
    }
    const start = customStart <= customEnd ? customStart : customEnd;
    const end = customStart <= customEnd ? customEnd : customStart;
    return { rangeStart: startOfDay(start), rangeEnd: end };
  }, [rangeDays, customStart, customEnd]);

  const correlations = useMemo(
    () => analyzeCorrelationsInRange(entries, rangeStart, rangeEnd, customSymptoms),
    [entries, rangeStart, rangeEnd, customSymptoms],
  );

  const reliefs = correlations.filter((c) => c.type === 'relief');
  const triggers = correlations.filter((c) => c.type === 'trigger');

  // What was tested and did NOT hold. Showing this stops an empty
  // result reading as "we found nothing worth looking for" when the
  // truth is "we looked and the data did not support it".
  const checked = useMemo(
    () => checkedButNotFoundInRange(entries, rangeStart, rangeEnd, customSymptoms),
    [entries, rangeStart, rangeEnd, customSymptoms],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        },
        backButton: {
          width: 40,
          height: 40,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          ...theme.shadows.card,
        },
        headerTitle: {
          ...theme.typography.title,
        },
        customRangeBlock: {
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          marginBottom: theme.spacing.md,
        },
        customRangeLabel: {
          ...theme.typography.overline,
          textTransform: 'uppercase' as const,
        },
        customRangeSummary: {
          ...theme.typography.bodySecondary,
        },
        rangeRow: {
          flexDirection: 'row',
          gap: theme.spacing.sm,
        },
        scrollContent: {
          gap: theme.spacing.md,
        },
        emptyCard: {
          gap: theme.spacing.md,
        },
        emptyTitle: {
          ...theme.typography.heading,
        },
        emptyText: {
          ...theme.typography.bodySecondary,
        },
        sectionCard: {
          gap: theme.spacing.md,
        },
        sectionTitle: {
          ...theme.typography.heading,
        },
        correlationItem: {
          gap: theme.spacing.sm,
          paddingBottom: theme.spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        correlationHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        correlationFactor: {
          ...theme.typography.body,
          fontFamily: theme.fonts.semibold,
        },
        badge: {
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
        },
        badgeText: {
          ...theme.typography.caption,
          fontFamily: theme.fonts.semibold,
        },
        correlationDescription: {
          ...theme.typography.bodySecondary,
          fontSize: 14,
        },
        improvementBar: {
          height: 6,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.border,
          overflow: 'hidden' as const,
        },
        improvementFill: {
          height: '100%' as const,
          borderRadius: theme.radius.pill,
        },
      }),
    [theme],
  );

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Insights</Text>
      </View>

      <View style={styles.rangeRow}>
        {[7, 30, 90].map((days) => (
          <Chip
            key={days}
            label={`${days} days`}
            selected={rangeDays === days}
            onToggle={() => setRangeDays(days)}
          />
        ))}
        <Chip
          label="Custom"
          selected={rangeDays === null}
          onToggle={() => setRangeDays(null)}
        />
      </View>

      {rangeDays === null && (
        <View style={styles.customRangeBlock}>
          <Text style={styles.customRangeLabel}>START</Text>
          <DayPickerRow
            selected={customStart}
            onSelect={setCustomStart}
            rangeDays={pickerRangeDays}
          />
          <Text style={styles.customRangeLabel}>END</Text>
          <DayPickerRow
            selected={customEnd}
            onSelect={setCustomEnd}
            rangeDays={pickerRangeDays}
          />
          <Text style={styles.customRangeSummary}>
            {formatDayLabelShort(dateKeyFromLocalDate(rangeStart))} –{' '}
            {formatDayLabelShort(dateKeyFromLocalDate(rangeEnd))}
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {entries.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No entries yet</Text>
            <Text style={styles.emptyText}>
              Log symptoms with triggers and relief factors to discover patterns.
            </Text>
          </Card>
        ) : correlations.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Not enough data</Text>
            <Text style={styles.emptyText}>
              Log at least 2 entries with triggers/relief factors to see patterns.
            </Text>
          </Card>
        ) : (
          <>
            {reliefs.length > 0 && (
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>What Helps Most</Text>
                {reliefs.map((corr) => (
                  <View key={`${corr.symptomLabel}:${corr.factor}`} style={styles.correlationItem}>
                    <View style={styles.correlationHeader}>
                      <Text style={styles.correlationFactor}>{corr.factor}</Text>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {corr.confidenceLabel} · {corr.support}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.correlationDescription}>
                      {describeCorrelation(corr)}
                    </Text>
                    <View style={styles.improvementBar}>
                      <View
                        style={[
                          styles.improvementFill,
                          {
                            width: `${corr.improvementRate}%`,
                            backgroundColor: theme.colors.success,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </Card>
            )}

            {triggers.length > 0 && (
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Common Triggers</Text>
                {triggers.map((corr) => (
                  <View key={`${corr.symptomLabel}:${corr.factor}`} style={styles.correlationItem}>
                    <View style={styles.correlationHeader}>
                      <Text style={styles.correlationFactor}>{corr.factor}</Text>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {corr.confidenceLabel} · {corr.support}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.correlationDescription}>
                      {describeCorrelation(corr)}
                    </Text>
                    <View style={styles.improvementBar}>
                      <View
                        style={[
                          styles.improvementFill,
                          {
                            width: `${100 - corr.improvementRate}%`,
                            backgroundColor: theme.colors.danger,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>

        {checked.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Also Checked</Text>
            <Text style={styles.correlationDescription}>
              These were tested against your readings and did not show a
              consistent relationship:{' '}
              {[...new Set(checked.map((item) => item.factor.toLowerCase()))]
                .slice(0, 8)
                .join(', ')}
              .
            </Text>
            <Text style={styles.correlationDescription}>
              Not finding a pattern is a real result — it usually means there
              isn't enough consistent data yet, not that nothing is happening.
            </Text>
          </Card>
        )}

    </Screen>
  );
}
