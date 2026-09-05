import React, { useMemo } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { getRegionLabel } from '../../utils/bodyRegions';
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
  /** Extra touch padding in viewBox units. */
  hitPadX?: number;
  hitPadY?: number;
  /** Higher priority wins where neighboring hit zones overlap. */
  priority?: number;
}

/**
 * Simplified front-view figure. Deliberately abstract (calm, clinical)
 * rather than anatomical. Mirror convention: the figure's left is the
 * user's left.
 */
const VIEW_W = 200;
const VIEW_H = 344;
const SVG_H = 340;

/**
 * Visual shapes stay compact, while explicit hit padding makes the
 * interaction forgiving. Priority is especially important around the
 * neck/chest, shoulders/arms, and feet/legs, where larger hit areas
 * naturally overlap.
 */
const SHAPES: RegionShape[] = [
  { id: 'head', kind: 'circle', cx: 100, cy: 38, r: 22, hitPadX: 7, hitPadY: 7, priority: 7 },
  { id: 'neck', kind: 'rect', x: 91, y: 60, w: 18, h: 14, rx: 5, hitPadX: 10, hitPadY: 7, priority: 10 },
  { id: 'shoulder_left', kind: 'rect', x: 50, y: 76, w: 26, h: 18, rx: 9, hitPadX: 8, hitPadY: 7, priority: 9 },
  { id: 'shoulder_right', kind: 'rect', x: 124, y: 76, w: 26, h: 18, rx: 9, hitPadX: 8, hitPadY: 7, priority: 9 },
  { id: 'chest', kind: 'rect', x: 74, y: 76, w: 52, h: 52, rx: 14, hitPadX: 5, hitPadY: 5, priority: 5 },
  { id: 'arm_left', kind: 'rect', x: 46, y: 96, w: 18, h: 88, rx: 9, hitPadX: 10, hitPadY: 4, priority: 8 },
  { id: 'arm_right', kind: 'rect', x: 136, y: 96, w: 18, h: 88, rx: 9, hitPadX: 10, hitPadY: 4, priority: 8 },
  { id: 'abdomen', kind: 'rect', x: 76, y: 130, w: 48, h: 46, rx: 12, hitPadX: 5, hitPadY: 5, priority: 6 },
  { id: 'pelvis', kind: 'rect', x: 74, y: 178, w: 52, h: 30, rx: 12, hitPadX: 6, hitPadY: 6, priority: 7 },
  { id: 'leg_left', kind: 'rect', x: 76, y: 210, w: 21, h: 108, rx: 10, hitPadX: 9, hitPadY: 3, priority: 6 },
  { id: 'leg_right', kind: 'rect', x: 103, y: 210, w: 21, h: 108, rx: 10, hitPadX: 9, hitPadY: 3, priority: 6 },
  { id: 'foot_left', kind: 'rect', x: 70, y: 320, w: 28, h: 14, rx: 6, hitPadX: 8, hitPadY: 10, priority: 10 },
  { id: 'foot_right', kind: 'rect', x: 102, y: 320, w: 28, h: 14, rx: 6, hitPadX: 8, hitPadY: 10, priority: 10 },
];

export function BodyMap({ selected, onToggle }: BodyMapProps) {
  const theme = useTheme();
  const selectedLabels = selected.map(getRegionLabel).join(', ');
  const [width, setWidth] = React.useState(0);

  // The SVG scales its viewBox using xMidYMid meet. Reproduce that
  // transform for the plain React Native Pressables placed over it.
  const scale = Math.min(width / VIEW_W, SVG_H / VIEW_H);
  const offsetX = (width - VIEW_W * scale) / 2;
  const offsetY = (SVG_H - VIEW_H * scale) / 2;

  const boxFor = (shape: RegionShape) => {
    const rawX = shape.kind === 'circle' ? (shape.cx ?? 0) - (shape.r ?? 0) : shape.x ?? 0;
    const rawY = shape.kind === 'circle' ? (shape.cy ?? 0) - (shape.r ?? 0) : shape.y ?? 0;
    const rawW = shape.kind === 'circle' ? (shape.r ?? 0) * 2 : shape.w ?? 0;
    const rawH = shape.kind === 'circle' ? (shape.r ?? 0) * 2 : shape.h ?? 0;
    const padX = shape.hitPadX ?? 0;
    const padY = shape.hitPadY ?? 0;

    return {
      left: offsetX + (rawX - padX) * scale,
      top: offsetY + (rawY - padY) * scale,
      width: (rawW + padX * 2) * scale,
      height: (rawH + padY * 2) * scale,
      zIndex: shape.priority ?? 1,
    };
  };

  const styles = useMemo(
    () => StyleSheet.create({
      container: { gap: theme.spacing.md },
      diagramWrap: {
        position: 'relative' as const,
        minHeight: SVG_H,
      },
      hitTarget: {
        position: 'absolute' as const,
        backgroundColor: 'transparent',
      },
      hint: {
        ...theme.typography.caption,
        textAlign: 'center' as const,
      },
      selectedText: {
        ...theme.typography.bodySecondary,
        fontFamily: theme.fonts.semibold,
        color: theme.colors.primary,
        textAlign: 'center' as const,
      },
      emptyText: {
        ...theme.typography.bodySecondary,
        color: theme.colors.inkMuted,
        textAlign: 'center' as const,
      },
    }),
    [theme],
  );

  return (
    <View style={styles.container}>
      <View
        style={styles.diagramWrap}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        accessibilityLabel={
          selected.length > 0
            ? `Body map. Selected: ${selectedLabels}`
            : 'Body map. Nothing selected yet.'
        }
      >
        <Svg width="100%" height={SVG_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          {SHAPES.map((shape) => {
            const isSelected = selected.includes(shape.id);
            const fill = isSelected ? theme.colors.primary : theme.colors.surfaceMuted;
            const stroke = isSelected ? theme.colors.primaryPressed : theme.colors.border;
            const strokeWidth = isSelected ? 2.5 : 1.5;

            if (shape.kind === 'circle') {
              return (
                <Circle
                  key={shape.id}
                  cx={shape.cx}
                  cy={shape.cy}
                  r={shape.r}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
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
                strokeWidth={strokeWidth}
              />
            );
          })}
        </Svg>

        {width > 0 &&
          SHAPES.map((shape) => {
            const isSelected = selected.includes(shape.id);
            return (
              <Pressable
                key={`hit-${shape.id}`}
                onPress={() => onToggle(shape.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${getRegionLabel(shape.id)}${isSelected ? ', selected' : ''}`}
                accessibilityHint={isSelected ? 'Double tap to remove this area' : 'Double tap to select this area'}
                style={[styles.hitTarget, boxFor(shape)]}
              />
            );
          })}
      </View>

      <Text style={styles.hint}>
        Mirror view — the figure's left is your left. Tap every area that applies.
      </Text>

      {selected.length > 0 ? (
        <Text style={styles.selectedText}>Selected: {selectedLabels}</Text>
      ) : (
        <Text style={styles.emptyText}>No areas selected yet.</Text>
      )}
    </View>
  );
}
