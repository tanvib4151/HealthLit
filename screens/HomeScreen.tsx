import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { DayCarousel } from '../components/ui/DayCarousel';
import { EntryListItem } from '../components/entries/EntryListItem';
import { Card } from '../components/ui/Card';
import { WellnessSupportCard } from '../components/wellness/WellnessSupportCard';
import { FadeInView } from '../components/ui/FadeInView';
import { Screen } from '../components/ui/Screen';
import { TrendLineChart } from '../components/charts/TrendLineChart';
import { useLogStore } from '../store/logStore';
import { getWeekComparison } from '../utils/comparisonStats';
import {
  dateKeyFromDate,
  dateKeyLocal,
  formatRelativeDayLabel,
  getStreakDays,
  getTodayStats,
  isStreakMilestone,
} from '../utils/entryStats';
import { buildDailySeries } from '../utils/trendData';
import { useTheme } from '../hooks/useTheme';

const HERO_GRADIENT = ['#E79FC4', '#F2AE8C'] as const;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const entries = useLogStore((state) => state.entries);
  const selectedLogDate = useLogStore((state) => state.draft.occurredAt);
  const setSelectedLogDate = useLogStore((state) => state.setOccurredAt);

  const todayStats = useMemo(() => getTodayStats(entries), [entries]);
  const streak = useMemo(() => getStreakDays(entries), [entries]);
  const atMilestone = useMemo(() => isStreakMilestone(streak), [streak]);
  const comparison = useMemo(() => getWeekComparison(entries), [entries]);
  const weekSeries = useMemo(() => buildDailySeries(entries, 7), [entries]);
  const selectedDateKey = dateKeyFromDate(selectedLogDate);
  const selectedDayEntries = useMemo(
    () => entries.filter((entry) => dateKeyLocal(entry.loggedAt) === selectedDateKey),
    [entries, selectedDateKey],
  );
  const selectedDayLabel = formatRelativeDayLabel(selectedLogDate);
  const isToday = selectedDateKey === dateKeyFromDate(new Date());

  const styles = useMemo(() => StyleSheet.create({
    hero: {
      borderRadius: theme.radius.xl,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
    heroGreeting: { ...theme.typography.bodySecondary, color: 'rgba(255, 255, 255, 0.9)' },
    heroTitle: { ...theme.typography.title, color: theme.colors.onPrimary },
    heroDate: { ...theme.typography.caption, color: 'rgba(255, 255, 255, 0.9)' },
    statRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.lg },
    dateCard: { gap: theme.spacing.sm },
    dateCardLabel: { ...theme.typography.caption, fontFamily: theme.fonts.semibold },
    dayLogCard: { gap: theme.spacing.md },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
    cardTitle: { ...theme.typography.heading },
    daySummary: { ...theme.typography.caption, color: theme.colors.inkMuted },
    viewLog: { ...theme.typography.body, fontSize: 15, fontFamily: theme.fonts.semibold, color: theme.colors.primary },
    emptyText: { ...theme.typography.bodySecondary },
    quickLog: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      minHeight: 68,
      ...theme.shadows.card,
    },
    quickLogPressed: { backgroundColor: theme.colors.primaryPressed },
    quickLogIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickLogText: { flex: 1, gap: 2 },
    quickLogTitle: { ...theme.typography.body, fontFamily: theme.fonts.bold, color: theme.colors.onPrimary },
    quickLogSubtitle: { ...theme.typography.caption, color: 'rgba(255, 255, 255, 0.85)' },
    shortcutRow: { flexDirection: 'row', gap: theme.spacing.md },
    shortcutCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      minHeight: 56,
      ...theme.shadows.card,
    },
    shortcutCardPressed: { backgroundColor: theme.colors.surfaceMuted },
    shortcutIcon: { width: 36, height: 36, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
    shortcutLabel: { ...theme.typography.body, fontFamily: theme.fonts.semibold, flexShrink: 1 },
    milestoneBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.successSoft,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    milestoneText: { ...theme.typography.bodySecondary, color: theme.colors.success, fontFamily: theme.fonts.medium, flexShrink: 1 },
    storyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      backgroundColor: theme.colors.primarySoft,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      minHeight: 64,
    },
    storyCardPressed: { opacity: 0.85 },
    storyIcon: { width: 40, height: 40, borderRadius: theme.radius.pill, backgroundColor: theme.colors.accentPinkSoft, alignItems: 'center', justifyContent: 'center' },
    storyText: { flex: 1, gap: 2 },
    storyTitle: { ...theme.typography.body, fontFamily: theme.fonts.bold, color: theme.colors.primary },
    storySubtitle: { ...theme.typography.caption, color: theme.colors.primary },
    trendCard: { gap: theme.spacing.md },
    rangePill: { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.pill, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs },
    rangePillText: { ...theme.typography.caption, color: theme.colors.inkSecondary },
    comparisonCard: { gap: theme.spacing.md },
    comparisonRow: { flexDirection: 'row', gap: theme.spacing.md },
  }), [theme]);

  return (
    <Screen showHeader>
      <FadeInView>
        <LinearGradient colors={HERO_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroGreeting}>{getGreeting()}</Text>
          <Text style={styles.heroTitle}>{entries.length > 0 ? 'Welcome back' : 'Welcome to HealthLit'}</Text>
          <Text style={styles.heroDate}>{getFormattedDate()}</Text>
          <View style={styles.statRow}>
            <StatTile value={todayStats.maxSeverity === null ? '—' : String(todayStats.maxSeverity)} unit="/10" label="Today's Pain" />
            <StatTile value={String(todayStats.count)} unit={todayStats.count === 1 ? 'symptom' : 'symptoms'} label="Logged" />
            <StatTile value={String(streak)} unit={streak === 1 ? 'day' : 'days'} label="Streak" />
          </View>
        </LinearGradient>
      </FadeInView>

      <WellnessSupportCard />

      {atMilestone && (
        <FadeInView delay={40}>
          <View style={styles.milestoneBanner}>
            <Ionicons name="sparkles-outline" size={18} color={theme.colors.success} />
            <Text style={styles.milestoneText}>{streak}-day logging streak — nice consistency.</Text>
          </View>
        </FadeInView>
      )}

      <FadeInView delay={60}>
        <View style={styles.dateCard}>
          <Text style={styles.dateCardLabel}>Day</Text>
          <DayCarousel selectedDate={selectedLogDate} onSelectDate={setSelectedLogDate} accessibilityLabelPrefix="Day to view and log for" />
        </View>
      </FadeInView>

      <FadeInView delay={70}>
        <Card style={styles.dayLogCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>{selectedDayLabel}’s Log</Text>
              <Text style={styles.daySummary}>
                {selectedDayEntries.length === 0
                  ? 'No entries yet'
                  : `${selectedDayEntries.length} ${selectedDayEntries.length === 1 ? 'entry' : 'entries'}`}
              </Text>
            </View>
            {selectedDayEntries.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${selectedDayLabel} log`}
                onPress={() => router.push({ pathname: '/history', params: { date: selectedDateKey } })}
                hitSlop={8}
              >
                <Text style={styles.viewLog}>View log</Text>
              </Pressable>
            )}
          </View>

          {selectedDayEntries.length === 0 ? (
            <Text style={styles.emptyText}>Nothing logged for {selectedDayLabel.toLowerCase()}.</Text>
          ) : (
            selectedDayEntries.slice(0, 3).map((entry) => (
              <EntryListItem
                key={entry.id}
                entry={entry}
                onPress={() => router.push({ pathname: '/log', params: { entryId: entry.id } })}
              />
            ))
          )}

          {selectedDayEntries.length > 3 && (
            <Pressable onPress={() => router.push({ pathname: '/history', params: { date: selectedDateKey } })} accessibilityRole="button">
              <Text style={styles.viewLog}>View all {selectedDayEntries.length} entries</Text>
            </Pressable>
          )}
        </Card>
      </FadeInView>

      <FadeInView delay={80}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${selectedDayEntries.length > 0 ? 'Add another symptom entry to' : 'Log symptoms for'} ${selectedDayLabel}`}
          accessibilityHint="Opens the guided symptom check-in"
          onPress={() => router.push('/log')}
          style={({ pressed }) => [styles.quickLog, pressed && styles.quickLogPressed]}
        >
          <View style={styles.quickLogIcon}><Ionicons name="add" size={22} color={theme.colors.onPrimary} /></View>
          <View style={styles.quickLogText}>
            <Text style={styles.quickLogTitle}>
              {selectedDayEntries.length > 0
                ? `Add to ${selectedDayLabel}’s Log`
                : isToday
                  ? "Log Today's Symptoms"
                  : `Log Symptoms for ${selectedDayLabel}`}
            </Text>
            <Text style={styles.quickLogSubtitle}>
              {selectedDayEntries.length > 0 ? 'Keeps this entry on the selected day' : 'Takes about 2 minutes'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.onPrimary} />
        </Pressable>
      </FadeInView>

      <FadeInView delay={140}>
        <View style={styles.shortcutRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="View insights" onPress={() => router.push('/insights')} style={({ pressed }) => [styles.shortcutCard, pressed && styles.shortcutCardPressed]}>
            <View style={[styles.shortcutIcon, { backgroundColor: theme.colors.primarySoft }]}><Ionicons name="bulb-outline" size={20} color={theme.colors.inkSecondary} /></View>
            <Text style={styles.shortcutLabel}>Insights</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="View medications" onPress={() => router.push('/medications')} style={({ pressed }) => [styles.shortcutCard, pressed && styles.shortcutCardPressed]}>
            <View style={[styles.shortcutIcon, { backgroundColor: theme.colors.successSoft }]}><Ionicons name="medkit-outline" size={20} color={theme.colors.success} /></View>
            <Text style={styles.shortcutLabel}>Medications</Text>
          </Pressable>
        </View>
      </FadeInView>

      <FadeInView delay={150}>
        <Pressable accessibilityRole="button" accessibilityLabel="View your story" onPress={() => router.push('/story')} style={({ pressed }) => [styles.storyCard, pressed && styles.storyCardPressed]}>
          <View style={styles.storyIcon}><Ionicons name="sparkles" size={20} color={theme.colors.accentPink} /></View>
          <View style={styles.storyText}>
            <Text style={styles.storyTitle}>Your Story</Text>
            <Text style={styles.storySubtitle}>A plain-English summary of your patterns</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
        </Pressable>
      </FadeInView>

      <FadeInView delay={160}>
        <Card style={styles.trendCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>7-Day Pain Trend</Text>
            <View style={styles.rangePill}><Text style={styles.rangePillText}>This week</Text></View>
          </View>
          {weekSeries.hasData ? (
            <TrendLineChart values={weekSeries.values} labels={weekSeries.labels} accessibilityLabel="Pain severity trend over the last 7 days" />
          ) : (
            <Text style={styles.emptyText}>Log symptoms for a few days and your weekly trend will appear here.</Text>
          )}
        </Card>
      </FadeInView>

      {comparison.thisWeek.count > 0 || comparison.lastWeek.count > 0 ? (
        <FadeInView delay={200}>
          <Card style={styles.comparisonCard}>
            <Text style={styles.cardTitle}>This Week vs Last Week</Text>
            <View style={styles.comparisonRow}>
              <ComparisonTile label="Avg severity" thisValue={comparison.thisWeek.avgSeverity === null ? '—' : comparison.thisWeek.avgSeverity.toFixed(1)} delta={comparison.severityDelta} lowerIsBetter />
              <ComparisonTile label="Entries logged" thisValue={String(comparison.thisWeek.count)} delta={comparison.countDelta} lowerIsBetter={false} />
            </View>
          </Card>
        </FadeInView>
      ) : null}
    </Screen>
  );
}

function StatTile({ value, unit, label }: { value: string; unit: string; label: string }) {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    statTile: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.22)', borderRadius: theme.radius.lg, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.sm, alignItems: 'center', gap: 2 },
    statLabel: { ...theme.typography.caption, color: 'rgba(255, 255, 255, 0.95)', fontSize: 12 },
    statValue: { fontSize: 24, lineHeight: 28, fontFamily: theme.fonts.bold, color: theme.colors.onPrimary },
    statUnit: { ...theme.typography.caption, color: 'rgba(255, 255, 255, 0.95)', fontSize: 11 },
  }), [theme]);

  return (
    <View style={styles.statTile} accessible accessibilityLabel={`${label}: ${value} ${unit}`}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
    </View>
  );
}

