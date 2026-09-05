import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { BodyMap } from '../components/body/BodyMap';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { ChipGroupWithOther } from '../components/ui/ChipGroupWithOther';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Screen } from '../components/ui/Screen';
import { SelectCard } from '../components/ui/SelectCard';
import { useCustomSymptomStore } from '../store/customSymptomStore';
import { useLogStore } from '../store/logStore';
import { useMedicationStore } from '../store/medicationStore';
import { WellnessCard } from '../components/log/WellnessCard';
import { SymptomEntry } from '../types/models';
import { getRegionLabel } from '../utils/bodyRegions';
import { CUSTOM_SYMPTOM_ICONS, CUSTOM_SYMPTOM_TINTS } from '../utils/customSymptomPalette';
import {
  dateKeyFromDate,
  findLatestEntryForSymptomOnDay,
  formatHourMinute,
  formatRelativeDayLabel,
  formatTime,
  getStreakDays,
} from '../utils/entryStats';
import {
  DURATION_OPTIONS,
  LOCATION_SYMPTOMS,
  QUALITY_OPTIONS,
  QUALITY_SYMPTOMS,
  RELIEF_OPTIONS,
  SYMPTOM_OPTIONS,
  TRIGGER_OPTIONS,
  getSymptomOption,
  severityColor,
  severityLabel,
} from '../utils/symptoms';
import { useTheme } from '../hooks/useTheme';

type PhaseKey = 'Symptom' | 'When' | 'Cards';
const PHASE_ORDER: PhaseKey[] = ['Symptom', 'When', 'Cards'];
const SEVERITY_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SAVE_FADE_MS = 160;
const SAVE_HOLD_MS = 620;

