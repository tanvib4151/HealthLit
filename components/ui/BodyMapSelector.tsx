import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';

import { BODY_REGIONS, getRegionLabel } from '../../utils/bodyRegions';
import { theme } from '../../utils/theme';

interface BodyMapSelectorProps {
  /** Selected region IDs. */
  selected: string[];
  /** Called when a region is toggled. */
  onToggle: (regionId: string) => void;
}

/**
 * Interactive body diagram for pain location selection (Tier 1).
 * Tap regions to toggle them on/off. SVG viewBox is 100x200.
 */
export function BodyMapSelector({ selected, onToggle }: BodyMapSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Tap where you feel pain (optional)</Text>
      <Svg width="100%" height={280} viewBox="0 0 100 200" style={styles.svg}>
        {/* Simple stick figure outline */}
        <Circle cx={50} cy={15} r={8} stroke={theme.colors.border} strokeWidth={1} fill="none" />
        <Rect x={42} y={24} width={16} height={20} stroke={theme.colors.border} strokeWidth={1} fill="none" />
        <Rect x={10} y={30} width={80} height={1} stroke={theme.colors.border} strokeWidth={1} />
        <Rect x={20} y={48} width={60} height={1} stroke={theme.colors.border} strokeWidth={1} />
        <Rect x={42} y={46} width={16} height={35} stroke={theme.colors.border} strokeWidth={1} fill="none" />
        <Rect x={20} y={48} width={12} height={45} stroke={theme.colors.border} strokeWidth={1} fill="none" />
        <Rect x={68} y={48} width={12} height={45} stroke={theme.colors.border} strokeWidth={1} fill="none" />
        <Rect x={32} y={82} width={36} height={1} stroke={theme.colors.border} strokeWidth={1} />
        <Rect x={28} y={84} width={14} height={60} stroke={theme.colors.border} strokeWidth={1} fill="none" />
        <Rect x={58} y={84} width={14} height={60} stroke={theme.colors.border} strokeWidth={1} fill="none" />

        {/* Tappable hit zones */}
        {BODY_REGIONS.map((region) => {
          const isSelected = selected.includes(region.id);
          const bounds = region.bounds;
          if (!bounds) return null;

          return (
            <Pressable
              key={region.id}
              onPress={() => onToggle(region.id)}
              accessible
              accessibilityRole="button"
              accessibilityLabel={getRegionLabel(region.id)}
              accessibilityState={{ selected: isSelected }}
            >
              <Rect
                x={bounds.x}
                y={bounds.y}
                width={bounds.width}
                height={bounds.height}
                fill={isSelected ? theme.colors.primary : 'transparent'}
                stroke={isSelected ? theme.colors.primary : theme.colors.border}
                strokeWidth={isSelected ? 0 : 1}
                opacity={isSelected ? 0.3 : 0.1}
              />
              {isSelected && (
                <Circle
                  cx={bounds.x + bounds.width / 2}
                  cy={bounds.y + bounds.height / 2}
                  r={2}
                  fill={theme.colors.primary}
                />
              )}
            </Pressable>
          );
        })}
      </Svg>

      {/* Selected regions list */}
      {selected.length > 0 && (
        <View style={styles.selectedList}>
          <Text style={styles.selectedLabel}>Selected:</Text>
          <View style={styles.chipRow}>
            {selected.map((regionId) => (
              <View key={regionId} style={styles.chip}>
                <Text style={styles.chipText}>{getRegionLabel(regionId)}</Text>
                <Pressable
                  onPress={() => onToggle(regionId)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${getRegionLabel(regionId)}`}
                  hitSlop={4}
                >
                  <Text style={styles.chipClose}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
  },
  label: {
    ...theme.typography.body,
    fontFamily: theme.fonts.medium,
  },
  svg: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectedList: {
    gap: theme.spacing.sm,
  },
  selectedLabel: {
    ...theme.typography.caption,
    fontFamily: theme.fonts.medium,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.pill,
    paddingLeft: theme.spacing.md,
    paddingRight: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  chipText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontFamily: theme.fonts.medium,
  },
  chipClose: {
    fontSize: 18,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
});
