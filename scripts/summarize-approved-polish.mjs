import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { assertCaptureFreeTiming } from './lib/review-frame-metrics.mjs'
const part=process.env.REVIEW_PART || 'polish-proof'
const themes=(process.env.POLISH_THEMES || 'desert-run,mountain-valley-run,coastal-island-run,generated-volcanic-run').split(',')
const seeds=(process.env.REVIEW_SEEDS || '42,1337,9001').split(',').map(Number)
const timing=process.env.REVIEW_CAPTURE!=='1'
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z','--','src'],{encoding:'utf8'}).split('\0').filter(Boolean)
const digest=v=>createHash('sha256').update(v).digest('hex')
const hashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,digest(await readFile(f))])))
const hookHash=digest(await readFile('scripts/browser-generator.js'))
const profiles={'desert-run':'generated-desert','mountain-valley-run':'generated-valley','coastal-island-run':'generated-coastal','generated-volcanic-run':'generated-volcanic'}
const rows=[]
for(const theme of themes)for(const seed of seeds){
 const receipt=`docs/reviews/generator/${part}/${theme}-${seed}/run.json`
 const r=JSON.parse(await readFile(receipt,'utf8')),f=r.final
 assert.equal(r.pass,true,receipt);assert.deepEqual(r.errors,[]);assert.equal(f.course,theme);assert.equal(f.seed,seed)
 assert.ok(f.recordId.startsWith(`seed:${seed}:${profiles[theme]}:r32:l`),`${receipt}: profile/record identity`)
 assert.match(f.recordId,/:l\d+:q\d+$/)
 assert.equal(r.build.production,true);assert.equal(r.build.minified,true);assert.equal(r.build.hookSha256,hookHash)
 assert.deepEqual(Object.keys(r.build.sourceHashes).sort(),files.sort())
 for(const [file,hash]of Object.entries(hashes))if(file!=='src/core/Version.ts')assert.equal(r.build.sourceHashes[file],hash,`${receipt}: runtime drift ${file}`)
 if(timing){
  const m=assertCaptureFreeTiming(r)
  for(const key of Object.keys(m))assert.equal(r.metrics[key],m[key],`${receipt}: metrics ${key}`)
  assert.ok(m.max<=100.1,`${receipt}: interval ${m.max}`)
 }
 else{
  assert.equal(r.capture,true)
  for(const picture of ['gates-chase.jpg','gates-cockpit.jpg']){
   assert.ok(r.pictures.includes(picture));assert.ok((await readFile(receipt.replace('run.json',picture))).length>10000)
  }
 }
 if(!r.smoke){
  assert.equal(f.status,'landed');assert.equal(f.phase,'complete');assert.equal(f.next,5);assert.equal(f.resultsOpen,true)
  assert.equal(f.result.gatesCleared,5);assert.equal(f.result.gatesTotal,5);assert.equal(f.result.medal,'gold')
  assert.ok(f.gates.every(g=>g.passed));assert.equal(f.nitroRefills.length,5)
  assert.ok(f.nitroTimeline.some(s=>s.boosting))
  assert.ok(f.nitroRefills.every(s=>Math.abs(s.after.fraction-Math.min(1,s.before.fraction+.25))<1e-9))
  assert.ok(f.contact&&Math.abs(f.contact.localX)<9&&Math.abs(f.contact.localZ)<60)
 }
 const coverageMisses=r.samples.filter(s=>s.seconds>10&&!s.coverage).length
 assert.equal(coverageMisses,0,receipt)
 const m=r.metrics
 rows.push({theme,seed,seconds:f.seconds,score:f.result?.totalScore,medal:f.result?.medal,fps:m.fps,p95:m.p95,over50:m.over50,over100:m.over100,max:m.max,heapPeakMB:Math.max(...r.samples.map(s=>s.heapMB)),coverageMisses,recordId:f.recordId,receipt})
}
const method=timing?'Sequential complete production flights, controls-only pilot, fixed chase camera, capture OFF, profiler OFF, native RAF and full rendering cadence. Balanced, 1280x720, device scale 1, ordinary adaptive resolution. First ten RAF intervals omitted as in 10.977; every raw interval is retained. No tests, builds or other review browser overlap timing. Heap is sampled main-thread JS heap, not total browser or GPU memory.':'Separate visual sessions, excluded from timing acceptance. Production rendering and controls-only pilot; chase/cockpit stills at gate one. Same viewport and quality as timing.'
await writeFile(`docs/reviews/generator/${part}-summary.json`,JSON.stringify({pass:true,method,sourceHashes:hashes,hookHash,rows},null,2)+'\n')
const table=['| Theme | Seed | Flight s | Medal | FPS | p95 ms | >50 ms | >100 ms | Max ms | Heap MB |','| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |',...rows.map(r=>`| ${r.theme} | ${r.seed} | ${r.seconds.toFixed(1)} | ${r.medal||'visual'} | ${r.fps.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.over50} | ${r.over100} | ${r.max.toFixed(1)} | ${r.heapPeakMB.toFixed(1)} |`)].join('\n')
await writeFile(`docs/reviews/generator/${part}-results.md`,method+'\n\n'+table+'\n')
console.log(JSON.stringify({pass:true,flights:rows.length,rows},null,2))
