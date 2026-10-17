require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
let raw=null, failWrite=false, shareAvailable=true, shareError=false, shareCalls=0, deletedFiles=0, printedHtml='';
const storage={getItem:async()=>raw,setItem:async(_key,value)=>{if(failWrite)throw Error('unavailable');raw=value;}};
class File { constructor(){this.uri='file://test.csv';this.exists=false;}create(){this.exists=true;}write(csv){assert.ok(csv.startsWith('\ufeff'));}delete(){this.exists=false;deletedFiles++;} }
const originalLoad=Module._load;
Module._load=function(id,parent,...args){
 if(id==='@react-native-async-storage/async-storage')return {__esModule:true,default:storage};
 if(id==='react-native')return {Platform:{OS:'ios'}};
 if(id==='expo-sharing')return {isAvailableAsync:async()=>shareAvailable,shareAsync:async()=>{shareCalls++;if(shareError)throw Error('share unavailable');}};
 if(id==='expo-print')return {printToFileAsync:async({html})=>{printedHtml=html;return {uri:'file://test.pdf'};}};
 if(id==='expo-file-system')return {File,Paths:{cache:'cache'}};
 if(id==='../services/syncService')return {syncEntriesToCloud:async()=>{}};
 return originalLoad.call(this,id,parent,...args);
};
const {loadEntries,saveEntries}=require('../services/entryStorage.ts');
const {useLogStore}=require('../store/logStore.ts');
const {exportEntriesCsv}=require('../services/csvExportService.ts');
function legacy(patch={}) { return {id:'old',symptomType:'headache',severity:5,durationMinutes:17,triggers:[],reliefFactors:[],impactNote:null,note:'Original',loggedAt:'2026-08-01T09:01:00.000Z',createdAt:'2026-08-02T09:01:00.000Z',updatedAt:'2026-08-02T09:01:00.000Z',schemaVersion:1,...patch}; }
test('legacy load/edit preserves IDs, original timestamps, arbitrary durations, and unknown fields',async()=>{
 const e=legacy({futureField:'preserve me',note:'  Verbatim original  '});raw=JSON.stringify([e]);
 useLogStore.setState({entries:[],deletedEntries:[],hydrated:false});await useLogStore.getState().hydrate();
 assert.equal(raw,JSON.stringify([e])); // no rewrite during hydration
 useLogStore.getState().startEditingEntry(e);useLogStore.getState().setSeverityFor('headache',7);
 const result=await useLogStore.getState().saveSymptomCard('headache');
 assert.equal(result.durationMinutes,17);assert.equal(result.durationPrecision,undefined);assert.equal(result.id,e.id);assert.equal(result.createdAt,e.createdAt);assert.equal(result.loggedAt,e.loggedAt);assert.equal(result.futureField,'preserve me');assert.equal(result.note,e.note);assert.equal(result.timezone,undefined);assert.equal(result.utcOffsetMinutes,undefined);
});
test('per-symptom durations and windows are independent and survive hydration',async()=>{
 useLogStore.setState({entries:[],deletedEntries:[]});raw='[]';const store=()=>useLogStore.getState();store().resetDraft();
 for(const symptom of ['pain','headache']){store().toggleSymptomType(symptom);store().setSeverityFor(symptom,4);}
 store().setDurationKeyFor('headache','exact_1');store().patchSymptom('headache',{continuity:'intermittent',episodeCount:3,episodeCountPrecision:'approximate',observationWindowMinutes:240});store().setTiming('part_of_day','Evening');
 const headache=await store().saveSymptomCard('headache');const pain=await store().saveSymptomCard('pain');
 assert.equal(headache.durationMinutes,1);assert.equal(pain.durationMinutes,null);assert.equal(pain.observationWindowMinutes,null);assert.equal(headache.episodeCount,3);assert.equal(headache.timingPrecision,'part_of_day');
 assert.equal((await loadEntries()).find(e=>e.id===headache.id).observationWindowMinutes,240);
});
test('failed local write does not produce a saved record',async()=>{
 useLogStore.setState({entries:[],deletedEntries:[]});raw='[]';const store=useLogStore.getState();store.resetDraft();store.toggleSymptomType('pain');store.setSeverityFor('pain',2);failWrite=true;
 assert.equal(await store.saveSymptomCard('pain'),null);assert.equal(useLogStore.getState().entries.length,0);assert.match(useLogStore.getState().saveError,/Could not save/);failWrite=false;
});
test('individual deletion persists tombstone and resists older remote resurrection',async()=>{
 const e=legacy();raw=JSON.stringify([e]);useLogStore.setState({entries:[e],deletedEntries:[]});
 assert.equal(await useLogStore.getState().deleteEntry(e.id),true);assert.equal(useLogStore.getState().entries.length,0);assert.ok(JSON.parse(raw)[0].deletedAt);assert.equal(JSON.parse(raw)[0].note,null);
 useLogStore.getState().mergeRemoteEntries([e]);assert.equal(useLogStore.getState().entries.length,0);
 useLogStore.setState({entries:[],deletedEntries:[],hydrated:false});await useLogStore.getState().hydrate();assert.equal(useLogStore.getState().entries.length,0);assert.equal(useLogStore.getState().deletedEntries.length,1);
});
test('unrecognized records are retained and unreadable storage is not overwritten',async()=>{
 raw=JSON.stringify([{unknown:'keep'}]);assert.equal(await saveEntries([legacy()]),true);assert.ok(JSON.parse(raw).some(e=>e.unknown==='keep'));
 raw='{bad json';assert.equal(await saveEntries([legacy()]),false);assert.equal(raw,'{bad json');
});
test('native CSV sharing handles success, unavailable, failure and cleanup without mutating records',async()=>{
 const rows=[legacy()];const before=JSON.stringify(rows);assert.equal((await exportEntriesCsv(rows)).ok,true);assert.equal(shareCalls,1);assert.equal(deletedFiles,1);
 shareAvailable=false;assert.equal((await exportEntriesCsv(rows)).ok,false);assert.equal(shareCalls,1);
 shareAvailable=true;shareError=true;assert.equal((await exportEntriesCsv(rows)).ok,false);assert.equal(deletedFiles,2);assert.equal(JSON.stringify(rows),before);
 assert.equal((await exportEntriesCsv([])).ok,false);
});

test('raw PDF preserves timing uncertainty, continuity, window, duration and escaped patient words',async()=>{
 const { exportReport }=require('../services/reportService.ts');
 shareAvailable=true;shareError=false;
 const e=legacy({loggedAt:new Date().toISOString(),timingPrecision:'unsure',continuity:'intermittent',episodeCount:3,observationWindowMinutes:240,durationMinutes:1,durationPrecision:'exact',feelsLikeNote:'<script>痛み</script>'});
 assert.equal((await exportReport([e],30)).ok,true);
 assert.match(printedHtml,/Time not sure/);assert.match(printedHtml,/3 episodes/);assert.match(printedHtml,/240 min/);assert.match(printedHtml,/1 min of symptoms/);assert.match(printedHtml,/&lt;script&gt;痛み/);assert.ok(!printedHtml.includes('<script>痛み'));
});
test('invalid exact timing blocks saving until timing is corrected or marked unsure',async()=>{
 raw='[]';useLogStore.setState({entries:[],deletedEntries:[]});const store=()=>useLogStore.getState();store().resetDraft();store().toggleSymptomType('pain');store().setSeverityFor('pain',2);store().setTimingValid(false);
 assert.equal(await store().saveSymptomCard('pain'),null);store().setTiming('unsure');assert.ok(await store().saveSymptomCard('pain'));
});
