import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const part = process.env.REVIEW_PART || 'expansion-completion'
const smoke = part !== 'expansion-completion'
const matrix = smoke
 ? [[part === 'coastal' ? 'coastal-island-run' : 'generated-volcanic-run', [42,73,808]]]
 : [['coastal-island-run',[1337,2026,9001]],['generated-volcanic-run',[1337,2026,9001]],['desert-run',[42]],['mountain-valley-run',[42]]]
const identities = {
 'coastal-island-run': ['generated-coastal',31,34], 'generated-volcanic-run':['generated-volcanic',32,35],
 'desert-run':['generated-desert',30,33], 'mountain-valley-run':['generated-valley',30,33],
}
const digest = value => createHash('sha256').update(value).digest('hex')
const sourceFiles = execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z','--','src'],{encoding:'utf8'}).split('\0').filter(Boolean)
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async f=>[f,digest(await readFile(f))])))
const hookHash = digest(await readFile('scripts/browser-generator.js'))
const rows=[]
for (const [theme,seeds] of matrix) for (const seed of seeds) {
 const receipt=`docs/reviews/generator/${part}/${theme}-${seed}/run.json`
 const r=JSON.parse(await readFile(receipt,'utf8')), f=r.final
 assert.equal(r.pass,true,receipt); assert.equal(r.smoke,smoke)
 assert.equal(f.course,theme); assert.equal(f.seed,seed); assert.deepEqual(r.errors,[])
 const [profile,landscape,route]=identities[theme]
 assert.equal(f.recordId,`seed:${seed}:${profile}:r32:l${landscape}:q${route}`)
 assert.equal(r.build.production,true); assert.equal(r.build.minified,true); assert.equal(r.build.hookSha256,hookHash)
 assert.deepEqual(Object.keys(r.build.sourceHashes).sort(),sourceFiles.sort())
 for(const [file,hash] of Object.entries(sourceHashes)) if(file!=='src/core/Version.ts') assert.equal(r.build.sourceHashes[file],hash,`${receipt}: source drift ${file}`)
 assert.equal(r.build.buildId,digest(JSON.stringify({sourceHashes:r.build.sourceHashes,hookSha256:hookHash})))
 assert.deepEqual(JSON.parse(await readFile(`docs/reviews/generator/hooks-build/hooks/${r.build.buildId}.json`,'utf8')),r.build)
 const expected=smoke?['gates-chase.jpg','gates-cockpit.jpg','final.jpg']:['gates-chase.jpg','gates-cockpit.jpg','approach-cockpit.jpg','final.jpg']
 for(const name of expected){ assert.ok(r.pictures.includes(name)); assert.ok((await readFile(receipt.replace('run.json',name))).length>10000) }
 if(smoke) assert.ok(f.next>=1)
 else {
  assert.equal(f.status,'landed'); assert.equal(f.phase,'complete'); assert.equal(f.next,5); assert.equal(f.resultsOpen,true)
  assert.equal(f.result.gatesCleared,5); assert.equal(f.result.gatesTotal,5); assert.ok(f.result.totalScore>0)
  assert.ok(['complete','bronze','silver','gold'].includes(f.result.medal)); assert.equal(f.gates.length,5); assert.ok(f.gates.every(g=>g.passed))
  assert.ok(f.contact && Math.abs(f.contact.localX)<9 && Math.abs(f.contact.localZ)<60)
  assert.ok(f.nitroTimeline.some(s=>s.boosting)); assert.equal(f.nitroRefills.length,5)
  assert.ok(f.nitroRefills.every(s=>Math.abs(s.after.fraction-Math.min(1,s.before.fraction+.25))<1e-9))
 }
 const samples=r.samples.filter(s=>s.seconds>10), m=r.metrics
 if(!smoke) assert.ok(samples.length>60)
 const coverageMisses=samples.filter(s=>!s.coverage).length
 assert.equal(coverageMisses,0,`${receipt}: resident coverage`)
 assert.ok(samples.every(s=>s.lod && Number.isFinite(s.lod.lod)))
 assert.ok(m.fps>0 && m.p95>=m.p50 && m.max>=m.p95)
 rows.push({theme,seed,seconds:f.seconds,score:f.result?.totalScore,medal:f.result?.medal,
  fps:m.fps,p50:m.p50,p95:m.p95,max:m.max,over50:m.over50,over100:m.over100,
  coverageMisses,lods:[...new Set(samples.map(s=>s.lod.lod))],
  loadedMax:Math.max(...samples.map(s=>s.stream.loaded)),pendingMax:Math.max(...samples.map(s=>s.stream.pending)),
  heapPeakMB:Math.max(...r.samples.map(s=>s.heapMB)),contact:f.contact,pictures:r.pictures,receipt})
}
const method='Sequential native-wall-time controls-only production browser flights, Balanced at 1280x720 and device scale 1, ordinary adaptive resolution and full rendering cadence. RAF intervals include camera switches and still capture; the first ten intervals are omitted. Coverage is sampled after ten simulation seconds. Heap is sampled main-thread JS heap, not total browser or GPU memory. No local test suite runs during capture.'
await writeFile(`docs/reviews/generator/${part}-summary.json`,JSON.stringify({pass:true,smoke,method,sourceHashes,hookHash,rows},null,2)+'\n')
if(!smoke){
 const table=['| Theme | Seed | Flight s | Medal | FPS | p95 ms | >50 ms | >100 ms | Worst ms | Heap peak MB |','| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |',...rows.map(r=>`| ${r.theme} | ${r.seed} | ${r.seconds.toFixed(1)} | ${r.medal} | ${r.fps.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.over50} | ${r.over100} | ${r.max.toFixed(1)} | ${r.heapPeakMB.toFixed(1)} |`)].join('\n')
 await writeFile('docs/reviews/generator/expansion-completion-results.md','# Four-theme completion verification, 10.977\n\n'+method+'\n\n'+table+'\n\nAll eight flights clear five gates, observe boost and five ordinary 25% gate refill calls, touch down inside the runway footprint and reach the existing landed/complete medal result. No sampled resident coverage misses occur after ten seconds in the 200 m square around the aircraft. Raw receipts retain stream pressure, LOD, controls, telemetry, contacts, refills, pictures and immutable source/pilot manifests. These sampled flights do not certify all seeds or long-duration memory behavior. Timing spikes are retained without attributing their cause or claiming a performance improvement.\n')
}
console.log(JSON.stringify({pass:true,smoke,flights:rows.length,rows:rows.map(({theme,seed,fps,p95,over50,over100,heapPeakMB})=>({theme,seed,fps,p95,over50,over100,heapPeakMB}))},null,2))
