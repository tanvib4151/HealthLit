import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { getRegionLabel } from '../../utils/bodyRegions';
import { useTheme } from '../../hooks/useTheme';

interface BodyMapProps {
  selected: string[];
  onToggle: (regionId: string) => void;
}

type BodyView = 'front' | 'back';

type HitBox = { x: number; y: number; w: number; h: number; priority?: number };

type PathRegion = {
  id: string;
  kind: 'path';
  d: string;
  hit: HitBox;
};

type EllipseRegion = {
  id: string;
  kind: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  hit: HitBox;
};

type RegionShape = PathRegion | EllipseRegion;

const VIEW_W = 220;
const VIEW_H = 420;
const SVG_H = 390;

/**
 * Curved, connected-looking body regions. These are intentionally a
 * neutral clinical silhouette rather than a sex-specific body type.
 * Screen-left is always the user's left, in both Front and Back views.
 */
const FRONT_SHAPES: RegionShape[] = [
  { id: 'head', kind: 'ellipse', cx: 110, cy: 38, rx: 25, ry: 31, hit: { x: 80, y: 5, w: 60, h: 70, priority: 9 } },
  { id: 'neck', kind: 'path', d: 'M96 66 C98 78 96 83 91 88 L129 88 C124 83 122 78 124 66 Z', hit: { x: 88, y: 62, w: 44, h: 32, priority: 10 } },
  { id: 'shoulder_left', kind: 'path', d: 'M91 86 C77 86 64 88 52 95 C46 99 42 105 40 113 L72 118 C75 105 81 95 91 90 Z', hit: { x: 35, y: 82, w: 59, h: 43, priority: 9 } },
  { id: 'shoulder_right', kind: 'path', d: 'M129 86 C143 86 156 88 168 95 C174 99 178 105 180 113 L148 118 C145 105 139 95 129 90 Z', hit: { x: 126, y: 82, w: 59, h: 43, priority: 9 } },
  { id: 'chest', kind: 'path', d: 'M78 92 C88 88 98 87 110 87 C122 87 132 88 142 92 L148 119 C145 139 139 153 134 164 L86 164 C81 153 75 139 72 119 Z', hit: { x: 70, y: 90, w: 80, h: 78, priority: 7 } },
  { id: 'arm_left', kind: 'path', d: 'M42 108 C34 127 31 149 29 169 C27 191 24 212 20 231 C19 239 23 245 29 246 C36 247 40 242 42 234 C47 213 51 191 54 170 C57 151 62 133 69 118 Z', hit: { x: 16, y: 104, w: 55, h: 148, priority: 8 } },
  { id: 'arm_right', kind: 'path', d: 'M178 108 C186 127 189 149 191 169 C193 191 196 212 200 231 C201 239 197 245 191 246 C184 247 180 242 178 234 C173 213 169 191 166 170 C163 151 158 133 151 118 Z', hit: { x: 149, y: 104, w: 55, h: 148, priority: 8 } },
  { id: 'abdomen', kind: 'path', d: 'M86 164 L134 164 C132 181 131 198 134 215 C127 221 119 224 110 224 C101 224 93 221 86 215 C89 198 88 181 86 164 Z', hit: { x: 82, y: 160, w: 56, h: 70, priority: 7 } },
  { id: 'pelvis', kind: 'path', d: 'M86 215 C78 224 76 239 80 252 C87 261 97 266 110 266 C123 266 133 261 140 252 C144 239 142 224 134 215 C127 222 119 225 110 225 C101 225 93 222 86 215 Z', hit: { x: 76, y: 211, w: 68, h: 60, priority: 8 } },
  { id: 'leg_left', kind: 'path', d: 'M82 253 C77 278 76 303 78 327 C79 346 78 365 75 386 L99 386 C102 363 104 342 103 322 C102 299 104 278 108 264 C98 263 89 259 82 253 Z', hit: { x: 72, y: 250, w: 40, h: 142, priority: 7 } },
  { id: 'leg_right', kind: 'path', d: 'M138 253 C143 278 144 303 142 327 C141 346 142 365 145 386 L121 386 C118 363 116 342 117 322 C118 299 116 278 112 264 C122 263 131 259 138 253 Z', hit: { x: 108, y: 250, w: 40, h: 142, priority: 7 } },
  { id: 'foot_left', kind: 'path', d: 'M75 384 C70 391 66 397 66 402 C66 407 71 410 78 409 L101 407 L99 384 Z', hit: { x: 62, y: 378, w: 43, h: 38, priority: 10 } },
  { id: 'foot_right', kind: 'path', d: 'M145 384 C150 391 154 397 154 402 C154 407 149 410 142 409 L119 407 L121 384 Z', hit: { x: 115, y: 378, w: 43, h: 38, priority: 10 } },
];

