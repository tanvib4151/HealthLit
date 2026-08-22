/**
 * Doctor report service (Step 6).
 *
 * Builds a clean, clinical HTML report from the user's entries and
 * exports it as a PDF:
 *  - iOS / Android: PDF file via expo-print, then the OS share sheet
 *    (AirDrop, email, save to Files) via expo-sharing.
 *  - Web: generates an HTML blob, opens in a new window for printing.
 *
 * DATA SENSITIVITY: the report intentionally contains health data —
 * that is its purpose — but nothing is ever logged to the console,
 * and all user-written text is HTML-escaped before rendering.
 */

import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { CustomSymptom, Medication, SymptomEntry, UserProfile } from '../types/models';
import { getRegionLabel } from '../utils/bodyRegions';
import { dateKeyLocal, formatTime } from '../utils/entryStats';
import { getSymptomOption, severityLabel } from '../utils/symptoms';
import { buildSymptomFrequency } from '../utils/trendData';
import { analyzeCorrelations, describeCorrelation } from '../utils/correlationAnalyzer';
import { buildStory, hasEnoughDataForStory } from '../utils/storyEngine';
import { StoryReport } from '../utils/storyReport';
import { escapeHtml } from '../utils/html';
import { renderChartBlock } from '../utils/chartSvg';

export interface ExportResult {
  ok: boolean;
  message: string;
}

/** Escape user-written text before it enters the HTML document. */

function filterToRange(
  entries: SymptomEntry[],
  rangeDays: number,
  now: Date = new Date(),
): SymptomEntry[] {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - (rangeDays - 1));
  cutoff.setHours(0, 0, 0, 0);
  return entries.filter((entry) => new Date(entry.loggedAt) >= cutoff);
}

