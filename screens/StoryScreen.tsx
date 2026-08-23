import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { Screen } from '../components/ui/Screen';
import { exportStoryReport } from '../services/reportService';
import { useCustomSymptomStore } from '../store/customSymptomStore';
import { useOnsetStore } from '../store/onsetStore';
import { useLogStore } from '../store/logStore';
import { useMedicationStore } from '../store/medicationStore';
import { useProfileStore } from '../store/profileStore';
import { useStoryStore } from '../store/storyStore';
import { useTheme } from '../hooks/useTheme';
import { dateKeyFromLocalDate } from '../utils/healthEvents';
import { evaluateStoryGate } from '../utils/storyGate';
import {
  applySectionOverrides,
  buildStoryReport,
  StoryReport,
  StorySection,
} from '../utils/storyReport';
import { DayPickerRow } from '../components/ui/DayPickerRow';
import { Sentence } from '../utils/storyNlg';
import { ChartSpec } from '../utils/storyCharts';
import { StoryChartList } from '../components/story/StoryChartCard';
import { HealthEvent } from '../utils/healthEvents';
import { formatTimeWithBucket } from '../utils/entryStats';
import { formatDayLabelShort } from '../utils/storyTimeline';
import { severityColor } from '../utils/symptoms';

const PRESETS = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const;

/**
 * How far back the custom range picker will scroll.
 *
 * Computed from the user's own history rather than fixed: a hard 120
 * days silently made a year of logging unreachable, which is exactly
 * the person most likely to want a long report.
 */
const MIN_RANGE_DAYS = 60;
const MAX_RANGE_DAYS = 730;

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function daysAgo(count: number, from: Date = new Date()): Date {
  const next = new Date(from);
  next.setDate(next.getDate() - count);
  return next;
}

/**
 * Symptoms-to-Story — HealthLit's signature feature.
 *
 * Turns logged entries into a nine-section, doctor-ready summary over
 * a date range the user chooses. Generation is gated until there are
 * at least 14 logged days in the last 20: a summary built from a
 * handful of scattered entries reads authoritative without being
 * complete, which is worse than showing nothing.
 *
 * The whole report is produced by deterministic on-device code (see
 * utils/storyReport.ts and the pipeline modules it calls) — there is
 * no model call anywhere in this path. That keeps it free to run,
 * available offline, and traceable line by line to logged numbers.
 */