const BACK_SHAPES: RegionShape[] = [
  { id: 'head', kind: 'ellipse', cx: 110, cy: 38, rx: 25, ry: 31, hit: { x: 80, y: 5, w: 60, h: 70, priority: 9 } },
  { id: 'neck', kind: 'path', d: 'M96 66 C98 78 96 83 91 88 L129 88 C124 83 122 78 124 66 Z', hit: { x: 88, y: 62, w: 44, h: 32, priority: 10 } },
  { id: 'shoulder_left', kind: 'path', d: 'M91 86 C77 86 64 88 52 95 C46 99 42 105 40 113 L72 118 C75 105 81 95 91 90 Z', hit: { x: 35, y: 82, w: 59, h: 43, priority: 9 } },
  { id: 'shoulder_right', kind: 'path', d: 'M129 86 C143 86 156 88 168 95 C174 99 178 105 180 113 L148 118 C145 105 139 95 129 90 Z', hit: { x: 126, y: 82, w: 59, h: 43, priority: 9 } },
  { id: 'upper_back', kind: 'path', d: 'M78 92 C88 88 98 87 110 87 C122 87 132 88 142 92 L148 119 C145 139 139 153 134 164 L86 164 C81 153 75 139 72 119 Z', hit: { x: 70, y: 90, w: 80, h: 78, priority: 7 } },
  { id: 'arm_left', kind: 'path', d: 'M42 108 C34 127 31 149 29 169 C27 191 24 212 20 231 C19 239 23 245 29 246 C36 247 40 242 42 234 C47 213 51 191 54 170 C57 151 62 133 69 118 Z', hit: { x: 16, y: 104, w: 55, h: 148, priority: 8 } },
  { id: 'arm_right', kind: 'path', d: 'M178 108 C186 127 189 149 191 169 C193 191 196 212 200 231 C201 239 197 245 191 246 C184 247 180 242 178 234 C173 213 169 191 166 170 C163 151 158 133 151 118 Z', hit: { x: 149, y: 104, w: 55, h: 148, priority: 8 } },
  { id: 'lower_back', kind: 'path', d: 'M86 164 L134 164 C132 181 131 198 134 215 C127 221 119 224 110 224 C101 224 93 221 86 215 C89 198 88 181 86 164 Z', hit: { x: 82, y: 160, w: 56, h: 70, priority: 7 } },
  { id: 'pelvis', kind: 'path', d: 'M86 215 C78 224 76 239 80 252 C87 261 97 266 110 266 C123 266 133 261 140 252 C144 239 142 224 134 215 C127 222 119 225 110 225 C101 225 93 222 86 215 Z', hit: { x: 76, y: 211, w: 68, h: 60, priority: 8 } },
  { id: 'leg_left', kind: 'path', d: 'M82 253 C77 278 76 303 78 327 C79 346 78 365 75 386 L99 386 C102 363 104 342 103 322 C102 299 104 278 108 264 C98 263 89 259 82 253 Z', hit: { x: 72, y: 250, w: 40, h: 142, priority: 7 } },
  { id: 'leg_right', kind: 'path', d: 'M138 253 C143 278 144 303 142 327 C141 346 142 365 145 386 L121 386 C118 363 116 342 117 322 C118 299 116 278 112 264 C122 263 131 259 138 253 Z', hit: { x: 108, y: 250, w: 40, h: 142, priority: 7 } },
  { id: 'foot_left', kind: 'path', d: 'M75 384 C70 391 66 397 66 402 C66 407 71 410 78 409 L101 407 L99 384 Z', hit: { x: 62, y: 378, w: 43, h: 38, priority: 10 } },
  { id: 'foot_right', kind: 'path', d: 'M145 384 C150 391 154 397 154 402 C154 407 149 410 142 409 L119 407 L121 384 Z', hit: { x: 115, y: 378, w: 43, h: 38, priority: 10 } },
];

