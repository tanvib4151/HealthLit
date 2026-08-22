import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '../ui/Button';
import { useAppPrefsStore } from '../../store/appPrefsStore';
import { useTheme } from '../../hooks/useTheme';
import { formatReminderTime, remindersSupported } from '../../services/reminderService';

/** Reminder times people plausibly want. Evening is the default. */
const TIME_CHOICES: { hour: number; minute: number }[] = [
  { hour: 9, minute: 0 },
  { hour: 13, minute: 0 },
  { hour: 18, minute: 0 },
  { hour: 20, minute: 0 },
  { hour: 21, minute: 30 },
];

/**
 * First-launch onboarding.
 *
 * Three steps, deliberately. The previous first run showed an empty
 * dashboard with no explanation, which is the most common way a
 * health app loses someone in the first thirty seconds: they cannot
 * tell what it is for, so they never log the first entry, so it never
 * becomes useful.
 *
 * The medical disclaimer is folded in as the final step rather than
 * living in its own modal. Two sequential modals on first launch is
 * worse for the user and no better legally — what matters for review
 * is that the disclaimer is unmissable and acknowledged, which it is
 * here.
 *
 * Short by design. Someone downloading a symptom diary may well be
 * unwell right now; a six-screen tour is a tax on exactly the person
 * this app exists for. Everything optional is deferred to Profile.
 */