function ComparisonTile({
  label,
  thisValue,
  delta,
  lowerIsBetter,
}: {
  label: string;
  thisValue: string;
  delta: number | null;
  lowerIsBetter: boolean;
}) {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    comparisonTile: { flex: 1, gap: 2 },
    comparisonLabel: { ...theme.typography.caption },
    comparisonValue: { fontSize: 22, lineHeight: 26, fontFamily: theme.fonts.bold, color: theme.colors.ink },
    comparisonDeltaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    comparisonDeltaText: { ...theme.typography.caption, fontSize: 12 },
  }), [theme]);

  const rounded = delta === null ? null : Math.round(delta * 10) / 10;
  const isFlat = rounded === null || rounded === 0;
  const isUp = !isFlat && rounded > 0;
  const deltaColor = isFlat
    ? theme.colors.inkMuted
    : lowerIsBetter
      ? isUp
        ? theme.colors.danger
        : theme.colors.success
      : theme.colors.inkSecondary;
  const deltaIcon = isFlat ? 'remove-outline' : isUp ? 'arrow-up-outline' : 'arrow-down-outline';
  const deltaText = isFlat ? 'No change' : `${isUp ? '+' : ''}${rounded} vs last week`;

  return (
    <View style={styles.comparisonTile}>
      <Text style={styles.comparisonLabel}>{label}</Text>
      <Text style={styles.comparisonValue}>{thisValue}</Text>
      <View style={styles.comparisonDeltaRow}>
        <Ionicons name={deltaIcon} size={12} color={deltaColor} />
        <Text style={[styles.comparisonDeltaText, { color: deltaColor }]}>{deltaText}</Text>
      </View>
    </View>
  );
}