export default function StoryScreen() {
  const theme = useTheme();
  const router = useRouter();

  const entries = useLogStore((state) => state.entries);
  const customSymptoms = useCustomSymptomStore((state) => state.customSymptoms);
  const medications = useMedicationStore((state) => state.medications);
  const profile = useProfileStore((state) => state.profile);
  const onsets = useOnsetStore((state) => state.onsets);
  const overrides = useStoryStore((state) => state.overrides);
  const hydrateOverrides = useStoryStore((state) => state.hydrate);

  const [presetDays, setPresetDays] = useState<number | null>(30);
  const [customStart, setCustomStart] = useState<Date>(startOfDay(daysAgo(29)));
  const [customEnd, setCustomEnd] = useState<Date>(startOfDay(new Date()));
  const [report, setReport] = useState<StoryReport | null>(null);
  const [exporting, setExporting] = useState(false);
  const [evidence, setEvidence] = useState<Sentence | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    void hydrateOverrides();
    // Runs once when the screen mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gate = useMemo(() => evaluateStoryGate(entries), [entries]);

  // The picker reaches back to the oldest entry (plus a little), so
  // someone with a year of history can actually select it.
  const pickerRangeDays = useMemo(() => {
    if (entries.length === 0) return MIN_RANGE_DAYS;
    const oldest = entries.reduce(
      (earliest, entry) => (entry.loggedAt < earliest ? entry.loggedAt : earliest),
      entries[0].loggedAt,
    );
    const days = Math.ceil(
      (Date.now() - new Date(oldest).getTime()) / 86400000,
    );
    return Math.min(MAX_RANGE_DAYS, Math.max(MIN_RANGE_DAYS, days + 7));
  }, [entries]);

  const { startDate, endDate } = useMemo(() => {
    if (presetDays !== null) {
      return {
        startDate: startOfDay(daysAgo(presetDays - 1)),
        endDate: endOfDay(new Date()),
      };
    }
    // Guard against the user picking a start later than the end.
    const start = customStart <= customEnd ? customStart : customEnd;
    const end = customStart <= customEnd ? customEnd : customStart;
    return { startDate: startOfDay(start), endDate: endOfDay(end) };
  }, [presetDays, customStart, customEnd]);

  // Any range change invalidates a generated report rather than
  // silently leaving stale text under a new date heading.
  useEffect(() => {
    setReport(null);
    setStatusMessage(null);
  }, [presetDays, customStart, customEnd]);

  const displayedReport = useMemo(
    () => (report === null ? null : applySectionOverrides(report, overrides)),
    [report, overrides],
  );

  const handleGenerate = () => {
    setReport(
      buildStoryReport(entries, {
        startDate,
        endDate,
        medications,
        profile,
        customSymptoms,
        onsets,
      }),
    );
    setStatusMessage(null);
  };

  const handlePrint = async () => {
    if (!displayedReport) return;
    setExporting(true);
    const result = await exportStoryReport(displayedReport, profile);
    setExporting(false);
    setStatusMessage(result.message);
  };

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
        headerTitle: { ...theme.typography.title },
        sectionLabel: {
          // The overline token exists precisely for these small caps
          // labels — it carries the wide tracking that caps text
          // needs to stay readable, instead of each screen bolding a
          // caption and hoping.
          ...theme.typography.overline,
          textTransform: 'uppercase' as const,
        },
        chipRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        },
        rangeCard: { gap: theme.spacing.md },
        rangeSummary: { ...theme.typography.bodySecondary },
        gateCard: { gap: theme.spacing.md },
        gateTitleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        },
        gateTitle: { ...theme.typography.heading, flex: 1 },
        gateText: { ...theme.typography.bodySecondary },
        gateTrack: {
          height: 10,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.surfaceMuted,
          overflow: 'hidden',
        },
        gateFill: {
          height: 10,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.primary,
        },
        gateCount: {
          ...theme.typography.body,
          fontFamily: theme.fonts.semibold,
          color: theme.colors.primary,
        },
        metaRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.lg,
        },
        metaItem: { gap: 2 },
        metaValue: { ...theme.typography.heading },
        metaLabel: { ...theme.typography.caption },
        actionRow: {
          flexDirection: 'row',
          gap: theme.spacing.md,
        },
        actionButton: { flex: 1 },
        status: {
          ...theme.typography.caption,
          textAlign: 'center',
        },
        disclaimer: {
          ...theme.typography.caption,
          textAlign: 'center',
        },
        scrollContent: { gap: theme.spacing.md },
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
        <Text style={styles.headerTitle}>Your Story</Text>
      </View>

      <Card style={styles.rangeCard}>
        <Text style={styles.sectionLabel}>REPORT PERIOD</Text>
        <View style={styles.chipRow}>
          {PRESETS.map((preset) => (
            <Chip
              key={preset.days}
              label={preset.label}
              selected={presetDays === preset.days}
              onToggle={() => setPresetDays(preset.days)}
            />
          ))}
          <Chip
            label="Custom"
            selected={presetDays === null}
            onToggle={() => setPresetDays(null)}
          />
        </View>

        {presetDays === null && (
          <>
            <Text style={styles.sectionLabel}>START</Text>
            <DayPickerRow
              selected={customStart}
              onSelect={setCustomStart}
              rangeDays={pickerRangeDays}
            />
            <Text style={styles.sectionLabel}>END</Text>
            <DayPickerRow
              selected={customEnd}
              onSelect={setCustomEnd}
              rangeDays={pickerRangeDays}
            />
          </>
        )}

        <Text style={styles.rangeSummary}>
          {formatDayLabelShort(dateKeyFromLocalDate(startDate))} –{' '}
          {formatDayLabelShort(dateKeyFromLocalDate(endDate))}
        </Text>
      </Card>

      {!gate.unlocked ? (
        <Card style={styles.gateCard}>
          <View style={styles.gateTitleRow}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.colors.inkSecondary} />
            <Text style={styles.gateTitle}>Keep logging to unlock your story</Text>
          </View>
          <Text style={styles.gateCount}>
            {gate.daysLogged} of {gate.requiredDays} days
          </Text>
          <View style={styles.gateTrack}>
            <View style={[styles.gateFill, { width: `${gate.progress * 100}%` }]} />
          </View>
          <Text style={styles.gateText}>
            A summary you hand to a doctor needs enough behind it to be worth
            reading. HealthLit generates your story once you have logged on at
            least {gate.requiredDays} of the last {gate.windowDays} days —{' '}
            {gate.daysRemaining} more {gate.daysRemaining === 1 ? 'day' : 'days'} to
            go. Everything logged so far still counts.
          </Text>
        </Card>
      ) : displayedReport === null ? (
        <>
          <Button
            label="Generate story"
            onPress={handleGenerate}
            accessibilityHint="Builds a doctor-ready summary for the selected period"
          />
          <Text style={styles.disclaimer}>
            Generated on this device from your own entries — no internet
            connection and no AI model involved.
          </Text>
        </>
      ) : displayedReport.meta.entryCount === 0 ? (
        // The gate only guarantees recent logging, so a custom range
        // pointed at an empty stretch is entirely reachable. Half a
        // report with "not enough entries" scattered through it reads
        // like a malfunction; say the actual thing instead.
        <Card style={styles.gateCard}>
          <Text style={styles.gateTitle}>Nothing logged in this period</Text>
          <Text style={styles.gateText}>
            There are no entries between{' '}
            {formatDayLabelShort(displayedReport.meta.startDateKey)} and{' '}
            {formatDayLabelShort(displayedReport.meta.endDateKey)}. Pick a
            different period above.
          </Text>
        </Card>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card>
            <View style={styles.metaRow}>
              <MetaItem
                value={`${displayedReport.meta.entryCount}`}
                label="Entries"
                styles={styles}
              />
              <MetaItem
                value={`${displayedReport.meta.daysLogged}/${displayedReport.meta.daysInRange}`}
                label="Days logged"
                styles={styles}
              />
              <MetaItem
                value={
                  displayedReport.meta.medianSeverity === null
                    ? '—'
                    : displayedReport.meta.medianSeverity.toFixed(1)
                }
                label="Typical severity"
                styles={styles}
              />
              <MetaItem
                value={`${displayedReport.meta.symptomCount}`}
                label="Symptoms"
                styles={styles}
              />
            </View>
          </Card>

          {displayedReport.sections.map((section) => (
            <StorySectionCard
              key={section.key}
              section={section}
              isEdited={typeof overrides[section.key] === 'string'}
              onInspect={(item) => setEvidence(item)}
            />
          ))}

          {/* Charts sit after the narrative and before the timeline:
              the words establish what happened, the charts show its
              shape, and the timeline summarises the period. Each
              chart carries its own data table. */}
          <StoryChartList
            specs={displayedReport.charts}
            onInspect={(spec) =>
              setEvidence({
                text: spec.title,
                entryIds: spec.entryIds,
                findingIds: [],
                source: 'derived',
              })
            }
          />

          <TimelineCard report={displayedReport} />

          <View style={styles.actionRow}>
            <Button
              label="Regenerate"
              variant="secondary"
              onPress={handleGenerate}
              style={styles.actionButton}
              accessibilityHint="Rebuilds the story from your latest entries"
            />
            <Button
              label={Platform.OS === 'web' ? 'Print' : 'Print / share'}
              onPress={handlePrint}
              loading={exporting}
              style={styles.actionButton}
              accessibilityHint="Opens a printable version of this story"
            />
          </View>

          {statusMessage !== null && <Text style={styles.status}>{statusMessage}</Text>}

          <Text style={styles.disclaimer}>
            Every figure here restates something you logged, and every sentence
            can be tapped to see the exact entries behind it. HealthLit does not
            interpret them, name a condition, or make recommendations — bring
            this to your doctor as a record, not a conclusion.
          </Text>
        </ScrollView>
      )}

      <EvidenceModal
        sentence={evidence}
        report={displayedReport}
        onClose={() => setEvidence(null)}
      />
    </Screen>
  );
}

