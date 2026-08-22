import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { theme } from '../../utils/theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  testID?: string;
}

/**
 * Multi-select toggle chip (triggers / relief factors). Selected state
 * uses a solid brand fill with white text for unmistakable contrast.
 */
export function Chip({ label, selected, onToggle, testID }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onToggle}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    ...theme.typography.body,
    fontSize: 15,
    color: theme.colors.inkSecondary,
    fontWeight: '500',
  },
  labelSelected: {
    color: theme.colors.onPrimary,
    fontWeight: '600',
  },
});
