import { generateDemoDataset } from '../utils/demoData';
import { buildStoryReport, storyReportToPlainText } from '../utils/storyReport';
import { evaluateStoryGate } from '../utils/storyGate';

const ds: any = generateDemoDataset();
const entries = ds.entries ?? ds;
console.log('entries:', entries.length, '| keys:', Object.keys(ds).join(','));
console.log('GATE:', JSON.stringify(evaluateStoryGate(entries)));

const end = new Date();
const start = new Date(); start.setDate(start.getDate() - 29);
const r = buildStoryReport(entries, {
  startDate: start, endDate: end,
  medications: ds.medications ?? [],
  customSymptoms: ds.customSymptoms ?? [],
});
console.log('\nFINDINGS BY KIND:');
const byKind: Record<string, number> = {};
for (const f of r.findings) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
console.log(JSON.stringify(byKind, null, 1));
console.log('\n--- PATTERNS / RELIEF / MEDICATIONS SECTIONS ---');
for (const s of r.sections) {
  if (!['patterns','relief','medications','change'].includes(s.key)) continue;
  console.log('\n#', s.title);
  s.body.forEach(b => console.log('  ', b.text));
}
