import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Line, Path } from 'react-native-svg';

import { getRegionLabel } from '../../utils/bodyRegions';
import { useTheme } from '../../hooks/useTheme';

interface BodyMapProps {
  selected: string[];
  onToggle: (regionId: string) => void;
}

type BodyView = 'front' | 'back';
type HitBox = { x: number; y: number; w: number; h: number; priority?: number };
type RegionShape = {
  id: string;
  kind: 'path' | 'ellipse';
  d?: string;
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  hit: HitBox;
};

const VIEW_W = 260;
const VIEW_H = 520;
const SVG_H = 440;

/**
 * The visible body is one continuous silhouette. Selectable regions are
 * lightly outlined on top, so the figure reads as a person first and a
 * diagram second. Screen-left is always the user's left.
 */
const FRONT_OUTLINE =
  'M130 12 C112 12 101 26 101 48 C101 67 109 79 116 84 ' +
  'C114 94 109 100 99 104 C85 106 68 111 56 120 C48 126 43 137 40 153 ' +
  'C36 177 34 202 30 226 C27 244 22 263 17 279 C14 290 18 302 27 306 ' +
  'C35 310 43 304 46 293 C51 276 55 259 59 242 C62 231 66 220 69 212 ' +
  'C75 229 78 247 76 264 C74 279 69 295 66 313 C63 335 65 356 71 377 ' +
  'C75 393 76 409 73 428 C71 445 68 462 67 478 C66 489 72 496 83 497 ' +
  'C94 498 101 491 101 481 C101 465 103 451 107 437 C111 420 114 401 116 380 ' +
  'C119 358 121 338 124 322 C126 312 128 305 130 301 ' +
  'C132 305 134 312 136 322 C139 338 141 358 144 380 C146 401 149 420 153 437 ' +
  'C157 451 159 465 159 481 C159 491 166 498 177 497 C188 496 194 489 193 478 ' +
  'C192 462 189 445 187 428 C184 409 185 393 189 377 C195 356 197 335 194 313 ' +
  'C191 295 186 279 184 264 C182 247 185 229 191 212 C194 220 198 231 201 242 ' +
  'C205 259 209 276 214 293 C217 304 225 310 233 306 C242 302 246 290 243 279 ' +
  'C238 263 233 244 230 226 C226 202 224 177 220 153 C217 137 212 126 204 120 ' +
  'C192 111 175 106 161 104 C151 100 146 94 144 84 C151 79 159 67 159 48 ' +
  'C159 26 148 12 130 12 Z';

const BACK_OUTLINE =
  'M130 11 C111 11 100 26 100 48 C100 66 107 78 115 84 ' +
  'C113 95 107 101 96 105 C80 108 63 114 52 124 C44 132 40 145 38 160 ' +
  'C35 184 33 207 29 229 C26 247 21 266 17 281 C14 292 18 303 27 307 ' +
  'C36 311 44 305 47 294 C52 278 56 261 60 244 C63 230 67 219 71 210 ' +
  'C77 231 79 249 77 267 C75 284 69 300 67 318 C65 338 68 359 73 379 ' +
  'C77 395 78 411 75 430 C72 448 70 465 69 479 C68 490 74 497 85 498 ' +
  'C96 499 103 492 103 481 C103 466 105 451 109 437 C113 419 116 400 118 380 ' +
  'C121 357 123 337 126 322 C127 313 129 306 130 302 ' +
  'C131 306 133 313 134 322 C137 337 139 357 142 380 C144 400 147 419 151 437 ' +
  'C155 451 157 466 157 481 C157 492 164 499 175 498 C186 497 192 490 191 479 ' +
  'C190 465 188 448 185 430 C182 411 183 395 187 379 C192 359 195 338 193 318 ' +
  'C191 300 185 284 183 267 C181 249 183 231 189 210 C193 219 197 230 200 244 ' +
  'C204 261 208 278 213 294 C216 305 224 311 233 307 C242 303 246 292 243 281 ' +
  'C239 266 234 247 231 229 C227 207 225 184 222 160 C220 145 216 132 208 124 ' +
  'C197 114 180 108 164 105 C153 101 147 95 145 84 C153 78 160 66 160 48 ' +
  'C160 26 149 11 130 11 Z';

