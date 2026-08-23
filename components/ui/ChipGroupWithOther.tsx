import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Chip } from './Chip';
import { useTheme } from '../../hooks/useTheme';

/**
 * A chip group with a free-text "Other" escape hatch.
 *
 * WHY THIS EXISTS
 *
 * A fixed list of eight relief factors cannot cover what actually
 * helps a given person. Someone whose migraines ease with a specific
 * breathing exercise, a particular position, or something their
 * physiotherapist taught them has no way to record it — so either
 * they force it into a category that does not fit, or the information
 * is lost. Both outcomes corrupt the data the story engine reads.
 *
 * Custom values are stored as ordinary strings in the same array as
 * the preset ones, so everything downstream — entity resolution,
 * paired analysis, the report — treats them identically with no
 * special-casing. utils/healthEvents.ts already normalises case and
 * spacing, so "Ice pack" and "ice pack" resolve to one factor rather
 * than two.
 *
 * Deliberately NOT a permanent list the user curates. A custom factor
 * typed once is a fact about that reading; promoting it to a managed
 * preset is a settings screen nobody asked for.
 */
export function ChipGroupWithOther({
  options,
  selected,
  onToggle,
  placeholder = 'Something else…',
  accessibilityLabel,
}: {
  /** Preset options. */
  options: string[];
  /** Currently selected values — may include custom ones. */
  selected: string[];
  onToggle: (value: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  // Anything selected that isn't a preset was typed by the user.
  const customValues = selected.filter((value) => !options.includes(value));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          flexDirection: 'row' as const,
          flexWrap: 'wrap' as const,
          gap: theme.spacing.sm,
          alignItems: 'center' as const,
        },
        otherChip: {
          minHeight: 44,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radius.pill,
          borderWidth: 1.5,
          borderStyle: 'dashed' as const,
          borderColor: theme.colors.border,
          backgroundColor: 'transparent',
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          gap: theme.spacing.xs,
        },
        otherLabel: {
          ...theme.typography.body,
          color: theme.colors.inkSecondary,
        },
        inputRow: {
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          gap: theme.spacing.sm,
          width: '100%' as const,
        },
        input: {
          ...theme.typography.body,
          flex: 1,
          minHeight: 44,
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radius.lg,
          borderWidth: 1.5,
          borderColor: theme.colors.primary,
          paddingHorizontal: theme.spacing.md,
        },
        addButton: {
          minHeight: 44,
          minWidth: 44,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.primary,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          paddingHorizontal: theme.spacing.md,
        },
      }),
    [theme],
  );

  const commit = () => {
    const value = draft.trim();
    // Guard against re-adding something already selected, which would
    // toggle it OFF and look like the app ate the input.
    if (value !== '' && !selected.includes(value)) onToggle(value);
    setDraft('');
    setAdding(false);
  };

  return (
    <View style={styles.wrap} accessibilityLabel={accessibilityLabel}>
      {options.map((option) => (
        <Chip
          key={option}
          label={option}
          selected={selected.includes(option)}
          onToggle={() => onToggle(option)}
        />
      ))}

      {/* Custom values render as normal chips — once added they are
          indistinguishable from presets, because to the engine they
          are. */}
      {customValues.map((value) => (
        <Chip
          key={value}
          label={value}
          selected
          onToggle={() => onToggle(value)}
        />
      ))}

      {adding ? (
        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.inkMuted}
            style={styles.input}
            maxLength={60}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={commit}
            onBlur={commit}
            accessibilityLabel={placeholder}
          />
          <Pressable
            onPress={commit}
            style={styles.addButton}
            accessibilityRole="button"
            accessibilityLabel="Add"
          >
            <Ionicons name="checkmark" size={20} color={theme.colors.onPrimary} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => setAdding(true)}
          style={styles.otherChip}
          accessibilityRole="button"
          accessibilityLabel="Add something else"
        >
          <Ionicons name="add" size={16} color={theme.colors.inkSecondary} />
          <Text style={styles.otherLabel}>Other</Text>
        </Pressable>
      )}
    </View>
  );
}