function MetaItem({
  value,
  label,
  styles,
}: {
  value: string;
  label: string;
  styles: Record<string, any>;
}) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaValue}>{value}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

/* --------------------------- Section card --------------------------- */

/**
 * One story section, with an inline editor. Editing replaces the
 * generated text entirely and is remembered across regenerations —
 * "Why I'm seeking care" in particular is the person's to write, and
 * they shouldn't have to retype it every time they change the date
 * range.
 */
function StorySectionCard({
  section,
  isEdited,
  onInspect,
}: {
  section: StorySection;
  isEdited: boolean;
  onInspect: (sentence: Sentence) => void;
}) {
  const theme = useTheme();
  const setOverride = useStoryStore((state) => state.setOverride);
  const clearOverride = useStoryStore((state) => state.clearOverride);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(section.body.map((item) => item.text).join('\n'));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { gap: theme.spacing.sm },
        titleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        },
        title: {
          ...theme.typography.heading,
          flex: 1,
        },
        badge: {
          ...theme.typography.caption,
          color: theme.colors.primary,
          fontFamily: theme.fonts.semibold,
        },
        paragraph: {
          ...theme.typography.bodySecondary,
          lineHeight: 24,
        },
        prompt: {
          ...theme.typography.bodySecondary,
          color: theme.colors.inkMuted,
          fontStyle: 'italic' as const,
        },
        inspectable: {
          textDecorationLine: 'underline' as const,
          textDecorationStyle: 'dotted' as const,
          textDecorationColor: theme.colors.border,
        },
        evidenceCount: {
          ...theme.typography.caption,
          color: theme.colors.primary,
          fontFamily: theme.fonts.semibold,
        },
        input: {
          ...theme.typography.body,
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radius.lg,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
          padding: theme.spacing.md,
          minHeight: 140,
          textAlignVertical: 'top' as const,
        },
        buttonRow: {
          flexDirection: 'row',
          gap: theme.spacing.sm,
        },
        flexButton: { flex: 1 },
      }),
    [theme],
  );

  if (section.body.length === 0) return null;

  const openEditor = () => {
    setText(section.body.map((item) => item.text).join('\n'));
    setEditing(true);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{section.title}</Text>
        {isEdited && <Text style={styles.badge}>EDITED</Text>}
        {!editing && (
          <Pressable
            onPress={openEditor}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${section.title}`}
          >
            <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
          </Pressable>
        )}
      </View>

      {editing ? (
        <>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            style={styles.input}
            placeholderTextColor={theme.colors.inkMuted}
            accessibilityLabel={`${section.title} text`}
          />
          <View style={styles.buttonRow}>
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => setEditing(false)}
              style={styles.flexButton}
            />
            <Button
              label="Save"
              onPress={() => {
                setOverride(section.key, text);
                setEditing(false);
              }}
              style={styles.flexButton}
            />
          </View>
          {isEdited && (
            <Button
              label="Reset to generated text"
              variant="ghost"
              onPress={() => {
                clearOverride(section.key);
                setEditing(false);
              }}
              accessibilityHint="Discards your edit and restores the calculated version"
            />
          )}
        </>
      ) : (
        section.body.map((item, index) => {
          const isPrompt =
            section.userAuthored === true && !isEdited && item.source === 'user';
          // Only derived sentences are tappable — a sentence with no
          // evidence behind it shouldn't pretend to have any.
          const canInspect = item.source === 'derived' && item.entryIds.length > 0;

          if (!canInspect) {
            return (
              <Text key={index} style={isPrompt ? styles.prompt : styles.paragraph}>
                {item.text}
              </Text>
            );
          }

          return (
            <Pressable
              key={index}
              onPress={() => onInspect(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.text} Tap to see the ${item.entryIds.length} entries behind this.`}
            >
              <Text style={[styles.paragraph, styles.inspectable]}>
                {item.text}
                <Text style={styles.evidenceCount}>
                  {'  '}
                  {item.entryIds.length}
                </Text>
              </Text>
            </Pressable>
          );
        })
      )}
    </Card>
  );
}

