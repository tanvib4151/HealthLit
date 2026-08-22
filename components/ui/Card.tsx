import React, { ReactNode, useMemo } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '../../hooks/useTheme';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** When provided, the card becomes pressable. */
  onPress?: () => void;
  /** Required for screen readers when the card is pressable. */
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Base surface for grouped content. White, rounded (radius.xl), softly
 * elevated — the primary building block of every screen.
 */
export function Card({ children, style, onPress, accessibilityLabel, testID }: CardProps) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.xl,
          padding: theme.spacing.xl,
          ...theme.shadows.card,
        },
        pressed: {
          opacity: 0.85,
        },
      }),
    [theme],
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
}
