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
type Region = { id: string; hit: HitBox; d?: string; ellipse?: { cx: number; cy: number; rx: number; ry: number } };

const VIEW_W = 260;
const VIEW_H = 520;
const SVG_H = 440;

// Clean, continuous silhouettes. The body is intentionally neutral and
// minimally detailed; selectable zones are invisible until selected.
const FRONT_OUTLINE =
  'M130 13 C112 13 101 27 101 49 C101 67 109 80 117 86 ' +
  'C115 96 110 101 100 105 C86 108 69 112 56 121 C48 127 43 139 40 155 ' +
  'C36 180 34 203 31 226 C28 246 23 264 18 281 C15 292 18 302 27 307 ' +
  'C36 312 44 305 47 294 C52 277 56 260 60 243 C64 229 68 218 72 210 ' +
  'C78 231 80 249 78 267 C76 284 70 301 68 319 C66 340 69 360 74 380 ' +
  'C78 397 79 414 76 432 C73 449 70 466 70 480 C69 491 75 498 86 499 ' +
  'C97 500 104 493 104 482 C104 467 106 453 110 439 C114 421 117 401 119 381 ' +
  'C122 358 125 337 128 320 L130 306 L132 320 C135 337 138 358 141 381 ' +
  'C143 401 146 421 150 439 C154 453 156 467 156 482 C156 493 163 500 174 499 ' +
  'C185 498 191 491 190 480 C190 466 187 449 184 432 C181 414 182 397 186 380 ' +
  'C191 360 194 340 192 319 C190 301 184 284 182 267 C180 249 182 231 188 210 ' +
  'C192 218 196 229 200 243 C204 260 208 277 213 294 C216 305 224 312 233 307 ' +
  'C242 302 245 292 242 281 C237 264 232 246 229 226 C226 203 224 180 220 155 ' +
  'C217 139 212 127 204 121 C191 112 174 108 160 105 C150 101 145 96 143 86 ' +
  'C151 80 159 67 159 49 C159 27 148 13 130 13 Z';

const BACK_OUTLINE =
  'M130 13 C111 13 100 28 100 49 C100 67 108 79 116 86 ' +
  'C114 96 108 102 97 106 C81 109 64 115 52 125 C44 133 40 146 38 161 ' +
  'C35 185 33 208 30 229 C27 248 22 266 18 282 C15 293 18 303 27 308 ' +
  'C36 313 44 306 47 295 C52 279 56 262 60 245 C64 231 68 220 72 211 ' +
  'C79 231 81 249 79 268 C77 285 71 302 69 320 C67 340 70 360 75 380 ' +
  'C79 397 80 414 77 433 C74 451 72 467 71 480 C70 491 76 499 87 500 ' +
  'C98 501 105 494 105 483 C105 467 107 453 111 439 C115 420 118 400 120 380 ' +
  'C123 357 126 337 128 321 L130 306 L132 321 C134 337 137 357 140 380 ' +
  'C142 400 145 420 149 439 C153 453 155 467 155 483 C155 494 162 501 173 500 ' +
  'C184 499 190 491 189 480 C188 467 186 451 183 433 C180 414 181 397 185 380 ' +
  'C190 360 193 340 191 320 C189 302 183 285 181 268 C179 249 181 231 188 211 ' +
  'C192 220 196 231 200 245 C204 262 208 279 213 295 C216 306 224 313 233 308 ' +
  'C242 303 245 293 242 282 C238 266 233 248 230 229 C227 208 225 185 222 161 ' +
  'C220 146 216 133 208 125 C196 115 179 109 163 106 C152 102 146 96 144 86 ' +
  'C152 79 160 67 160 49 C160 28 149 13 130 13 Z';

