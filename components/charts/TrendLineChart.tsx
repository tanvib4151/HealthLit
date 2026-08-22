import React, { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { useTheme } from '../../hooks/useTheme';

interface TrendLineChartProps {
  /** One value per day, oldest → newest. null = gap (no entry). */
  values: (number | null)[];
  /** Axis label per value; '' renders no label at that position. */
  labels: string[];
  height?: number;
  /** Y-axis maximum (severity scale is 0–10). */
  yMax?: number;
  accessibilityLabel?: string;
}

const PAD = { top: 12, right: 12, bottom: 24, left: 30 };
const GRID_VALUES = [0, 5, 10];

/**
 * Lightweight severity-over-time line chart on react-native-svg
 * (Figma: 7-Day Pain Trend). Days without entries render as gaps in
 * the line rather than fake zeros — missing data is not "no pain".
 *
 * Deliberately purpose-built instead of a charting library: current
 * Victory Native requires Skia + Reanimated (heavy, unreliable on
 * Expo web), and this stays fully under our control. If a library is
 * ever wanted, it swaps inside this one component.
 */
export function TrendLineChart({
  values,
  labels,
  height = 180,
  yMax = 10,
  accessibilityLabel,
}: TrendLineChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(Math.round(event.nativeEvent.layout.width));
  };

  const innerWidth = width - PAD.left - PAD.right;
  const innerHeight = height - PAD.top - PAD.bottom;
  const count = values.length;

  const xAt = (index: number): number =>
    count <= 1
      ? PAD.left + innerWidth / 2
      : PAD.left + (innerWidth * index) / (count - 1);

  const yAt = (value: number): number =>
    PAD.top + innerHeight * (1 - value / yMax);

  // Consecutive non-null runs become line segments; gaps break the line.
  const segments: { index: number; value: number }[][] = [];
  let run: { index: number; value: number }[] = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (run.length > 0) segments.push(run);
      run = [];
      return;
    }
    run.push({ index, value });
  });
  if (run.length > 0) segments.push(run);

  const dotRadius = count > 14 ? 3 : 4.5;

  return (
    <View
      onLayout={onLayout}
      style={{ height }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? 'Severity trend chart'}
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          {GRID_VALUES.filter((value) => value <= yMax).map((value) => (
            <React.Fragment key={`grid-${value}`}>
              <Line
                x1={PAD.left}
                y1={yAt(value)}
                x2={width - PAD.right}
                y2={yAt(value)}
                stroke={theme.colors.border}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <SvgText
                x={PAD.left - 8}
                y={yAt(value) + 3.5}
                fontSize={10}
                fill={theme.colors.inkMuted}
                textAnchor="end"
              >
                {value}
              </SvgText>
            </React.Fragment>
          ))}

          {segments.map((segment, segmentIndex) =>
            segment.length > 1 ? (
              <Polyline
                key={`line-${segmentIndex}`}
                points={segment
                  .map((point) => `${xAt(point.index)},${yAt(point.value)}`)
                  .join(' ')}
                fill="none"
                stroke={theme.colors.primary}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null,
          )}

          {segments.flat().map((point) => (
            <Circle
              key={`dot-${point.index}`}
              cx={xAt(point.index)}
              cy={yAt(point.value)}
              r={dotRadius}
              fill={theme.colors.primary}
              stroke={theme.colors.surface}
              strokeWidth={1.5}
            />
          ))}

          {labels.map((label, index) =>
            label !== '' ? (
              <SvgText
                key={`label-${index}`}
                x={xAt(index)}
                y={height - 8}
                fontSize={10}
                fill={theme.colors.inkMuted}
                textAnchor="middle"
              >
                {label}
              </SvgText>
            ) : null,
          )}
        </Svg>
      )}
    </View>
  );
}