/** "Jul 6, 2026" from a YYYY-MM-DD key. */
function formatReportDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Top N values by frequency from string arrays across entries. */
function tallyTop(lists: string[][], top: number): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const list of lists) {
    for (const item of list) {
      counts.set(item, (counts.get(item) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top);
}

function buildReportHtml(
  entries: SymptomEntry[],
  rangeDays: number,
  medications: Medication[],
  profile: UserProfile | null,
  customSymptoms: CustomSymptom[],
): string {
  const generatedOn = new Date().toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Summary numbers
  const daysLogged = new Set(entries.map((e) => dateKeyLocal(e.loggedAt))).size;
  const severities = entries.map((e) => e.severity);
  const avgSeverity =
    severities.reduce((sum, s) => sum + s, 0) / Math.max(severities.length, 1);
  const maxSeverity = Math.max(...severities);
  const frequency = buildSymptomFrequency(entries, rangeDays, customSymptoms);
  const topTriggers = tallyTop(entries.map((e) => e.triggers), 3);
  const topReliefs = tallyTop(entries.map((e) => e.reliefFactors), 3);
  const correlations = analyzeCorrelations(entries, rangeDays).slice(0, 5);
  const storyNarrative = hasEnoughDataForStory(entries, rangeDays)
    ? buildStory(entries, rangeDays, customSymptoms)
        .map((insight) => insight.narrative)
        .join(' ')
    : null;

  // Chronological (oldest first) reads naturally for a clinician.
  const chronological = [...entries].sort((a, b) =>
    a.loggedAt.localeCompare(b.loggedAt),
  );

  const frequencyRows = frequency
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.label)}</td><td style="text-align: right;">${item.count}</td></tr>`,
    )
    .join('');

  const factorLine = (items: { label: string; count: number }[]): string =>
    items.length === 0
      ? 'None reported'
      : items.map((i) => `${escapeHtml(i.label)} (${i.count})`).join(', ');

  const entryRows = chronological
    .map((entry) => {
      const symptom = getSymptomOption(entry.symptomType, customSymptoms);
      const qualities = entry.qualities ?? [];
      const symptomLabel =
        qualities.length > 0
          ? `${escapeHtml(symptom.label)} (${qualities.map(escapeHtml).join(', ')})`
          : escapeHtml(symptom.label);
      const location =
        entry.bodyRegions && entry.bodyRegions.length > 0
          ? entry.bodyRegions.map((id: string) => escapeHtml(getRegionLabel(id))).join(', ')
          : '—';
      const notes = [entry.impactNote, entry.note]
        .filter((text): text is string => text !== null && text !== '')
        .map(escapeHtml)
        .join(' — ');
      return `<tr>
        <td>${formatReportDate(dateKeyLocal(entry.loggedAt))}</td>
        <td>${formatTime(entry.loggedAt)}</td>
        <td>${symptomLabel}</td>
        <td style="text-align: right;">${entry.severity}/10 (${severityLabel(entry.severity)})</td>
        <td>${location}</td>
        <td>${entry.triggers.map(escapeHtml).join(', ') || '—'}</td>
        <td>${entry.reliefFactors.map(escapeHtml).join(', ') || '—'}</td>
        <td>${notes || '—'}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>HealthLit Symptom Report</title>
<style>
body {
  font-family: Arial, sans-serif;
  color: #333;
  margin: 40px;
  line-height: 1.5;
  font-size: 11pt;
}
h1 {
  font-size: 18pt;
  margin: 0 0 4px 0;
  color: #000;
}
.meta {
  color: #666;
  font-size: 10pt;
  margin-bottom: 20px;
}
.patient-box {
  border: 1px solid #ddd;
  background: #fafafa;
  padding: 10px 14px;
  margin-bottom: 16px;
  font-size: 10pt;
}
.patient-row {
  line-height: 1.5;
}
.story-box {
  border-left: 3px solid #7C6BD6;
  background: #FAF8FF;
  padding: 12px 16px;
  margin: 12px 0 16px 0;
}
.story-label {
  font-size: 9pt;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #7C6BD6;
  font-weight: bold;
  margin-bottom: 4px;
}
.story-text {
  font-size: 11pt;
  line-height: 1.5;
  color: #333;
  margin: 0;
}
h2 {
  font-size: 12pt;
  margin: 20px 0 8px 0;
  color: #000;
  border-bottom: 1px solid #ddd;
  padding-bottom: 4px;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  margin-bottom: 16px;
}
th {
  background-color: #f5f5f5;
  text-align: left;
  padding: 8px 4px;
  border-bottom: 2px solid #333;
  font-weight: bold;
  font-size: 10pt;
}
td {
  padding: 6px 4px;
  border-bottom: 1px solid #eee;
  font-size: 10pt;
}
.summary-box {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 16px;
  margin: 12px 0;
}
.summary-item {
  border: 1px solid #ddd;
  padding: 12px;
  background: #fafafa;
}
.summary-value {
  font-size: 16pt;
  font-weight: bold;
  color: #000;
}
.summary-label {
  font-size: 9pt;
  color: #666;
  text-transform: uppercase;
  margin-top: 4px;
}
.print-only {
  page-break-inside: avoid;
}
@media print {
  body { margin: 20px; }
  h2 { page-break-after: avoid; }
  table { page-break-inside: avoid; }
}
</style>
</head>
<body>
  <h1>HealthLit — Symptom Report</h1>
  <div class="meta">Last ${rangeDays} days • Generated ${generatedOn}</div>
  ${profile ? `
  <div class="patient-box">
    <div class="patient-row"><strong>${escapeHtml(profile.displayName)}</strong>${profile.dateOfBirth ? ` · DOB ${escapeHtml(profile.dateOfBirth)}` : ''}</div>
    ${profile.condition ? `<div class="patient-row">Condition: ${escapeHtml(profile.condition)}</div>` : ''}
    ${profile.primaryDoctor ? `<div class="patient-row">Primary doctor: ${escapeHtml(profile.primaryDoctor)}</div>` : ''}
    ${profile.emergencyContact ? `<div class="patient-row">Emergency contact: ${escapeHtml(profile.emergencyContact)}</div>` : ''}
  </div>
  ` : ''}
  <p style="color: #999; font-size: 9pt;">Self-reported symptom data logged by the patient in the HealthLit app.</p>

  ${storyNarrative ? `
  <div class="story-box">
    <div class="story-label">Overview</div>
    <p class="story-text">${escapeHtml(storyNarrative)}</p>
  </div>
  ` : ''}

  <h2>Summary</h2>
  <div class="summary-box">
    <div class="summary-item">
      <div class="summary-value">${entries.length}</div>
      <div class="summary-label">Entries</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${daysLogged}/${rangeDays}</div>
      <div class="summary-label">Days Logged</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${avgSeverity.toFixed(1)}</div>
      <div class="summary-label">Avg Severity</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${maxSeverity}</div>
      <div class="summary-label">Worst Severity</div>
    </div>
  </div>

  <h2>Symptom Frequency</h2>
  <table>
    <thead>
      <tr>
        <th>Symptom</th>
        <th style="text-align: right;">Times Logged</th>
      </tr>
    </thead>
    <tbody>
      ${frequencyRows}
    </tbody>
  </table>

  <h2>Reported Factors</h2>
  <table>
    <tbody>
      <tr>
        <td style="width: 120px; font-weight: bold;">Made it Worse</td>
        <td>${factorLine(topTriggers)}</td>
      </tr>
      <tr>
        <td style="font-weight: bold;">Helped</td>
        <td>${factorLine(topReliefs)}</td>
      </tr>
    </tbody>
  </table>

  <h2>Entry Log</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Time</th>
        <th>Symptom</th>
        <th style="text-align: right;">Severity</th>
        <th>Location</th>
        <th>Worsened By</th>
        <th>Helped By</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${entryRows}
    </tbody>
  </table>

  ${medications.length > 0 ? `
  <h2>Current Medications</h2>
  <table>
    <thead>
      <tr>
        <th>Medication</th>
        <th>Dose</th>
        <th>Schedule</th>
      </tr>
    </thead>
    <tbody>
      ${medications
        .map(
          (med) => `<tr>
        <td>${escapeHtml(med.name)}</td>
        <td>${med.dose ? escapeHtml(med.dose) : '—'}</td>
        <td>${med.scheduleNote ? escapeHtml(med.scheduleNote) : '—'}</td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>
  ` : ''}

  ${correlations.length > 0 ? `
  <h2>Notable Patterns</h2>
  <table>
    <thead>
      <tr>
        <th>Factor</th>
        <th>Type</th>
        <th>Observation</th>
      </tr>
    </thead>
    <tbody>
      ${correlations
        .map(
          (corr) => `<tr>
        <td>${escapeHtml(corr.factor)}</td>
        <td>${corr.type === 'relief' ? 'Helps' : 'Worsens'}</td>
        <td>${escapeHtml(describeCorrelation(corr))}</td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>
  <p style="color: #999; font-size: 9pt;">Patterns are based on self-reported entries within 24-hour windows and are not a clinical diagnosis.</p>
  ` : ''}

  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; color: #999; font-size: 9pt;">
    <p>This report was generated by HealthLit and is intended to support conversations with your healthcare provider.</p>
  </div>
</body>
</html>`;
}

/**
 * Exports a PDF report for the trailing `rangeDays` window. Returns a
 * user-facing result message; never throws.
 */
export async function exportReport(
  entries: SymptomEntry[],
  rangeDays: number,
  medications: Medication[] = [],
  profile: UserProfile | null = null,
  customSymptoms: CustomSymptom[] = [],
): Promise<ExportResult> {
  const inRange = filterToRange(entries, rangeDays);
  if (inRange.length === 0) {
    return {
      ok: false,
      message: `No entries in the last ${rangeDays} days to export.`,
    };
  }

  const html = buildReportHtml(inRange, rangeDays, medications, profile, customSymptoms);

  try {
    if (Platform.OS === 'web') {
      // On web, open the HTML in a new window for printing
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      return {
        ok: true,
        message: 'Report opened in a new window — choose "Save as PDF" in the print dialog.',
      };
    }

    const { uri } = await Print.printToFileAsync({ html });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share symptom report',
        UTI: 'com.adobe.pdf',
      });
      return { ok: true, message: 'Report ready.' };
    }

    return { ok: true, message: 'PDF created on this device.' };
  } catch (error) {
    console.warn('[reportService] Report export failed.');
    return { ok: false, message: 'Could not create the report. Please try again.' };
  }
}

/* ------------------------ Story report (v2) ------------------------- */

/**
 * Renders a StoryReport (the nine-section, doctor-ready summary) as a
 * printable document.
 *
 * Kept separate from `exportReport` above: that one is the full data
 * dump with every entry in a table, this one is the narrative a
 * clinician reads in the first thirty seconds of an appointment. Both
 * are useful; they are not the same document.
 *
 * All user-written text goes through escapeHtml — story sections can
 * contain text the user typed themselves.
 */
export async function exportStoryReport(
  report: StoryReport,
  profile: UserProfile | null = null,
): Promise<ExportResult> {
  const html = buildStoryReportHtml(report, profile);

  try {
    if (Platform.OS === 'web') {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow === null) {
        return {
          ok: false,
          message: 'Your browser blocked the print window — allow pop-ups and try again.',
        };
      }
      return {
        ok: true,
        message: 'Story opened in a new window — choose "Save as PDF" in the print dialog.',
      };
    }

    const { uri } = await Print.printToFileAsync({ html });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share symptom story',
        UTI: 'com.adobe.pdf',
      });
      return { ok: true, message: 'Story ready.' };
    }

    return { ok: true, message: 'PDF created on this device.' };
  } catch {
    console.warn('[reportService] Story export failed.');
    return { ok: false, message: 'Could not create the story. Please try again.' };
  }
}

function buildStoryReportHtml(report: StoryReport, profile: UserProfile | null): string {
  const generatedOn = new Date(report.meta.generatedAt).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const sectionsHtml = report.sections
    .filter((section) => section.body.length > 0)
    .map(
      (section) => `
  <section class="story-section">
    <h2>${escapeHtml(section.title)}</h2>
    ${section.body.map((item) => `<p>${escapeHtml(item.text)}</p>`).join('')}
  </section>`,
    )
    .join('');

  // Only the compressed segment view goes in the printed timeline —
  // thirty individual day rows is the table this report exists to
  // replace.
  const timelineRows = report.timeline.segments
    .map(
      (segment) => `<tr>
        <td>${escapeHtml(segment.label)}</td>
        <td>${escapeHtml(segment.band)}</td>
        <td style="text-align: right;">${
          segment.avgSeverity === null ? '—' : `${segment.avgSeverity.toFixed(1)}/10`
        }</td>
        <td style="text-align: right;">${segment.loggedDayCount}/${segment.dayCount}</td>
        <td>${
          segment.symptomLabels.length > 0
            ? segment.symptomLabels.slice(0, 4).map(escapeHtml).join(', ')
            : '—'
        }</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>HealthLit — Symptom Story</title>
<style>
body { font-family: Arial, sans-serif; color: #333; margin: 40px; line-height: 1.55; font-size: 11pt; }
h1 { font-size: 18pt; margin: 0 0 4px 0; color: #000; }
.meta { color: #666; font-size: 10pt; margin-bottom: 18px; }
.patient-box { border: 1px solid #ddd; background: #fafafa; padding: 10px 14px; margin-bottom: 16px; font-size: 10pt; }
.summary-box { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin: 12px 0 20px 0; }
.summary-item { border: 1px solid #ddd; padding: 10px; background: #fafafa; }
.summary-value { font-size: 15pt; font-weight: bold; color: #000; }
.summary-label { font-size: 8.5pt; color: #666; text-transform: uppercase; margin-top: 3px; }
.story-section { page-break-inside: avoid; margin-bottom: 4px; }
h2 { font-size: 12pt; margin: 18px 0 6px 0; color: #000; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
p { margin: 0 0 7px 0; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 16px; }
th { background-color: #f5f5f5; text-align: left; padding: 8px 4px; border-bottom: 2px solid #333; font-weight: bold; font-size: 10pt; }
td { padding: 6px 4px; border-bottom: 1px solid #eee; font-size: 10pt; }
.footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #ddd; color: #999; font-size: 9pt; }
.chart-block { margin: 18px 0 26px 0; page-break-inside: avoid; }
.chart-block h3 { font-size: 11pt; margin: 0 0 2px 0; color: #000; }
.chart-caption { font-size: 9.5pt; color: #666; margin: 0 0 8px 0; }
.chart-table { width: 100%; margin-top: 6px; }
.chart-table th { font-size: 9pt; padding: 5px 4px; }
.chart-table td { font-size: 9pt; padding: 4px; }
.chart-note { font-size: 8.5pt; color: #888; font-style: italic; margin-top: 4px; }
@media print { body { margin: 20px; } h2 { page-break-after: avoid; } table { page-break-inside: avoid; } .chart-block { page-break-inside: avoid; } }
</style>
</head>
<body>
  <h1>HealthLit — Symptom Story</h1>
  <div class="meta">${escapeHtml(report.meta.rangeLabel)} • Generated ${generatedOn}</div>
  ${
    profile
      ? `<div class="patient-box">
    <div><strong>${escapeHtml(profile.displayName)}</strong>${
          profile.dateOfBirth ? ` · DOB ${escapeHtml(profile.dateOfBirth)}` : ''
        }</div>
    ${profile.condition ? `<div>Condition: ${escapeHtml(profile.condition)}</div>` : ''}
    ${profile.primaryDoctor ? `<div>Primary doctor: ${escapeHtml(profile.primaryDoctor)}</div>` : ''}
  </div>`
      : ''
  }

  <div class="summary-box">
    <div class="summary-item">
      <div class="summary-value">${report.meta.entryCount}</div>
      <div class="summary-label">Entries</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${report.meta.daysLogged}/${report.meta.daysInRange}</div>
      <div class="summary-label">Days Logged</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${
        report.meta.medianSeverity === null ? '—' : report.meta.medianSeverity.toFixed(1)
      }</div>
      <div class="summary-label">Typical Severity</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${report.meta.maxSeverity ?? '—'}</div>
      <div class="summary-label">Worst Severity</div>
    </div>
  </div>
${sectionsHtml}

  ${
    report.charts.length > 0
      ? `<h2>Charts</h2>${report.charts.map(renderChartBlock).join('')}`
      : ''
  }

  <h2>Simplified timeline</h2>
  <table>
    <thead>
      <tr>
        <th>Period</th>
        <th>Level</th>
        <th style="text-align: right;">Avg severity</th>
        <th style="text-align: right;">Days logged</th>
        <th>Symptoms</th>
      </tr>
    </thead>
    <tbody>
      ${timelineRows}
    </tbody>
  </table>

  <div class="footer">
    <p>Self-reported symptom data logged by the patient in the HealthLit app.
    This summary is generated by deterministic on-device calculation over the
    patient's own entries — every figure restates logged data. It contains no
    interpretation, no diagnosis, and no clinical recommendation.</p>
  </div>
</body>
</html>`;
}
