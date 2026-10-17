import { CustomSymptom, SymptomEntry } from '../types/models';
/** All fields are quoted. Prefix formula-like text, including after whitespace/control characters. */
export function csvCell(value: unknown): string {
  if (value == null) return '""';
  let text = Array.isArray(value) ? JSON.stringify(value) : String(value);
  if (/^[\s\u0000-\u001f\u007f-\u009f\ufeff]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export const CSV_COLUMNS = ['id', 'symptomType', 'symptomLabel', 'occurrenceDate', 'loggedAt', 'createdAt', 'updatedAt', 'timingPrecision', 'partOfDay', 'timezone', 'utcOffsetMinutes', 'continuity', 'episodeCount', 'episodeCountPrecision', 'observationWindowMinutes', 'durationMinutes', 'durationPrecision', 'durationDescription', 'severity', 'triggers', 'reliefFactors', 'impactNote', 'note', 'qualities', 'bodyRegions', 'feelsLikeNote', 'medicationIds', 'schemaVersion'] as const;
/** Raw ISO timestamps stay unchanged. Unknown legacy timezone/precision remain blank. No mutation. */
export function buildEntriesCsv(entries: SymptomEntry[], customSymptoms: CustomSymptom[] = []): string {
  const rows = entries.map(entry => {
    const row: Record<string, unknown> = { ...entry, symptomLabel: customSymptoms.find(s => s.id === entry.symptomType)?.label ?? entry.symptomType };
    return CSV_COLUMNS.map(column => csvCell(row[column])).join(',');
  });
  return '\ufeff' + [CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
}
