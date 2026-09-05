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
type PathRegion = { id: string; kind: 'path'; d: string; hit: HitBox };
type EllipseRegion = { id: string; kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; hit: HitBox };
type RegionShape = PathRegion | EllipseRegion;

const VIEW_W = 240;
const VIEW_H = 460;
const SVG_H = 420;

/**
 * Detailed but still neutral clinical body map. The paths are intentionally
 * smooth and human-shaped rather than anatomically diagnostic illustrations.
 * Screen-left is always the user's left.
 */
const FRONT_SHAPES: RegionShape[] = [
  { id: 'head', kind: 'path', d: 'M96 43 C96 20 106 8 120 8 C134 8 144 20 144 43 C144 56 139 68 132 75 L108 75 C101 68 96 56 96 43 Z', hit: { x: 91, y: 4, w: 58, h: 76, priority: 8 } },
  { id: 'face', kind: 'ellipse', cx: 120, cy: 48, rx: 18, ry: 23, hit: { x: 100, y: 23, w: 40, h: 52, priority: 10 } },
  { id: 'neck', kind: 'path', d: 'M108 72 C109 82 106 89 101 94 L139 94 C134 89 131 82 132 72 Z', hit: { x: 101, y: 68, w: 38, h: 31, priority: 10 } },

  { id: 'shoulder_left', kind: 'path', d: 'M101 91 C85 91 70 95 58 103 C53 107 49 113 47 120 L78 124 C81 109 89 99 101 95 Z', hit: { x: 43, y: 88, w: 62, h: 41, priority: 9 } },
  { id: 'shoulder_right', kind: 'path', d: 'M139 91 C155 91 170 95 182 103 C187 107 191 113 193 120 L162 124 C159 109 151 99 139 95 Z', hit: { x: 135, y: 88, w: 62, h: 41, priority: 9 } },
  { id: 'chest_left', kind: 'path', d: 'M82 99 C92 95 104 94 119 94 L119 157 L88 157 C82 143 78 127 77 112 Z', hit: { x: 76, y: 95, w: 45, h: 66, priority: 7 } },
  { id: 'chest_right', kind: 'path', d: 'M121 94 C136 94 148 95 158 99 L163 112 C162 127 158 143 152 157 L121 157 Z', hit: { x: 119, y: 95, w: 45, h: 66, priority: 7 } },
  { id: 'upper_abdomen', kind: 'path', d: 'M88 158 L152 158 C149 174 148 187 150 199 C141 204 131 207 120 207 C109 207 99 204 90 199 C92 187 91 174 88 158 Z', hit: { x: 86, y: 155, w: 68, h: 55, priority: 7 } },
  { id: 'lower_abdomen', kind: 'path', d: 'M90 199 C99 204 109 207 120 207 C131 207 141 204 150 199 C152 214 151 226 146 238 C138 244 129 247 120 247 C111 247 102 244 94 238 C89 226 88 214 90 199 Z', hit: { x: 87, y: 197, w: 66, h: 54, priority: 8 } },
  { id: 'hip_left', kind: 'path', d: 'M94 236 C84 242 80 254 82 269 C88 279 98 285 111 286 L116 247 C107 246 101 243 94 236 Z', hit: { x: 78, y: 233, w: 42, h: 58, priority: 9 } },
  { id: 'hip_right', kind: 'path', d: 'M146 236 C156 242 160 254 158 269 C152 279 142 285 129 286 L124 247 C133 246 139 243 146 236 Z', hit: { x: 120, y: 233, w: 42, h: 58, priority: 9 } },

  { id: 'upper_arm_left', kind: 'path', d: 'M49 116 C41 132 38 149 37 166 C36 179 37 190 40 199 L55 197 C56 183 58 169 61 154 C64 140 70 129 76 120 Z', hit: { x: 33, y: 112, w: 47, h: 91, priority: 8 } },
  { id: 'elbow_left', kind: 'ellipse', cx: 43, cy: 204, rx: 11, ry: 12, hit: { x: 29, y: 191, w: 29, h: 28, priority: 10 } },
  { id: 'forearm_left', kind: 'path', d: 'M39 214 C36 230 32 246 28 261 C26 271 28 280 34 282 C40 284 45 278 47 270 C51 251 54 232 55 216 Z', hit: { x: 24, y: 211, w: 35, h: 74, priority: 8 } },
  { id: 'hand_left', kind: 'path', d: 'M28 278 C20 284 17 294 20 303 C23 310 29 313 35 309 C40 306 43 297 42 285 Z', hit: { x: 15, y: 274, w: 33, h: 41, priority: 10 } },

  { id: 'upper_arm_right', kind: 'path', d: 'M191 116 C199 132 202 149 203 166 C204 179 203 190 200 199 L185 197 C184 183 182 169 179 154 C176 140 170 129 164 120 Z', hit: { x: 160, y: 112, w: 47, h: 91, priority: 8 } },
  { id: 'elbow_right', kind: 'ellipse', cx: 197, cy: 204, rx: 11, ry: 12, hit: { x: 182, y: 191, w: 29, h: 28, priority: 10 } },
  { id: 'forearm_right', kind: 'path', d: 'M201 214 C204 230 208 246 212 261 C214 271 212 280 206 282 C200 284 195 278 193 270 C189 251 186 232 185 216 Z', hit: { x: 181, y: 211, w: 35, h: 74, priority: 8 } },
  { id: 'hand_right', kind: 'path', d: 'M212 278 C220 284 223 294 220 303 C217 310 211 313 205 309 C200 306 197 297 198 285 Z', hit: { x: 192, y: 274, w: 33, h: 41, priority: 10 } },

  { id: 'thigh_left', kind: 'path', d: 'M84 270 C79 291 79 314 82 335 C84 349 87 360 92 367 L112 363 C111 344 112 325 115 307 C117 294 117 286 115 281 C103 281 92 277 84 270 Z', hit: { x: 78, y: 267, w: 40, h: 104, priority: 7 } },
  { id: 'knee_left', kind: 'ellipse', cx: 99, cy: 374, rx: 14, ry: 14, hit: { x: 82, y: 357, w: 34, h: 35, priority: 10 } },
  { id: 'lower_leg_left', kind: 'path', d: 'M88 386 C87 402 85 417 82 432 L105 432 C108 416 110 401 111 386 Z', hit: { x: 79, y: 383, w: 35, h: 53, priority: 8 } },
  { id: 'ankle_left', kind: 'path', d: 'M82 430 L105 430 L104 442 L82 442 Z', hit: { x: 77, y: 426, w: 32, h: 20, priority: 10 } },
  { id: 'foot_left', kind: 'path', d: 'M82 440 C76 446 71 450 72 454 C73 458 79 459 87 458 L106 455 L104 440 Z', hit: { x: 68, y: 437, w: 42, h: 23, priority: 10 } },

  { id: 'thigh_right', kind: 'path', d: 'M156 270 C161 291 161 314 158 335 C156 349 153 360 148 367 L128 363 C129 344 128 325 125 307 C123 294 123 286 125 281 C137 281 148 277 156 270 Z', hit: { x: 122, y: 267, w: 40, h: 104, priority: 7 } },
  { id: 'knee_right', kind: 'ellipse', cx: 141, cy: 374, rx: 14, ry: 14, hit: { x: 124, y: 357, w: 34, h: 35, priority: 10 } },
  { id: 'lower_leg_right', kind: 'path', d: 'M152 386 C153 402 155 417 158 432 L135 432 C132 416 130 401 129 386 Z', hit: { x: 126, y: 383, w: 35, h: 53, priority: 8 } },
  { id: 'ankle_right', kind: 'path', d: 'M158 430 L135 430 L136 442 L158 442 Z', hit: { x: 131, y: 426, w: 32, h: 20, priority: 10 } },
  { id: 'foot_right', kind: 'path', d: 'M158 440 C164 446 169 450 168 454 C167 458 161 459 153 458 L134 455 L136 440 Z', hit: { x: 130, y: 437, w: 42, h: 23, priority: 10 } },
];

