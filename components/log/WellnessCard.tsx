import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { useWellnessStore } from '../../store/wellnessStore';
import { useTheme } from '../../hooks/useTheme';
import { MOOD_OPTIONS, WELLNESS_TAGS } from '../../utils/wellness';

/**
 * The final card of a logging session: how the day felt overall.
 *
 * DESIGN CONSTRAINTS, all deliberate:
 *
 * LAST, AND SKIPPABLE. It comes after the symptoms are safely saved,
 * so nothing about someone's physical record depends on answering a
 * question about their mental state. "Skip" is a real, equally
 * weighted button, not a greyed-out afterthought.
 *
 * WORDS, NOT NUMBERS OR FACES. A 0-10 mood score invites arithmetic
 * that means nothing, and cartoon faces are exactly the childish
 * design this app avoids — particularly jarring for an adult managing
 * a serious condition.
 *
 * BALANCED VOCABULARY. Half the tags describe feeling well. A
 * check-in that only offers ways to say you feel bad teaches people
 * to look for bad, and produces data skewed by its own interface.
 *
 * ONE PER DAY. Re-opening the flow later edits that day's entry
 * rather than adding a second, so "how was today" keeps having one
 * answer.
 */
export function WellnessCard({
  occurredAt,
  onDone,
  onSkip,
}: {
  occurredAt: Date;
  onDone: () => void;
  onSkip: () => void;
}) {
  const theme = useTheme();
  const saveCheckIn = useWellnessStore((state) => state.saveCheckIn);
  const checkInForDate = useWellnessStore((state) => state.checkInForDate);

  const existing = checkInForDate(occurredAt);
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5 | null>(
    existing ? existing.mood : null,
  );
  const [tags, setTags] = useState<string[]>(existing ? existing.tags : []);
  const [note, setNote] = useState(existing?.note ?? '');
  const [showNote, setShowNote] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { gap: theme.spacing.lg },
        titleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
        },
        titleIcon: {
          width: 40,
          height: 40,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        },
        title: { ...theme.typography.heading, flex: 1 },
        subtitle: { ...theme.typography.bodySecondary, lineHeight: 22 },
        moodRow: {
          flexDirection: 'row',
          gap: theme.spacing.sm,
        },
        moodOption: {
          flex: 1,
          minHeight: 76,
          borderRadius: theme.radius.lg,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 2,
          gap: 6,
        },
        moodDot: { width: 16, height: 16, borderRadius: 8 },
        moodLabel: {
          ...theme.typography.caption,
          fontSize: 11,
          textAlign: 'center',
        },
        moodLabelSelected: {
          color: theme.colors.onPrimary,
          fontFamily: theme.fonts.semibold,
        },
        sectionLabel: {
          ...theme.typography.body,
          fontFamily: theme.fonts.semibold,
        },
        chipWrap: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        },
        input: {
          ...theme.typography.body,
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radius.lg,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
          padding: theme.spacing.md,
          minHeight: 88,
          textAlignVertical: 'top' as const,
        },
        privacyNote: { ...theme.typography.caption },
        actions: { gap: theme.spacing.sm },
      }),
    [theme],
  );

  const toggleTag = (tag: string) =>
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );

  const handleSave = () => {
    if (mood === null) return;
    saveCheckIn({ mood, tags, note, occurredAt });
    onDone();
  };

  return (
    <Card style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.titleIcon}>
          <Ionicons name="partly-sunny-outline" size={20} color={theme.colors.inkSecondary} />
        </View>
        <Text style={styles.title}>How has today felt?</Text>
      </View>

      <Text style={styles.subtitle}>
        Optional. Living with symptoms affects more than your body, and it is
        worth having a record of that too.
      </Text>

      <View style={styles.moodRow}>
        {MOOD_OPTIONS.map((option) => {
          const selected = mood === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setMood(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              style={[
                styles.moodOption,
                selected && {
                  backgroundColor: option.color,
                  borderColor: option.color,
                },
              ]}
            >
              <View
                style={[
                  styles.moodDot,
                  { backgroundColor: selected ? theme.colors.onPrimary : option.color },
                ]}
              />
              <Text style={[styles.moodLabel, selected && styles.moodLabelSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mood !== null && (
        <>
          <Text style={styles.sectionLabel}>Anything describe it?</Text>
          <View style={styles.chipWrap}>
            {WELLNESS_TAGS.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                selected={tags.includes(tag)}
                onToggle={() => toggleTag(tag)}
              />
            ))}
          </View>

          {showNote ? (
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="In your own words (optional)"
              placeholderTextColor={theme.colors.inkMuted}
              style={styles.input}
              maxLength={1000}
              accessibilityLabel="Note about how today felt"
            />
          ) : (
            <Button
              label="Add a note"
              variant="ghost"
              onPress={() => setShowNote(true)}
            />
          )}

          <Text style={styles.privacyNote}>
            Stored on your phone with everything else. Included in reports only
            if you choose to share them.
          </Text>
        </>
      )}

      <View style={styles.actions}>
        <Button
          label={existing ? 'Update check-in' : 'Save check-in'}
          onPress={handleSave}
          disabled={mood === null}
          accessibilityHint="Saves how today felt and finishes this session"
        />
        <Button
          label="Skip"
          variant="ghost"
          onPress={onSkip}
          accessibilityHint="Finishes without recording how today felt"
        />
      </View>
    </Card>
  );
}