export default function LogScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ entryId?: string }>();
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [finishedEntries, setFinishedEntries] = useState<SymptomEntry[] | null>(null);
  const [wasEditing, setWasEditing] = useState(false);

  const draft = useLogStore((state) => state.draft);
  const entries = useLogStore((state) => state.entries);
  const editingEntryId = useLogStore((state) => state.editingEntryId);
  const startEditingEntry = useLogStore((state) => state.startEditingEntry);
  const resetDraft = useLogStore((state) => state.resetDraft);
  const isEditing = editingEntryId !== null;

  useEffect(() => {
    if (params.entryId) {
      if (editingEntryId !== params.entryId) {
        const target = entries.find((entry) => entry.id === params.entryId);
        if (target) startEditingEntry(target);
      }
    } else if (editingEntryId !== null) {
      resetDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.entryId]);

  useEffect(() => {
    if (isEditing) setPhaseIndex(PHASE_ORDER.indexOf('Cards'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingEntryId]);

  const currentPhase = PHASE_ORDER[Math.min(phaseIndex, PHASE_ORDER.length - 1)];
  const canContinue = currentPhase === 'Symptom' ? draft.symptomDrafts.length > 0 : true;

  const styles = useMemo(
    () => StyleSheet.create({
      stepCaption: { ...theme.typography.caption },
      dateConfirmation: { ...theme.typography.body, fontFamily: theme.fonts.semibold, color: theme.colors.primary, marginBottom: 2 },
      buttonRow: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.sm },
      backButton: { flex: 1 },
      continueButton: { flex: 2 },
    }), [theme]);

  const handleFinish = (saved: SymptomEntry[]) => {
    Keyboard.dismiss();
    setWasEditing(isEditing);
    setFinishedEntries(saved);
    setPhaseIndex(0);
    resetDraft();
  };

  const occurredAt = useLogStore((state) => state.draft.occurredAt);

  if (finishedEntries) {
    return (
      <SuccessView
        entries={finishedEntries}
        isEditing={wasEditing}
        onDone={() => {
          setFinishedEntries(null);
          router.push('/');
        }}
        onLogAnother={() => setFinishedEntries(null)}
      />
    );
  }

  const phaseCaption = currentPhase === 'Cards'
    ? `${isEditing ? 'Editing entry — ' : ''}Details for each symptom`
    : `${isEditing ? 'Editing entry — ' : ''}Step ${phaseIndex + 1} of ${PHASE_ORDER.length} — ${currentPhase}`;

  return (
    <Screen showHeader>
      <ProgressBar totalSteps={PHASE_ORDER.length} currentStep={phaseIndex} />
      <Text style={styles.dateConfirmation}>Logging for {formatRelativeDayLabel(occurredAt)}</Text>
      <Text style={styles.stepCaption}>{phaseCaption}</Text>

      {currentPhase === 'Symptom' && <SymptomStep />}
      {currentPhase === 'When' && <WhenStep />}
      {currentPhase === 'Cards' && <SymptomCardDeck isEditing={isEditing} onFinish={handleFinish} />}

      {currentPhase !== 'Cards' && (
        <View style={styles.buttonRow}>
          {phaseIndex > 0 && (
            <Button label="Back" variant="secondary" onPress={() => setPhaseIndex((index) => Math.max(0, index - 1))} style={styles.backButton} accessibilityHint="Returns to the previous question" />
          )}
          <Button label="Continue" onPress={() => setPhaseIndex((index) => index + 1)} disabled={!canContinue} style={styles.continueButton} accessibilityHint="Goes to the next question" />
        </View>
      )}

      {currentPhase === 'Cards' && !isEditing && (
        <Button label="Back" variant="ghost" onPress={() => setPhaseIndex(PHASE_ORDER.indexOf('When'))} accessibilityHint="Returns to the date and time question" />
      )}
    </Screen>
  );
}

interface SymptomCardDeckProps {
  isEditing: boolean;
  onFinish: (entries: SymptomEntry[]) => void;
}

function SymptomCardDeck({ isEditing, onFinish }: SymptomCardDeckProps) {
  const theme = useTheme();
  const symptomDrafts = useLogStore((state) => state.draft.symptomDrafts);
  const occurredAt = useLogStore((state) => state.draft.occurredAt);
  const saveSymptomCard = useLogStore((state) => state.saveSymptomCard);
  const customSymptoms = useCustomSymptomStore((state) => state.customSymptoms);

  const firstUnsaved = symptomDrafts.find((card) => !card.saved)?.symptomType ?? null;
  const [focusedType, setFocusedType] = useState<string | null>(firstUnsaved);
  const [checkmarkType, setCheckmarkType] = useState<string | null>(null);
  const [addingSymptom, setAddingSymptom] = useState(false);
  const toggleSymptomType = useLogStore((state) => state.toggleSymptomType);
  const fade = React.useRef(new Animated.Value(1)).current;
  const saveTransitionTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (focusedType === null && checkmarkType === null && firstUnsaved !== null) setFocusedType(firstUnsaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstUnsaved]);

  useEffect(() => () => {
    if (saveTransitionTimer.current) clearTimeout(saveTransitionTimer.current);
    fade.stopAnimation();
  }, [fade]);

  const savedCount = symptomDrafts.filter((card) => card.saved).length;
  const allSaved = symptomDrafts.length > 0 && savedCount === symptomDrafts.length;
  const [wellnessDone, setWellnessDone] = useState(isEditing);
  const showWellness = allSaved && checkmarkType === null && !wellnessDone;

  const styles = useMemo(
    () => StyleSheet.create({
      deck: { gap: theme.spacing.md },
      progressText: { ...theme.typography.caption, textAlign: 'center' as const },
      collapsedRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: theme.spacing.md, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.lg },
      backgrounded: { opacity: 0.35 },
      collapsedIcon: { width: 36, height: 36, borderRadius: theme.radius.pill, alignItems: 'center' as const, justifyContent: 'center' as const },
      collapsedBody: { flex: 1, gap: 2 },
      collapsedLabel: { ...theme.typography.body, fontFamily: theme.fonts.semibold },
      collapsedMeta: { ...theme.typography.caption },
      checkCard: { alignItems: 'center' as const, justifyContent: 'center' as const, gap: theme.spacing.sm, paddingVertical: theme.spacing.xxl },
      checkCircle: { width: 64, height: 64, borderRadius: theme.radius.pill, backgroundColor: theme.colors.successSoft, alignItems: 'center' as const, justifyContent: 'center' as const },
      addPickerCard: { gap: theme.spacing.md },
      addPickerTitle: { ...theme.typography.body, fontFamily: theme.fonts.semibold },
      addPickerWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: theme.spacing.sm },
      checkText: { ...theme.typography.body, color: theme.colors.success, fontFamily: theme.fonts.semibold },
    }), [theme]);

  const useNativeDriver = Platform.OS !== 'web';

  const runSaveTransition = (symptomType: string) => {
    const saved = saveSymptomCard(symptomType);
    if (!saved) return;

    Keyboard.dismiss();
    setCheckmarkType(symptomType);
    setFocusedType(null);
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: SAVE_FADE_MS, useNativeDriver }).start();

    if (saveTransitionTimer.current) clearTimeout(saveTransitionTimer.current);
    saveTransitionTimer.current = setTimeout(() => {
      setCheckmarkType(null);
      fade.setValue(1);
      const next = useLogStore.getState().draft.symptomDrafts.find((card) => !card.saved);
      setFocusedType(next ? next.symptomType : null);
      saveTransitionTimer.current = null;
    }, SAVE_HOLD_MS);
  };

  const handleDone = () => {
    const ids = useLogStore.getState().draft.symptomDrafts.map((card) => card.entryId).filter((id): id is string => id !== null);
    const currentEntries = useLogStore.getState().entries;
    const saved = ids.map((id) => currentEntries.find((entry) => entry.id === id)).filter((entry): entry is SymptomEntry => entry !== undefined);
    onFinish(saved);
  };

  if (symptomDrafts.length === 0) {
    return <Card><Text style={styles.collapsedMeta}>No symptoms selected yet — go back and pick at least one.</Text></Card>;
  }

  return (
    <View style={styles.deck}>
      {symptomDrafts.length > 1 && <Text style={styles.progressText}>{savedCount} of {symptomDrafts.length} saved</Text>}

      {symptomDrafts.map((card) => {
        const option = getSymptomOption(card.symptomType, customSymptoms);
        const isFocused = focusedType === card.symptomType;
        const isCheckmark = checkmarkType === card.symptomType;

        if (isCheckmark) {
          return (
            <Animated.View key={card.symptomType} style={{ opacity: fade }}>
              <Card style={styles.checkCard}>
                <View style={styles.checkCircle}><Ionicons name="checkmark" size={34} color={theme.colors.success} /></View>
                <Text style={styles.checkText}>{option.label} saved</Text>
              </Card>
            </Animated.View>
          );
        }

        if (isFocused) {
          return (
            <SymptomCardEditor
              key={card.symptomType}
              symptomType={card.symptomType}
              isEditing={isEditing}
              otherCards={symptomDrafts.filter((other) => other.symptomType !== card.symptomType)}
              onSave={() => runSaveTransition(card.symptomType)}
              onCollapse={() => setFocusedType(null)}
            />
          );
        }

        const severityText = card.severity !== null ? `${card.severity}/10 · ${severityLabel(card.severity)}` : 'Not set yet';
        return (
          <View key={card.symptomType} style={styles.backgrounded}>
            <Card onPress={() => setFocusedType(card.symptomType)} accessibilityLabel={`${option.label}, ${card.saved ? 'saved' : 'not saved yet'}. Opens this symptom.`} style={styles.collapsedRow}>
              <View style={[styles.collapsedIcon, { backgroundColor: option.tintSoft }]}><Ionicons name={option.icon as any} size={18} color={option.tint} /></View>
              <View style={styles.collapsedBody}><Text style={styles.collapsedLabel}>{option.label}</Text><Text style={styles.collapsedMeta}>{severityText}</Text></View>
              <Ionicons name={card.saved ? 'checkmark-circle' : 'chevron-forward'} size={20} color={card.saved ? theme.colors.success : theme.colors.inkMuted} />
            </Card>
          </View>
        );
      })}

      {showWellness && <WellnessCard occurredAt={occurredAt} onDone={() => setWellnessDone(true)} onSkip={() => setWellnessDone(true)} />}

      {!isEditing && checkmarkType === null && !addingSymptom && (
        <Button label="+ Add another symptom" variant="secondary" onPress={() => setAddingSymptom(true)} accessibilityHint="Adds another symptom card to this session" />
      )}

      {!isEditing && addingSymptom && (
        <Card style={styles.addPickerCard}>
          <Text style={styles.addPickerTitle}>Add another symptom</Text>
          <View style={styles.addPickerWrap}>
            {SYMPTOM_OPTIONS.filter((option) => !symptomDrafts.some((card) => card.symptomType === option.type)).map((option) => (
              <Chip key={option.type} label={option.label} selected={false} onToggle={() => { toggleSymptomType(option.type); setFocusedType(option.type); setAddingSymptom(false); }} />
            ))}
            {customSymptoms.filter((custom) => !symptomDrafts.some((card) => card.symptomType === custom.id)).map((custom) => (
              <Chip key={custom.id} label={custom.label} selected={false} onToggle={() => { toggleSymptomType(custom.id); setFocusedType(custom.id); setAddingSymptom(false); }} />
            ))}
          </View>
          <Button label="Cancel" variant="ghost" onPress={() => setAddingSymptom(false)} />
        </Card>
      )}

      {allSaved && checkmarkType === null && wellnessDone && (
        <Button label={isEditing ? 'Done' : 'Finish'} onPress={handleDone} accessibilityHint="Finishes this logging session" />
      )}
    </View>
  );
}

