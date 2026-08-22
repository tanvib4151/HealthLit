/**
 * Story pipeline — chart specifications.
 *
 * Produces CHART SPECS: pure data structures describing what to plot,
 * with no rendering in them at all. Two different renderers consume
 * these — React Native SVG in the app, and inline SVG in the printed
 * report — so a spec built here is guaranteed to show the same
 * numbers in both. Building the chart inside a component instead
 * would mean writing every chart twice and having them drift.
 *
 * TWO RULES CARRIED OVER FROM THE REST OF THE ENGINE
 *
 * 1. Every spec carries `entryIds`. A chart is a claim about data
 *    just as much as a sentence is, so it is traceable the same way
 *    and can be tapped through to its readings.
 *
 * 2. Every spec carries a `table`. A chart that cannot be read as
 *    numbers is not acceptable in a clinical document: a screen
 *    reader cannot describe a polyline, a photocopy can flatten
 *    colour to grey, and a clinician may simply want the values. The
 *    table is not a fallback, it is the same information in the form
 *    some readers need.
 *
 * Missing days are never plotted as zero. "No entry" and "severity 0"
 * are different facts, and conflating them would understate someone's
 * symptoms in a document that a treatment decision might rest on.
 */

import { distinctDayKeys, groupBySymptom, HealthEvent, meanOf } from './healthEvents';
import { Finding } from './storyFindings';
import { median } from './storyStats';
import { formatDayLabelShort, Timeline } from './storyTimeline';

export type ChartKind =
  | 'severityTrend'
  | 'coverageCalendar'
  | 'severityDistribution'
  | 'symptomFrequency'
  | 'factorContrast';

/** A tabular rendering of exactly what a chart plots. */
export interface ChartTable {
  headers: string[];
  rows: string[][];
  /** Shown under the table when some values are intentionally absent. */
  note?: string;
}

export interface ChartSeries {
  label: string;
  /** Hex colour. Symptom accents stay constant across light and dark. */
  color: string;
  /** One value per x position. null means no data, and is never drawn. */
  values: (number | null)[];
}

export interface ChartSpec {
  id: string;
  kind: ChartKind;
  title: string;
  /** One line explaining how to read it. */
  caption: string;
  /** X axis labels, same length as each series' values. */
  labels: string[];
  series: ChartSeries[];
  /** Y axis maximum. Severity charts fix this at 10 so two charts compare. */
  yMax: number;
  table: ChartTable;
  entryIds: string[];
  /** Spoken description for screen readers. */
  accessibilityLabel: string;
}

/** Fallback palette for symptoms without an assigned accent. */
const SERIES_COLORS = ['#7C6BD6', '#5B9BD8', '#3FAF8C', '#DE9A36', '#D65C77', '#8A7CD8'];

function colorFor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

