import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { theme } from '../../utils/theme';

interface ProgressBarProps {
  /** Total number of steps. */
  totalSteps: number;
  /** Zero-based index of the current step. */
  currentStep: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Segmented progress indicator for multi-step flows (Figma treatment:
 * completed and current segments fill in the brand color).
 */
export function ProgressBar({ totalSteps, currentStep, style }: ProgressBarProps) {
  return (
    <View
      style={[styles.row, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: totalSteps, now: currentStep + 1 }}
    >
      {Array.from({ length: totalSteps }).map((_, index) => (
        <View
          key={index}
          style={[styles.segment, index <= currentStep && styles.segmentFilled]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.border,
  },
  segmentFilled: {
    backgroundColor: theme.colors.primary,
  },
});