interface SymptomCardEditorProps {
  symptomType: string;
  isEditing: boolean;
  otherCards: { symptomType: string; severity: number | null }[];
  onSave: () => void;
  onCollapse: () => void;
}

function SymptomCardEditor({ symptomType, isEditing, otherCards, onSave, onCollapse }: SymptomCardEditorProps) {
  const theme = useTheme();
  const customSymptoms = useCustomSymptomStore((state) => state.customSymptoms);
  const card = useLogStore((state) => state.draft.symptomDrafts.find((item) => item.symptomType === symptomType));
  const copyCardDetails = useLogStore((state) => state.copyCardDetails);
  const [showOptional, setShowOptional] = useState(false);
  const option = getSymptomOption(symptomType, customSymptoms);
  const showLocation = LOCATION_SYMPTOMS.includes(symptomType);

  const styles = useMemo(
    () => StyleSheet.create({
      card: { gap: theme.spacing.lg },
      titleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: theme.spacing.md },
      titleIcon: { width: 40, height: 40, borderRadius: theme.radius.pill, alignItems: 'center' as const, justifyContent: 'center' as const },
      title: { ...theme.typography.heading, flex: 1 },
      divider: { height: 1, backgroundColor: theme.colors.border },
      savedNote: { ...theme.typography.caption, color: theme.colors.success },
    }), [theme]);

  if (!card) return null;
  const copySource = otherCards.find((other) => other.severity !== null);

  return (
    <Card style={styles.card}>
      <View style={styles.titleRow}>
        <View style={[styles.titleIcon, { backgroundColor: option.tintSoft }]}><Ionicons name={option.icon as any} size={20} color={option.tint} /></View>
        <Text style={styles.title}>{option.label}</Text>
        {otherCards.length > 0 && <Pressable onPress={onCollapse} hitSlop={12} accessibilityRole="button" accessibilityLabel="Collapse this symptom"><Ionicons name="chevron-up" size={22} color={theme.colors.inkMuted} /></Pressable>}
      </View>

      {card.saved && <Text style={styles.savedNote}>Already saved — any change here updates that entry.</Text>}
      {copySource && !card.saved && <Button label={`Same details as ${getSymptomOption(copySource.symptomType, customSymptoms).label}`} variant="secondary" onPress={() => copyCardDetails(copySource.symptomType, symptomType)} accessibilityHint="Copies duration, factors, and notes from that symptom — severity stays separate" />}

      <SeverityDial symptomType={symptomType} />
      <View style={styles.divider} />

      {showOptional ? (
        <>
          {showLocation && <LocationSection symptomType={symptomType} />}
          <DurationSection symptomType={symptomType} />
          <FactorsSection symptomType={symptomType} />
          <MedicationSection symptomType={symptomType} />
          <NotesSection symptomType={symptomType} />
        </>
      ) : (
        <Button label="+ Add duration, factors and notes" variant="secondary" onPress={() => setShowOptional(true)} accessibilityHint="Opens the optional detail fields for this symptom" />
      )}

      <Button label={isEditing ? 'Save changes' : card.saved ? 'Update' : 'Save'} onPress={onSave} disabled={card.severity === null} accessibilityHint={`Saves the ${option.label} entry and moves to the next symptom`} />
    </Card>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create({ stepHeader: { gap: theme.spacing.xs }, stepTitle: { ...theme.typography.title }, stepSubtitle: { ...theme.typography.bodySecondary } }), [theme]);
  return <View style={styles.stepHeader}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepSubtitle}>{subtitle}</Text></View>;
}

function SymptomStep() {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create({ stepBody: { gap: theme.spacing.md } }), [theme]);
  const symptomDrafts = useLogStore((state) => state.draft.symptomDrafts);
  const symptomTypes = symptomDrafts.map((card) => card.symptomType);
  const toggleSymptomType = useLogStore((state) => state.toggleSymptomType);
  const customSymptoms = useCustomSymptomStore((state) => state.customSymptoms);
  const addCustomSymptom = useCustomSymptomStore((state) => state.addCustomSymptom);
  const [showAddCustom, setShowAddCustom] = useState(false);

  return (
    <View style={styles.stepBody}>
      <StepHeader title="What are you experiencing?" subtitle="Select all the symptoms you'd like to log — each one gets its own card to fill in." />
      {SYMPTOM_OPTIONS.map((option) => <SelectCard key={option.type} label={option.label} icon={option.icon} iconColor={option.tint} iconBackground={option.tintSoft} selected={symptomTypes.includes(option.type)} onPress={() => toggleSymptomType(option.type)} />)}
      {customSymptoms.map((custom) => <SelectCard key={custom.id} label={custom.label} icon={custom.icon as any} iconColor={custom.tint} iconBackground={custom.tintSoft} selected={symptomTypes.includes(custom.id)} onPress={() => toggleSymptomType(custom.id)} />)}
      {showAddCustom ? (
        <AddCustomSymptomForm onCancel={() => setShowAddCustom(false)} onCreated={(id) => { toggleSymptomType(id); setShowAddCustom(false); }} addCustomSymptom={addCustomSymptom} />
      ) : (
        <Button label="Add custom symptom" variant="ghost" onPress={() => setShowAddCustom(true)} accessibilityHint="Create a symptom type not in this list" />
      )}
    </View>
  );
}

