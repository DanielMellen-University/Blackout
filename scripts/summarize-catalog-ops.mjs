import {readFileSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const dir=process.argv[2]||'docs/reviews/catalog-10.934',data=JSON.parse(readFileSync(`${dir}/browser.json`,'utf8'))
assert.deepEqual(data.errors,[])
const get=label=>{const r=data.records.find(r=>r.label===label);assert.ok(r,'Missing '+label);return r.state}
const before=get('rollover-before'),after=get('rollover-after'),live=get('daily-launch')
assert.ok(before.detail.includes('2026-10-18'));assert.ok(after.detail.includes('2026-10-19'))
assert.equal(before.seed,after.seed);assert.deepEqual(before.position,after.position)
assert.ok(after.wallClock-before.wallClock>=70000)
assert.equal(live.seed,after.definition.seed);assert.equal(live.active.periodKey,'2026-10-19')
for(const label of ['paused-selection','resumed','retry']){
 const s=get(label);assert.equal(s.selected,'training-orbit');assert.equal(s.selectedTitle,s.selected);assert.equal(s.selectedPause,s.selected)
 assert.equal(s.active.recordId,live.active.recordId);assert.equal(s.seed,live.seed)
}
assert.equal(get('new-selection-launch').active.course.id,'training-orbit')
for(const key of ['day','week','month']){
 const historical=get(`${key}-launched`),released=get(`${key}-released`),retry=get(`${key}-historical-retry`),next=get(`${key}-new-training`)
 assert.ok(historical.replay);assert.equal(released.replay,null);assert.equal(released.active.recordId,historical.active.recordId)
 assert.ok(released.protectedRecords.includes(historical.active.recordId));assert.equal(retry.active.recordId,historical.active.recordId)
 assert.equal(next.active.course.id,'training-orbit');assert.ok(!next.protectedRecords.includes(historical.active.recordId))
}
assert.equal(get('custom-seed-releases-replay').replay,null);assert.equal(get('custom-seed-launched').seed,73)
const visual=JSON.parse(readFileSync(`${dir}/visual/current.json`,'utf8'));assert.deepEqual(visual.errors,[]);assert.deepEqual(visual.results.map(r=>r.mode),['chase','cockpit'])
const summary={states:data.records.length,longOpenWallSeconds:(after.wallClock-before.wallClock)/1000,previewWorldUnchanged:true,dailyBefore:before.definition.detail,dailyAfter:after.definition.detail,activeDaily:live.active.recordId,pausedSelectionResumeRetry:true,historicalRelease:['day','week','month'],customSeedRelease:true,visuals:visual.results.map(r=>({seed:r.seed,mode:r.mode,position:r.scan.position})),applicationErrors:data.errors,scope:'Browser DOM/session identity and protection-set transitions, not scored completions, durable historical record deletion, cross-tab synchronization or multi-day endurance.'}
writeFileSync(`${dir}/summary.json`,JSON.stringify(summary,null,2)+'\n');console.log(summary)