const FRONT_REGIONS: Region[] = [
  { id: 'face', hit: { x: 104, y: 22, w: 52, h: 62, priority: 10 }, ellipse: { cx: 130, cy: 51, rx: 22, ry: 28 } },
  { id: 'head', hit: { x: 98, y: 8, w: 64, h: 82, priority: 7 }, ellipse: { cx: 130, cy: 49, rx: 29, ry: 36 } },
  { id: 'neck', hit: { x: 104, y: 80, w: 52, h: 32, priority: 10 }, d: 'M116 82 C118 94 113 102 105 106 L155 106 C147 102 142 94 144 82 Z' },
  { id: 'shoulder_left', hit: { x: 41, y: 103, w: 67, h: 53, priority: 9 }, d: 'M103 105 C84 107 67 112 55 122 C49 129 45 139 43 151 C55 152 68 151 79 148 C84 130 91 116 103 108 Z' },
  { id: 'shoulder_right', hit: { x: 152, y: 103, w: 67, h: 53, priority: 9 }, d: 'M157 105 C176 107 193 112 205 122 C211 129 215 139 217 151 C205 152 192 151 181 148 C176 130 169 116 157 108 Z' },
  { id: 'chest_left', hit: { x: 82, y: 108, w: 49, h: 66, priority: 7 }, d: 'M92 113 C103 108 116 106 129 106 L129 169 C116 171 103 169 92 165 C87 151 84 135 84 121 Z' },
  { id: 'chest_right', hit: { x: 129, y: 108, w: 49, h: 66, priority: 7 }, d: 'M131 106 C144 106 157 108 168 113 L176 121 C176 135 173 151 168 165 C157 169 144 171 131 169 Z' },
  { id: 'upper_abdomen', hit: { x: 90, y: 162, w: 80, h: 61, priority: 7 }, d: 'M93 166 C105 170 117 172 130 172 C143 172 155 170 167 166 C164 185 164 199 167 211 C155 218 143 221 130 221 C117 221 105 218 93 211 C96 199 96 185 93 166 Z' },
  { id: 'lower_abdomen', hit: { x: 90, y: 207, w: 80, h: 61, priority: 8 }, d: 'M93 211 C105 218 117 221 130 221 C143 221 155 218 167 211 C169 228 167 242 161 255 C151 262 141 265 130 265 C119 265 109 262 99 255 C93 242 91 228 93 211 Z' },
  { id: 'hip_left', hit: { x: 84, y: 249, w: 44, h: 56, priority: 9 }, d: 'M99 253 C90 260 86 271 87 285 C94 295 106 301 121 301 L125 265 C114 264 106 260 99 253 Z' },
  { id: 'hip_right', hit: { x: 132, y: 249, w: 44, h: 56, priority: 9 }, d: 'M161 253 C170 260 174 271 173 285 C166 295 154 301 139 301 L135 265 C146 264 154 260 161 253 Z' },
  { id: 'upper_arm_left', hit: { x: 35, y: 141, w: 48, h: 98, priority: 8 }, d: 'M47 146 C41 165 39 185 39 202 C39 214 40 225 43 235 L59 232 C60 216 62 200 65 184 C68 169 73 156 79 147 Z' },
  { id: 'elbow_left', hit: { x: 31, y: 226, w: 30, h: 31, priority: 10 }, ellipse: { cx: 45, cy: 241, rx: 12, ry: 13 } },
  { id: 'forearm_left', hit: { x: 26, y: 249, w: 38, h: 80, priority: 8 }, d: 'M41 253 C38 271 34 287 30 302 C27 313 30 322 36 324 C43 326 49 320 51 311 C55 291 59 271 59 253 Z' },
  { id: 'hand_left', hit: { x: 17, y: 315, w: 36, h: 45, priority: 10 }, d: 'M29 319 C21 326 18 337 22 347 C25 355 32 358 39 353 C45 349 48 339 46 326 Z' },
  { id: 'upper_arm_right', hit: { x: 177, y: 141, w: 48, h: 98, priority: 8 }, d: 'M213 146 C219 165 221 185 221 202 C221 214 220 225 217 235 L201 232 C200 216 198 200 195 184 C192 169 187 156 181 147 Z' },
  { id: 'elbow_right', hit: { x: 199, y: 226, w: 30, h: 31, priority: 10 }, ellipse: { cx: 215, cy: 241, rx: 12, ry: 13 } },
  { id: 'forearm_right', hit: { x: 196, y: 249, w: 38, h: 80, priority: 8 }, d: 'M219 253 C222 271 226 287 230 302 C233 313 230 322 224 324 C217 326 211 320 209 311 C205 291 201 271 201 253 Z' },
  { id: 'hand_right', hit: { x: 207, y: 315, w: 36, h: 45, priority: 10 }, d: 'M231 319 C239 326 242 337 238 347 C235 355 228 358 221 353 C215 349 212 339 214 326 Z' },
  { id: 'thigh_left', hit: { x: 82, y: 282, w: 45, h: 109, priority: 7 }, d: 'M89 287 C84 308 84 330 87 352 C89 366 92 378 98 387 L121 382 C120 362 121 343 124 323 C126 311 126 302 123 297 C110 297 99 293 89 287 Z' },
  { id: 'knee_left', hit: { x: 87, y: 376, w: 37, h: 38, priority: 10 }, ellipse: { cx: 105, cy: 395, rx: 15, ry: 16 } },
  { id: 'lower_leg_left', hit: { x: 84, y: 406, w: 38, h: 64, priority: 8 }, d: 'M94 411 C93 432 90 450 87 467 L112 467 C116 449 118 430 118 411 Z' },
  { id: 'ankle_left', hit: { x: 82, y: 461, w: 34, h: 22, priority: 10 }, d: 'M87 465 L112 465 L111 480 L87 480 Z' },
  { id: 'foot_left', hit: { x: 71, y: 474, w: 46, h: 31, priority: 10 }, d: 'M87 478 C79 486 73 492 75 497 C77 502 84 503 94 501 L113 498 L111 478 Z' },
  { id: 'thigh_right', hit: { x: 133, y: 282, w: 45, h: 109, priority: 7 }, d: 'M171 287 C176 308 176 330 173 352 C171 366 168 378 162 387 L139 382 C140 362 139 343 136 323 C134 311 134 302 137 297 C150 297 161 293 171 287 Z' },
  { id: 'knee_right', hit: { x: 136, y: 376, w: 37, h: 38, priority: 10 }, ellipse: { cx: 155, cy: 395, rx: 15, ry: 16 } },
  { id: 'lower_leg_right', hit: { x: 138, y: 406, w: 38, h: 64, priority: 8 }, d: 'M166 411 C167 432 170 450 173 467 L148 467 C144 449 142 430 142 411 Z' },
  { id: 'ankle_right', hit: { x: 144, y: 461, w: 34, h: 22, priority: 10 }, d: 'M173 465 L148 465 L149 480 L173 480 Z' },
  { id: 'foot_right', hit: { x: 143, y: 474, w: 46, h: 31, priority: 10 }, d: 'M173 478 C181 486 187 492 185 497 C183 502 176 503 166 501 L147 498 L149 478 Z' },
];