function WhenStep() {
  const theme = useTheme();
  const symptomDrafts = useLogStore((state) => state.draft.symptomDrafts);
  const symptomTypes = symptomDrafts.map((card) => card.symptomType);
  const occurredAt = useLogStore((state) => state.draft.occurredAt);
  const setOccurredAt = useLogStore((state) => state.setOccurredAt);
  const entries = useLogStore((state) => state.entries);
  const editingEntryId = useLogStore((state) => state.editingEntryId);
  const startEditingEntry = useLogStore((state) => state.startEditingEntry);
  const selectedDateKey = dateKeyFromDate(occurredAt);

  const styles = useMemo(() => StyleSheet.create({
    stepBody: { gap: theme.spacing.lg },
    sectionLabel: { ...theme.typography.caption, fontFamily: theme.fonts.semibold },
    carouselCard: { borderRadius: theme.radius.xl, backgroundColor: theme.colors.surfaceMuted, paddingVertical: theme.spacing.lg, overflow: 'hidden' as const },
    centerMarker: { position: 'absolute' as const, top: 0, bottom: 0, left: '50%' as const, width: 3, marginLeft: -1.5, borderRadius: 2, backgroundColor: theme.colors.primary },
    tick: { width: 68, alignItems: 'center' as const, justifyContent: 'center' as const },
    tickPill: { paddingHorizontal: theme.spacing.md, paddingVertical: 6, borderRadius: theme.radius.pill },
    tickPillSelected: { backgroundColor: theme.colors.primary },
    tickLabel: { fontFamily: theme.fonts.semibold, color: theme.colors.ink },
    tickLabelSelected: { color: theme.colors.onPrimary },
    selectedTimeCaption: { ...theme.typography.body, fontFamily: theme.fonts.semibold, color: theme.colors.primary, textAlign: 'center' as const, marginTop: theme.spacing.xs },
  }), [theme]);

  const TIME_TICK_WIDTH = 68;
  const timeOptions = useMemo(() => {
    const options: { key: string; label: string; hour: number; minute: number }[] = [];
    for (let minutesFromMidnight = 0; minutesFromMidnight < 24 * 60; minutesFromMidnight += 15) {
      const hour = Math.floor(minutesFromMidnight / 60);
      const minute = minutesFromMidnight % 60;
      options.push({ key: `${hour}:${minute}`, label: formatHourMinute(hour, minute), hour, minute });
    }
    return options;
  }, []);

  const minutesFromMidnight = occurredAt.getHours() * 60 + occurredAt.getMinutes();
  const selectedTimeIndex = Math.max(0, Math.min(timeOptions.length - 1, Math.round(minutesFromMidnight / 15)));

  const [timeContainerWidth, setTimeContainerWidth] = useState(0);
  const timeScrollRef = React.useRef<any>(null);
  const timeScrollX = React.useRef(new Animated.Value(selectedTimeIndex * TIME_TICK_WIDTH)).current;
  const latestTimeScrollX = React.useRef(selectedTimeIndex * TIME_TICK_WIDTH);
  const timeWheelSettleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = timeScrollX.addListener(({ value }) => { latestTimeScrollX.current = value; });
    return () => scrollXCleanup(timeScrollX, id);
  }, [timeScrollX]);

  useEffect(() => () => {
    if (timeWheelSettleTimer.current) clearTimeout(timeWheelSettleTimer.current);
  }, []);

  useEffect(() => {
    if (timeContainerWidth <= 0) return;
    const x = selectedTimeIndex * TIME_TICK_WIDTH;
    latestTimeScrollX.current = x;
    timeScrollX.setValue(x);
    timeScrollRef.current?.scrollTo({ x, animated: false });
  }, [timeContainerWidth, selectedTimeIndex, timeScrollX]);

  const timeSidePadding = Math.max(0, timeContainerWidth / 2 - TIME_TICK_WIDTH / 2);
  const maxTimeIndex = timeOptions.length - 1;

  const snapToTimeIndex = (rawIndex: number, animated: boolean) => {
    const clamped = Math.max(0, Math.min(maxTimeIndex, Math.round(rawIndex)));
    const option = timeOptions[clamped];
    const next = new Date(occurredAt);
    next.setHours(option.hour, option.minute, 0, 0);
    latestTimeScrollX.current = clamped * TIME_TICK_WIDTH;
    setOccurredAt(next);
    if (animated) timeScrollRef.current?.scrollTo({ x: latestTimeScrollX.current, animated: true });
  };

  const handleTimeScrollSettle = () => snapToTimeIndex(latestTimeScrollX.current / TIME_TICK_WIDTH, false);

  const handleTimeWheel = (event: any) => {
    if (Platform.OS !== 'web') return;
    event.preventDefault?.();
    const delta = event.deltaY ?? 0;
    const nextX = Math.max(0, Math.min(maxTimeIndex * TIME_TICK_WIDTH, latestTimeScrollX.current + delta));
    latestTimeScrollX.current = nextX;
    timeScrollRef.current?.scrollTo({ x: nextX, animated: false });
    if (timeWheelSettleTimer.current) clearTimeout(timeWheelSettleTimer.current);
    timeWheelSettleTimer.current = setTimeout(handleTimeScrollSettle, 120);
  };

  const existingOnSelectedDay = useMemo(() => {
    if (editingEntryId !== null) return [];
    return symptomTypes
      .map((type) => findLatestEntryForSymptomOnDay(entries, type, selectedDateKey))
      .filter((entry): entry is SymptomEntry => entry !== null);
  }, [symptomTypes, entries, editingEntryId, selectedDateKey]);

  return (
    <View style={styles.stepBody}>
      <StepHeader title="What time, roughly?" subtitle={`Logging for ${formatRelativeDayLabel(occurredAt)}. Change the day from Home if this isn't right.`} />
      <View>
        <Text style={styles.sectionLabel}>Time</Text>
        <View
          style={styles.carouselCard}
          onLayout={(e) => setTimeContainerWidth(e.nativeEvent.layout.width)}
          // @ts-expect-error react-native-web forwards onWheel.
          onWheel={handleTimeWheel}
          accessibilityRole="adjustable"
          accessibilityLabel={`Time, ${timeOptions[selectedTimeIndex]?.label ?? ''}`}
        >
          <View pointerEvents="none" style={styles.centerMarker} />
          {timeContainerWidth > 0 && (
            <Animated.ScrollView
              ref={timeScrollRef}
              horizontal
              bounces={false}
              overScrollMode="never"
              showsHorizontalScrollIndicator={false}
              snapToInterval={TIME_TICK_WIDTH}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: timeSidePadding }}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: timeScrollX } } }], { useNativeDriver: false })}
              scrollEventThrottle={16}
              onMomentumScrollEnd={handleTimeScrollSettle}
              onScrollEndDrag={(e) => { if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.05) handleTimeScrollSettle(); }}
            >
              {timeOptions.map((option, index) => {
                const distance = timeScrollX.interpolate({ inputRange: [(index - 1) * TIME_TICK_WIDTH, index * TIME_TICK_WIDTH, (index + 1) * TIME_TICK_WIDTH], outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' });
                const scale = timeScrollX.interpolate({ inputRange: [(index - 1) * TIME_TICK_WIDTH, index * TIME_TICK_WIDTH, (index + 1) * TIME_TICK_WIDTH], outputRange: [0.85, 1.08, 0.85], extrapolate: 'clamp' });
                const isSelected = index === selectedTimeIndex;
                const showLabel = option.minute === 0 || isSelected;
                return (
                  <Pressable key={option.key} onPress={() => snapToTimeIndex(index, true)} style={[styles.tick, { width: TIME_TICK_WIDTH }]}>
                    <Animated.View style={[styles.tickPill, isSelected && styles.tickPillSelected, { opacity: distance, transform: [{ scale }] }]}>
                      <Text style={[styles.tickLabel, { fontSize: 13 }, isSelected && styles.tickLabelSelected]}>{showLabel ? option.label : '·'}</Text>
                    </Animated.View>
                  </Pressable>
                );
              })}
            </Animated.ScrollView>
          )}
        </View>
        <Text style={styles.selectedTimeCaption}>{timeOptions[selectedTimeIndex]?.label ?? formatHourMinute(occurredAt.getHours(), occurredAt.getMinutes())}</Text>
      </View>

      {existingOnSelectedDay.map((entry) => (
        <AlreadyLoggedBanner key={entry.id} entry={entry} onEditInstead={() => startEditingEntry(entry)} />
      ))}
    </View>
  );
}