/* ---------------------------- Timeline ------------------------------ */

/**
 * The simplified timeline: consecutive days in the same severity band
 * collapsed into runs, so a 90-day report reads as a few phases
 * instead of ninety rows. Rendered as plain Views rather than a chart
 * — it has to stay readable on a small screen and print cleanly.
 */
function TimelineCard({ report }: { report: StoryReport }) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { gap: theme.spacing.md },
        title: { ...theme.typography.heading },
        segmentRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
        },
        swatch: {
          width: 6,
          alignSelf: 'stretch',
          minHeight: 40,
          borderRadius: 3,
        },
        segmentBody: { flex: 1, gap: 2 },
        segmentLabel: {
          ...theme.typography.body,
          fontFamily: theme.fonts.semibold,
        },
        segmentMeta: { ...theme.typography.caption },
      }),
    [theme],
  );

  if (report.timeline.segments.length === 0) return null;

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Simplified timeline</Text>
      {report.timeline.segments.map((segment) => (
        <View key={segment.startDateKey} style={styles.segmentRow}>
          <View
            style={[
              styles.swatch,
              {
                backgroundColor:
                  segment.avgSeverity === null
                    ? theme.colors.border
                    : severityColor(segment.avgSeverity),
              },
            ]}
          />
          <View style={styles.segmentBody}>
            <Text style={styles.segmentLabel}>
              {segment.label} · {segment.band}
            </Text>
            <Text style={styles.segmentMeta}>
              {segment.avgSeverity === null
                ? `${segment.dayCount} ${segment.dayCount === 1 ? 'day' : 'days'} with nothing logged`
                : `avg ${segment.avgSeverity.toFixed(1)}/10 · ${segment.entryCount} ${
                    segment.entryCount === 1 ? 'entry' : 'entries'
                  } over ${segment.loggedDayCount}/${segment.dayCount} ${
                    segment.dayCount === 1 ? 'day' : 'days'
                  }`}
            </Text>
            {segment.symptomLabels.length > 0 && (
              <Text style={styles.segmentMeta}>
                {segment.symptomLabels.slice(0, 4).join(', ')}
              </Text>
            )}
          </View>
        </View>
      ))}
    </Card>
  );
}