const BACK_SHAPES: RegionShape[] = [
  { id: 'head', kind: 'path', d: 'M95 42 C95 19 105 7 120 7 C135 7 145 19 145 42 C145 58 139 70 130 78 L110 78 C101 70 95 58 95 42 Z', hit: { x: 90, y: 3, w: 60, h: 80, priority: 8 } },
  { id: 'neck', kind: 'path', d: 'M107 74 C109 83 106 91 100 97 L140 97 C134 91 131 83 133 74 Z', hit: { x: 100, y: 70, w: 40, h: 32, priority: 10 } },

  { id: 'shoulder_left', kind: 'path', d: 'M100 94 C82 94 66 98 53 108 C48 112 44 118 43 126 L78 130 C81 112 88 101 100 98 Z', hit: { x: 39, y: 91, w: 65, h: 44, priority: 9 } },
  { id: 'shoulder_right', kind: 'path', d: 'M140 94 C158 94 174 98 187 108 C192 112 196 118 197 126 L162 130 C159 112 152 101 140 98 Z', hit: { x: 136, y: 91, w: 65, h: 44, priority: 9 } },
  { id: 'shoulder_blade_left', kind: 'path', d: 'M80 104 C89 99 101 98 118 98 L118 159 C107 157 96 154 87 148 C82 135 79 120 80 104 Z', hit: { x: 78, y: 100, w: 42, h: 62, priority: 8 } },
  { id: 'shoulder_blade_right', kind: 'path', d: 'M122 98 C139 98 151 99 160 104 C161 120 158 135 153 148 C144 154 133 157 122 159 Z', hit: { x: 120, y: 100, w: 42, h: 62, priority: 8 } },
  { id: 'mid_back', kind: 'path', d: 'M88 151 C98 157 108 160 120 160 C132 160 142 157 152 151 C150 171 150 188 153 203 C143 209 132 212 120 212 C108 212 97 209 87 203 C90 188 90 171 88 151 Z', hit: { x: 85, y: 149, w: 70, h: 67, priority: 7 } },
  { id: 'lower_back_left', kind: 'path', d: 'M87 202 C97 208 107 211 118 212 L116 247 C105 247 96 244 89 238 C85 226 84 214 87 202 Z', hit: { x: 83, y: 199, w: 37, h: 52, priority: 8 } },
  { id: 'lower_back_right', kind: 'path', d: 'M122 212 C133 211 143 208 153 202 C156 214 155 226 151 238 C144 244 135 247 124 247 Z', hit: { x: 120, y: 199, w: 37, h: 52, priority: 8 } },
  { id: 'glute_left', kind: 'path', d: 'M89 237 C82 245 80 258 83 272 C90 282 101 287 116 287 L117 247 C106 247 97 244 89 237 Z', hit: { x: 79, y: 234, w: 41, h: 58, priority: 9 } },
  { id: 'glute_right', kind: 'path', d: 'M151 237 C158 245 160 258 157 272 C150 282 139 287 124 287 L123 247 C134 247 143 244 151 237 Z', hit: { x: 120, y: 234, w: 41, h: 58, priority: 9 } },

  { id: 'upper_arm_left', kind: 'path', d: 'M45 122 C38 139 36 156 37 174 C38 184 39 193 42 201 L57 198 C57 184 59 170 62 156 C65 142 70 131 76 125 Z', hit: { x: 33, y: 118, w: 47, h: 87, priority: 8 } },
  { id: 'elbow_left', kind: 'ellipse', cx: 44, cy: 207, rx: 11, ry: 12, hit: { x: 30, y: 194, w: 29, h: 28, priority: 10 } },
  { id: 'forearm_left', kind: 'path', d: 'M40 216 C37 232 33 248 29 263 C27 273 29 282 35 284 C41 286 46 280 48 272 C52 253 55 234 56 218 Z', hit: { x: 25, y: 213, w: 35, h: 74, priority: 8 } },
  { id: 'hand_left', kind: 'path', d: 'M29 280 C21 286 18 296 21 305 C24 312 30 315 36 311 C41 308 44 299 43 287 Z', hit: { x: 16, y: 276, w: 33, h: 41, priority: 10 } },

  { id: 'upper_arm_right', kind: 'path', d: 'M195 122 C202 139 204 156 203 174 C202 184 201 193 198 201 L183 198 C183 184 181 170 178 156 C175 142 170 131 164 125 Z', hit: { x: 160, y: 118, w: 47, h: 87, priority: 8 } },
  { id: 'elbow_right', kind: 'ellipse', cx: 196, cy: 207, rx: 11, ry: 12, hit: { x: 181, y: 194, w: 29, h: 28, priority: 10 } },
  { id: 'forearm_right', kind: 'path', d: 'M200 216 C203 232 207 248 211 263 C213 273 211 282 205 284 C199 286 194 280 192 272 C188 253 185 234 184 218 Z', hit: { x: 180, y: 213, w: 35, h: 74, priority: 8 } },
  { id: 'hand_right', kind: 'path', d: 'M211 280 C219 286 222 296 219 305 C216 312 210 315 204 311 C199 308 196 299 197 287 Z', hit: { x: 191, y: 276, w: 33, h: 41, priority: 10 } },

  { id: 'hamstring_left', kind: 'path', d: 'M84 271 C80 293 80 316 83 336 C85 350 88 360 93 367 L112 363 C111 344 112 325 115 307 C117 294 117 286 115 282 C103 282 92 278 84 271 Z', hit: { x: 78, y: 268, w: 40, h: 103, priority: 7 } },
  { id: 'knee_left', kind: 'ellipse', cx: 99, cy: 374, rx: 14, ry: 14, hit: { x: 82, y: 357, w: 34, h: 35, priority: 10 } },
  { id: 'calf_left', kind: 'path', d: 'M88 386 C86 399 85 414 83 430 C90 433 98 433 105 430 C108 414 110 400 111 386 Z', hit: { x: 79, y: 383, w: 35, h: 51, priority: 8 } },
  { id: 'ankle_left', kind: 'path', d: 'M83 429 L105 429 L104 442 L82 442 Z', hit: { x: 77, y: 425, w: 32, h: 21, priority: 10 } },
  { id: 'heel_left', kind: 'path', d: 'M82 440 C78 446 76 451 78 455 C82 459 91 459 103 455 L104 440 Z', hit: { x: 74, y: 437, w: 34, h: 23, priority: 10 } },

  { id: 'hamstring_right', kind: 'path', d: 'M156 271 C160 293 160 316 157 336 C155 350 152 360 147 367 L128 363 C129 344 128 325 125 307 C123 294 123 286 125 282 C137 282 148 278 156 271 Z', hit: { x: 122, y: 268, w: 40, h: 103, priority: 7 } },
  { id: 'knee_right', kind: 'ellipse', cx: 141, cy: 374, rx: 14, ry: 14, hit: { x: 124, y: 357, w: 34, h: 35, priority: 10 } },
  { id: 'calf_right', kind: 'path', d: 'M152 386 C154 399 155 414 157 430 C150 433 142 433 135 430 C132 414 130 400 129 386 Z', hit: { x: 126, y: 383, w: 35, h: 51, priority: 8 } },
  { id: 'ankle_right', kind: 'path', d: 'M157 429 L135 429 L136 442 L158 442 Z', hit: { x: 131, y: 425, w: 32, h: 21, priority: 10 } },
  { id: 'heel_right', kind: 'path', d: 'M158 440 C162 446 164 451 162 455 C158 459 149 459 137 455 L136 440 Z', hit: { x: 132, y: 437, w: 34, h: 23, priority: 10 } },
];