export function OnboardingFlow() {
  const theme = useTheme();
  const prefs = useAppPrefsStore((state) => state.prefs);
  const hydrated = useAppPrefsStore((state) => state.hydrated);
  const completeOnboarding = useAppPrefsStore((state) => state.completeOnboarding);
  const setReminderEnabled = useAppPrefsStore((state) => state.setReminderEnabled);
  const setReminderTime = useAppPrefsStore((state) => state.setReminderTime);

  const [step, setStep] = useState(0);
  const [chosenTime, setChosenTime] = useState<{ hour: number; minute: number } | null>(
    null,
  );
  const [permissionRefused, setPermissionRefused] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        content: {
          flexGrow: 1,
          padding: theme.spacing.xl,
          paddingTop: theme.spacing.xxl * 2,
          gap: theme.spacing.lg,
        },
        dots: {
          flexDirection: 'row',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.sm,
        },
        dot: {
          width: 28,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.colors.border,
        },
        dotActive: { backgroundColor: theme.colors.primary },
        title: {
          ...theme.typography.title,
          fontSize: 28,
          lineHeight: 34,
        },
        lede: {
          ...theme.typography.bodySecondary,
          fontSize: 17,
          lineHeight: 26,
        },
        pointRow: {
          flexDirection: 'row',
          gap: theme.spacing.md,
          alignItems: 'flex-start',
        },
        pointIcon: {
          width: 38,
          height: 38,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pointBody: { flex: 1, gap: 2 },
        pointTitle: {
          ...theme.typography.body,
          fontFamily: theme.fonts.semibold,
        },
        pointText: {
          ...theme.typography.bodySecondary,
          lineHeight: 22,
        },
        timeRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        },
        timeChip: {
          minHeight: 46,
          paddingHorizontal: theme.spacing.lg,
          justifyContent: 'center',
          borderRadius: theme.radius.pill,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
        timeChipSelected: {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primary,
        },
        timeText: {
          ...theme.typography.body,
          fontFamily: theme.fonts.semibold,
        },
        timeTextSelected: { color: theme.colors.onPrimary },
        disclaimerBox: {
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
        },
        disclaimerLead: {
          ...theme.typography.body,
          fontFamily: theme.fonts.semibold,
        },
        disclaimerText: {
          ...theme.typography.bodySecondary,
          lineHeight: 22,
        },
        note: {
          ...theme.typography.caption,
        },
        spacer: { flex: 1, minHeight: theme.spacing.lg },
        actions: { gap: theme.spacing.sm },
      }),
    [theme],
  );

  // Wait for hydration so returning users never see a flash of this.
  if (!hydrated || prefs.onboardedAt !== null) return null;

  const finish = () => completeOnboarding();

  const handleEnableReminder = async () => {
    const time = chosenTime ?? { hour: prefs.reminderHour, minute: prefs.reminderMinute };
    await setReminderTime(time.hour, time.minute);
    const ok = await setReminderEnabled(true);
    if (!ok) {
      // Permission denied. Don't block — say what happened and let
      // them continue; it can be turned on later from Profile.
      setPermissionRefused(true);
      return;
    }
    setStep(2);
  };

  return (
    <Modal visible animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.dots}>
            {[0, 1, 2].map((index) => (
              <View
                key={index}
                style={[styles.dot, index <= step && styles.dotActive]}
              />
            ))}
          </View>

          {step === 0 && (
            <>
              <Text style={styles.title}>
                Your symptoms, in words a doctor can use
              </Text>
              <Text style={styles.lede}>
                Appointments are short, and months of symptoms are hard to
                summarise from memory. HealthLit remembers for you.
              </Text>

              <View style={styles.spacer} />

              <Point
                styles={styles}
                theme={theme}
                icon="flash-outline"
                title="Logging takes seconds"
                text="Pick what you're feeling, set the severity, save. Everything else is optional."
              />
              <Point
                styles={styles}
                theme={theme}
                icon="document-text-outline"
                title="It writes your story"
                text="Your entries become a structured summary you can print or share before an appointment."
              />
              <Point
                styles={styles}
                theme={theme}
                icon="lock-closed-outline"
                title="Stays on your phone"
                text="No account needed, works offline, and nothing is ever sold or advertised against."
              />

              <View style={styles.spacer} />
              <View style={styles.actions}>
                <Button label="Get started" onPress={() => setStep(1)} />
              </View>
            </>
          )}

          {step === 1 && (
            <>
              <Text style={styles.title}>A daily nudge?</Text>
              <Text style={styles.lede}>
                Reports get better the more consistently you log. One quiet
                reminder a day is usually enough — and you can change or turn it
                off any time in Profile.
              </Text>

              <View style={styles.timeRow}>
                {TIME_CHOICES.map((choice) => {
                  const selected =
                    chosenTime !== null &&
                    chosenTime.hour === choice.hour &&
                    chosenTime.minute === choice.minute;
                  return (
                    <Pressable
                      key={`${choice.hour}:${choice.minute}`}
                      onPress={() => setChosenTime(choice)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[styles.timeChip, selected && styles.timeChipSelected]}
                    >
                      <Text style={[styles.timeText, selected && styles.timeTextSelected]}>
                        {formatReminderTime(choice.hour, choice.minute)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {permissionRefused && (
                <Text style={styles.note}>
                  Notifications are turned off for HealthLit in your device
                  settings. You can still use everything else — turn reminders on
                  later from Profile once you've allowed them.
                </Text>
              )}

              {!remindersSupported() && (
                <Text style={styles.note}>
                  Reminders aren't available on this platform.
                </Text>
              )}

              <View style={styles.spacer} />
              <View style={styles.actions}>
                <Button
                  label="Remind me daily"
                  onPress={handleEnableReminder}
                  disabled={!remindersSupported()}
                />
                <Button
                  label="Not now"
                  variant="ghost"
                  onPress={() => setStep(2)}
                />
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.title}>One thing before you start</Text>

              <View style={styles.disclaimerBox}>
                <Text style={styles.disclaimerLead}>
                  HealthLit is a symptom diary. It is not a medical device and
                  does not give medical advice.
                </Text>
                <Text style={styles.disclaimerText}>
                  It records what you tell it and summarises your own numbers
                  back to you. It does not diagnose conditions, identify causes,
                  predict what will happen, or recommend treatment.
                </Text>
                <Text style={styles.disclaimerText}>
                  Bring a report to your doctor as a record, not a conclusion.
                  Decisions about your care belong to you and them.
                </Text>
                <Text style={styles.disclaimerText}>
                  Never delay seeking medical advice because of anything in this
                  app. If you think you're having a medical emergency, contact
                  your local emergency services.
                </Text>
              </View>

              <View style={styles.spacer} />
              <View style={styles.actions}>
                <Button label="I understand — let's go" onPress={finish} />
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Point({
  styles,
  theme,
  icon,
  title,
  text,
}: {
  styles: Record<string, any>;
  theme: ReturnType<typeof useTheme>;
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.pointRow}>
      <View style={styles.pointIcon}>
        <Ionicons name={icon as any} size={19} color={theme.colors.inkSecondary} />
      </View>
      <View style={styles.pointBody}>
        <Text style={styles.pointTitle}>{title}</Text>
        <Text style={styles.pointText}>{text}</Text>
      </View>
    </View>
  );
}
