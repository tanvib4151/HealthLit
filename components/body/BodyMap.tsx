import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgUri } from 'react-native-svg';

import { getRegionLabel } from '../../utils/bodyRegions';
import { useTheme } from '../../hooks/useTheme';

interface BodyMapProps {
  selected: string[];
  onToggle: (regionId: string) => void;
}

type BodyView = 'front' | 'back';
type Zone =
  | { id: string; priority?: number; kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { id: string; priority?: number; kind: 'rect'; x: number; y: number; w: number; h: number; r?: number };

type FigureAsset = {
  uri: string;
  width: number;
  height: number;
  zones: Zone[];
};

const FRONT_URI =
  'https://upload.wikimedia.org/wikipedia/commons/2/2c/Human_silhouette_gender_neutral_front.svg';
const BACK_URI =
  'https://upload.wikimedia.org/wikipedia/commons/8/85/Human_silhouette_gender_neutral_back.svg';

const FRONT_ZONES: Zone[] = [
  { id: 'head', kind: 'ellipse', cx: 280, cy: 86, rx: 70, ry: 82, priority: 5 },
  { id: 'face', kind: 'ellipse', cx: 280, cy: 94, rx: 50, ry: 60, priority: 10 },
  { id: 'neck', kind: 'rect', x: 244, y: 160, w: 72, h: 72, r: 22, priority: 10 },
  { id: 'shoulder_left', kind: 'ellipse', cx: 188, cy: 248, rx: 84, ry: 58, priority: 9 },
  { id: 'shoulder_right', kind: 'ellipse', cx: 371, cy: 248, rx: 84, ry: 58, priority: 9 },
  { id: 'chest_left', kind: 'rect', x: 188, y: 255, w: 92, h: 164, r: 36, priority: 7 },
  { id: 'chest_right', kind: 'rect', x: 279, y: 255, w: 92, h: 164, r: 36, priority: 7 },
  { id: 'upper_abdomen', kind: 'rect', x: 214, y: 412, w: 131, h: 128, r: 34, priority: 7 },
  { id: 'lower_abdomen', kind: 'rect', x: 208, y: 525, w: 143, h: 135, r: 34, priority: 8 },
  { id: 'hip_left', kind: 'ellipse', cx: 229, cy: 650, rx: 70, ry: 58, priority: 9 },
  { id: 'hip_right', kind: 'ellipse', cx: 330, cy: 650, rx: 70, ry: 58, priority: 9 },
  { id: 'upper_arm_left', kind: 'rect', x: 92, y: 278, w: 92, h: 248, r: 42, priority: 8 },
  { id: 'elbow_left', kind: 'ellipse', cx: 116, cy: 520, rx: 48, ry: 48, priority: 10 },
  { id: 'forearm_left', kind: 'rect', x: 63, y: 530, w: 86, h: 230, r: 40, priority: 8 },
  { id: 'hand_left', kind: 'ellipse', cx: 91, cy: 782, rx: 52, ry: 68, priority: 10 },
  { id: 'upper_arm_right', kind: 'rect', x: 375, y: 278, w: 92, h: 248, r: 42, priority: 8 },
  { id: 'elbow_right', kind: 'ellipse', cx: 443, cy: 520, rx: 48, ry: 48, priority: 10 },
  { id: 'forearm_right', kind: 'rect', x: 410, y: 530, w: 86, h: 230, r: 40, priority: 8 },
  { id: 'hand_right', kind: 'ellipse', cx: 468, cy: 782, rx: 52, ry: 68, priority: 10 },
  { id: 'thigh_left', kind: 'rect', x: 185, y: 665, w: 98, h: 268, r: 44, priority: 7 },
  { id: 'knee_left', kind: 'ellipse', cx: 232, cy: 935, rx: 49, ry: 47, priority: 10 },
  { id: 'lower_leg_left', kind: 'rect', x: 190, y: 965, w: 83, h: 163, r: 38, priority: 8 },
  { id: 'ankle_left', kind: 'ellipse', cx: 230, cy: 1119, rx: 39, ry: 34, priority: 10 },
  { id: 'foot_left', kind: 'ellipse', cx: 220, cy: 1165, rx: 65, ry: 37, priority: 10 },
  { id: 'thigh_right', kind: 'rect', x: 276, y: 665, w: 98, h: 268, r: 44, priority: 7 },
  { id: 'knee_right', kind: 'ellipse', cx: 327, cy: 935, rx: 49, ry: 47, priority: 10 },
  { id: 'lower_leg_right', kind: 'rect', x: 286, y: 965, w: 83, h: 163, r: 38, priority: 8 },
  { id: 'ankle_right', kind: 'ellipse', cx: 329, cy: 1119, rx: 39, ry: 34, priority: 10 },
  { id: 'foot_right', kind: 'ellipse', cx: 339, cy: 1165, rx: 65, ry: 37, priority: 10 },
];

const BACK_ZONES: Zone[] = [
  { id: 'head', kind: 'ellipse', cx: 280, cy: 84, rx: 70, ry: 82, priority: 8 },
  { id: 'neck', kind: 'rect', x: 244, y: 158, w: 72, h: 72, r: 22, priority: 10 },
  { id: 'shoulder_left', kind: 'ellipse', cx: 188, cy: 246, rx: 84, ry: 58, priority: 9 },
  { id: 'shoulder_right', kind: 'ellipse', cx: 371, cy: 246, rx: 84, ry: 58, priority: 9 },
  { id: 'shoulder_blade_left', kind: 'ellipse', cx: 229, cy: 320, rx: 67, ry: 88, priority: 8 },
  { id: 'shoulder_blade_right', kind: 'ellipse', cx: 330, cy: 320, rx: 67, ry: 88, priority: 8 },
  { id: 'mid_back', kind: 'rect', x: 211, y: 365, w: 137, h: 175, r: 36, priority: 7 },
  { id: 'lower_back_left', kind: 'rect', x: 205, y: 520, w: 75, h: 125, r: 30, priority: 8 },
  { id: 'lower_back_right', kind: 'rect', x: 279, y: 520, w: 75, h: 125, r: 30, priority: 8 },
  { id: 'glute_left', kind: 'ellipse', cx: 229, cy: 648, rx: 70, ry: 66, priority: 9 },
  { id: 'glute_right', kind: 'ellipse', cx: 330, cy: 648, rx: 70, ry: 66, priority: 9 },
  { id: 'upper_arm_left', kind: 'rect', x: 92, y: 276, w: 92, h: 246, r: 42, priority: 8 },
  { id: 'elbow_left', kind: 'ellipse', cx: 116, cy: 516, rx: 48, ry: 48, priority: 10 },
  { id: 'forearm_left', kind: 'rect', x: 63, y: 526, w: 86, h: 226, r: 40, priority: 8 },
  { id: 'hand_left', kind: 'ellipse', cx: 91, cy: 772, rx: 52, ry: 68, priority: 10 },
  { id: 'upper_arm_right', kind: 'rect', x: 375, y: 276, w: 92, h: 246, r: 42, priority: 8 },
  { id: 'elbow_right', kind: 'ellipse', cx: 443, cy: 516, rx: 48, ry: 48, priority: 10 },
  { id: 'forearm_right', kind: 'rect', x: 410, y: 526, w: 86, h: 226, r: 40, priority: 8 },
  { id: 'hand_right', kind: 'ellipse', cx: 468, cy: 772, rx: 52, ry: 68, priority: 10 },
  { id: 'hamstring_left', kind: 'rect', x: 185, y: 674, w: 98, h: 250, r: 44, priority: 8 },
  { id: 'hamstring_right', kind: 'rect', x: 276, y: 674, w: 98, h: 250, r: 44, priority: 8 },
  { id: 'knee_left', kind: 'ellipse', cx: 232, cy: 925, rx: 49, ry: 47, priority: 10 },
  { id: 'knee_right', kind: 'ellipse', cx: 327, cy: 925, rx: 49, ry: 47, priority: 10 },
  { id: 'calf_left', kind: 'rect', x: 190, y: 955, w: 83, h: 158, r: 38, priority: 8 },
  { id: 'calf_right', kind: 'rect', x: 286, y: 955, w: 83, h: 158, r: 38, priority: 8 },
  { id: 'heel_left', kind: 'ellipse', cx: 229, cy: 1135, rx: 54, ry: 46, priority: 10 },
  { id: 'heel_right', kind: 'ellipse', cx: 330, cy: 1135, rx: 54, ry: 46, priority: 10 },
];

const ASSETS: Record<BodyView, FigureAsset> = {
  front: { uri: FRONT_URI, width: 559, height: 1204, zones: FRONT_ZONES },
  back: { uri: BACK_URI, width: 559, height: 1190, zones: BACK_ZONES },
};

function zoneBox(zone: Zone, scale: number) {
  if (zone.kind === 'ellipse') {
    return {
      left: (zone.cx - zone.rx) * scale,
      top: (zone.cy - zone.ry) * scale,
      width: zone.rx * 2 * scale,
      height: zone.ry * 2 * scale,
      borderRadius: Math.max(zone.rx, zone.ry) * scale,
      zIndex: zone.priority ?? 1,
    };
  }
  return {
    left: zone.x * scale,
    top: zone.y * scale,
    width: zone.w * scale,
    height: zone.h * scale,
    borderRadius: (zone.r ?? 0) * scale,
    zIndex: zone.priority ?? 1,
  };
}

function selectionOutline(zone: Zone) {
  // The interaction zone remains generous, but the visible outline is
  // inset well inside it so it never hangs off the professional figure.
  // This keeps the artwork clean while still showing exactly which area
  // was selected.
  if (zone.kind === 'ellipse') {
    return {
      left: '24%' as const,
      top: '24%' as const,
      right: '24%' as const,
      bottom: '24%' as const,
      borderRadius: 999,
    };
  }

  const verticalInset = zone.h > zone.w * 1.8 ? '18%' : '22%';
  return {
    left: '20%' as const,
    right: '20%' as const,
    top: verticalInset as any,
    bottom: verticalInset as any,
    borderRadius: 999,
  };
}

export function BodyMap({ selected, onToggle }: BodyMapProps) {
  const theme = useTheme();
  const [view, setView] = useState<BodyView>('front');
  const [frameWidth, setFrameWidth] = useState(232);
  const asset = ASSETS[view];
  const selectedLabels = selected.map(getRegionLabel).join(', ');

  const orderedZones = useMemo(
    () => [...asset.zones].sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1)),
    [asset.zones],
  );
  const scale = frameWidth / asset.width;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { gap: theme.spacing.md },
        toggle: {
          flexDirection: 'row',
          alignSelf: 'center',
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radius.pill,
          padding: 4,
          gap: 4,
        },
        toggleButton: {
          minWidth: 92,
          minHeight: 40,
          paddingHorizontal: theme.spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.pill,
        },
        toggleButtonSelected: { backgroundColor: theme.colors.primary },
        toggleText: {
          ...theme.typography.caption,
          fontFamily: theme.fonts.semibold,
          color: theme.colors.inkSecondary,
        },
        toggleTextSelected: { color: theme.colors.onPrimary },
        figureFrame: {
          width: 232,
          alignSelf: 'center',
          position: 'relative',
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.xl,
          overflow: 'hidden',
        },
        hitTarget: {
          position: 'absolute',
          backgroundColor: 'transparent',
        },
        selectedOutline: {
          position: 'absolute',
          borderWidth: 1.5,
          borderColor: theme.colors.primary,
          backgroundColor: 'transparent',
          opacity: 0.95,
        },
        selectedDot: {
          position: 'absolute',
          width: 5,
          height: 5,
          borderRadius: 999,
          backgroundColor: theme.colors.primary,
          left: '50%',
          top: '50%',
          marginLeft: -2.5,
          marginTop: -2.5,
        },
        hint: { ...theme.typography.caption, textAlign: 'center' },
        selectedText: {
          ...theme.typography.bodySecondary,
          fontFamily: theme.fonts.semibold,
          color: theme.colors.primary,
          textAlign: 'center',
        },
        emptyText: {
          ...theme.typography.bodySecondary,
          color: theme.colors.inkMuted,
          textAlign: 'center',
        },
      }),
    [theme],
  );

  return (
    <View style={styles.container}>
      <View style={styles.toggle}>
        {(['front', 'back'] as const).map((option) => {
          const active = view === option;
          return (
            <Pressable
              key={option}
              onPress={() => setView(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${option === 'front' ? 'Front' : 'Back'} body view`}
              style={[styles.toggleButton, active && styles.toggleButtonSelected]}
            >
              <Text style={[styles.toggleText, active && styles.toggleTextSelected]}>
                {option === 'front' ? 'Front' : 'Back'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[styles.figureFrame, { aspectRatio: asset.width / asset.height }]}
        onLayout={(event: LayoutChangeEvent) => setFrameWidth(event.nativeEvent.layout.width)}
      >
        <SvgUri width="100%" height="100%" uri={asset.uri} pointerEvents="none" />

        {orderedZones.map((zone) => {
          const isSelected = selected.includes(zone.id);
          return (
            <Pressable
              key={`hit-${zone.id}`}
              onPress={() => onToggle(zone.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${getRegionLabel(zone.id)}${isSelected ? ', selected' : ''}`}
              accessibilityHint={isSelected ? 'Double tap to remove this area' : 'Double tap to select this area'}
              style={[styles.hitTarget, zoneBox(zone, scale)]}
            >
              {isSelected && (
                <>
                  <View pointerEvents="none" style={[styles.selectedOutline, selectionOutline(zone)]} />
                  <View pointerEvents="none" style={styles.selectedDot} />
                </>
              )}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.hint}>
        {view === 'front' ? 'Front view' : 'Back view'} — tap directly on the figure.
      </Text>

      {selected.length > 0 ? (
        <Text style={styles.selectedText}>Selected: {selectedLabels}</Text>
      ) : (
        <Text style={styles.emptyText}>No areas selected yet.</Text>
      )}
    </View>
  );
}