function oneDecimal(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

/* ------------------------- Severity over time ------------------------ */

/**
 * Daily severity per symptom across the report window.
 *
 * Plots the DAILY MEAN for each symptom. Someone logging a headache
 * three times in a day produces three points that would otherwise
 * stack on one x position; averaging them gives one honest point per
 * day, and the count is preserved in the table so nothing is hidden.
 *
 * Limited to the three most-logged symptoms. A five-line chart at
 * phone width is decoration, not information.
 */
export function buildSeverityTrendChart(
  events: HealthEvent[],
  timeline: Timeline,
): ChartSpec | null {
  if (events.length < 2) return null;

  const groups = [...groupBySymptom(events).entries()].slice(0, 3);
  if (groups.length === 0) return null;

  const days = timeline.days;
  const labels = days.map((day, index) => {
    // Label roughly six positions; a label per day is unreadable at
    // phone width and illegible in print.
    const step = Math.max(1, Math.ceil(days.length / 6));
    return index % step === 0 || index === days.length - 1 ? day.label : '';
  });

  const series: ChartSeries[] = groups.map(([, groupEvents], index) => {
    const byDay = new Map<string, number[]>();
    for (const event of groupEvents) {
      byDay.set(event.dateKey, [...(byDay.get(event.dateKey) ?? []), event.severity]);
    }
    return {
      label: groupEvents[0].symptomLabel,
      color: colorFor(index),
      values: days.map((day) => {
        const values = byDay.get(day.dateKey);
        return values === undefined ? null : meanOf(values);
      }),
    };
  });

  // The table lists only days with data. Thirty rows of "no entry"
  // would bury the days that matter.
  const rows: string[][] = [];
  days.forEach((day, dayIndex) => {
    const cells = series.map((item) => {
      const value = item.values[dayIndex];
      return value === null ? '—' : oneDecimal(value);
    });
    if (cells.every((cell) => cell === '—')) return;
    rows.push([day.label, ...cells]);
  });

  const missingDays = days.filter((day) => day.entryCount === 0).length;

  return {
    id: 'chart:severityTrend',
    kind: 'severityTrend',
    title: 'Severity over time',
    caption:
      'Daily average severity for each symptom, 0–10. Gaps are days with nothing logged.',
    labels,
    series,
    yMax: 10,
    table: {
      headers: ['Date', ...series.map((item) => item.label)],
      rows,
      note:
        missingDays > 0
          ? `${missingDays} ${missingDays === 1 ? 'day' : 'days'} in this period had no entries and are omitted from the table.`
          : undefined,
    },
    entryIds: groups.flatMap(([, groupEvents]) =>
      groupEvents.map((event) => event.entryId),
    ),
    accessibilityLabel:
      `Line chart of daily average severity over ${days.length} days for ` +
      `${series.map((item) => item.label).join(', ')}. Full values are in the data table below.`,
  };
}

/* --------------------------- Logging coverage ------------------------ */

/**
 * One cell per day: how severe, and whether anything was logged.
 *
 * This is the chart a clinician reads first, because it answers "how
 * much should I trust the rest of this" before any finding does.
 * Rendered as a single series where the value IS the day's mean
 * severity, so a renderer can colour by intensity.
 */
export function buildCoverageChart(timeline: Timeline): ChartSpec | null {
  if (timeline.days.length === 0) return null;

  const values = timeline.days.map((day) => day.avgSeverity);
  const loggedDays = timeline.days.filter((day) => day.entryCount > 0).length;

  return {
    id: 'chart:coverage',
    kind: 'coverageCalendar',
    title: 'Logging coverage',
    caption: `Logged on ${loggedDays} of ${timeline.days.length} days. Darker means higher average severity; blank means nothing logged.`,
    labels: timeline.days.map((day) => day.label),
    series: [{ label: 'Average severity', color: '#7C6BD6', values }],
    yMax: 10,
    table: {
      headers: ['Date', 'Entries', 'Average severity', 'Symptoms'],
      rows: timeline.days.map((day) => [
        day.label,
        `${day.entryCount}`,
        day.avgSeverity === null ? '—' : oneDecimal(day.avgSeverity),
        day.symptomLabels.length > 0 ? day.symptomLabels.join(', ') : '—',
      ]),
    },
    entryIds: [],
    accessibilityLabel:
      `Coverage grid showing ${loggedDays} logged days out of ${timeline.days.length}. ` +
      `Day-by-day values are in the data table below.`,
  };
}

/* ------------------------ Severity distribution ---------------------- */

/**
 * How often each severity level was recorded, for the most-logged
 * symptom.
 *
 * Worth its own chart because an average conceals shape. "Averages
 * 5/10" describes both someone steadily at 5 and someone alternating
 * between 1 and 9, and those are entirely different clinical
 * pictures.
 */
export function buildDistributionChart(events: HealthEvent[]): ChartSpec | null {
  const groups = [...groupBySymptom(events).entries()];
  if (groups.length === 0) return null;

  const [, groupEvents] = groups[0];
  if (groupEvents.length < 5) return null;

  const label = groupEvents[0].symptomLabel;
  const counts = new Array(11).fill(0) as number[];
  for (const event of groupEvents) {
    const bucket = Math.max(0, Math.min(10, Math.round(event.severity)));
    counts[bucket] += 1;
  }

  const total = groupEvents.length;
  const severities = groupEvents.map((event) => event.severity);

  return {
    id: 'chart:distribution',
    kind: 'severityDistribution',
    title: `How severe ${label.toLowerCase()} was`,
    caption: `${total} readings, typically ${oneDecimal(median(severities))}/10. Height is how many readings landed at each level.`,
    labels: counts.map((_, index) => `${index}`),
    series: [{ label, color: colorFor(0), values: counts }],
    yMax: Math.max(...counts),
    table: {
      headers: ['Severity', 'Readings', 'Share'],
      rows: counts
        .map((count, index) => [
          `${index}/10`,
          `${count}`,
          count === 0 ? '—' : `${Math.round((count / total) * 100)}%`,
        ])
        .filter((row) => row[1] !== '0'),
      note: 'Severity levels that were never recorded are omitted.',
    },
    entryIds: groupEvents.map((event) => event.entryId),
    accessibilityLabel:
      `Bar chart of how often each severity level from 0 to 10 was recorded for ` +
      `${label}, across ${total} readings. Counts are in the data table below.`,
  };
}

/* -------------------------- Symptom frequency ------------------------ */

export function buildFrequencyChart(events: HealthEvent[]): ChartSpec | null {
  const groups = [...groupBySymptom(events).entries()];
  if (groups.length < 2) return null;

  const rows = groups.slice(0, 6).map(([, groupEvents], index) => ({
    label: groupEvents[0].symptomLabel,
    days: distinctDayKeys(groupEvents).length,
    entries: groupEvents.length,
    median: median(groupEvents.map((event) => event.severity)),
    color: colorFor(index),
  }));

  return {
    id: 'chart:frequency',
    kind: 'symptomFrequency',
    title: 'How often each symptom appeared',
    caption: 'Number of days each symptom was recorded in this period.',
    labels: rows.map((row) => row.label),
    series: [
      {
        label: 'Days recorded',
        color: colorFor(0),
        values: rows.map((row) => row.days),
      },
    ],
    yMax: Math.max(...rows.map((row) => row.days)),
    table: {
      headers: ['Symptom', 'Days', 'Readings', 'Typical severity'],
      rows: rows.map((row) => [
        row.label,
        `${row.days}`,
        `${row.entries}`,
        `${oneDecimal(row.median)}/10`,
      ]),
    },
    entryIds: groups.slice(0, 6).flatMap(([, groupEvents]) =>
      groupEvents.map((event) => event.entryId),
    ),
    accessibilityLabel:
      `Bar chart comparing how many days each of ${rows.length} symptoms was recorded. ` +
      `Values are in the data table below.`,
  };
}

/* --------------------------- Factor contrast ------------------------- */

/**
 * What changed after each recorded factor, against what changed
 * without it.
 *
 * A diverging bar: negative means severity fell FURTHER than usual in
 * the readings that followed. This is the only chart that plots a
 * derived comparison rather than raw readings, so its caption is
 * explicit that it shows an association in self-reported data — the
 * same wording constraint the text sections operate under.
 */
export function buildFactorChart(
  factorFindings: Finding[],
  /** id -> display name, so medication findings don't plot a raw id. */
  medicationNames: Map<string, string> = new Map(),
): ChartSpec | null {
  const usable = factorFindings
    .filter((finding) => typeof finding.facts.contrast === 'number')
    .slice(0, 6);
  if (usable.length < 2) return null;

  const rows = usable.map((finding) => ({
    // Medication findings carry the medication ID as their factor —
    // fine for the text realizer, which maps it, but it would plot a
    // database id on a chart a doctor reads.
    label: medicationNames.get(`${finding.facts.factor}`) ?? `${finding.facts.factor}`,
    symptom: finding.symptomLabel ?? '',
    contrast: Number(finding.facts.contrast),
    withCount: Number(finding.facts.withCount ?? 0),
    withoutCount: Number(finding.facts.withoutCount ?? 0),
  }));

  const magnitude = Math.max(...rows.map((row) => Math.abs(row.contrast)), 1);

  return {
    id: 'chart:factors',
    kind: 'factorContrast',
    title: 'What changed after each factor',
    caption:
      'Bars left of centre: severity fell further than it did otherwise. These are associations in self-reported entries, not established relationships.',
    labels: rows.map((row) => row.label),
    series: [
      {
        label: 'Difference in severity change',
        color: colorFor(0),
        values: rows.map((row) => row.contrast),
      },
    ],
    yMax: Math.ceil(magnitude),
    table: {
      headers: ['Factor', 'Symptom', 'Difference', 'With', 'Without'],
      rows: rows.map((row) => [
        row.label,
        row.symptom,
        `${row.contrast >= 0 ? '+' : ''}${oneDecimal(row.contrast)} points`,
        `${row.withCount}`,
        `${row.withoutCount}`,
      ]),
      note: '"With" and "Without" are the number of paired readings behind each comparison.',
    },
    entryIds: usable.flatMap((finding) => finding.entryIds),
    accessibilityLabel:
      `Diverging bar chart comparing ${rows.length} recorded factors by how much ` +
      `severity changed after each. Values are in the data table below.`,
  };
}

/* ------------------------------ Assembly ----------------------------- */

/**
 * Builds every chart the data supports, in reading order. Charts that
 * would rest on too little data return null upstream and simply do
 * not appear — an empty or two-point chart implies a pattern that
 * isn't there.
 */
export function buildStoryCharts(
  events: HealthEvent[],
  timeline: Timeline,
  factorFindings: Finding[],
  medicationNames: Map<string, string> = new Map(),
): ChartSpec[] {
  return [
    buildSeverityTrendChart(events, timeline),
    buildCoverageChart(timeline),
    buildDistributionChart(events),
    buildFrequencyChart(events),
    buildFactorChart(factorFindings, medicationNames),
  ].filter((spec): spec is ChartSpec => spec !== null);
}