const BACK_REGIONS: Region[] = [
  { id: 'head', hit: { x: 98, y: 8, w: 64, h: 82, priority: 8 }, ellipse: { cx: 130, cy: 49, rx: 29, ry: 36 } },
  { id: 'neck', hit: { x: 104, y: 80, w: 52, h: 32, priority: 10 }, d: 'M116 82 C118 94 113 102 105 106 L155 106 C147 102 142 94 144 82 Z' },
  { id: 'shoulder_left', hit: { x: 39, y: 103, w: 69, h: 55, priority: 9 }, d: 'M101 105 C82 108 65 114 53 125 C47 132 43 142 42 154 C55 155 68 153 80 149 C85 130 91 116 101 109 Z' },
  { id: 'shoulder_right', hit: { x: 152, y: 103, w: 69, h: 55, priority: 9 }, d: 'M159 105 C178 108 195 114 207 125 C213 132 217 142 218 154 C205 155 192 153 180 149 C175 130 169 116 159 109 Z' },
  { id: 'shoulder_blade_left', hit: { x: 82, y: 108, w: 48, h: 70, priority: 8 }, d: 'M91 113 C102 108 114 106 129 106 L129 174 C116 174 104 170 94 164 C89 148 87 130 91 113 Z' },
  { id: 'shoulder_blade_right', hit: { x: 130, y: 108, w: 48, h: 70, priority: 8 }, d: 'M131 106 C146 106 158 108 169 113 C173 130 171 148 166 164 C156 170 144 174 131 174 Z' },
  { id: 'mid_back', hit: { x: 88, y: 166, w: 84, h: 69, priority: 7 }, d: 'M94 165 C105 171 117 174 130 174 C143 174 155 171 166 165 C164 184 164 202 168 216 C156 224 143 228 130 228 C117 228 104 224 92 216 C96 202 96 184 94 165 Z' },
  { id: 'lower_back_left', hit: { x: 87, y: 214, w: 43, h: 57, priority: 8 }, d: 'M92 216 C103 224 115 228 129 228 L126 267 C113 267 103 263 95 256 C91 242 90 229 92 216 Z' },
  { id: 'lower_back_right', hit: { x: 130, y: 214, w: 43, h: 57, priority: 8 }, d: 'M131 228 C145 228 157 224 168 216 C170 229 169 242 165 256 C157 263 147 267 134 267 Z' },
  { id: 'glute_left', hit: { x: 84, y: 250, w: 47, h: 61, priority: 9 }, d: 'M95 255 C87 263 84 276 87 290 C95 301 108 307 127 307 L126 267 C113 267 103 263 95 255 Z' },
  { id: 'glute_right', hit: { x: 129, y: 250, w: 47, h: 61, priority: 9 }, d: 'M165 255 C173 263 176 276 173 290 C165 301 152 307 133 307 L134 267 C147 267 157 263 165 255 Z' },
  { id: 'upper_arm_left', hit: { x: 35, y: 145, w: 49, h: 96, priority: 8 }, d: 'M47 148 C41 167 39 186 39 203 C39 216 40 227 43 237 L59 234 C60 218 62 202 65 186 C68 171 73 158 80 149 Z' },
  { id: 'elbow_left', hit: { x: 31, y: 228, w: 30, h: 31, priority: 10 }, ellipse: { cx: 45, cy: 243, rx: 12, ry: 13 } },
  { id: 'forearm_left', hit: { x: 26, y: 251, w: 38, h: 80, priority: 8 }, d: 'M41 255 C38 273 34 289 30 304 C27 315 30 324 36 326 C43 328 49 322 51 313 C55 293 59 273 59 255 Z' },
  { id: 'hand_left', hit: { x: 17, y: 317, w: 36, h: 45, priority: 10 }, d: 'M29 321 C21 328 18 339 22 349 C25 357 32 360 39 355 C45 351 48 341 46 328 Z' },
  { id: 'upper_arm_right', hit: { x: 176, y: 145, w: 49, h: 96, priority: 8 }, d: 'M213 148 C219 167 221 186 221 203 C221 216 220 227 217 237 L201 234 C200 218 198 202 195 186 C192 171 187 158 180 149 Z' },
  { id: 'elbow_right', hit: { x: 199, y: 228, w: 30, h: 31, priority: 10 }, ellipse: { cx: 215, cy: 243, rx: 12, ry: 13 } },
  { id: 'forearm_right', hit: { x: 196, y: 251, w: 38, h: 80, priority: 8 }, d: 'M219 255 C222 273 226 289 230 304 C233 315 230 324 224 326 C217 328 211 322 209 313 C205 293 201 273 201 255 Z' },
  { id: 'hand_right', hit: { x: 207, y: 317, w: 36, h: 45, priority: 10 }, d: 'M231 321 C239 328 242 339 238 349 C235 357 228 360 221 355 C215 351 212 341 214 328 Z' },
  { id: 'hamstring_left', hit: { x: 82, y: 299, w: 46, h: 91, priority: 8 }, d: 'M88 292 C84 312 85 333 88 352 C90 366 94 378 99 387 L122 382 C120 361 121 342 124 323 C126 315 127 308 127 304 C111 305 98 301 88 292 Z' },
  { id: 'hamstring_right', hit: { x: 132, y: 299, w: 46, h: 91, priority: 8 }, d: 'M172 292 C176 312 175 333 172 352 C170 366 166 378 161 387 L138 382 C140 361 139 342 136 323 C134 315 133 308 133 304 C149 305 162 301 172 292 Z' },
  { id: 'knee_left', hit: { x: 87, y: 376, w: 37, h: 38, priority: 10 }, ellipse: { cx: 105, cy: 395, rx: 15, ry: 16 } },
  { id: 'knee_right', hit: { x: 136, y: 376, w: 37, h: 38, priority: 10 }, ellipse: { cx: 155, cy: 395, rx: 15, ry: 16 } },
  { id: 'calf_left', hit: { x: 84, y: 406, w: 38, h: 64, priority: 8 }, d: 'M94 411 C92 429 90 447 88 466 L112 466 C116 448 118 430 118 411 Z' },
  { id: 'calf_right', hit: { x: 138, y: 406, w: 38, h: 64, priority: 8 }, d: 'M166 411 C168 429 170 447 172 466 L148 466 C144 448 142 430 142 411 Z' },
  { id: 'heel_left', hit: { x: 78, y: 461, w: 40, h: 38, priority: 10 }, d: 'M87 465 L112 465 L111 480 C106 491 99 497 90 498 C83 496 80 489 82 479 Z' },
  { id: 'heel_right', hit: { x: 142, y: 461, w: 40, h: 38, priority: 10 }, d: 'M173 465 L148 465 L149 480 C154 491 161 497 170 498 C177 496 180 489 178 479 Z' },
];