function scrollXCleanup(value: Animated.Value, id: string) {
  value.removeListener(id);
}

function AlreadyLoggedBanner({ entry, onEditInstead }: { entry: SymptomEntry; onEditInstead: () => void }) {
  const theme = useTheme();
  const customSymptoms = useCustomSymptomStore((state) => state.customSymptoms);
  const styles = useMemo(() => StyleSheet.create({ banner: { gap: theme.spacing.sm, backgroundColor: theme.colors.primarySoft }, text: { ...theme.typography.bodySecondary } }), [theme]);
  const dayLabel = isSameCalendarDay(new Date(entry.loggedAt), new Date()) ? 'today' : 'that day';
  const symptomLabel = getSymptomOption(entry.symptomType, customSymptoms).label;
  return (
    <Card style={styles.banner}>
      <Text style={styles.text}>Already logged {symptomLabel.toLowerCase()} {dayLabel} at {formatTime(entry.loggedAt)} ({entry.severity}/10). Continue to add another reading, or edit that entry instead.</Text>
      <Button label={`Edit ${symptomLabel} entry instead`} variant="secondary" onPress={onEditInstead} accessibilityHint="Loads the existing entry for this symptom on this day so you can update it" />
    </Card>
  );
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function AddCustomSymptomForm({ onCancel, onCreated, addCustomSymptom }: { onCancel: () => void; onCreated: (id: string) => void; addCustomSymptom: (label: string, icon: string, tint: string, tintSoft: string) => { id: string } }) {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    buttonRow: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.sm },
    backButton: { flex: 1 }, continueButton: { flex: 2 }, customSymptomCard: { gap: theme.spacing.sm },
    customSymptomLabel: { ...theme.typography.caption, fontFamily: theme.fonts.semibold, marginTop: theme.spacing.xs },
    customSymptomInput: { ...theme.typography.body, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1.5, borderColor: theme.colors.border, padding: theme.spacing.md, minHeight: 44 },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    iconGridButton: { width: 44, height: 44, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
    tintGrid: { flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' },
    tintSwatch: { width: 44, height: 44, borderRadius: theme.radius.pill, borderWidth: 3, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
    tintSwatchSelected: { borderColor: theme.colors.ink },
    tintInner: { width: 28, height: 28, borderRadius: theme.radius.pill },
  }), [theme]);
  const [label, setLabel] = useState('');
  const [iconIndex, setIconIndex] = useState(0);
  const [tintIndex, setTintIndex] = useState(0);
  const canCreate = label.trim() !== '';

  const handleCreate = () => {
    if (!canCreate) return;
    const icon = CUSTOM_SYMPTOM_ICONS[iconIndex];
    const { tint, tintSoft } = CUSTOM_SYMPTOM_TINTS[tintIndex];
    const created = addCustomSymptom(label.trim(), icon, tint, tintSoft);
    onCreated(created.id);
  };

  return (
    <Card style={styles.customSymptomCard}>
      <Text style={styles.customSymptomLabel}>Symptom name</Text>
      <TextInput value={label} onChangeText={setLabel} placeholder="e.g. Brain fog, Joint stiffness" placeholderTextColor={theme.colors.inkMuted} style={styles.customSymptomInput} accessibilityLabel="Custom symptom name" />
      <Text style={styles.customSymptomLabel}>Icon</Text>
      <View style={styles.iconGrid}>
        {CUSTOM_SYMPTOM_ICONS.map((icon, index) => {
          const selected = index === iconIndex;
          return <Pressable key={icon} onPress={() => setIconIndex(index)} accessibilityRole="button" accessibilityLabel={`Icon option ${index + 1}`} accessibilityState={{ selected }} style={[styles.iconGridButton, { backgroundColor: selected ? CUSTOM_SYMPTOM_TINTS[tintIndex].tintSoft : theme.colors.surfaceMuted }]}><Ionicons name={icon} size={18} color={selected ? CUSTOM_SYMPTOM_TINTS[tintIndex].tint : theme.colors.inkMuted} /></Pressable>;
        })}
      </View>
      <Text style={styles.customSymptomLabel}>Color</Text>
      <View style={styles.tintGrid}>
        {CUSTOM_SYMPTOM_TINTS.map((option, index) => (
          <Pressable key={option.tint} onPress={() => setTintIndex(index)} style={[styles.tintSwatch, index === tintIndex && styles.tintSwatchSelected]} accessibilityRole="button" accessibilityLabel={`Color option ${index + 1}`} accessibilityState={{ selected: index === tintIndex }}>
            <View style={[styles.tintInner, { backgroundColor: option.tint }]} />
          </Pressable>
        ))}
      </View>
      <View style={styles.buttonRow}>
        <Button label="Cancel" variant="secondary" onPress={onCancel} style={styles.backButton} />
        <Button label="Create" onPress={handleCreate} disabled={!canCreate} style={styles.continueButton} />
      </View>
    </Card>
  );
}

