import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Card } from '../ui/Card';
import { useAppPrefsStore } from '../../store/appPrefsStore';
import { useTheme } from '../../hooks/useTheme';
import { formatReminderTime, remindersSupported } from '../../services/reminderService';

const TIME_CHOICES: { hour: number; minute: number }[] = [
  { hour: 9, minute: 0 },
  { hour: 13, minute: 0 },
  { hour: 18, minute: 0 },
  { hour: 20, minute: 0 },
  { hour: 21, minute: 30 },
];

/**
 * Daily reminder settings.
 *
 * The toggle reports failure honestly rather than springing back with
 * no explanation. If notification permission was denied at the OS
 * level, no amount of tapping will change it from inside the app, and
 * a switch that silently refuses to stay on is the most frustrating
 * possible version of that.
 */
export function ReminderCard() {
  const theme = useTheme();
  const prefs = useAppPrefsStore((state) => state.prefs);
  const setReminderEnabled = useAppPrefsStore((state) => state.setReminderEnabled);
  const setReminderTime = useAppPrefsStore((state) => state.setReminderTime);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { gap: theme.spacing.md },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
        },
        headerBody: { flex: 1, gap: 2 },
        title: { ...theme.typography.body, fontFamily: theme.fonts.semibold },
        caption: { ...theme.typography.caption },
        timeRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        },
        chip: {
          minHeight: 44,
          paddingHorizontal: theme.spacing.md,
          justifyContent: 'center',
          borderRadius: theme.radius.pill,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
        chipSelected: {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primary,
        },
        chipText: { ...theme.typography.caption, fontFamily: theme.fonts.semibold },
        chipTextSelected: { color: theme.colors.onPrimary },
        message: { ...theme.typography.caption, color: theme.colors.warning },
      }),
    [theme],
  );

  if (!remindersSupported()) return null;

  const handleToggle = async (next: boolean) => {
    setBusy(true);
    setMessage(null);
    const ok = await setReminderEnabled(next);
    setBusy(false);
    if (!ok && next) {
      setMessage(
        'Notifications are turned off for HealthLit in your device settings. ' +
          'Allow them there, then try again.',
      );
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerBody}>
          <Text style={styles.title}>Daily reminder</Text>
          <Text style={styles.caption}>
            {prefs.reminderEnabled
              ? `Every day at ${formatReminderTime(prefs.reminderHour, prefs.reminderMinute)}`
              : 'Off — reports get better with consistent logging'}
          </Text>
        </View>
        <Switch
          value={prefs.reminderEnabled}
          onValueChange={handleToggle}
          disabled={busy}
          trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          accessibilityLabel="Daily reminder"
        />
      </View>

      {prefs.reminderEnabled && (
        <View style={styles.timeRow}>
          {TIME_CHOICES.map((choice) => {
            const selected =
              prefs.reminderHour === choice.hour && prefs.reminderMinute === choice.minute;
            return (
              <Pressable
                key={`${choice.hour}:${choice.minute}`}
                onPress={() => void setReminderTime(choice.hour, choice.minute)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {formatReminderTime(choice.hour, choice.minute)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {message !== null && <Text style={styles.message}>{message}</Text>}
    </Card>
  );
}
