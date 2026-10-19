import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const dir=process.argv[2]||'docs/reviews/contour-10.944',summary=[]
for(const seed of [42,73,808]){
 const data=JSON.parse(await readFile(`${dir}/seed-${seed}/runs.json`,'utf8'))
 assert.deepEqual(data.errors,[])
 const run=data.runs.find(r=>r.final),f=run.final,r=f.score.result
 assert.equal(f.course,'contour-circuit');assert.equal(f.phase,'complete');assert.equal(f.next,5);assert.equal(f.status,'landed')
 assert.equal(f.score.summary.profile,'contour');assert.equal(f.score.active.recordId,`seed:${seed}:contour`)
 const dx=f.position[0]-f.runway[0],dz=f.position[2]-f.runway[2]
 const along=dx*Math.sin(f.spawn.yaw)+dz*Math.cos(f.spawn.yaw),lateral=dx*Math.cos(f.spawn.yaw)-dz*Math.sin(f.spawn.yaw)
 assert.ok(Math.abs(along)<60&&Math.abs(lateral)<9,'Actual runway footprint contact')
 assert.equal(Number(f.score.storage[`blackout.best.seed:${seed}:contour`]),r.bestScore)
 assert.equal(JSON.parse(f.score.storage[`blackout.history.seed:${seed}:contour`]).bestTimeSec,r.elapsedSec)
 const reload=data.runs.find(r=>r.label.endsWith('-reload'))
 if(seed===42)assert.match(reload.state.goal,/Beat your .* best time/)
 summary.push({seed,seconds:r.elapsedSec,score:r.totalScore,medal:r.medal,landing:r.landingLabel,alongMeters:along,lateralMeters:lateral,clearance:f.score.summary.minClearanceMeters,recordId:f.score.active.recordId})
}
const ui=JSON.parse(await readFile(`${dir}/replay-ui.json`,'utf8'));assert.deepEqual(ui.errors,[]);for(const seed of [42,73,808])assert.match(ui.states.find(s=>s.label==='replay-goal'&&s.seed===seed).goal,/Beat your .* best time/)
await writeFile(`${dir}/summary.json`,JSON.stringify(summary,null,2)+'\n');console.table(summary)