const TICK_WIDTH = 56;

function SeverityDial({ symptomType }: { symptomType: string }) {
  const theme = useTheme();
  const severity = useLogStore((state) => state.draft.symptomDrafts.find((card) => card.symptomType === symptomType)?.severity ?? null);
  const setSeverityFor = useLogStore((state) => state.setSeverityFor);
  const setSeverity = (value: number) => setSeverityFor(symptomType, value);

  const [containerWidth, setContainerWidth] = useState(0);
  const scrollRef = React.useRef<any>(null);
  const visualValue = severity ?? 5;
  const scrollX = React.useRef(new Animated.Value(visualValue * TICK_WIDTH)).current;
  const latestScrollX = React.useRef(visualValue * TICK_WIDTH);
  const wheelSettleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = scrollX.addListener(({ value }) => { latestScrollX.current = value; });
    return () => scrollXCleanup(scrollX, id);
  }, [scrollX]);

  useEffect(() => () => {
    if (wheelSettleTimer.current) clearTimeout(wheelSettleTimer.current);
  }, []);

  useEffect(() => {
    if (containerWidth <= 0) return;
    const x = visualValue * TICK_WIDTH;
    latestScrollX.current = x;
    scrollX.setValue(x);
    scrollRef.current?.scrollTo({ x, animated: false });
  }, [containerWidth, visualValue, scrollX]);

  const sidePadding = Math.max(0, containerWidth / 2 - TICK_WIDTH / 2);

  const snapToValue = (rawValue: number, animated: boolean) => {
    const clamped = Math.max(0, Math.min(10, Math.round(rawValue)));
    latestScrollX.current = clamped * TICK_WIDTH;
    setSeverity(clamped);
    if (animated) scrollRef.current?.scrollTo({ x: latestScrollX.current, animated: true });
  };

  const handleScrollSettle = () => snapToValue(latestScrollX.current / TICK_WIDTH, false);

  const handleWheel = (event: any) => {
    if (Platform.OS !== 'web') return;
    event.preventDefault?.();
    const delta = event.deltaY ?? 0;
    const nextX = Math.max(0, Math.min(10 * TICK_WIDTH, latestScrollX.current + delta));
    latestScrollX.current = nextX;
    scrollRef.current?.scrollTo({ x: nextX, animated: false });
    if (wheelSettleTimer.current) clearTimeout(wheelSettleTimer.current);
    wheelSettleTimer.current = setTimeout(handleScrollSettle, 120);
  };

  const styles = useMemo(() => StyleSheet.create({
    stepBody: { gap: theme.spacing.lg },
    readoutRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: theme.spacing.lg },
    stepperButton: { width: 44, height: 44, borderRadius: theme.radius.pill, borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, alignItems: 'center' as const, justifyContent: 'center' as const },
    badge: { width: 96, height: 96, borderRadius: theme.radius.pill, alignItems: 'center' as const, justifyContent: 'center' as const },
    badgeNumber: { fontSize: 40, fontFamily: theme.fonts.bold, color: theme.colors.onPrimary },
    badgeOutOf: { fontSize: 13, fontFamily: theme.fonts.semibold, color: theme.colors.onPrimary, opacity: 0.85, marginTop: -4 },
    severityLabelText: { ...theme.typography.heading, textAlign: 'center' as const },
    dialCard: { borderRadius: theme.radius.xl, backgroundColor: theme.colors.surfaceMuted, paddingVertical: theme.spacing.lg, overflow: 'hidden' as const },
    centerMarker: { position: 'absolute' as const, top: 0, bottom: 0, left: '50%' as const, width: 3, marginLeft: -1.5, borderRadius: 2 },
    tick: { width: TICK_WIDTH, alignItems: 'center' as const, justifyContent: 'flex-end' as const },
    tickMark: { width: 3, borderRadius: 2, backgroundColor: theme.colors.border },
    tickNumber: { marginTop: theme.spacing.xs, fontFamily: theme.fonts.semibold, color: theme.colors.inkMuted },
    hint: { ...theme.typography.caption, textAlign: 'center' as const },
  }), [theme]);

  const color = severityColor(visualValue);
  const hasSelection = severity !== null;

  return (
    <View style={styles.stepBody}>
      <StepHeader title="How severe is it?" subtitle="0 means none at all, 10 is the worst imaginable. Move the ruler or use + / − to choose." />
      <View style={styles.readoutRow}>
        <Pressable onPress={() => snapToValue(visualValue - 1, true)} style={styles.stepperButton} accessibilityRole="button" accessibilityLabel="Decrease severity"><Ionicons name="remove" size={20} color={theme.colors.ink} /></Pressable>
        <View style={[styles.badge, { backgroundColor: color }]}><Text style={styles.badgeNumber}>{hasSelection ? severity : '—'}</Text><Text style={styles.badgeOutOf}>/ 10</Text></View>
        <Pressable onPress={() => snapToValue(visualValue + 1, true)} style={styles.stepperButton} accessibilityRole="button" accessibilityLabel="Increase severity"><Ionicons name="add" size={20} color={theme.colors.ink} /></Pressable>
      </View>
      <Text style={[styles.severityLabelText, { color }]}>{hasSelection ? severityLabel(severity) : 'Choose a severity'}</Text>

      <View
        style={styles.dialCard}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        // @ts-expect-error react-native-web forwards onWheel.
        onWheel={handleWheel}
        accessibilityRole="adjustable"
        accessibilityLabel={hasSelection ? `Severity, ${severity} out of 10, ${severityLabel(severity)}` : 'Severity, not set, ruler centered at 5'}
        accessibilityValue={hasSelection ? { min: 0, max: 10, now: severity } : { min: 0, max: 10, text: 'Not set; centered at 5' }}
        accessibilityActions={[{ name: 'increment', label: 'Increase severity' }, { name: 'decrement', label: 'Decrease severity' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') snapToValue(visualValue + 1, true);
          if (event.nativeEvent.actionName === 'decrement') snapToValue(visualValue - 1, true);
        }}
      >
        <View pointerEvents="none" style={[styles.centerMarker, { backgroundColor: color }]} />
        {containerWidth > 0 && (
          <Animated.ScrollView
            ref={scrollRef}
            horizontal
            bounces={false}
            overScrollMode="never"
            showsHorizontalScrollIndicator={false}
            snapToInterval={TICK_WIDTH}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: sidePadding }}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
            scrollEventThrottle={16}
            onMomentumScrollEnd={handleScrollSettle}
            onScrollEndDrag={(e) => { if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.05) handleScrollSettle(); }}
          >
            {SEVERITY_VALUES.map((value) => {
              const distance = scrollX.interpolate({ inputRange: [(value - 1) * TICK_WIDTH, value * TICK_WIDTH, (value + 1) * TICK_WIDTH], outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' });
              const scale = scrollX.interpolate({ inputRange: [(value - 1) * TICK_WIDTH, value * TICK_WIDTH, (value + 1) * TICK_WIDTH], outputRange: [0.75, 1.15, 0.75], extrapolate: 'clamp' });
              const isMajor = value % 5 === 0;
              const isSelected = hasSelection && value === severity;
              return (
                <Pressable key={value} onPress={() => snapToValue(value, true)} style={styles.tick}>
                  <Animated.View style={[styles.tickMark, { height: isMajor ? 28 : 18, opacity: distance, backgroundColor: isSelected ? color : theme.colors.border }]} />
                  <Animated.Text style={[styles.tickNumber, { fontSize: 13, opacity: distance, transform: [{ scale }], color: isSelected ? color : theme.colors.inkMuted }]}>{value}</Animated.Text>
                </Pressable>
              );
            })}
          </Animated.ScrollView>
        )}
      </View>
      <Text style={styles.hint}>Scroll the ruler, tap a number, or use + / − to adjust.</Text>
    </View>
  );
}