export function BodyMap({ selected, onToggle }: BodyMapProps) {
  const theme = useTheme();
  const [view, setView] = useState<BodyView>('front');
  const [width, setWidth] = useState(0);
  const shapes = view === 'front' ? FRONT_SHAPES : BACK_SHAPES;
  const selectedLabels = selected.map(getRegionLabel).join(', ');

  const scale = Math.min(width / VIEW_W, SVG_H / VIEW_H);
  const offsetX = (width - VIEW_W * scale) / 2;
  const offsetY = (SVG_H - VIEW_H * scale) / 2;

  const boxFor = (hit: HitBox) => ({
    left: offsetX + hit.x * scale,
    top: offsetY + hit.y * scale,
    width: hit.w * scale,
    height: hit.h * scale,
    zIndex: hit.priority ?? 1,
  });

  const styles = useMemo(
    () => StyleSheet.create({
      container: { gap: theme.spacing.md },
      toggle: {
        flexDirection: 'row' as const,
        alignSelf: 'center' as const,
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: theme.radius.pill,
        padding: 4,
        gap: 4,
      },
      toggleButton: {
        minWidth: 92,
        minHeight: 40,
        paddingHorizontal: theme.spacing.lg,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        borderRadius: theme.radius.pill,
      },
      toggleButtonSelected: { backgroundColor: theme.colors.primary },
      toggleText: { ...theme.typography.caption, fontFamily: theme.fonts.semibold, color: theme.colors.inkSecondary },
      toggleTextSelected: { color: theme.colors.onPrimary },
      diagramWrap: { position: 'relative' as const, minHeight: SVG_H },
      hitTarget: { position: 'absolute' as const, backgroundColor: 'transparent' },
      hint: { ...theme.typography.caption, textAlign: 'center' as const },
      selectedText: {
        ...theme.typography.bodySecondary,
        fontFamily: theme.fonts.semibold,
        color: theme.colors.primary,
        textAlign: 'center' as const,
      },
      emptyText: { ...theme.typography.bodySecondary, color: theme.colors.inkMuted, textAlign: 'center' as const },
    }),
    [theme],
  );

  return (
    <View style={styles.container}>
      <View style={styles.toggle} accessibilityRole="tablist">
        {(['front', 'back'] as const).map((option) => {
          const active = view === option;
          const label = option === 'front' ? 'Front' : 'Back';
          return (
            <Pressable
              key={option}
              onPress={() => setView(option)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label} body view`}
              style={[styles.toggleButton, active && styles.toggleButtonSelected]}
            >
              <Text style={[styles.toggleText, active && styles.toggleTextSelected]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={styles.diagramWrap}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        accessibilityLabel={
          selected.length > 0
            ? `${view} body map. Selected: ${selectedLabels}`
            : `${view} body map. Nothing selected yet.`
        }
      >
        <Svg width="100%" height={SVG_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          {shapes.map((shape) => {
            const isSelected = selected.includes(shape.id);
            const fill = isSelected ? theme.colors.primary : theme.colors.surfaceMuted;
            const stroke = isSelected ? theme.colors.primaryPressed : theme.colors.border;
            const strokeWidth = isSelected ? 2.8 : 1.4;

            if (shape.kind === 'ellipse') {
              return (
                <Ellipse
                  key={`${view}-${shape.id}`}
                  cx={shape.cx}
                  cy={shape.cy}
                  rx={shape.rx}
                  ry={shape.ry}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                />
              );
            }

            return (
              <Path
                key={`${view}-${shape.id}`}
                d={shape.d}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
              />
            );
          })}
        </Svg>

        {width > 0 && shapes.map((shape) => {
          const isSelected = selected.includes(shape.id);
          return (
            <Pressable
              key={`hit-${view}-${shape.id}`}
              onPress={() => onToggle(shape.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${getRegionLabel(shape.id)}${isSelected ? ', selected' : ''}`}
              accessibilityHint={isSelected ? 'Double tap to remove this area' : 'Double tap to select this area'}
              style={[styles.hitTarget, boxFor(shape.hit)]}
            />
          );
        })}
      </View>

      <Text style={styles.hint}>
        Tap every area that applies. Switch between Front and Back for the other side of your body.
      </Text>

      {selected.length > 0 ? (
        <Text style={styles.selectedText}>Selected: {selectedLabels}</Text>
      ) : (
        <Text style={styles.emptyText}>No areas selected yet.</Text>
      )}
    </View>
  );
}
