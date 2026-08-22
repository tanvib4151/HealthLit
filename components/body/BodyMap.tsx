import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { BODY_REGIONS, getRegionLabel } from '../../utils/bodyRegions';
import { useTheme } from '../../hooks/useTheme';

interface BodyMapProps {
  /** Selected region ids. */
  selected: string[];
  onToggle: (regionId: string) => void;
}

interface RegionShape {
  id: string;
  kind: 'circle' | 'rect';
  // circle
  cx?: number;
  cy?: number;
  r?: number;
  // rect
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rx?: number;
}

/**
 * Simplified front-view figure. Deliberately abstract (calm, clinical)
 * rather than anatomical. Mirror convention: the figure's left is the
 * user's left.
 */
const SHAPES: RegionShape[] = [
  { id: 'head', kind: 'circle', cx: 100, cy: 38, r: 22 },
  { id: 'neck', kind: 'rect', x: 91, y: 60, w: 18, h: 14, rx: 5 },
  { id: 'shoulder_left', kind: 'rect', x: 50, y: 76, w: 26, h: 18, rx: 9 },
  { id: 'shoulder_right', kind: 'rect', x: 124, y: 76, w: 26, h: 18, rx: 9 },
  { id: 'chest', kind: 'rect', x: 74, y: 76, w: 52, h: 52, rx: 14 },
  { id: 'arm_left', kind: 'rect', x: 46, y: 96, w: 18, h: 88, rx: 9 },
  { id: 'arm_right', kind: 'rect', x: 136, y: 96, w: 18, h: 88, rx: 9 },
  { id: 'abdomen', kind: 'rect', x: 76, y: 130, w: 48, h: 46, rx: 12 },
  { id: 'pelvis', kind: 'rect', x: 74, y: 178, w: 52, h: 30, rx: 12 },
  { id: 'leg_left', kind: 'rect', x: 76, y: 210, w: 21, h: 108, rx: 10 },
  { id: 'leg_right', kind: 'rect', x: 103, y: 210, w: 21, h: 108, rx: 10 },
  { id: 'foot_left', kind: 'rect', x: 70, y: 320, w: 28, h: 14, rx: 6 },
  { id: 'foot_right', kind: 'rect', x: 102, y: 320, w: 28, h: 14, rx: 6 },
];

export function BodyMap({ selected, onToggle }: BodyMapProps) {
  const theme = useTheme();
  const selectedLabels = selected.map(getRegionLabel).join(', ');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: theme.spacing.md,
        },
        hint: {
          ...theme.typography.caption,
          textAlign: 'center',
        },
        selectedText: {
          ...theme.typography.bodySecondary,
          fontWeight: '600' as const,
          color: theme.colors.primary,
          textAlign: 'center',
        },
        chipWrap: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          justifyContent: 'center',
        },
        regionChip: {
          ...theme.typography.caption,
          color: theme.colors.inkSecondary,
          backgroundColor: theme.colors.surface,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          overflow: 'hidden' as const,
        },
        regionChipSelected: {
          color: theme.colors.onPrimary,
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primary,
        },
      }),
    [theme],
  );

  return (
    <View style={styles.container}>
      <View
        accessible
        accessibilityLabel={
          selected.length > 0
            ? `Body map. Selected: ${selectedLabels}`
            : 'Body map. Nothing selected yet.'
        }
      >
        <Svg width="100%" height={300} viewBox="0 0 200 344">
          {SHAPES.map((shape) => {
            const isSelected = selected.includes(shape.id);
            const fill = isSelected
              ? theme.colors.primary
              : theme.colors.surfaceMuted;
            const stroke = isSelected
              ? theme.colors.primaryPressed
              : theme.colors.border;
            // react-native-svg's onPress on individual shapes crashes on
            // web (a known gap in its web compatibility layer). Every
            // region is already fully selectable via the chip list below
            // regardless, so on web the diagram is just visual and the
            // chips are the real control — no loss of functionality,
            // just a different input path on that one platform.
            const pressHandler =
              Platform.OS === 'web' ? undefined : () => onToggle(shape.id);

            if (shape.kind === 'circle') {
              return (
                <Circle
                  key={shape.id}
                  cx={shape.cx}
                  cy={shape.cy}
                  r={shape.r}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1.5}
                  onPress={pressHandler}
                />
              );
            }
            return (
              <Rect
                key={shape.id}
                x={shape.x}
                y={shape.y}
                width={shape.w}
                height={shape.h}
                rx={shape.rx}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.5}
                onPress={pressHandler}
              />
            );
          })}
        </Svg>
      </View>

      <Text style={styles.hint}>
        Mirror view — the figure's left is your left.{' '}
        {Platform.OS === 'web'
          ? 'Select all areas that apply from the list below.'
          : 'Tap all areas that apply, or use the list below.'}
      </Text>

      {/* Text fallback keeps selection reviewable for screen readers. */}
      {selected.length > 0 ? (
        <Text style={styles.selectedText}>Selected: {selectedLabels}</Text>
      ) : null}

      {/* Chip list mirrors the map so every region is reachable without
          precise tapping — important for reduced motor control. */}
      <View style={styles.chipWrap}>
        {BODY_REGIONS.map((region) => {
          const isSelected = selected.includes(region.id);
          return (
            <Text
              key={region.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onToggle(region.id)}
              style={[styles.regionChip, isSelected && styles.regionChipSelected]}
            >
              {region.label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}
