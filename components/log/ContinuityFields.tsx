import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { useLogStore } from '../../store/logStore';
import { useTheme } from '../../hooks/useTheme';
import { Chip } from '../ui/Chip';
export function ContinuityFields({ symptomType }: { symptomType: string }) {
  const theme = useTheme();
  const card = useLogStore(s => s.draft.symptomDrafts.find(c => c.symptomType === symptomType)!);
  const patch = useLogStore(s => s.patchSymptom);
  const input = { ...theme.typography.body, minHeight: 48, borderWidth: 1, borderColor: theme.colors.inkMuted, borderRadius: 8, padding: 12 };
  return <View style={{ gap: 12 }}>
    <Text style={theme.typography.heading}>Was it continuous or did it come and go?</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{([['continuous','Continuous'], ['intermittent','Comes and goes'], ['unsure','Not sure']] as const).map(([value,label]) => <Chip key={value} label={label} selected={(card.continuity ?? 'unsure') === value} onToggle={() => patch(symptomType, { continuity: value })} />)}</View>
    {card.continuity === 'intermittent' && <>
      <Text style={theme.typography.body}>Number of episodes (optional)</Text>
      <TextInput accessibilityLabel="Episode count, optional positive whole number" keyboardType="number-pad" style={input} value={card.episodeCount?.toString() ?? ''} onChangeText={v => { if (v === '' || (/^[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v)) && Number(v) <= 100000)) patch(symptomType, { episodeCount: v === '' ? null : Number(v) }); }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['exact','approximate'] as const).map(value => <Chip key={value} label={value === 'exact' ? 'Exact count' : 'Approximate count'} selected={(card.episodeCountPrecision ?? 'exact') === value} onToggle={() => patch(symptomType, { episodeCountPrecision: value })} />)}</View>
    </>}
    <Text style={theme.typography.body}>Observation window in minutes (optional). For example, 3 headaches across 240 minutes does not mean a 240-minute headache.</Text>
    <TextInput accessibilityLabel="Observation window in minutes, optional" keyboardType="number-pad" style={input} value={card.observationWindowMinutes?.toString() ?? ''} onChangeText={v => { if (v === '' || (/^[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v)) && Number(v) <= 100000)) patch(symptomType, { observationWindowMinutes: v === '' ? null : Number(v) }); }} />
  </View>;
}