export function BodyMap({ selected, onToggle }: BodyMapProps) {
  const theme = useTheme();
  const [view, setView] = useState<BodyView>('front');
  const [width, setWidth] = useState(0);
  const regions = view === 'front' ? FRONT_REGIONS : BACK_REGIONS;
  const outline = view === 'front' ? FRONT_OUTLINE : BACK_OUTLINE;
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

  const styles = useMemo(() => StyleSheet.create({
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
    selectedText: { ...theme.typography.bodySecondary, fontFamily: theme.fonts.semibold, color: theme.colors.primary, textAlign: 'center' as const },
    emptyText: { ...theme.typography.bodySecondary, color: theme.colors.inkMuted, textAlign: 'center' as const },
  }), [theme]);

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
        accessibilityLabel={selected.length > 0 ? `${view} body map. Selected: ${selectedLabels}` : `${view} body map. Nothing selected yet.`}
      >
        <Svg width="100%" height={SVG_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Path
            d={outline}
            fill={theme.colors.surfaceMuted}
            stroke={theme.colors.border}
            strokeWidth={1.5}
          />

          {regions.map((region) => {
            const isSelected = selected.includes(region.id);
            if (!isSelected) return null;

            const common = {
              fill: theme.colors.primary,
              stroke: theme.colors.primaryPressed,
              strokeWidth: 2.2,
              opacity: 0.9,
            };

            if (region.ellipse) {
              return (
                <Ellipse
                  key={`selected-${region.id}`}
                  cx={region.ellipse.cx}
                  cy={region.ellipse.cy}
                  rx={region.ellipse.rx}
                  ry={region.ellipse.ry}
                  {...common}
                />
              );
            }

            return region.d ? <Path key={`selected-${region.id}`} d={region.d} {...common} /> : null;
          })}
        </Svg>

        {width > 0 && regions.map((region) => {
          const isSelected = selected.includes(region.id);
          return (
            <Pressable
              key={`hit-${region.id}`}
              onPress={() => onToggle(region.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${getRegionLabel(region.id)}${isSelected ? ', selected' : ''}`}
              accessibilityHint={isSelected ? 'Double tap to remove this area' : 'Double tap to select this area'}
              style={[styles.hitTarget, boxFor(region.hit)]}
            />
          );
        })}
      </View>

      <Text style={styles.hint}>
        {view === 'front' ? 'Front view' : 'Back view'} — tap the area that applies.
      </Text>

      {selected.length > 0 ? (
        <Text style={styles.selectedText}>Selected: {selectedLabels}</Text>
      ) : (
        <Text style={styles.emptyText}>No areas selected yet.</Text>
      )}
    </View>
  );
}
