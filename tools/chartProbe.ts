/**
 * Renders every chart to SVG and validates the print output.
 * Run: npx tsx tools/chartProbe.ts
 */
import * as fs from 'fs';
import { generateDemoDataset } from '../utils/demoData';
import { buildStoryReport } from '../utils/storyReport';
import { renderChartBlock, renderChartSvg } from '../utils/chartSvg';

const ds = generateDemoDataset();
const end = new Date();
const start = new Date();
start.setDate(start.getDate() - 29);
const report = buildStoryReport(ds.entries, {
  startDate: start, endDate: end,
  medications: ds.medications, customSymptoms: ds.customSymptoms,
});

let failures = 0;
console.log(`${report.charts.length} charts\n`);

for (const chart of report.charts) {
  const svg = renderChartSvg(chart);
  const problems: string[] = [];

  if (!svg.startsWith('<svg') || !svg.trimEnd().endsWith('</svg>')) {
    problems.push('SVG is not well-formed at its boundaries');
  }
  if ((svg.match(/</g) ?? []).length !== (svg.match(/>/g) ?? []).length) {
    problems.push('unbalanced angle brackets');
  }
  if (/NaN|Infinity|undefined/.test(svg)) {
    problems.push('SVG contains NaN, Infinity or undefined coordinates');
  }
  if (chart.table.rows.length === 0) problems.push('data table is empty');
  for (const row of chart.table.rows) {
    if (row.length !== chart.table.headers.length) {
      problems.push(`row has ${row.length} cells, headers have ${chart.table.headers.length}`);
      break;
    }
  }

  const status = problems.length === 0 ? 'ok' : 'FAIL';
  if (problems.length > 0) failures += problems.length;
  console.log(
    `[${status}] ${chart.kind.padEnd(21)} svg ${String(svg.length).padStart(5)}b · ` +
    `${chart.table.rows.length} rows × ${chart.table.headers.length} cols · ` +
    `${chart.entryIds.length} entries`,
  );
  for (const p of problems) console.log(`        - ${p}`);
}

// Write a viewable preview of the print output.
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;margin:40px;color:#333;font-size:11pt}
h3{font-size:11pt;margin:0 0 2px}
.chart-caption{font-size:9.5pt;color:#666;margin:0 0 8px}
table{width:100%;border-collapse:collapse;margin-top:6px}
th{background:#f5f5f5;text-align:left;padding:5px 4px;border-bottom:2px solid #333;font-size:9pt}
td{padding:4px;border-bottom:1px solid #eee;font-size:9pt}
.chart-block{margin:18px 0 26px}
.chart-note{font-size:8.5pt;color:#888;font-style:italic}
</style></head><body>${report.charts.map(renderChartBlock).join('')}</body></html>`;
fs.writeFileSync('/tmp/charts-preview.html', html);

console.log(failures === 0 ? '\nPASS — all charts render cleanly.' : `\nFAIL — ${failures} problem(s).`);
if (failures > 0) process.exitCode = 1;
