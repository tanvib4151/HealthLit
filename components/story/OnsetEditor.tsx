import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { useCustomSymptomStore } from '../../store/customSymptomStore';
import { useLogStore } from '../../store/logStore';
import { useOnsetStore } from '../../store/onsetStore';
import { useTheme } from '../../hooks/useTheme';
import { getSymptomOption } from '../../utils/symptoms';
import { formatDayLabelLong } from '../../utils/storyTimeline';

/** Rough onset offsets — the precision people can actually supply. */
const PRESETS: { label: string; monthsAgo: number; precision: 'month' | 'year' }[] = [
  { label: 'This month', monthsAgo: 0, precision: 'month' },
  { label: '3 months ago', monthsAgo: 3, precision: 'month' },
  { label: '6 months ago', monthsAgo: 6, precision: 'month' },
  { label: '1 year ago', monthsAgo: 12, precision: 'year' },
  { label: '2 years ago', monthsAgo: 24, precision: 'year' },
  { label: '5+ years ago', monthsAgo: 60, precision: 'year' },
];

function dateKeyMonthsAgo(monthsAgo: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Records when each tracked symptom actually began.
 *
 * This is the one clinical fact HealthLit cannot compute. The first
 * logged entry is when someone downloaded the app — presenting that
 * as onset understates how long they have been unwell, sometimes by
 * years, in a document they hand to a doctor.
 *
 * Deliberately coarse: "about 2 years ago" is what people can
 * honestly supply, and demanding an exact date would produce
 * confident fiction. The stored `precision` records how exact the
 * answer was, so the report never overstates it.
 *
 * Lives in Profile rather than onboarding on purpose — nothing here
 * blocks logging, which stays the fast path.
 */
export function OnsetEditor() {
  const theme = useTheme();
  const entries = useLogStore((state) => state.entries);
  const customSymptoms = useCustomSymptomStore((state) => state.customSymptoms);
  const onsets = useOnsetStore((state) => state.onsets);
  const setOnset = useOnsetStore((state) => state.setOnset);
  const removeOnset = useOnsetStore((state) => state.removeOnset);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  // Only symptoms actually logged — no point asking about the rest.
  const trackedTypes = useMemo(
    () => [...new Set(entries.map((entry) => entry.symptomType))],
    [entries],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { gap: theme.spacing.md },
        title: { ...theme.typography.body, fontFamily: theme.fonts.semibold },
        caption: { ...theme.typography.caption },
        row: {
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        rowTitle: { ...theme.typography.body, fontFamily: theme.fonts.semibold },
        rowValue: { ...theme.typography.caption, color: theme.colors.primary },
        chipWrap: {
          flexDirection: 'row' as const,
          flexWrap: 'wrap' as const,
          gap: theme.spacing.sm,
        },
        input: {
          ...theme.typography.body,
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radius.lg,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
          padding: theme.spacing.md,
          minHeight: 44,
        },
      }),
    [theme],
  );

  if (trackedTypes.length === 0) return null;

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>When did each symptom start?</Text>
      <Text style={styles.caption}>
        Reports currently say when a symptom first appeared in your logs, which
        is usually later than when it actually began. A rough answer is fine —
        "about two years ago" is genuinely useful to a doctor.
      </Text>

      {trackedTypes.map((symptomType) => {
        const option = getSymptomOption(symptomType, customSymptoms);
        const existing = onsets.find((onset) => onset.symptomType === symptomType);
        const isOpen = expanded === symptomType;

        return (
          <View key={symptomType} style={styles.row}>
            <Text style={styles.rowTitle}>{option.label}</Text>
            {existing ? (
              <Text style={styles.rowValue}>
                Started around {formatDayLabelLong(existing.onsetDate)}
                {existing.note !== null && existing.note !== ''
                  ? ` — ${existing.note}`
                  : ''}
              </Text>
            ) : (
              <Text style={styles.caption}>Not recorded</Text>
            )}

            {isOpen ? (
              <>
                <View style={styles.chipWrap}>
                  {PRESETS.map((preset) => (
                    <Chip
                      key={preset.label}
                      label={preset.label}
                      selected={false}
                      onToggle={() => {
                        setOnset(
                          symptomType,
                          dateKeyMonthsAgo(preset.monthsAgo),
                          preset.precision,
                          noteDraft.trim() !== '' ? noteDraft.trim() : null,
                        );
                        setNoteDraft('');
                        setExpanded(null);
                      }}
                    />
                  ))}
                </View>
                <TextInput
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                  placeholder="Anything about how it started (optional)"
                  placeholderTextColor={theme.colors.inkMuted}
                  style={styles.input}
                  maxLength={200}
                  accessibilityLabel="Note about how this symptom started"
                />
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={() => {
                    setExpanded(null);
                    setNoteDraft('');
                  }}
                />
              </>
            ) : (
              <View style={styles.chipWrap}>
                <Button
                  label={existing ? 'Change' : 'Set start date'}
                  variant="secondary"
                  onPress={() => {
                    setNoteDraft(existing?.note ?? '');
                    setExpanded(symptomType);
                  }}
                />
                {existing ? (
                  <Button
                    label="Remove"
                    variant="ghost"
                    onPress={() => removeOnset(symptomType)}
                  />
                ) : null}
              </View>
            )}
          </View>
        );
      })}
    </Card>
  );
}
