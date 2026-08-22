import { generateDemoDataset } from '../utils/demoData';
import { buildHealthEvents, filterEventsToRange } from '../utils/healthEvents';
import { buildSymptomLinks, describeLink, assembleChain } from '../utils/storyProgression';
const ds = generateDemoDataset();
const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 29);
const ev = filterEventsToRange(buildHealthEvents(ds.entries, ds.customSymptoms), start, end);
const links = buildSymptomLinks(ev);
console.log('links found:', links.length);
for (const l of links) {
  console.log(`\n${l.fromLabel} -> ${l.toLabel}: ${l.followed}/${l.fromCount} (${(l.observedRate*100).toFixed(0)}%), expected ${(l.expectedRate*100).toFixed(0)}%, lift ${l.lift.toFixed(2)}`);
  console.log('  ', describeLink(l));
}
console.log('\nchain:', assembleChain(links).join(' -> ') || '(none)');