function LocationSection({ symptomType }: { symptomType: string }) {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create({ stepBody: { gap: theme.spacing.md } }), [theme]);
  const bodyRegions = useLogStore((state) => state.draft.symptomDrafts.find((card) => card.symptomType === symptomType)?.bodyRegions ?? []);
  const toggleBodyRegionFor = useLogStore((state) => state.toggleBodyRegionFor);
  return <View style={styles.stepBody}><StepHeader title="Where is it?" subtitle="Optional — tap the figure or the labels below." /><BodyMap selected={bodyRegions} onToggle={(regionId: string) => toggleBodyRegionFor(symptomType, regionId)} /></View>;
}

function DurationSection({ symptomType }: { symptomType: string }) {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create({ stepBody: { gap: theme.spacing.md } }), [theme]);
  const durationKey = useLogStore((state) => state.draft.symptomDrafts.find((card) => card.symptomType === symptomType)?.durationKey ?? null);
  const setDurationKeyFor = useLogStore((state) => state.setDurationKeyFor);
  return <View style={styles.stepBody}><StepHeader title="How long has it lasted?" subtitle="Your best estimate is fine. Optional." />{DURATION_OPTIONS.map((option) => <SelectCard key={option.key} label={option.label} selected={durationKey === option.key} onPress={() => setDurationKeyFor(symptomType, option.key)} />)}</View>;
}

function FactorsSection({ symptomType }: { symptomType: string }) {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    stepBody: { gap: theme.spacing.md },
    feelsLikeInput: { ...theme.typography.body, backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.lg, borderWidth: 1.5, borderColor: theme.colors.border, padding: theme.spacing.md, minHeight: 92, textAlignVertical: 'top' as const },
    factorSubHeading: { ...theme.typography.caption, marginTop: theme.spacing.sm },
    factorHeading: { ...theme.typography.body, fontWeight: '600' as const, marginTop: theme.spacing.xs },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  }), [theme]);
  const card = useLogStore((state) => state.draft.symptomDrafts.find((item) => item.symptomType === symptomType));
  const triggers = card?.triggers ?? [];
  const reliefFactors = card?.reliefFactors ?? [];
  const qualities = card?.qualities ?? [];
  const toggleTriggerFor = useLogStore((state) => state.toggleTriggerFor);
  const toggleReliefFor = useLogStore((state) => state.toggleReliefFor);
  const toggleQualityFor = useLogStore((state) => state.toggleQualityFor);
  const feelsLikeNote = card?.feelsLikeNote ?? '';
  const setFeelsLikeNoteFor = useLogStore((state) => state.setFeelsLikeNoteFor);
  const showQualities = QUALITY_SYMPTOMS.includes(symptomType);

  return (
    <View style={styles.stepBody}>
      <StepHeader title="What affected it?" subtitle="Optional — tap any that apply." />
      {showQualities ? <>
        <Text style={styles.factorHeading}>How does it feel?</Text>
        <TextInput value={feelsLikeNote} onChangeText={(text) => setFeelsLikeNoteFor(symptomType, text)} multiline placeholder="Describe it in your own words — e.g. throbbing behind my right eye, worse when I bend down" placeholderTextColor={theme.colors.inkMuted} style={styles.feelsLikeInput} maxLength={600} accessibilityLabel="Describe how this symptom feels, in your own words" />
        <Text style={styles.factorSubHeading}>Or tap what fits</Text>
        <View style={styles.chipWrap}>{QUALITY_OPTIONS.map((quality) => <Chip key={quality} label={quality} selected={qualities.includes(quality)} onToggle={() => toggleQualityFor(symptomType, quality)} />)}</View>
      </> : null}
      <Text style={styles.factorHeading}>Made it worse</Text>
      <ChipGroupWithOther options={TRIGGER_OPTIONS} selected={triggers} onToggle={(value) => toggleTriggerFor(symptomType, value)} placeholder="Something else that made it worse…" accessibilityLabel="What made it worse" />
      <Text style={styles.factorHeading}>Helped</Text>
      <ChipGroupWithOther options={RELIEF_OPTIONS} selected={reliefFactors} onToggle={(value) => toggleReliefFor(symptomType, value)} placeholder="Something else that helped…" accessibilityLabel="What helped" />
    </View>
  );
}

