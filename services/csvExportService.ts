import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { CustomSymptom, SymptomEntry } from '../types/models';
import { buildEntriesCsv } from '../utils/csv';
export async function exportEntriesCsv(entries: SymptomEntry[], customSymptoms: CustomSymptom[] = []): Promise<{ ok: boolean; message: string }> {
  let file: File | null = null;
  try {
    if (!entries.length) return { ok: false, message: 'No records to export.' };
    const csv = buildEntriesCsv(entries, customSymptoms);
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'HealthLit-records.csv'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return { ok: true, message: 'CSV download requested.' };
    }
    if (!(await Sharing.isAvailableAsync())) return { ok: false, message: 'Sharing is unavailable on this device. Please try again on a supported device.' };
    file = new File(Paths.cache, `HealthLit-records-${Date.now()}.csv`);
    file.create(); file.write(csv);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: 'Share HealthLit records' });
    return { ok: true, message: 'Share sheet closed. Records were not changed.' };
  } catch {
    return { ok: false, message: 'Could not export CSV. Your records are unchanged. Please try again.' };
  } finally {
    try { if (file?.exists) file.delete(); } catch { /* Cache cleanup must not mask export result. */ }
  }
}
