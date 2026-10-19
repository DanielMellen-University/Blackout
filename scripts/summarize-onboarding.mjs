import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const dir=process.argv[2]||'docs/reviews/onboarding-10.945',summary=[]
for(const device of ['keyboard','gamepad']){
 const root=`${dir}/after-${device}`,data=JSON.parse(await readFile(root+'/run.json','utf8')),f=data.final
 assert.deepEqual(data.errors,[]);assert.equal(f.phase,'complete');assert.equal(f.next,5);assert.equal(f.status,'landed');assert.equal(f.mapped.inputSource,device)
 assert.equal(f.mapped.result.gatesCleared,5);assert.ok(f.mapped.report.includes('MEDAL'));assert.ok(f.mapped.report.includes('Choose mission'))
 assert.ok(data.samples.some(s=>s.onGround&&s.briefing.hint.includes('AT 60 KT')))
 for(const stage of ['first-gate','route','return','approach'])assert.ok(data.samples.some(s=>s.briefing.stage===stage),`Missing ${device} ${stage}`)
 const next=JSON.parse(await readFile(root+'/next.json','utf8'));assert.equal(next.selected,'training-orbit');assert.equal(next.focused,'btn-play');assert.equal(JSON.parse(next.history).completionCount,1)
 const layout=JSON.parse(await readFile(root+'/layout.json','utf8'));assert.ok(layout.brief.bottom<=layout.hero.bottom&&layout.launch.bottom<=layout.hero.bottom)
 summary.push({device,seconds:f.mapped.result.elapsedSec,medal:f.mapped.result.medal,score:f.mapped.result.totalScore,landing:f.mapped.result.landingLabel,keys:f.mapped.eventCount,stages:[...new Set(data.samples.map(s=>s.briefing.stage))],nextGoal:next.goal})
}
await writeFile(dir+'/summary.json',JSON.stringify(summary,null,2)+'\n');console.table(summary)
