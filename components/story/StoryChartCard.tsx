import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Polygon,
  Polyline,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '../ui/Card';
import { useTheme } from '../../hooks/useTheme';
import { ChartSpec } from '../../utils/storyCharts';
import { severityColor } from '../../utils/symptoms';

const CHART_HEIGHT = 170;
const PAD = { top: 14, right: 12, bottom: 24, left: 30 };

/**
 * Renders one chart spec, with its data table underneath.
 *
 * NO ENTRY ANIMATION. Charts do not draw themselves in, bars do not
 * grow, lines do not sweep. That is a deliberate rule for this app:
 * animated chart entry delays the moment the reader can actually read
 * the value, and this is clinical data being reviewed by someone who
 * may be unwell or in a hurry. Data over decoration.
 *
 * Every chart pairs with a table because a chart alone is not
 * accessible: VoiceOver cannot describe a polyline, and a printed
 * report may be photocopied to grey. The table is collapsed by
 * default so the visual stays uncluttered, and one tap away.
 */
export function StoryChartCard({
  spec,
  onInspect,
}: {
  spec: ChartSpec;
  onInspect?: (spec: ChartSpec) => void;
}) {
  const theme = useTheme();
  const [showTable, setShowTable] = useState(false);
  const [width, setWidth] = useState(0);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { gap: theme.spacing.md },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: theme.spacing.sm,
        },
        headerBody: { flex: 1, gap: 2 },
        title: { ...theme.typography.heading },
        caption: { ...theme.typography.caption, lineHeight: 18 },
        chartArea: { minHeight: CHART_HEIGHT },
        legendRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.md,
        },
        legendItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
        },
        legendSwatch: { width: 10, height: 10, borderRadius: 5 },
        legendLabel: { ...theme.typography.caption },
        toggleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          minHeight: 44,
        },
        toggleText: {
          ...theme.typography.caption,
          color: theme.colors.primary,
          fontFamily: theme.fonts.semibold,
        },
        table: { gap: 0 },
        tableHeaderRow: {
          flexDirection: 'row',
          borderBottomWidth: 1.5,
          borderBottomColor: theme.colors.ink,
          paddingBottom: theme.spacing.xs,
        },
        tableRow: {
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          paddingVertical: theme.spacing.sm,
        },
        cellHeader: {
          ...theme.typography.caption,
          fontFamily: theme.fonts.semibold,
          color: theme.colors.ink,
        },
        cell: { ...theme.typography.caption },
        tableNote: {
          ...theme.typography.caption,
          fontStyle: 'italic' as const,
          marginTop: theme.spacing.sm,
        },
      }),
    [theme],
  );

  const onLayout = (event: LayoutChangeEvent) =>
    setWidth(Math.round(event.nativeEvent.layout.width));

  // Column widths: first column wider (it holds labels), rest even.
  const columnCount = spec.table.headers.length;
  const flexFor = (index: number) => (index === 0 ? 1.6 : 1);

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerBody}>
          <Text style={styles.title}>{spec.title}</Text>
          <Text style={styles.caption}>{spec.caption}</Text>
        </View>
        {onInspect !== undefined && spec.entryIds.length > 0 && (
          <Pressable
            onPress={() => onInspect(spec)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`See the ${spec.entryIds.length} readings behind this chart`}
          >
            <Ionicons name="list-outline" size={20} color={theme.colors.primary} />
          </Pressable>
        )}
      </View>

      <View style={styles.chartArea} onLayout={onLayout} accessible
        accessibilityLabel={spec.accessibilityLabel}>
        {width > 0 && <ChartBody spec={spec} width={width} theme={theme} />}
      </View>

      {spec.series.length > 1 && (
        <View style={styles.legendRow}>
          {spec.series.map((series) => (
            <View key={series.label} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: series.color }]} />
              <Text style={styles.legendLabel}>{series.label}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        onPress={() => setShowTable((current) => !current)}
        style={styles.toggleRow}
        accessibilityRole="button"
        accessibilityState={{ expanded: showTable }}
        accessibilityLabel={showTable ? 'Hide the data table' : 'Show the data behind this chart'}
      >
        <Ionicons
          name={showTable ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.colors.primary}
        />
        <Text style={styles.toggleText}>
          {showTable ? 'Hide data' : `Show data (${spec.table.rows.length} rows)`}
        </Text>
      </Pressable>

      {showTable && (
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            {spec.table.headers.map((header, index) => (
              <Text
                key={header}
                style={[styles.cellHeader, { flex: flexFor(index) }]}
                numberOfLines={2}
              >
                {header}
              </Text>
            ))}
          </View>
          {spec.table.rows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.tableRow}>
              {row.slice(0, columnCount).map((cell, cellIndex) => (
                <Text key={cellIndex} style={[styles.cell, { flex: flexFor(cellIndex) }]}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}
          {spec.table.note !== undefined && (
            <Text style={styles.tableNote}>{spec.table.note}</Text>
          )}
        </View>
      )}
    </Card>
  );
}

/* ----------------------------- Renderers ----------------------------- */

function ChartBody({
  spec,
  width,
  theme,
}: {
  spec: ChartSpec;
  width: number;
  theme: ReturnType<typeof useTheme>;
}) {
  if (spec.kind === 'coverageCalendar') return <CoverageGrid spec={spec} theme={theme} />;
  if (spec.kind === 'factorContrast') {
    return <DivergingBars spec={spec} width={width} theme={theme} />;
  }
  if (spec.kind === 'severityDistribution' || spec.kind === 'symptomFrequency') {
    return <VerticalBars spec={spec} width={width} theme={theme} />;
  }
  return <LineChart spec={spec} width={width} theme={theme} />;
}

/** Multi-series line. Gaps break the line rather than plotting zero. */
function LineChart({
  spec,
  width,
  theme,
}: {
  spec: ChartSpec;
  width: number;
  theme: ReturnType<typeof useTheme>;
}) {
  const innerWidth = width - PAD.left - PAD.right;
  const innerHeight = CHART_HEIGHT - PAD.top - PAD.bottom;
  const count = spec.labels.length;

  const xAt = (index: number) =>
    count <= 1 ? PAD.left + innerWidth / 2 : PAD.left + (innerWidth * index) / (count - 1);
  const yAt = (value: number) => PAD.top + innerHeight * (1 - value / spec.yMax);

  const baselineY = PAD.top + innerHeight;

  return (
    <Svg width={width} height={CHART_HEIGHT}>
      <Defs>
        {/* A soft fade beneath each line. This is the single biggest
            visual difference between a plain polyline and a chart that
            looks designed — it gives the line weight and makes the
            area it covers legible at a glance, without adding a second
            color to read. */}
        {spec.series.map((series, seriesIndex) => (
          <LinearGradient
            key={series.label}
            id={`fill-${seriesIndex}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <Stop offset="0" stopColor={series.color} stopOpacity={0.22} />
            <Stop offset="1" stopColor={series.color} stopOpacity={0.01} />
          </LinearGradient>
        ))}
      </Defs>

      {/* HORIZONTAL gridlines only, and hairline-thin. Vertical grid
          adds ink without adding information on a time axis, and heavy
          grid competes with the data it is supposed to support. */}
      {[0, 5, 10].map((gridValue) => (
        <React.Fragment key={gridValue}>
          <Line
            x1={PAD.left}
            y1={yAt(gridValue)}
            x2={width - PAD.right}
            y2={yAt(gridValue)}
            stroke={theme.colors.border}
            strokeWidth={StyleSheet.hairlineWidth * 2}
          />
          <SvgText
            x={PAD.left - 7}
            y={yAt(gridValue) + 4}
            fontSize={10}
            fill={theme.colors.inkMuted}
            textAnchor="end"
          >
            {gridValue}
          </SvgText>
        </React.Fragment>
      ))}

      {spec.series.map((series, seriesIndex) => {
        // Split into runs of consecutive non-null values.
        const runs: { index: number; value: number }[][] = [];
        let run: { index: number; value: number }[] = [];
        series.values.forEach((value, index) => {
          if (value === null) {
            if (run.length > 0) runs.push(run);
            run = [];
          } else {
            run.push({ index, value });
          }
        });
        if (run.length > 0) runs.push(run);

        return (
          <React.Fragment key={series.label}>
            {runs.map((points, runIndex) => {
              if (points.length === 1) {
                return (
                  <Circle
                    key={runIndex}
                    cx={xAt(points[0].index)}
                    cy={yAt(points[0].value)}
                    r={3.5}
                    fill={series.color}
                  />
                );
              }

              const linePoints = points
                .map((p) => `${xAt(p.index)},${yAt(p.value)}`)
                .join(' ');
              // Close the shape down to the baseline so the gradient
              // has an area to fill, then trace back along the line.
              const areaPoints =
                `${xAt(points[0].index)},${baselineY} ` +
                linePoints +
                ` ${xAt(points[points.length - 1].index)},${baselineY}`;

              return (
                <React.Fragment key={runIndex}>
                  <Polygon points={areaPoints} fill={`url(#fill-${seriesIndex})`} />
                  <Polyline
                    points={linePoints}
                    fill="none"
                    stroke={series.color}
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {/* A marker on the most recent reading of each run —
                      the eye needs somewhere to land, and the latest
                      value is the one a reader looks for first. */}
                  <Circle
                    cx={xAt(points[points.length - 1].index)}
                    cy={yAt(points[points.length - 1].value)}
                    r={3.5}
                    fill={theme.colors.surface}
                    stroke={series.color}
                    strokeWidth={2.5}
                  />
                </React.Fragment>
              );
            })}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

/** Vertical bars for distribution and frequency. */
function VerticalBars({
  spec,
  width,
  theme,
}: {
  spec: ChartSpec;
  width: number;
  theme: ReturnType<typeof useTheme>;
}) {
  const innerWidth = width - PAD.left - PAD.right;
  const innerHeight = CHART_HEIGHT - PAD.top - PAD.bottom;
  const values = spec.series[0].values;
  const count = values.length;
  const slot = innerWidth / Math.max(count, 1);
  const barWidth = Math.max(4, slot * 0.62);
  const yMax = Math.max(spec.yMax, 1);

  return (
    <Svg width={width} height={CHART_HEIGHT}>
      {/* Faint track behind each bar, so short bars still read as
          "a small amount of something" rather than near-nothing
          floating above an empty baseline. */}
      {values.map((value, index) => {
        // Only where a value actually exists — a track on a zero
        // column implies data that was never recorded.
        if (value === null || value === 0) return null;
        return (
          <Rect
            key={`track-${index}`}
            x={PAD.left + slot * index + (slot - barWidth) / 2}
            y={PAD.top}
            width={barWidth}
            height={innerHeight}
            rx={4}
            fill={theme.colors.surfaceMuted}
            opacity={0.5}
          />
        );
      })}

      <Line
        x1={PAD.left}
        y1={PAD.top + innerHeight}
        x2={width - PAD.right}
        y2={PAD.top + innerHeight}
        stroke={theme.colors.border}
        strokeWidth={StyleSheet.hairlineWidth * 2}
      />

      {values.map((value, index) => {
        if (value === null || value === 0) return null;
        const height = innerHeight * (value / yMax);
        return (
          <React.Fragment key={index}>
            <Rect
              x={PAD.left + slot * index + (slot - barWidth) / 2}
              y={PAD.top + innerHeight - height}
              width={barWidth}
              height={height}
              rx={4}
              fill={
                // The distribution chart colours by severity level, so
                // the shape of someone's worst days is visible at a
                // glance rather than needing the axis read.
                spec.kind === 'severityDistribution'
                  ? severityColor(index)
                  : spec.series[0].color
              }
            />
            {/* Value printed above the bar — removes the need to
                measure a bar against an axis by eye, which is the
                slowest part of reading a bar chart. */}
            <SvgText
              x={PAD.left + slot * index + slot / 2}
              y={PAD.top + innerHeight - height - 5}
              fontSize={10}
              fill={theme.colors.inkSecondary}
              textAnchor="middle"
            >
              {value}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

/** Diverging bars around a centre line, for factor contrasts. */
function DivergingBars({
  spec,
  width,
  theme,
}: {
  spec: ChartSpec;
  width: number;
  theme: ReturnType<typeof useTheme>;
}) {
  const values = spec.series[0].values;
  const rowHeight = 30;
  const height = Math.max(CHART_HEIGHT, values.length * rowHeight + 20);
  const centreX = width / 2;
  const maxBar = width / 2 - 12;
  const scale = maxBar / Math.max(spec.yMax, 1);

  return (
    <Svg width={width} height={height}>
      <Line
        x1={centreX}
        y1={4}
        x2={centreX}
        y2={height - 4}
        stroke={theme.colors.border}
        strokeWidth={1.5}
      />
      {values.map((value, index) => {
        if (value === null) return null;
        const barLength = Math.abs(value) * scale;
        const improving = value < 0;
        return (
          <Rect
            key={index}
            x={improving ? centreX - barLength : centreX}
            y={index * rowHeight + 8}
            width={Math.max(barLength, 2)}
            height={rowHeight - 14}
            rx={3}
            fill={improving ? theme.colors.success : theme.colors.warning}
          />
        );
      })}
    </Svg>
  );
}

/**
 * Coverage grid — one small square per day, wrapped.
 *
 * Plain Views rather than SVG: this is a grid of rectangles, and
 * flexbox wrapping handles reflow across screen widths for free.
 */
function CoverageGrid({
  spec,
  theme,
}: {
  spec: ChartSpec;
  theme: ReturnType<typeof useTheme>;
}) {
  const values = spec.series[0].values;
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        paddingVertical: theme.spacing.sm,
      }}
    >
      {values.map((value, index) => (
        <View
          key={index}
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            backgroundColor:
              value === null ? theme.colors.surfaceMuted : severityColor(value),
            borderWidth: value === null ? 1 : 0,
            borderColor: theme.colors.border,
          }}
        />
      ))}
    </View>
  );
}

/** Horizontal scroller for a set of charts, used by the story screen. */
export function StoryChartList({
  specs,
  onInspect,
}: {
  specs: ChartSpec[];
  onInspect?: (spec: ChartSpec) => void;
}) {
  if (specs.length === 0) return null;
  return (
    <>
      {specs.map((spec) => (
        <StoryChartCard key={spec.id} spec={spec} onInspect={onInspect} />
      ))}
    </>
  );
}