function MedicationSection({ symptomType }: { symptomType: string }) {
  const theme = useTheme();
  const medications = useMedicationStore((state) => state.medications);
  const selected = useLogStore((state) => state.draft.symptomDrafts.find((card) => card.symptomType === symptomType)?.medicationIds ?? []);
  const toggleMedicationFor = useLogStore((state) => state.toggleMedicationFor);
  const styles = useMemo(() => StyleSheet.create({ stepBody: { gap: theme.spacing.md }, chipWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: theme.spacing.sm } }), [theme]);
  if (medications.length === 0) return null;
  return <View style={styles.stepBody}><StepHeader title="Did you take anything for it?" subtitle="Optional — tap any medication you took around this time." /><View style={styles.chipWrap}>{medications.map((medication) => <Chip key={medication.id} label={medication.dose.trim() !== '' ? `${medication.name} ${medication.dose}` : medication.name} selected={selected.includes(medication.id)} onToggle={() => toggleMedicationFor(symptomType, medication.id)} />)}</View></View>;
}

function NotesSection({ symptomType }: { symptomType: string }) {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    stepBody: { gap: theme.spacing.md },
    factorHeading: { ...theme.typography.body, fontWeight: '600' as const, marginTop: theme.spacing.xs },
    input: { ...theme.typography.body, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1.5, borderColor: theme.colors.border, padding: theme.spacing.lg, minHeight: 88, textAlignVertical: 'top' as const },
    inputTall: { minHeight: 112 },
  }), [theme]);
  const card = useLogStore((state) => state.draft.symptomDrafts.find((item) => item.symptomType === symptomType));
  const setImpactNoteFor = useLogStore((state) => state.setImpactNoteFor);
  const setNoteFor = useLogStore((state) => state.setNoteFor);
  return (
    <View style={styles.stepBody}>
      <StepHeader title="Anything else to add?" subtitle="Optional — this helps your doctor understand impact." />
      <Text style={styles.factorHeading}>How did it affect your day?</Text>
      <TextInput value={card?.impactNote ?? ''} onChangeText={(value) => setImpactNoteFor(symptomType, value)} placeholder="e.g. Hard to focus at work, skipped my walk" placeholderTextColor={theme.colors.inkMuted} multiline maxLength={280} style={styles.input} accessibilityLabel="How did it affect your day" />
      <Text style={styles.factorHeading}>Notes</Text>
      <TextInput value={card?.note ?? ''} onChangeText={(value) => setNoteFor(symptomType, value)} placeholder="e.g. Sharp on the left side, started after lunch" placeholderTextColor={theme.colors.inkMuted} multiline maxLength={500} style={[styles.input, styles.inputTall]} accessibilityLabel="Additional notes" />
    </View>
  );
}

interface SuccessViewProps {
  entries: SymptomEntry[];
  isEditing: boolean;
  onDone: () => void;
  onLogAnother: () => void;
}

function SuccessView({ entries: savedEntries, isEditing, onDone, onLogAnother }: SuccessViewProps) {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    successHeader: { alignItems: 'center', gap: theme.spacing.md, marginTop: theme.spacing.lg },
    successCircle: { width: 64, height: 64, borderRadius: theme.radius.pill, backgroundColor: theme.colors.successSoft, alignItems: 'center', justifyContent: 'center' },
    successTitle: { ...theme.typography.title },
    streakText: { ...theme.typography.bodySecondary, color: theme.colors.primary, fontWeight: '600' as const, textAlign: 'center' as const },
    successNote: { ...theme.typography.caption, textAlign: 'center' as const },
    summaryCard: { gap: theme.spacing.md },
    summarySymptom: { ...theme.typography.heading },
  }), [theme]);
  const totalEntries = useLogStore((state) => state.entries.length);
  const allEntries = useLogStore((state) => state.entries);
  const streak = getStreakDays(allEntries);
  const customSymptoms = useCustomSymptomStore((state) => state.customSymptoms);
  const isMultiple = savedEntries.length > 1;
  const title = isEditing ? 'Entry updated' : isMultiple ? `${savedEntries.length} symptoms logged` : 'Symptom logged';

  return (
    <Screen showHeader>
      <View style={styles.successHeader}>
        <View style={styles.successCircle}><Ionicons name="checkmark" size={32} color={theme.colors.success} /></View>
        <Text style={styles.successTitle}>{title}</Text>
        {!isEditing && streak >= 3 ? <Text style={styles.streakText}>{streak}-day streak — consistent logs make your reports far more useful.</Text> : null}
      </View>

      {savedEntries.map((entry) => {
        const option = getSymptomOption(entry.symptomType, customSymptoms);
        const duration = DURATION_OPTIONS.find((item) => item.minutes === entry.durationMinutes);
        const factorCount = entry.triggers.length + entry.reliefFactors.length;
        return (
          <Card key={entry.id} style={styles.summaryCard}>
            {isMultiple && <Text style={styles.summarySymptom}>{option.label}</Text>}
            {!isMultiple && <SummaryRow label="Symptom" value={option.label} />}
            <SummaryRow label="Severity" value={`${entry.severity} / 10 · ${severityLabel(entry.severity)}`} />
            {entry.qualities && entry.qualities.length > 0 && <SummaryRow label="Feels like" value={entry.qualities.join(', ')} />}
            {entry.bodyRegions && entry.bodyRegions.length > 0 && <SummaryRow label="Location" value={entry.bodyRegions.map(getRegionLabel).join(', ')} />}
            <SummaryRow label="Duration" value={duration ? duration.label : 'Not set'} />
            <SummaryRow label="Factors" value={factorCount > 0 ? `${factorCount} selected` : 'None'} />
          </Card>
        );
      })}

      <Text style={styles.successNote}>{isEditing ? 'Your changes are saved on this device.' : `Saved on this device — ${totalEntries} ${totalEntries === 1 ? 'entry' : 'entries'} logged so far.`}</Text>
      <Button label="Done" onPress={onDone} accessibilityHint="Returns to Home" />
      <Button label="Log another symptom" variant="secondary" onPress={onLogAnother} accessibilityHint="Starts a new symptom entry" />
    </Screen>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md },
    summaryLabel: { ...theme.typography.bodySecondary },
    summaryValue: { ...theme.typography.body, fontWeight: '600' as const, flexShrink: 1, textAlign: 'right' as const },
  }), [theme]);
  return <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}
