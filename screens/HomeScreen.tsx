import { entryDateKey } from '../utils/entryStats';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { DayCarousel } from '../components/ui/DayCarousel';
import { EntryListItem } from '../components/entries/EntryListItem';
import { Card } from '../components/ui/Card';
import { WellnessSupportCard } from '../components/wellness/WellnessSupportCard';
import { FadeInView } from '../components/ui/FadeInView';
import { Screen } from '../components/ui/Screen';
import { useLogStore } from '../store/logStore';
import {
  dateKeyFromDate,
  formatRelativeDayLabel,
} from '../utils/entryStats';
import { useTheme } from '../hooks/useTheme';

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

  const selectedDateKey = dateKeyFromDate(selectedLogDate);
  const selectedDayEntries = useMemo(
    () => entries.filter((entry) => entryDateKey(entry) === selectedDateKey),
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
    heroGreeting: { ...theme.typography.bodySecondary, color: theme.colors.onPrimary },
    heroTitle: { ...theme.typography.title, color: theme.colors.onPrimary },
    heroDate: { ...theme.typography.caption, color: theme.colors.onPrimary },
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
    quickLogSubtitle: { ...theme.typography.caption, color: theme.colors.onPrimary },
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


      <FadeInView>
        <View style={[styles.hero, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.heroGreeting}>{getGreeting()}</Text>
          <Text style={styles.heroTitle}>{entries.length > 0 ? 'Welcome back' : 'Welcome to HealthLit'}</Text>
          <Text style={styles.heroDate}>{getFormattedDate()}</Text>

        </View>
      </FadeInView>

      <WellnessSupportCard />

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
            <Text style={styles.emptyText}>Nothing logged for {selectedDayLabel.toLowerCase()}. Unlogged days are unknown, not symptom-free.</Text>
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

    </Screen>
  );
}
