import React, { useMemo } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
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
/** viewBox dimensions — overlay positions are computed against these. */
const VIEW_W = 200;
const VIEW_H = 344;
/** Rendered height of the SVG, fixed. */
const SVG_H = 300;
/** Apple/Android minimum comfortable touch target. */
const MIN_TOUCH = 44;

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
  // Measured so the tap overlays can be positioned over the rendered
  // SVG. Zero until first layout, which is why overlays render only
  // once a real width is known.
  const [width, setWidth] = React.useState(0);

  // The SVG scales its 200x344 viewBox to fit a 100%-wide, 300-tall
  // box using the default preserveAspectRatio (xMidYMid meet), so the
  // content is letterboxed horizontally and centred. Reproducing that
  // transform here is what lets a plain View sit exactly on top of a
  // drawn shape.
  const scale = Math.min(width / VIEW_W, SVG_H / VIEW_H);
  const offsetX = (width - VIEW_W * scale) / 2;
  const offsetY = (SVG_H - VIEW_H * scale) / 2;

  /** Bounding box of a shape, in rendered pixels. */
  const boxFor = (shape: RegionShape) => {
    const vx = shape.kind === 'circle' ? (shape.cx ?? 0) - (shape.r ?? 0) : shape.x ?? 0;
    const vy = shape.kind === 'circle' ? (shape.cy ?? 0) - (shape.r ?? 0) : shape.y ?? 0;
    const vw = shape.kind === 'circle' ? (shape.r ?? 0) * 2 : shape.w ?? 0;
    const vh = shape.kind === 'circle' ? (shape.r ?? 0) * 2 : shape.h ?? 0;
    return {
      left: offsetX + vx * scale,
      top: offsetY + vy * scale,
      width: vw * scale,
      height: vh * scale,
    };
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: theme.spacing.md,
        },
        diagramWrap: {
          position: 'relative' as const,
        },
        hitTarget: {
          position: 'absolute' as const,
          // Invisible: the SVG underneath already shows selection
          // state. This layer exists purely to receive taps.
          backgroundColor: 'transparent',
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
        style={styles.diagramWrap}
        onLayout={(event: LayoutChangeEvent) =>
          setWidth(event.nativeEvent.layout.width)
        }
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
              />
            );
          })}
        </Svg>

        {/* TAP TARGETS.
            Plain Pressables positioned over the drawn shapes, rather
            than onPress handlers on the SVG elements themselves.
            react-native-svg's per-shape press handling is unreliable
            on web, which previously left the diagram decorative there
            and forced people onto the chip list. A View overlay
            behaves identically on iOS, Android and web because it
            never touches SVG event handling at all.

            Rendered smallest-first so that a small region sitting
            inside a larger one — the neck over the chest, a foot over
            a leg — receives the tap rather than the region behind it. */}
        {width > 0 &&
          [...SHAPES]
            .sort((a, b) => {
              const areaOf = (shape: RegionShape) =>
                shape.kind === 'circle'
                  ? Math.PI * (shape.r ?? 0) ** 2
                  : (shape.w ?? 0) * (shape.h ?? 0);
              return areaOf(b) - areaOf(a);
            })
            .map((shape) => {
              const box = boxFor(shape);
              // Small regions get hitSlop rather than an inflated box,
              // so the touch target reaches the 44pt minimum without
              // the visible overlay growing and stealing taps from a
              // neighbour.
              const slopX = Math.max(0, (MIN_TOUCH - box.width) / 2);
              const slopY = Math.max(0, (MIN_TOUCH - box.height) / 2);
              const isSelected = selected.includes(shape.id);

              return (
                <Pressable
                  key={`hit-${shape.id}`}
                  onPress={() => onToggle(shape.id)}
                  hitSlop={{ top: slopY, bottom: slopY, left: slopX, right: slopX }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={getRegionLabel(shape.id)}
                  style={[styles.hitTarget, box]}
                />
              );
            })}
      </View>

      <Text style={styles.hint}>
        Mirror view — the figure's left is your left.{' '}
        Tap all areas that apply, or use the list below.
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