const FRONT_REGIONS: RegionShape[] = [
  { id: 'head', kind: 'ellipse', cx: 130, cy: 47, rx: 29, ry: 36, hit: { x: 98, y: 8, w: 64, h: 80, priority: 7 } },
  { id: 'face', kind: 'ellipse', cx: 130, cy: 52, rx: 21, ry: 27, hit: { x: 106, y: 24, w: 48, h: 58, priority: 10 } },
  { id: 'neck', kind: 'path', d: 'M116 82 C118 94 113 101 105 106 L155 106 C147 101 142 94 144 82 Z', hit: { x: 104, y: 79, w: 52, h: 32, priority: 10 } },
  { id: 'shoulder_left', kind: 'path', d: 'M103 105 C84 107 67 111 55 122 C49 128 45 138 43 150 C55 151 68 150 79 147 C84 129 91 115 103 108 Z', hit: { x: 41, y: 102, w: 67, h: 53, priority: 9 } },
  { id: 'shoulder_right', kind: 'path', d: 'M157 105 C176 107 193 111 205 122 C211 128 215 138 217 150 C205 151 192 150 181 147 C176 129 169 115 157 108 Z', hit: { x: 152, y: 102, w: 67, h: 53, priority: 9 } },
  { id: 'chest_left', kind: 'path', d: 'M92 113 C103 108 116 106 129 106 L129 168 C116 170 103 168 92 164 C87 150 84 134 84 120 Z', hit: { x: 82, y: 108, w: 49, h: 65, priority: 7 } },
  { id: 'chest_right', kind: 'path', d: 'M131 106 C144 106 157 108 168 113 L176 120 C176 134 173 150 168 164 C157 168 144 170 131 168 Z', hit: { x: 129, y: 108, w: 49, h: 65, priority: 7 } },
  { id: 'upper_abdomen', kind: 'path', d: 'M93 165 C105 169 117 171 130 171 C143 171 155 169 167 165 C164 184 164 198 167 210 C155 217 143 220 130 220 C117 220 105 217 93 210 C96 198 96 184 93 165 Z', hit: { x: 90, y: 162, w: 80, h: 61, priority: 7 } },
  { id: 'lower_abdomen', kind: 'path', d: 'M93 210 C105 217 117 220 130 220 C143 220 155 217 167 210 C169 227 167 241 161 254 C151 261 141 264 130 264 C119 264 109 261 99 254 C93 241 91 227 93 210 Z', hit: { x: 90, y: 207, w: 80, h: 61, priority: 8 } },
  { id: 'hip_left', kind: 'path', d: 'M99 252 C90 259 86 270 87 284 C94 294 106 300 121 300 L125 264 C114 263 106 259 99 252 Z', hit: { x: 84, y: 249, w: 44, h: 56, priority: 9 } },
  { id: 'hip_right', kind: 'path', d: 'M161 252 C170 259 174 270 173 284 C166 294 154 300 139 300 L135 264 C146 263 154 259 161 252 Z', hit: { x: 132, y: 249, w: 44, h: 56, priority: 9 } },
  { id: 'upper_arm_left', kind: 'path', d: 'M47 145 C41 164 39 184 39 201 C39 213 40 224 43 234 L59 231 C60 215 62 199 65 183 C68 168 73 155 79 146 Z', hit: { x: 35, y: 141, w: 48, h: 97, priority: 8 } },
  { id: 'elbow_left', kind: 'ellipse', cx: 45, cy: 240, rx: 12, ry: 13, hit: { x: 31, y: 226, w: 30, h: 30, priority: 10 } },
  { id: 'forearm_left', kind: 'path', d: 'M41 252 C38 270 34 286 30 301 C27 312 30 321 36 323 C43 325 49 319 51 310 C55 290 59 270 59 252 Z', hit: { x: 26, y: 249, w: 38, h: 80, priority: 8 } },
  { id: 'hand_left', kind: 'path', d: 'M29 318 C21 325 18 336 22 346 C25 354 32 357 39 352 C45 348 48 338 46 325 Z', hit: { x: 17, y: 315, w: 36, h: 45, priority: 10 } },
  { id: 'upper_arm_right', kind: 'path', d: 'M213 145 C219 164 221 184 221 201 C221 213 220 224 217 234 L201 231 C200 215 198 199 195 183 C192 168 187 155 181 146 Z', hit: { x: 177, y: 141, w: 48, h: 97, priority: 8 } },
  { id: 'elbow_right', kind: 'ellipse', cx: 215, cy: 240, rx: 12, ry: 13, hit: { x: 199, y: 226, w: 30, h: 30, priority: 10 } },
  { id: 'forearm_right', kind: 'path', d: 'M219 252 C222 270 226 286 230 301 C233 312 230 321 224 323 C217 325 211 319 209 310 C205 290 201 270 201 252 Z', hit: { x: 196, y: 249, w: 38, h: 80, priority: 8 } },
  { id: 'hand_right', kind: 'path', d: 'M231 318 C239 325 242 336 238 346 C235 354 228 357 221 352 C215 348 212 338 214 325 Z', hit: { x: 207, y: 315, w: 36, h: 45, priority: 10 } },
  { id: 'thigh_left', kind: 'path', d: 'M89 286 C84 307 84 329 87 351 C89 365 92 377 98 386 L121 381 C120 361 121 342 124 322 C126 310 126 301 123 296 C110 296 99 292 89 286 Z', hit: { x: 82, y: 282, w: 45, h: 108, priority: 7 } },
  { id: 'knee_left', kind: 'ellipse', cx: 105, cy: 394, rx: 15, ry: 16, hit: { x: 87, y: 376, w: 37, h: 38, priority: 10 } },
  { id: 'lower_leg_left', kind: 'path', d: 'M94 410 C93 431 90 449 87 466 L112 466 C116 448 118 429 118 410 Z', hit: { x: 84, y: 406, w: 38, h: 64, priority: 8 } },
  { id: 'ankle_left', kind: 'path', d: 'M87 464 L112 464 L111 479 L87 479 Z', hit: { x: 82, y: 461, w: 34, h: 22, priority: 10 } },
  { id: 'foot_left', kind: 'path', d: 'M87 477 C79 485 73 491 75 496 C77 501 84 502 94 500 L113 497 L111 477 Z', hit: { x: 71, y: 474, w: 46, h: 31, priority: 10 } },
  { id: 'thigh_right', kind: 'path', d: 'M171 286 C176 307 176 329 173 351 C171 365 168 377 162 386 L139 381 C140 361 139 342 136 322 C134 310 134 301 137 296 C150 296 161 292 171 286 Z', hit: { x: 133, y: 282, w: 45, h: 108, priority: 7 } },
  { id: 'knee_right', kind: 'ellipse', cx: 155, cy: 394, rx: 15, ry: 16, hit: { x: 136, y: 376, w: 37, h: 38, priority: 10 } },
  { id: 'lower_leg_right', kind: 'path', d: 'M166 410 C167 431 170 449 173 466 L148 466 C144 448 142 429 142 410 Z', hit: { x: 138, y: 406, w: 38, h: 64, priority: 8 } },
  { id: 'ankle_right', kind: 'path', d: 'M173 464 L148 464 L149 479 L173 479 Z', hit: { x: 144, y: 461, w: 34, h: 22, priority: 10 } },
  { id: 'foot_right', kind: 'path', d: 'M173 477 C181 485 187 491 185 496 C183 501 176 502 166 500 L147 497 L149 477 Z', hit: { x: 143, y: 474, w: 46, h: 31, priority: 10 } },
];

