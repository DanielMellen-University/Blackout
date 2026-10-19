import { readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const dir=process.argv[2]||'docs/reviews/missions-10.943'
const reports=await Promise.all(['after','daily-final','bronze-offset','daily-silver','daily-bronze-final'].map(async name=>({name,...JSON.parse(await readFile(`${dir}/${name}/runs.json`,'utf8'))})))
const summaries=[]
for(const report of reports){
 assert.deepEqual(report.errors,[])
 const byId=new Map()
 for(const run of report.runs.filter(r=>r.final)){
  const f=run.final,r=f.score.result,id=f.score.active.recordId
  assert.equal(f.course,run.label.replace(/-\d+$/,''));assert.equal(f.next,5);assert.equal(f.phase,'complete');assert.equal(f.status,'landed')
  const medal=r.totalScore>=88000?'gold':r.totalScore>=76000?'silver':r.totalScore>=64000?'bronze':'complete'
  assert.equal(r.medal,medal);assert.ok(f.score.report.includes(medal==='complete'?'COMPLETE':medal.toUpperCase()+' MEDAL'))
  const previous=byId.get(id)||[];previous.push(r);byId.set(id,previous)
  assert.equal(r.bestScore,Math.max(...previous.map(v=>v.totalScore)))
  assert.equal(r.bestTimeSec,Math.min(...previous.map(v=>v.elapsedSec)))
  assert.equal(r.completionCount,previous.length)
  const history=JSON.parse(f.score.storage['blackout.history.'+id])
  assert.equal(history.completionCount,r.completionCount);assert.equal(history.bestTimeSec,r.bestTimeSec)
  assert.equal(Number(f.score.storage['blackout.best.'+id]),r.bestScore)
  const prior=previous.at(-2)
  if(prior){assert.ok(Math.abs(r.paceDeltaSec-(r.elapsedSec-prior.bestTimeSec))<1e-8);assert.equal(r.isNewBestTime,r.elapsedSec<prior.bestTimeSec)}
  summaries.push({suite:report.name,mission:f.course,id,speed:run.speed,score:r.totalScore,medal,seconds:r.elapsedSec,fastest:r.bestTimeSec,newFastest:r.isNewBestTime,pace:r.paceLabel})
 }
}
for(const course of ['training-orbit','daily-ops'])for(const medal of ['bronze','silver','gold'])assert.ok(summaries.some(r=>r.mission===course&&r.medal===medal),`Missing ${course} ${medal}`)
await writeFile(dir+'/summary.json',JSON.stringify(summaries,null,2)+'\n');console.table(summaries)
