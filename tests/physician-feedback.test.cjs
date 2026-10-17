require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildEntriesCsv, csvCell, CSV_COLUMNS } = require('../utils/csv.ts');
const { formatEntryDuration, formatContinuity, formatEntryTiming, observationCoverage } = require('../utils/observation.ts');
const { buildHealthEvents } = require('../utils/healthEvents.ts');
const { buildDailySeries } = require('../utils/trendData.ts');
const { evaluateStoryGate } = require('../utils/storyGate.ts');
const { buildProgressionFindings } = require('../utils/storyProgression.ts');
const { buildStoryReport, storyReportToPlainText } = require('../utils/storyReport.ts');
const { buildFactorFindings, buildTimeFindings } = require('../utils/storyFindings.ts');
const { severityLabel, severityColor } = require('../utils/symptoms.ts');
const { severityPrintColor } = require('../utils/chartSvg.ts');
function entry(patch = {}) { return { id: 'one', symptomType: 'headache', severity: 5, durationMinutes: null, triggers: [], reliefFactors: [], impactNote: null, note: null, loggedAt: '2026-09-01T09:00:00.000Z', createdAt: '2026-09-02T09:00:00.000Z', updatedAt: '2026-09-02T09:00:00.000Z', schemaVersion: 1, ...patch }; }
const scattered = [1,5,9,14,21,29].map(day => entry({id:`e${day}`,loggedAt:`2026-09-${String(day).padStart(2,'0')}T09:00:00.000Z`}));
test('summaries unlock for zero, one, and six nonconsecutive observations', () => {
 for (const entries of [[],[entry()],scattered]) assert.equal(evaluateStoryGate(entries).unlocked,true);
 const report=buildStoryReport(scattered,{startDate:new Date('2026-09-01'),endDate:new Date('2026-09-30T23:59:59Z')});
 assert.equal(report.meta.entryCount,6); assert.equal(report.meta.daysLogged,6);
 assert.match(observationCoverage(scattered),/6 observations/);
 assert.match(storyReportToPlainText(report),/Headache/i);
});
test('unlogged chart days remain null and never imply symptom resolution', () => {
 const series=buildDailySeries([entry()],3,new Date('2026-09-03T12:00:00Z'));
 assert.deepEqual(series.values,[5,null,null]);
 assert.deepEqual(buildProgressionFindings([],buildHealthEvents([entry()]),30,new Date('2026-10-01')),[]);
});
test('intermittent windows are not active durations, one minute is retained in reports', () => {
 const e=entry({continuity:'intermittent',episodeCount:3,episodeCountPrecision:'approximate',observationWindowMinutes:240,durationMinutes:1,durationPrecision:'exact'});
 assert.match(formatContinuity(e),/about 3 episodes/);assert.match(formatContinuity(e),/240 min \(not symptom duration\)/);assert.equal(formatEntryDuration(e),'1 min of symptoms');
 const report=buildStoryReport([e],{startDate:new Date('2026-09-01'),endDate:new Date('2026-09-30')});
 const text=storyReportToPlainText(report); assert.match(text,/about 3 episodes/);assert.match(text,/240 min/);assert.match(text,/1 min of symptoms/);
});
test('approximate, ongoing, absent, and legacy duration remain distinct',()=>{
 assert.equal(formatEntryDuration(entry()),'Duration not provided');
 assert.equal(formatEntryDuration(entry({durationPrecision:'ongoing'})),'Still ongoing');
 assert.equal(formatEntryDuration(entry({durationMinutes:120,durationPrecision:'approximate',durationDescription:'1–3 hours'})),'1–3 hours');
 assert.match(formatEntryDuration(entry({durationMinutes:17})),/legacy: 17 min/);
});
test('unknown and coarse timing never supply exact-time factor pairs',()=>{
 const rows=Array.from({length:20},(_,i)=>entry({id:`r${i}`,loggedAt:new Date(Date.UTC(2026,8,1,9,i)).toISOString(),timingPrecision:'unsure',triggers:i%2?['Stress']:[]}));
 assert.equal(formatEntryTiming(rows[0]),'Time not sure');
 assert.equal(buildFactorFindings(buildHealthEvents(rows)).length,0);
 assert.equal(buildTimeFindings(buildHealthEvents(rows)).filter(f=>f.kind==='timeOfDayConcentration').length,0);
 const coarse=entry({timingPrecision:'part_of_day',partOfDay:'Night'});assert.equal(formatEntryTiming(coarse),'Night');assert.equal(buildHealthEvents([coarse])[0].hour,23);
});
test('CSV escapes quotes, commas, newlines, Unicode and formula injection without mutation',()=>{
 const e=entry({note:'痛み, "quoted"\r\nnext',impactNote:' \t=HYPERLINK("x")',timingPrecision:'unsure',timezone:'America/Los_Angeles',utcOffsetMinutes:-420,continuity:'intermittent',episodeCount:2});
 const before=JSON.stringify(e);const csv=buildEntriesCsv([e]);
 assert.ok(csv.startsWith('\ufeff'));assert.match(csv,/痛み, ""quoted""\r\nnext/);assert.match(csv,/' \t=HYPERLINK/);assert.match(csv,/America\/Los_Angeles/);assert.equal(JSON.stringify(e),before);
 for(const text of ['=1','+1','-1','@SUM(A1)',' \n=1','\tfoo','\rfoo']) assert.equal(csvCell(text)[1],"'");
 for(const column of ['id','createdAt','timingPrecision','episodeCountPrecision','durationPrecision','severity','medicationIds'])assert.ok(CSV_COLUMNS.includes(column));
 assert.equal(csvCell(null),'""'); assert.equal(csvCell(undefined),'""');
});
test('severity is numerical and uses one color in screen and print',()=>{
 assert.equal(severityLabel(1),'1/10');assert.equal(severityLabel(10),'10/10');
 assert.equal(new Set(Array.from({length:11},(_,i)=>severityColor(i))).size,1);
 assert.equal(new Set(Array.from({length:11},(_,i)=>severityPrintColor(i))).size,1);
});
test('patient calendar day and reported time survive timezone changes',()=>{
 const { entryDateKey }=require('../utils/entryStats.ts');const { entryTimeBucket }=require('../utils/observation.ts');
 const e=entry({loggedAt:'2026-09-02T06:30:00.000Z',occurrenceDate:'2026-09-01',timezone:'America/Los_Angeles',utcOffsetMinutes:-420,timingPrecision:'exact'});
 assert.equal(entryDateKey(e),'2026-09-01');assert.equal(entryTimeBucket(e),'Night');assert.match(formatEntryTiming(e),/11:30/);
 assert.match(observationCoverage([e]),/2026-09-01 to 2026-09-01/);
});
test('core text and primary controls meet AA contrast in light and dark themes',()=>{
 const {getTheme}=require('../utils/theme.ts');
 function luminance(hex){const rgb=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;}
 for(const scheme of ['light','dark']){
  const c=getTheme(scheme).colors;
  for(const [fg,bg] of [['ink','background'],['inkSecondary','surface'],['inkMuted','surfaceMuted'],['onPrimary','primary'],['primary','primarySoft'],['success','successSoft'],['danger','dangerSoft']]){
   const a=luminance(c[fg]),b=luminance(c[bg]);const ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
   assert.ok(ratio>=4.5,`${scheme} ${fg}/${bg}: ${ratio.toFixed(2)}`);
  }
 }
});
