import {readFileSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const dir=process.argv[2]||'docs/reviews/training-10.933'
const before=JSON.parse(readFileSync(`${dir}/pilot/run.json`,'utf8'))
const after=JSON.parse(readFileSync(`${dir}/after/run.json`,'utf8'))
const first=after.samples[0],last=after.final
assert.deepEqual(after.errors,[]);assert.equal(last.phase,'complete');assert.equal(last.status,'landed');assert.equal(last.resultsOpen,true)
assert.equal(last.next,5);assert.ok(last.gates.every(g=>g.passed));assert.ok(after.samples.every(s=>!s.paused&&s.course==='training-orbit'))
assert.deepEqual(last.events.map(e=>e.next),[0,1,2,3,4,5])
for(const stage of ['takeoff','first-gate','route','return','approach'])assert.ok(after.samples.some(s=>s.briefing.visible&&s.briefing.stage===stage),'Missing hint '+stage)
assert.ok(Math.hypot(first.position[0]-first.spawn.x,first.position[2]-first.spawn.z)<200,'Flight must start near the runway')
assert.ok(after.pictures.includes('launch.png')&&after.pictures.includes('cockpit.png'))
const old=before.samples[0],gateBefore=old.gates[0].position,gateAfter=first.gates[0].position
assert.equal(gateBefore[0],gateAfter[0]);assert.equal(gateBefore[2],gateAfter[2])
for(let i=1;i<5;i++)assert.deepEqual(old.gates[i].position,first.gates[i].position)
const climb=(g,s)=>g[1]-s.y
const slope=(g,s)=>Math.atan2(climb(g,s),Math.hypot(g[0]-s.x,g[2]-s.z))*180/Math.PI
const summary={seconds:last.seconds,passedGates:last.next,status:last.status,phase:last.phase,settingsOpened:false,
 method:after.method,gateOne:{beforeClimbM:climb(gateBefore,old.spawn),afterClimbM:climb(gateAfter,first.spawn),beforeSlopeDegrees:slope(gateBefore,old.spawn),afterSlopeDegrees:slope(gateAfter,first.spawn)},
 otherGatePositionsUnchanged:true,hintStages:[...new Set(after.samples.filter(s=>s.briefing.visible).map(s=>s.briefing.stage))],touchdownPosition:last.position,finalSpeedMps:last.speed,
 cockpitSample:after.samples.find(s=>s.next>=1),pictures:after.pictures.length,sourceHashes:after.sourceHashes,
 limits:'External controls-only pilot, not manual keyboard/gamepad handling. No preset landing trajectory or gate writes. Settings absence follows the saved browser driver actions.'}
writeFileSync(`${dir}/summary.json`,JSON.stringify(summary,null,2)+'\n');console.log({seconds:summary.seconds,gateOne:summary.gateOne,hintStages:summary.hintStages,pictures:summary.pictures})
