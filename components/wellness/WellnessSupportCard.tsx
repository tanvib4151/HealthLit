import React, { useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '../ui/Card';
import { useWellnessStore } from '../../store/wellnessStore';
import { useTheme } from '../../hooks/useTheme';
import { LOW_MOOD_RUN_LENGTH } from '../../utils/wellness';

/**
 * Shown when recent check-ins have been consistently low.
 *
 * WHY THIS EXISTS
 * An app that invites someone to record five consecutive very low
 * days and then says nothing has made a choice — it has decided that
 * information is worth collecting but not worth acknowledging. This
 * card is the minimum honest response to data the app asked for.
 *
 * WHAT IT DELIBERATELY IS NOT
 *
 * Not a screening tool. It counts check-ins; it does not score
 * anything, and it must never be described as detecting a condition.
 *
 * Not a diagnosis, and it names none. The word "depression" does not
 * appear, because an app must not hand someone a clinical term their
 * doctor has not used.
 *
 * Not an alarm. No modal, no red, no interruption of the logging
 * flow. It sits on the Home screen and can be scrolled past. Anything
 * more forceful teaches people to answer dishonestly to avoid it,
 * which destroys the data and helps nobody.
 *
 * Not a substitute for a person. The whole point of the copy is to
 * point outward — to a clinician, someone trusted, or a helpline —
 * rather than to position the app as the thing that helps.
 *
 * It does not fire for one bad day; the threshold is five consecutive
 * low check-ins. See utils/wellness.ts.
 *
 * findahelpline.com is used rather than a hardcoded number because
 * it routes to the right service for the user's own country. A US
 * hotline shown to someone in Manchester is worse than useless.
 */
export function WellnessSupportCard() {
  const theme = useTheme();
  const showSupport = useWellnessStore((state) => state.showSupport);
  const checkIns = useWellnessStore((state) => state.checkIns);

  // Recomputed when check-ins change.
  const visible = useMemo(() => showSupport(), [checkIns, showSupport]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          gap: theme.spacing.md,
          borderLeftWidth: 4,
          borderLeftColor: theme.colors.accentPink,
        },
        titleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
        },
        title: { ...theme.typography.heading, flex: 1 },
        body: { ...theme.typography.bodySecondary, lineHeight: 23 },
        link: {
          ...theme.typography.bodySecondary,
          color: theme.colors.primary,
          fontFamily: theme.fonts.semibold,
          lineHeight: 23,
        },
      }),
    [theme],
  );

  if (!visible) return null;

  return (
    <Card style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="heart-outline" size={20} color={theme.colors.accentPink} />
        <Text style={styles.title}>The last few days have been hard</Text>
      </View>

      <Text style={styles.body}>
        You have recorded {LOW_MOOD_RUN_LENGTH} low days in a row. Managing
        symptoms takes a real toll, and that is worth taking seriously rather
        than pushing through alone.
      </Text>

      <Text style={styles.body}>
        Your doctor is a good place to raise this — it belongs in the same
        conversation as your physical symptoms, and your reports can include
        these check-ins if you want them to. Talking to someone you trust helps
        too.
      </Text>

      <Text
        style={styles.link}
        accessibilityRole="link"
        onPress={() => void Linking.openURL('https://findahelpline.com')}
      >
        Find a free, confidential helpline in your country →
      </Text>
    </Card>
  );
}
