// Bounded two-case proof using the existing native frame metrics and pilot.
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {assertCaptureFreeTiming} from './lib/review-frame-metrics.mjs'
const root='docs/reviews/generator',part=process.argv[2]||'frame-spikes-after-a'
const rows=[]
const cases=['frame-spikes-before',part].flatMap(cohort=>[['waterway-tour',1337],['coastal-run',42]].map(([mission,seed])=>({cohort,mission,seed})))
if(part==='frame-spikes-proof-b')cases.push({cohort:'frame-spikes-proof-b-repeat',mission:'coastal-run',seed:42})
for(const {cohort,mission,seed}of cases){
 const path=`${root}/${cohort}/${mission}-${seed}/run.json`,r=JSON.parse(await readFile(path)),f=r.final
 assert.equal(r.pass,true);assert.deepEqual(r.errors,[]);assert.equal(f.seed,seed);assert.equal(f.course,mission)
 assert.equal(f.status,'landed');assert.equal(f.phase,'complete');assert.equal(f.next,5);assert.equal(f.resultsOpen,true);assert.equal(f.result.medal,'gold')
 assert.equal(f.nitroRefills.length,5);assert.ok(f.nitroRefills.every(s=>Math.abs(s.after.fraction-Math.min(1,s.before.fraction+.25))<1e-9))
 assert.ok(Math.abs(f.contact.localX)<9&&Math.abs(f.contact.localZ)<60)
 assert.equal(r.samples.filter(s=>s.seconds>10&&!s.coverage).length,0)
 assert.equal(r.build.hookSha256,createHash('sha256').update(await readFile('scripts/browser-generator.js')).digest('hex'))
 const metrics=assertCaptureFreeTiming(r)
 for(const [key,value]of Object.entries(metrics))assert.equal(r.metrics[key],value)
 for(let i=1;i<r.frameTimes.length;i++)assert.ok(Math.abs(r.frameTimes[i].start-r.frameTimes[i-1].end)<.001)
 for(const [file,hash]of Object.entries(r.build.sourceHashes)){
  const bytes=cohort==='frame-spikes-before'&&['src/core/Version.ts','src/world/TerrainSeams.ts','src/world/TerrainSystem.ts'].includes(file)?execFileSync('git',['show',`17d8025d:${file}`]):await readFile(file)
  assert.equal(hash,createHash('sha256').update(bytes).digest('hex'),`${path}: ${file}`)
 }
 const peak=Math.max(...r.samples.map(s=>s.heapMB),r.metrics.heapMB);assert.ok(peak<200)
 rows.push({cohort,mission,seed,seconds:f.seconds,medal:f.result.medal,...metrics,heapPeakMB:peak,buildId:r.build.buildId})
}
await writeFile(`${root}/frame-spikes-verification/${part}-audit.json`,JSON.stringify({pass:true,rows},null,2)+'\n')
for(const r of rows)console.log(`| ${r.mission} | ${r.seed} | ${r.cohort==='frame-spikes-before'?'Before':r.cohort.endsWith('-repeat')?'Proof B repeat':part==='frame-spikes-proof-b'?'Proof B':'After A'} | ${r.fps.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.over50} | ${r.over100} | ${r.max.toFixed(1)} | ${r.heapPeakMB.toFixed(1)} |`)
