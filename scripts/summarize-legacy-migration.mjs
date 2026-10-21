import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { assertCaptureFreeTiming } from './lib/review-frame-metrics.mjs'
const part=process.env.REVIEW_PART || 'migration-b-full'
const root=`docs/reviews/generator/${part}`
const jobs=JSON.parse(await readFile(`${root}/jobs.json`,'utf8'))
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z','--','src'],{encoding:'utf8'}).split('\0').filter(Boolean)
const digest=v=>createHash('sha256').update(v).digest('hex')
const hashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,digest(await readFile(f))])))
const hookHash=digest(await readFile('scripts/browser-generator.js'))
const rows=[]
for(const job of jobs)for(const seed of job.seeds.split(',').map(Number)) {
 const receipt=`${root}/${job.course}-${seed}/run.json`
 const r=JSON.parse(await readFile(receipt,'utf8')),f=r.final
 assert.equal(r.pass,true,receipt);assert.deepEqual(r.errors,[])
 assert.equal(f.seed,seed);assert.equal(f.course,job.course)
 assert.equal(r.build.production,true);assert.equal(r.build.minified,true)
 assert.equal(r.build.hookSha256,hookHash)
 for(const[file,hash]of Object.entries(hashes))if(file!=='src/core/Version.ts')assert.equal(r.build.sourceHashes[file],hash,`${receipt}: source drift ${file}`)
 assert.equal(f.next>=1,true);assert.equal(f.status==='crashed',false)
 if(r.smoke)assert.ok(f.nitroRefills.length>=1)
 else assert.equal(f.nitroRefills.length,5)
 assert.ok(f.nitroRefills.every(s=>Math.abs(s.after.fraction-Math.min(1,s.before.fraction+.25))<1e-9))
 if(job.profile){
  assert.equal(f.missionSettings.terrainTheme,job.profile)
  assert.equal(f.routeProfile,f.missionSettings.profile)
  assert.ok(f.recordId.includes(`:mission:${job.course}`));assert.match(f.recordId,/:l1\d+:q1\d+:/)
 }
 if(r.smoke){
  assert.equal(r.capture,true);assert.equal(r.timingEligible,false)
  for(const camera of ['chase','cockpit'])assert.ok((await readFile(receipt.replace('run.json',`gates-${camera}.jpg`))).length>10000)
 }else{
  const metrics=assertCaptureFreeTiming(r)
  for(const key of Object.keys(metrics))assert.equal(r.metrics[key],metrics[key])
  assert.equal(f.phase,'complete');assert.equal(f.status,'landed');assert.equal(f.next,5)
  assert.equal(f.result.gatesCleared,5);assert.equal(f.result.gatesTotal,5);assert.equal(f.resultsOpen,true)
  assert.ok(f.gates.every(g=>g.passed));assert.ok(f.nitroTimeline.some(s=>s.boosting))
  assert.ok(f.contact&&Math.abs(f.contact.localX)<9&&Math.abs(f.contact.localZ)<60)
 }
 const m=r.metrics,coverageMisses=r.samples.filter(s=>s.seconds>10&&!s.coverage).length
 assert.equal(coverageMisses,0,receipt)
 rows.push({mission:job.course,profile:job.profile||'unchanged period',seed,period:job.period,seconds:f.seconds,
  medal:f.result?.medal,score:f.result?.totalScore,contract:f.contract,refills:f.nitroRefills.length,
  fps:m.fps,p95:m.p95,over50:m.over50,over100:m.over100,max:m.max,heapPeakMB:Math.max(...r.samples.map(s=>s.heapMB)),coverageMisses,recordId:f.recordId,receipt})
}
const method=part.endsWith('-full')?'Sequential complete production-mode browser flights. Capture OFF, profiler OFF, fixed chase, balanced 1280x720, scale 1, native RAF, ordinary adaptive resolution. Timing begins after the launch panel hides. Omit only the first ten intervals; retain every remaining interval and strict >50/100 ms counts. No test, build or other browser overlaps timing. Heap is sampled main-thread used JS heap.':'Separate browser smoke and visual flights through gate one and ordinary nitro refill. Chase/cockpit captures exclude these sessions from timing acceptance.'
await writeFile(`docs/reviews/generator/${part}-summary.json`,JSON.stringify({pass:true,method,sourceHashes:hashes,hookHash,rows},null,2)+'\n')
const table=['| Mission | Profile | Seed | Medal | FPS | p95 ms | >50 ms | >100 ms | Max ms | Heap MB |','| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |',...rows.map(r=>`| ${r.mission} | ${r.profile} | ${r.seed} | ${r.medal||'gate one'} | ${r.fps.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.over50} | ${r.over100} | ${r.max.toFixed(1)} | ${r.heapPeakMB.toFixed(1)} |`)].join('\n')
await writeFile(`docs/reviews/generator/${part}-results.md`,method+'\n\n'+table+'\n')
console.log(JSON.stringify({pass:true,flights:rows.length,notGold:rows.filter(r=>r.medal&&r.medal!=='gold'),max:Math.max(...rows.map(r=>r.max)),heapPeakMB:Math.max(...rows.map(r=>r.heapPeakMB))}))
