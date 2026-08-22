import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../utils/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface SelectCardProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Optional leading icon in a tinted circle. */
  icon?: IoniconName;
  iconColor?: string;
  iconBackground?: string;
  testID?: string;
}

/**
 * Single-select option card (Figma: symptom picker rows). Large touch
 * target, clear selected state via border + soft fill — never color
 * alone (a checkmark confirms selection for color-blind users).
 */
export function SelectCard({
  label,
  selected,
  onPress,
  icon,
  iconColor = theme.colors.primary,
  iconBackground = theme.colors.primarySoft,
  testID,
}: SelectCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.pressed,
      ]}
    >
      {icon ? (
        <View style={[styles.iconCircle, { backgroundColor: iconBackground }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
      ) : null}
      <Text style={styles.label}>{label}</Text>
      {selected ? (
        <Ionicons
          name="checkmark-circle"
          size={22}
          color={theme.colors.primary}
          style={styles.check}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: 64,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    ...theme.shadows.card,
  },
  cardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  pressed: {
    opacity: 0.85,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...theme.typography.body,
    fontWeight: '600',
    flex: 1,
  },
  check: {
    marginLeft: theme.spacing.sm,
  },
});
