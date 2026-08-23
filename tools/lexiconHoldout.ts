/**
 * HELD-OUT set: sentences written fresh, after tuning was finished,
 * and never used to adjust the lexicon. The corpus result is
 * self-graded; this is the closer thing to an honest estimate.
 */
import { extractDescriptors } from '../utils/symptomLexicon';

const cases: { text: string; expect: string[] }[] = [
  // Everyday non-clinical writing using lexicon words
  { text: 'The company is under a lot of pressure to deliver.', expect: [] },
  { text: 'He gave a sharp reply and walked off.', expect: [] },
  { text: 'It rained heavy all weekend.', expect: [] },
  { text: 'I felt numb watching the news.', expect: [] },
  { text: 'We had a tight win in the last minute.', expect: [] },
  { text: 'The colours were dull in that photo.', expect: [] },
  { text: 'Burning through my savings this month.', expect: [] },
  { text: 'She has a heart of gold.', expect: [] },
  { text: 'My laptop is running hot again.', expect: [] },
  { text: 'Cold call from a recruiter today.', expect: [] },
  { text: 'That joke was in poor taste.', expect: [] },
  { text: 'The deadline is crushing me.', expect: [] },
  // Genuine symptom reports, phrased differently from the corpus
  { text: 'Pounding in my temples since I woke up.', expect: ['Throbbing', 'Temple'] },
  { text: 'My ankles are swollen again this evening.', expect: ['Ankles', 'Swollen'] },
  { text: 'Queasy after breakfast, no vomiting.', expect: ['Nausea'] },
  { text: 'Shooting pain travelling down my thigh.', expect: ['Radiating', 'Legs'] },
  { text: 'Could not concentrate, felt spaced out all morning.', expect: ['Brain fog'] },
  { text: 'A hot bath eased it more than the tablets.', expect: ['Heat therapy'] },
  { text: 'Heart was fluttering and I felt clammy.', expect: ['Racing heart', 'Sweating'] },
  { text: 'The stiffness in my knees is worse first thing in the morning.', expect: ['Stiff', 'Knees', 'On waking'] },
];

let fp = 0, ext = 0, expected = 0, missed = 0;
const problems: string[] = [];
for (const c of cases) {
  const found = extractDescriptors([{ entryId: 'e', text: c.text }])
    .filter((d) => d.count > 0).map((d) => d.label);
  ext += found.length;
  expected += c.expect.length;
  const wrong = found.filter((f) => !c.expect.includes(f));
  const miss = c.expect.filter((e) => !found.includes(e));
  fp += wrong.length;
  missed += miss.length;
  if (wrong.length) problems.push(`  FP  "${c.text}" -> ${wrong.join(', ')}`);
  if (miss.length) problems.push(`  miss "${c.text}" -> ${miss.join(', ')}`);
}
problems.forEach((p) => console.log(p));
console.log(`\nHELD-OUT: ${cases.length} cases`);
console.log(`extractions ${ext} | false positives ${fp} | FP rate ${ext ? ((fp/ext)*100).toFixed(2) : '0.00'}%`);
console.log(`recall ${expected ? (((expected-missed)/expected)*100).toFixed(1) : '100'}%`);