const BACK_REGIONS: RegionShape[] = [
  { id: 'head', kind: 'ellipse', cx: 130, cy: 46, rx: 29, ry: 35, hit: { x: 98, y: 8, w: 64, h: 78, priority: 8 } },
  { id: 'neck', kind: 'path', d: 'M115 81 C118 94 112 101 103 107 L157 107 C148 101 142 94 145 81 Z', hit: { x: 102, y: 78, w: 56, h: 34, priority: 10 } },
  { id: 'shoulder_left', kind: 'path', d: 'M102 105 C82 108 65 113 53 124 C47 131 43 141 42 153 C55 154 69 153 80 149 C85 130 92 115 102 108 Z', hit: { x: 39, y: 102, w: 68, h: 56, priority: 9 } },
  { id: 'shoulder_right', kind: 'path', d: 'M158 105 C178 108 195 113 207 124 C213 131 217 141 218 153 C205 154 191 153 180 149 C175 130 168 115 158 108 Z', hit: { x: 153, y: 102, w: 68, h: 56, priority: 9 } },
  { id: 'shoulder_blade_left', kind: 'path', d: 'M87 116 C99 110 112 108 128 108 L128 170 C116 169 104 166 94 159 C89 145 86 130 87 116 Z', hit: { x: 84, y: 111, w: 46, h: 64, priority: 8 } },
  { id: 'shoulder_blade_right', kind: 'path', d: 'M132 108 C148 108 161 110 173 116 C174 130 171 145 166 159 C156 166 144 169 132 170 Z', hit: { x: 130, y: 111, w: 46, h: 64, priority: 8 } },
  { id: 'mid_back', kind: 'path', d: 'M94 159 C105 166 117 169 130 169 C143 169 155 166 166 159 C164 179 164 197 167 213 C156 220 143 223 130 223 C117 223 104 220 93 213 C96 197 96 179 94 159 Z', hit: { x: 91, y: 156, w: 78, h: 70, priority: 7 } },
  { id: 'lower_back_left', kind: 'path', d: 'M93 212 C104 219 116 222 128 223 L126 262 C114 262 104 259 96 252 C91 238 90 225 93 212 Z', hit: { x: 89, y: 209, w: 42, h: 58, priority: 8 } },
  { id: 'lower_back_right', kind: 'path', d: 'M132 223 C144 222 156 219 167 212 C170 225 169 238 164 252 C156 259 146 262 134 262 Z', hit: { x: 129, y: 209, w: 42, h: 58, priority: 8 } },
  { id: 'glute_left', kind: 'path', d: 'M96 251 C88 260 86 273 89 287 C97 297 108 302 126 302 L127 262 C115 262 104 259 96 251 Z', hit: { x: 85, y: 248, w: 45, h: 59, priority: 9 } },
  { id: 'glute_right', kind: 'path', d: 'M164 251 C172 260 174 273 171 287 C163 297 152 302 134 302 L133 262 C145 262 156 259 164 251 Z', hit: { x: 130, y: 248, w: 45, h: 59, priority: 9 } },
  { id: 'upper_arm_left', kind: 'path', d: 'M46 148 C40 166 38 186 39 203 C39 215 40 226 43 236 L59 233 C60 217 62 201 65 185 C68 170 74 157 80 149 Z', hit: { x: 34, y: 144, w: 49, h: 96, priority: 8 } },
  { id: 'elbow_left', kind: 'ellipse', cx: 45, cy: 242, rx: 12, ry: 13, hit: { x: 31, y: 228, w: 30, h: 30, priority: 10 } },
  { id: 'forearm_left', kind: 'path', d: 'M41 254 C38 272 34 288 30 303 C27 314 30 323 36 325 C43 327 49 321 51 312 C55 292 59 272 59 254 Z', hit: { x: 26, y: 251, w: 38, h: 80, priority: 8 } },
  { id: 'hand_left', kind: 'path', d: 'M29 320 C21 327 18 338 22 348 C25 356 32 359 39 354 C45 350 48 340 46 327 Z', hit: { x: 17, y: 317, w: 36, h: 45, priority: 10 } },
  { id: 'upper_arm_right', kind: 'path', d: 'M214 148 C220 166 222 186 221 203 C221 215 220 226 217 236 L201 233 C200 217 198 201 195 185 C192 170 186 157 180 149 Z', hit: { x: 177, y: 144, w: 49, h: 96, priority: 8 } },
  { id: 'elbow_right', kind: 'ellipse', cx: 215, cy: 242, rx: 12, ry: 13, hit: { x: 199, y: 228, w: 30, h: 30, priority: 10 } },
  { id: 'forearm_right', kind: 'path', d: 'M219 254 C222 272 226 288 230 303 C233 314 230 323 224 325 C217 327 211 321 209 312 C205 292 201 272 201 254 Z', hit: { x: 196, y: 251, w: 38, h: 80, priority: 8 } },
  { id: 'hand_right', kind: 'path', d: 'M231 320 C239 327 242 338 238 348 C235 356 228 359 221 354 C215 350 212 340 214 327 Z', hit: { x: 207, y: 317, w: 36, h: 45, priority: 10 } },
  { id: 'hamstring_left', kind: 'path', d: 'M90 289 C85 309 85 331 88 351 C90 366 94 378 100 387 L122 382 C121 362 122 343 125 324 C127 312 127 303 125 298 C111 298 100 294 90 289 Z', hit: { x: 83, y: 285, w: 45, h: 106, priority: 8 } },
  { id: 'knee_left', kind: 'ellipse', cx: 106, cy: 395, rx: 15, ry: 16, hit: { x: 88, y: 377, w: 37, h: 38, priority: 10 } },
  { id: 'calf_left', kind: 'path', d: 'M95 411 C91 430 90 447 88 465 C95 469 103 470 112 467 C116 448 119 429 118 411 Z', hit: { x: 84, y: 407, w: 38, h: 64, priority: 9 } },
  { id: 'ankle_left', kind: 'path', d: 'M88 464 L112 464 L111 479 L88 479 Z', hit: { x: 83, y: 461, w: 34, h: 22, priority: 10 } },
  { id: 'heel_left', kind: 'path', d: 'M88 477 C81 484 77 490 79 496 C82 501 89 502 97 499 L112 496 L111 477 Z', hit: { x: 75, y: 474, w: 41, h: 30, priority: 10 } },
  { id: 'hamstring_right', kind: 'path', d: 'M170 289 C175 309 175 331 172 351 C170 366 166 378 160 387 L138 382 C139 362 138 343 135 324 C133 312 133 303 135 298 C149 298 160 294 170 289 Z', hit: { x: 132, y: 285, w: 45, h: 106, priority: 8 } },
  { id: 'knee_right', kind: 'ellipse', cx: 154, cy: 395, rx: 15, ry: 16, hit: { x: 135, y: 377, w: 37, h: 38, priority: 10 } },
  { id: 'calf_right', kind: 'path', d: 'M165 411 C169 430 170 447 172 465 C165 469 157 470 148 467 C144 448 141 429 142 411 Z', hit: { x: 138, y: 407, w: 38, h: 64, priority: 9 } },
  { id: 'ankle_right', kind: 'path', d: 'M172 464 L148 464 L149 479 L172 479 Z', hit: { x: 144, y: 461, w: 34, h: 22, priority: 10 } },
  { id: 'heel_right', kind: 'path', d: 'M172 477 C179 484 183 490 181 496 C178 501 171 502 163 499 L148 496 L149 477 Z', hit: { x: 144, y: 474, w: 41, h: 30, priority: 10 } },
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
    toggle: { flexDirection: 'row', alignSelf: 'center', backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.pill, padding: 4, gap: 4 },
    toggleButton: { minWidth: 92, minHeight: 40, paddingHorizontal: theme.spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.pill },
    toggleButtonSelected: { backgroundColor: theme.colors.primary },
    toggleText: { ...theme.typography.caption, fontFamily: theme.fonts.semibold, color: theme.colors.inkSecondary },
    toggleTextSelected: { color: theme.colors.onPrimary },
    diagramWrap: { position: 'relative', minHeight: SVG_H },
    hitTarget: { position: 'absolute', backgroundColor: 'transparent' },
    hint: { ...theme.typography.caption, textAlign: 'center' },
    selectedText: { ...theme.typography.bodySecondary, fontFamily: theme.fonts.semibold, color: theme.colors.primary, textAlign: 'center' },
    emptyText: { ...theme.typography.bodySecondary, color: theme.colors.inkMuted, textAlign: 'center' },
  }), [theme]);

  const renderRegion = (region: RegionShape) => {
    const isSelected = selected.includes(region.id);
    const common = {
      fill: isSelected ? theme.colors.primary : 'transparent',
      stroke: isSelected ? theme.colors.primaryPressed : theme.colors.border,
      strokeWidth: isSelected ? 2.2 : 0.8,
      opacity: isSelected ? 0.88 : 0.62,
    };
    if (region.kind === 'ellipse') {
      return <Ellipse key={region.id} cx={region.cx} cy={region.cy} rx={region.rx} ry={region.ry} {...common} />;
    }
    return <Path key={region.id} d={region.d} {...common} />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.toggle}>
        {(['front', 'back'] as const).map((option) => {
          const active = view === option;
          const label = option === 'front' ? 'Front' : 'Back';
          return (
            <Pressable
              key={option}
              onPress={() => setView(option)}
              accessibilityRole="button"
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
          <Path d={outline} fill={theme.colors.surfaceMuted} stroke={theme.colors.inkMuted} strokeWidth={1.35} />

          {regions.map(renderRegion)}

          {view === 'front' ? (
            <>
              <Path d="M106 117 C116 121 123 122 130 122 C137 122 144 121 154 117" fill="none" stroke={theme.colors.border} strokeWidth={1} opacity={0.7} />
              <Line x1={130} y1={123} x2={130} y2={166} stroke={theme.colors.border} strokeWidth={0.8} opacity={0.55} />
              <Ellipse cx={130} cy={209} rx={2.3} ry={2.3} fill={theme.colors.inkMuted} opacity={0.45} />
              <Path d="M100 256 C110 263 120 266 130 266 C140 266 150 263 160 256" fill="none" stroke={theme.colors.border} strokeWidth={0.8} opacity={0.55} />
            </>
          ) : (
            <>
              <Path d="M101 119 C109 130 116 137 126 143" fill="none" stroke={theme.colors.border} strokeWidth={1} opacity={0.65} />
              <Path d="M159 119 C151 130 144 137 134 143" fill="none" stroke={theme.colors.border} strokeWidth={1} opacity={0.65} />
              <Path d="M130 111 C128 145 129 177 130 212 C131 229 130 244 130 259" fill="none" stroke={theme.colors.inkMuted} strokeWidth={1} opacity={0.5} />
              <Path d="M96 255 C106 263 118 266 130 266 C142 266 154 263 164 255" fill="none" stroke={theme.colors.border} strokeWidth={0.8} opacity={0.55} />
            </>
          )}
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
        {view === 'front' ? 'Front view' : 'Back view'} — tap every area that applies.
      </Text>
      {selected.length > 0 ? (
        <Text style={styles.selectedText}>Selected: {selectedLabels}</Text>
      ) : (
        <Text style={styles.emptyText}>No areas selected yet.</Text>
      )}
    </View>
  );
}
