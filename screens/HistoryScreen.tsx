import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { FrequencyBars } from '../components/charts/FrequencyBars';
import { TrendLineChart } from '../components/charts/TrendLineChart';
import { EntryListItem } from '../components/entries/EntryListItem';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { Screen } from '../components/ui/Screen';
import { exportReport } from '../services/reportService';
import { useCustomSymptomStore } from '../store/customSymptomStore';
import { useLogStore } from '../store/logStore';
import { useMedicationStore } from '../store/medicationStore';
import { useProfileStore } from '../store/profileStore';
import { SymptomEntry } from '../types/models';
import { dateKeyLocal, formatDayLabel } from '../utils/entryStats';
import { buildDailySeries, buildSymptomFrequency } from '../utils/trendData';
import { useTheme } from '../hooks/useTheme';

const RANGE_OPTIONS = [{ days: 7, label: '7 days' }, { days: 30, label: '30 days' }, { days: 90, label: '90 days' }] as const;
interface DayGroup { dateKey: string; entries: SymptomEntry[]; }
function groupByDay(entries: SymptomEntry[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const entry of entries) {
    const dateKey = dateKeyLocal(entry.loggedAt);
    const last = groups[groups.length - 1];
    if (last && last.dateKey === dateKey) last.entries.push(entry);
    else groups.push({ dateKey, entries: [entry] });
  }
  return groups;
}
function summarizeDay(entries: SymptomEntry[]): string {
  const avg = entries.reduce((sum, e) => sum + e.severity, 0) / entries.length;
  return `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} · avg ${avg.toFixed(1)}/10`;
}

export default function HistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const entries = useLogStore((state) => state.entries);
  const medications = useMedicationStore((state) => state.medications);
  const profile = useProfileStore((state) => state.profile);
  const customSymptoms = useCustomSymptomStore((state) => state.customSymptoms);
  const [rangeDays, setRangeDays] = useState<number>(7);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportFailed, setExportFailed] = useState(false);

  const series = useMemo(() => buildDailySeries(entries, rangeDays), [entries, rangeDays]);
  const frequency = useMemo(() => buildSymptomFrequency(entries, rangeDays, customSymptoms), [entries, rangeDays, customSymptoms]);
  // Charts/report use the selected range; the actual history remains
  // complete so old records never become unreachable after 30 days.
  const dayGroups = useMemo(() => groupByDay(entries), [entries]);

  const handleExport = async () => {
    setExporting(true); setExportMessage(null);
    const result = await exportReport(entries, rangeDays, medications, profile, customSymptoms);
    setExportMessage(result.message); setExportFailed(!result.ok); setExporting(false);
  };

  const styles = useMemo(() => StyleSheet.create({
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    backButton: { width: 40, height: 40, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', ...theme.shadows.card },
    headerTitle: { ...theme.typography.title }, rangeRow: { flexDirection: 'row', gap: theme.spacing.sm },
    sectionCard: { gap: theme.spacing.md }, sectionTitle: { ...theme.typography.heading }, sectionCaption: { ...theme.typography.bodySecondary },
    exportStatus: { ...theme.typography.caption, color: theme.colors.success }, exportStatusError: { color: theme.colors.danger },
    dayGroup: { gap: theme.spacing.sm }, dayHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    dayLabel: { ...theme.typography.overline, textTransform: 'uppercase' }, daySummary: { ...theme.typography.caption, color: theme.colors.inkMuted },
    dayCard: { gap: theme.spacing.md }, emptyCard: { gap: theme.spacing.md }, emptyTitle: { ...theme.typography.heading }, emptyText: { ...theme.typography.bodySecondary },
  }), [theme]);

  return <Screen>
    <View style={styles.headerRow}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12} style={styles.backButton}><Ionicons name="chevron-back" size={24} color={theme.colors.ink} /></Pressable><Text style={styles.headerTitle}>History</Text></View>
    <View style={styles.rangeRow}>{RANGE_OPTIONS.map((option) => <Chip key={option.days} label={option.label} selected={rangeDays === option.days} onToggle={() => setRangeDays(option.days)} />)}</View>
    {entries.length === 0 ? <Card style={styles.emptyCard}><Text style={styles.emptyTitle}>No entries yet</Text><Text style={styles.emptyText}>Once you start logging symptoms, your trends and history will appear here.</Text><Button label="Log a symptom" onPress={() => router.push('/log')} accessibilityHint="Opens the symptom logging flow" /></Card> : <>
      <Card style={styles.sectionCard}><Text style={styles.sectionTitle}>Doctor Report</Text><Text style={styles.sectionCaption}>A clean PDF of the last {rangeDays} days — summary, symptom frequency, factors, and every entry in that range.</Text><Button label="Export PDF report" onPress={handleExport} loading={exporting} accessibilityHint="Creates a PDF report you can share with your doctor" />{exportMessage !== null && <Text style={[styles.exportStatus, exportFailed && styles.exportStatusError]} accessibilityLiveRegion="polite">{exportMessage}</Text>}</Card>
      <Card style={styles.sectionCard}><Text style={styles.sectionTitle}>Pain Trend</Text>{series.hasData ? <TrendLineChart values={series.values} labels={series.labels} accessibilityLabel={`Severity trend over the last ${rangeDays} days`} /> : <Text style={styles.emptyText}>No entries in the last {rangeDays} days.</Text>}</Card>
      <Card style={styles.sectionCard}><Text style={styles.sectionTitle}>Symptom Frequency</Text>{frequency.length > 0 ? <FrequencyBars data={frequency} /> : <Text style={styles.emptyText}>No entries in the last {rangeDays} days.</Text>}</Card>
      <Text style={styles.sectionTitle}>All Entries</Text>
      {dayGroups.map((group) => <View key={group.dateKey} style={styles.dayGroup}><View style={styles.dayHeaderRow}><Text style={styles.dayLabel}>{formatDayLabel(group.dateKey)}</Text><Text style={styles.daySummary}>{summarizeDay(group.entries)}</Text></View><Card style={styles.dayCard}>{group.entries.map((entry) => <EntryListItem key={entry.id} entry={entry} onPress={() => router.push({ pathname: '/log', params: { entryId: entry.id } })} />)}</Card></View>)}
    </>}
  </Screen>;
}