const BACK_DETAIL_PATHS = [
  'M120 99 C118 121 118 142 120 160 C121 179 121 196 120 213 C119 225 119 237 120 246',
  'M90 115 C98 108 107 106 116 109 C110 128 101 139 89 144',
  'M150 115 C142 108 133 106 124 109 C130 128 139 139 151 144',
  'M91 249 C101 254 110 255 118 253',
  'M149 249 C139 254 130 255 122 253',
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
        minWidth: 96,
        minHeight: 42,
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
            const strokeWidth = isSelected ? 2.6 : 1.25;

            if (shape.kind === 'ellipse') {
              return (
                <Ellipse
                  key={shape.id}
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
                key={shape.id}
                d={shape.d}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
              />
            );
          })}

          {view === 'back' && BACK_DETAIL_PATHS.map((d, index) => (
            <Path
              key={`back-detail-${index}`}
              d={d}
              fill="none"
              stroke={theme.colors.inkMuted}
              strokeWidth={0.8}
              opacity={0.45}
            />
          ))}
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
        {view === 'front'
          ? 'Front view — tap each specific area that applies.'
          : 'Back view — tap shoulder blades, back, glutes, hamstrings, calves, or other areas that apply.'}
      </Text>

      {selected.length > 0 ? (
        <Text style={styles.selectedText}>Selected: {selectedLabels}</Text>
      ) : (
        <Text style={styles.emptyText}>No areas selected yet.</Text>
      )}
    </View>
  );
}
