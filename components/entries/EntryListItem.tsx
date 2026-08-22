import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SymptomEntry } from '../../types/models';
import { useCustomSymptomStore } from '../../store/customSymptomStore';
import { useTheme } from '../../hooks/useTheme';
import { formatTime } from '../../utils/entryStats';
import { getSymptomOption, severityLabel } from '../../utils/symptoms';

interface EntryListItemProps {
  entry: SymptomEntry;
  /** When provided, the row becomes tappable to view/edit this entry. */
  onPress?: () => void;
}

/**
 * One logged symptom in a list: tinted symptom icon, name, time, and a
 * severity pill. Shared by the Home dashboard and the History screen.
 * Tappable (when `onPress` is given) to open this entry for editing.
 */
export function EntryListItem({ entry, onPress }: EntryListItemProps) {
  const theme = useTheme();
  const customSymptoms = useCustomSymptomStore((state) => state.customSymptoms);
  const symptom = getSymptomOption(entry.symptomType, customSymptoms);
  const qualities = entry.qualities ?? [];
  const qualitiesText = qualities.length > 0 ? ` · ${qualities.join(', ')}` : '';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          minHeight: 52,
        },
        rowPressed: {
          opacity: 0.7,
        },
        iconCircle: {
          width: 40,
          height: 40,
          borderRadius: theme.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
        },
        textColumn: {
          flex: 1,
          gap: 2,
        },
        title: {
          ...theme.typography.body,
          fontWeight: '600' as const,
        },
        qualities: {
          ...theme.typography.body,
          fontWeight: '400' as const,
          color: theme.colors.inkSecondary,
          fontSize: 14,
        },
        subtitle: {
          ...theme.typography.caption,
        },
        severityPill: {
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
        },
        severityText: {
          ...theme.typography.caption,
          color: theme.colors.ink,
          fontWeight: '600' as const,
        },
      }),
    [theme],
  );

  const accessibilityLabel = `${symptom.label}${
    qualities.length > 0 ? `, feels ${qualities.join(', ')}` : ''
  }, severity ${entry.severity} out of 10, ${severityLabel(
    entry.severity,
  )}, at ${formatTime(entry.loggedAt)}`;

  const content = (
    <>
      <View style={[styles.iconCircle, { backgroundColor: symptom.tintSoft }]}>
        <Ionicons name={symptom.icon} size={18} color={symptom.tint} />
      </View>
      <View style={styles.textColumn}>
        <Text style={styles.title}>
          {symptom.label}
          {qualitiesText ? <Text style={styles.qualities}>{qualitiesText}</Text> : null}
        </Text>
        <Text style={styles.subtitle}>
          {formatTime(entry.loggedAt)} · {severityLabel(entry.severity)}
        </Text>
      </View>
      <View style={styles.severityPill}>
        <Text style={styles.severityText}>{entry.severity}/10</Text>
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={18} color={theme.colors.inkMuted} />
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Opens this entry to view or edit it"
        hitSlop={4}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.row} accessible accessibilityLabel={accessibilityLabel}>
      {content}
    </View>
  );
}
