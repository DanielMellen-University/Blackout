import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const themes = ['desert-run', 'mountain-valley-run'], seeds = [1337, 2026, 9001]
const sourceFiles = execFileSync('git', ['ls-files','--cached','--others','--exclude-standard','-z','--','src'], {encoding:'utf8'}).split('\0').filter(Boolean)
const digest = value => createHash('sha256').update(value).digest('hex')
const currentHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,digest(await readFile(file))])))
const hookHash = digest(await readFile('scripts/browser-generator.js'))
const rows = []
for (const theme of themes) for (const seed of seeds) {
 const path = `docs/reviews/generator/d/${theme}-${seed}/run.json`
 const run = JSON.parse(await readFile(path,'utf8')), f=run.final
 assert.equal(run.pass,true,path)
 assert.equal(run.smoke,false,path)
 assert.equal(run.theme,theme); assert.equal(f.course,theme); assert.equal(f.seed,seed)
 assert.equal(f.status,'landed'); assert.equal(f.phase,'complete'); assert.equal(f.next,5); assert.equal(f.resultsOpen,true)
 assert.equal(f.result.gatesCleared,5); assert.equal(f.result.gatesTotal,5); assert.ok(f.result.totalScore>0); assert.ok(['complete','bronze','silver','gold'].includes(f.result.medal));
 assert.equal(f.gates.length,5); assert.ok(f.gates.every(g=>g.passed))
 assert.deepEqual(run.errors,[])
 assert.ok(f.contact && Math.abs(f.contact.localX)<9 && Math.abs(f.contact.localZ)<60)
 assert.ok(f.nitroTimeline.some(s=>s.boosting))
 assert.equal(f.nitroRefills.length,5)
 assert.ok(f.nitroRefills.every(s=>Math.abs(s.after.fraction-Math.min(1,s.before.fraction+.25))<1e-9))
 const profile=theme==='desert-run'?'generated-desert':'generated-valley'
 assert.equal(f.recordId,`seed:${seed}:${profile}:r32:l30:q33`)
 assert.equal(run.build.production,true); assert.equal(run.build.minified,true); assert.equal(run.build.hookSha256,hookHash)
 assert.deepEqual(Object.keys(run.build.sourceHashes).sort(),sourceFiles.sort())
 for (const [file,hash] of Object.entries(currentHashes)) if(file!=='src/core/Version.ts') assert.equal(run.build.sourceHashes[file],hash,`${path}: changed runtime ${file}`)
 for (const name of ['gates-chase.jpg','gates-cockpit.jpg','approach-cockpit.jpg','final.jpg']) {
  assert.ok(run.pictures.includes(name)); assert.ok((await readFile(path.replace('run.json',name))).length>10000)
 }
 const samples=run.samples.filter(s=>s.seconds>10)
 assert.ok(samples.length>60)
 const coverageMisses=samples.filter(s=>!s.coverage).length
 assert.equal(coverageMisses,0,`${path}: resident terrain coverage`)
 assert.ok(samples.every(s=>s.lod && Number.isFinite(s.lod.lod)))
 const metrics=run.metrics
 assert.ok(metrics.fps>0 && metrics.p95>=metrics.p50 && metrics.max>=metrics.p95)
 rows.push({theme,seed,seconds:f.seconds,score:f.result?.totalScore,medal:f.result?.medal,
  fps:metrics.fps,p50:metrics.p50,p95:metrics.p95,max:metrics.max,over50:metrics.over50,over100:metrics.over100,
  coverageMisses,lods:[...new Set(samples.map(s=>s.lod.lod))],
  loadedMax:Math.max(...samples.map(s=>s.stream.loaded)),pendingMax:Math.max(...samples.map(s=>s.stream.pending)),
  heapPeakMB:Math.max(...run.samples.map(s=>s.heapMB)),contact:f.contact,pictures:run.pictures,receipt:path})
}
const summary={pass:true,method:'Six sequential native-wall-time controls-only flights. Balanced at a 1280x720 viewport and device scale 1 with the ordinary adaptive resolution scaler, full rendering cadence, ordinary physics/streaming/collision/scoring. RAF intervals include camera changes and screenshot capture. First ten intervals are omitted from the frame summary; resident coverage is checked after ten simulation seconds. Heap is the sampled main-thread JS heap, not total browser/GPU memory.',sourceHashes:currentHashes,hookHash,rows}
await writeFile('docs/reviews/generator/completion-summary.json',JSON.stringify(summary,null,2)+'\n')
const table=['| Theme | Seed | Flight s | FPS | p95 ms | >50 ms | >100 ms | Worst ms | Heap peak MB |','| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',...rows.map(r=>`| ${r.theme} | ${r.seed} | ${r.seconds.toFixed(1)} | ${r.fps.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.over50} | ${r.over100} | ${r.max.toFixed(1)} | ${r.heapPeakMB.toFixed(1)} |`)].join('\n')
await writeFile('docs/reviews/generator/completion-results.md','# Completion and streaming measurements\n\n'+summary.method+'\n\n'+table+'\n\nEvery flight accepts five gates, observes boost and five ordinary nitro refills, touches down inside the runway footprint and reaches the normal landed/complete result. No resident terrain coverage misses occur after ten seconds in the 200 m square around the aircraft. These are sampled course flights, not an all-seed or long-duration certification. Raw receipts retain LOD, stream pressure, controls, telemetry and source hashes.\n')
console.log(JSON.stringify({pass:true,flights:rows.length,rows:rows.map(({theme,seed,fps,p95,over50,over100})=>({theme,seed,fps,p95,over50,over100}))},null,2))
