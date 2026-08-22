import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Screen } from '../components/ui/Screen';
import { useMedicationStore } from '../store/medicationStore';
import { useTheme } from '../hooks/useTheme';

/**
 * Medications management screen (Tier 1).
 * Add, edit, or remove tracked medications.
 */
export default function MedicationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const medications = useMedicationStore((state) => state.medications);
  const addMedication = useMedicationStore((state) => state.addMedication);
  const removeMedication = useMedicationStore((state) => state.removeMedication);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [scheduleNote, setScheduleNote] = useState('');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        },
        backButton: {
          width: 40,
          height: 40,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          ...theme.shadows.card,
        },
        headerTitle: {
          ...theme.typography.title,
        },
        scrollContent: {
          gap: theme.spacing.md,
        },
        emptyCard: {
          gap: theme.spacing.md,
        },
        emptyTitle: {
          ...theme.typography.heading,
        },
        emptyText: {
          ...theme.typography.bodySecondary,
        },
        medicationCard: {
          gap: theme.spacing.md,
        },
        medHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        },
        medInfo: {
          flex: 1,
          gap: theme.spacing.xs,
        },
        medName: {
          ...theme.typography.heading,
        },
        medDose: {
          ...theme.typography.caption,
        },
        medSchedule: {
          ...theme.typography.caption,
          color: theme.colors.primary,
          fontFamily: theme.fonts.medium,
        },
        formCard: {
          gap: theme.spacing.md,
        },
        formTitle: {
          ...theme.typography.heading,
        },
        input: {
          ...theme.typography.body,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
          padding: theme.spacing.lg,
          minHeight: 44,
        },
        formButtons: {
          flexDirection: 'row',
          gap: theme.spacing.md,
        },
        formButton: {
          flex: 1,
        },
      }),
    [theme],
  );

  const handleAdd = () => {
    if (name.trim()) {
      addMedication(name.trim(), dose.trim(), scheduleNote.trim() || null);
      setName('');
      setDose('');
      setScheduleNote('');
      setShowForm(false);
    }
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Medications</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {medications.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No medications tracked yet</Text>
            <Text style={styles.emptyText}>
              Track medications to correlate adherence with pain levels.
            </Text>
          </Card>
        ) : (
          medications.map((med) => (
            <Card key={med.id} style={styles.medicationCard}>
              <View style={styles.medHeader}>
                <View style={styles.medInfo}>
                  <Text style={styles.medName}>{med.name}</Text>
                  {med.dose && <Text style={styles.medDose}>{med.dose}</Text>}
                  {med.scheduleNote && <Text style={styles.medSchedule}>{med.scheduleNote}</Text>}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${med.name}`}
                  onPress={() => removeMedication(med.id)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
                </Pressable>
              </View>
            </Card>
          ))
        )}

        {showForm ? (
          <Card style={styles.formCard}>
            <Text style={styles.formTitle}>Add Medication</Text>
            <TextInput
              placeholder="Medication name"
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholderTextColor={theme.colors.inkMuted}
            />
            <TextInput
              placeholder="Dose (optional)"
              value={dose}
              onChangeText={setDose}
              style={styles.input}
              placeholderTextColor={theme.colors.inkMuted}
            />
            <TextInput
              placeholder="Schedule (optional)"
              value={scheduleNote}
              onChangeText={setScheduleNote}
              style={styles.input}
              placeholderTextColor={theme.colors.inkMuted}
            />
            <View style={styles.formButtons}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => {
                  setShowForm(false);
                  setName('');
                  setDose('');
                  setScheduleNote('');
                }}
                style={styles.formButton}
              />
              <Button
                label="Add"
                onPress={handleAdd}
                disabled={!name.trim()}
                style={styles.formButton}
              />
            </View>
          </Card>
        ) : (
          <Button
            label="Add Medication"
            onPress={() => setShowForm(true)}
            accessibilityHint="Opens the medication form"
          />
        )}
      </ScrollView>
    </Screen>
  );
}
