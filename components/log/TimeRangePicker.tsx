import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useLogStore } from '../../store/logStore';
import { useTheme } from '../../hooks/useTheme';
import { Chip } from '../ui/Chip';
import { Button } from '../ui/Button';
import { dateKeyFromDate } from '../../utils/entryStats';

/** Timing precision is explicit; no synthetic exact time or shared duration. */
export function TimeRangePicker() {
  const theme = useTheme();
  const draft = useLogStore(s => s.draft);
  const setDate = useLogStore(s => s.setOccurredAt);
  const setTiming = useLogStore(s => s.setTiming);
  const setTimingValid = useLogStore(s => s.setTimingValid);
  const [other, setOther] = useState(false);
  const [dateText, setDateText] = useState(dateKeyFromDate(draft.occurredAt));
  const [time, setTime] = useState(`${String(draft.occurredAt.getHours()).padStart(2, '0')}:${String(draft.occurredAt.getMinutes()).padStart(2, '0')}`);
  const [error, setError] = useState('');
  const input = { ...theme.typography.body, borderWidth: 1, borderColor: theme.colors.inkMuted, borderRadius: 8, minHeight: 48, padding: 12 };
  const pickDay = (offset: number) => {
    const d = new Date(draft.occurredAt); const today = new Date(); today.setDate(today.getDate() - offset);
    d.setFullYear(today.getFullYear(), today.getMonth(), today.getDate()); setDate(d); setDateText(dateKeyFromDate(d)); setOther(false);
  };
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button label="Today" variant="secondary" onPress={() => pickDay(0)} />
      <Button label="Yesterday" variant="secondary" onPress={() => pickDay(1)} />
      <Button label="Another date" variant="secondary" onPress={() => setOther(!other)} />
    </View>
    {other && <><Text style={theme.typography.body}>Date (YYYY-MM-DD)</Text><TextInput style={input} value={dateText} onChangeText={setDateText} accessibilityLabel="Another date, year month day" />
      <Button label="Use date" onPress={() => {
        const d = new Date(`${dateText}T12:00:00`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || isNaN(d.getTime()) || dateKeyFromDate(d) !== dateText || dateText > dateKeyFromDate(new Date())) { setError('Enter a valid date today or earlier.'); return; }
        d.setHours(draft.occurredAt.getHours(), draft.occurredAt.getMinutes()); setDate(d); setError('');
      }} /></>}
    <Text style={theme.typography.body}>Time of day (optional)</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['Morning', 'Afternoon', 'Evening', 'Night'] as const).map(part => <Chip key={part} label={part} selected={draft.timingPrecision === 'part_of_day' && draft.partOfDay === part} onToggle={() => setTiming('part_of_day', part)} />)}
      <Chip label="Not sure" selected={draft.timingPrecision === 'unsure'} onToggle={() => setTiming('unsure')} />
      <Chip label="Exact time" selected={draft.timingPrecision === 'exact' || draft.timingPrecision === undefined} onToggle={() => setTiming('exact')} />
    </View>
    {(draft.timingPrecision === 'exact' || draft.timingPrecision === undefined) && <>
      <Text style={theme.typography.body}>Exact time, 24-hour HH:MM</Text><TextInput style={input} value={time} accessibilityLabel="Exact time in 24 hour format" onChangeText={value => {
        setTime(value); if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) { const d = new Date(draft.occurredAt); const [h,m] = value.split(':').map(Number); d.setHours(h,m,0,0); setDate(d); setTiming('exact'); setError(''); } else { setTimingValid(false); setError('Enter time as HH:MM, for example 09:01.'); }
      }} />
    </>}
    {error !== '' && <Text accessibilityRole="alert" style={theme.typography.body}>{error}</Text>}
  </View>;
}