/* -------------------------- Day picker row -------------------------- */

/**
 * Horizontal day picker for the custom range. Deliberately plain
 * Pressables in a ScrollView — no scroll-linked interpolation, no
 * snapping math. This is a settings control, not the logging path,
 * and cheap beats fancy on a slow phone.
 */

/* --------------------------- Evidence view --------------------------- */

/**
 * Tap-through evidence for one sentence.
 *
 * This is the payoff of carrying provenance through the pipeline:
 * any claim in the report opens the exact readings it was computed
 * from, with dates, severities and factors. No language model can
 * offer this — a generated sentence has no retrievable relationship
 * to the rows that produced it. Here every sentence does, by
 * construction.
 */
function EvidenceModal({
  sentence,
  report,
  onClose,
}: {
  sentence: Sentence | null;
  report: StoryReport | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: theme.colors.background,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          padding: theme.spacing.xl,
          gap: theme.spacing.md,
          maxHeight: '80%',
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        },
        title: { ...theme.typography.heading, flex: 1 },
        claim: {
          ...theme.typography.bodySecondary,
          fontStyle: 'italic' as const,
        },
        countLine: {
          ...theme.typography.caption,
          fontFamily: theme.fonts.semibold,
          color: theme.colors.primary,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        swatch: {
          width: 40,
          height: 40,
          borderRadius: theme.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
        },
        swatchText: {
          fontFamily: theme.fonts.bold,
          color: theme.colors.onPrimary,
          fontSize: 15,
        },
        rowBody: { flex: 1, gap: 2 },
        rowTitle: {
          ...theme.typography.body,
          fontFamily: theme.fonts.semibold,
        },
        rowMeta: { ...theme.typography.caption },
      }),
    [theme],
  );

  if (sentence === null || report === null) return null;

  // Newest first, and capped: the point is to make the claim
  // checkable, not to reprint the whole log inside a sheet.
  const events: HealthEvent[] = sentence.entryIds
    .map((id) => report.entryIndex[id])
    .filter((event): event is HealthEvent => event !== undefined)
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        {/* Stops a tap inside the sheet from closing it. */}
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Where this comes from</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color={theme.colors.inkMuted} />
            </Pressable>
          </View>

          <Text style={styles.claim}>{sentence.text}</Text>
          <Text style={styles.countLine}>
            Calculated from {events.length}{' '}
            {events.length === 1 ? 'reading' : 'readings'}
          </Text>

          <ScrollView>
            {events.slice(0, 60).map((event) => {
              const factors = [...event.triggers, ...event.reliefFactors];
              return (
                <View key={event.entryId} style={styles.row}>
                  <View
                    style={[
                      styles.swatch,
                      { backgroundColor: severityColor(event.severity) },
                    ]}
                  >
                    <Text style={styles.swatchText}>{event.severity}</Text>
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{event.symptomLabel}</Text>
                    <Text style={styles.rowMeta}>
                      {formatDayLabelShort(event.dateKey)} ·{' '}
                      {formatTimeWithBucket(event.at.toISOString())}
                      {event.durationLabel !== null ? ` · ${event.durationLabel}` : ''}
                    </Text>
                    {factors.length > 0 && (
                      <Text style={styles.rowMeta}>{factors.join(', ')}</Text>
                    )}
                  </View>
                </View>
              );
            })}
            {events.length > 60 && (
              <Text style={styles.rowMeta}>
                Showing the 60 most recent of {events.length}.
              </Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
