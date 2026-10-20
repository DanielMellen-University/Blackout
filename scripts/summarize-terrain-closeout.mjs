import assert from 'node:assert/strict'
import {readFile,writeFile,access} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const dir=process.argv[2]||'docs/reviews/terrain-closeout-b19',complete=process.argv.includes('--final')
let selection={seeds:[42,73,1337],reason:'Original endurance selection'}
try{selection=JSON.parse(await readFile(`${dir}/endurance-selection.json`,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
assert.ok(Array.isArray(selection.seeds)&&selection.seeds.length===3&&new Set(selection.seeds).size===3,'Exactly three distinct endurance seeds required')
assert.ok(selection.seeds.includes(42)&&selection.seeds.includes(73),'Retain the two accepted endurance seeds')
assert.ok(selection.seeds.every(seed=>[42,73,1337,2026,9001,1].includes(seed)),'Unauthorized endurance seed')
const fallback=selection.seeds.find(seed=>![42,73,1337].includes(seed))
if(fallback){assert.ok(selection.reason?.trim(),'Fallback attribution required');await access(`${dir}/hitch-1337.md`)}
const stages={audit:[42,2026,9001,1,73,1337],final:[42,2026,9001,1,73,1337],lod:[42,2026,9001,1,73,1337],endurance:selection.seeds}
const rows=[];let baseline
const currentFiles=execFileSync('rg',['--files','src'],{encoding:'utf8'}).trim().split('\n').sort()
const currentHashes=Object.fromEntries(await Promise.all(currentFiles.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])))
for(const [stage,seeds] of Object.entries(stages))for(const seed of seeds){
 const path=`${dir}/${stage}/${seed}.json`
 try{await access(path)}catch{assert.ok(!complete&&stage!=='audit',`Missing ${path}`);continue}
 const r=JSON.parse(await readFile(path,'utf8')),required=stage==='endurance'?650:stage==='lod'?25:45
 assert.ok(r.final.seconds>=required&&r.wallSeconds>=required,`Duration ${stage}/${seed}`)
 assert.equal(r.diagnosticOnly??false,false,'Diagnostic flight cannot be accepted')
 assert.equal(r.route.seed,seed)
 assert.equal(r.final.status,'ok');assert.equal(r.final.onGround,false);assert.deepEqual(r.errors,[])
 assert.ok(r.samples.every(s=>s.seed===seed&&s.course==='free-flight'&&!s.paused&&s.playing&&s.ratio===1&&s.status==='ok'&&!s.onGround))
 assert.equal(new Set(r.pictures.map(p=>p.state.camera)).size,2)
 assert.equal(r.pictures.length,stage==='endurance'?22:stage==='lod'?4:6)
 for(const picture of r.pictures)await access(`${dir}/${stage}/${picture.file}`)
 assert.deepEqual(Object.keys(r.sourceHashes).sort(),currentFiles,'Source file set changed')
 for(const file of currentFiles)if(file!=='src/core/Version.ts')assert.equal(r.sourceHashes[file],currentHashes[file],`Source differs from frozen runtime: ${file}`)
 assert.equal(createHash('sha256').update(await readFile(`${dir}/hooks/${r.hookSha256}.js`)).digest('hex'),r.hookSha256)
 baseline??=r.sourceHashes
 for(const [file,hash] of Object.entries(baseline))if(file!=='src/core/Version.ts')assert.equal(r.sourceHashes[file],hash,`Runtime changed: ${file}`)
 if(stage!=='audit'){
  assert.ok(!r.metrics.coverageMisses.some(m=>m.seconds>=5),`Missing terrain after reset warmup ${stage}/${seed}`)
  assert.ok(r.pictures.every(p=>p.state.meshCoverage),`Uncovered picture ${stage}/${seed}`)
 }
 if(stage==='endurance'){
  assert.deepEqual(r.metrics.hitches,[],`Unexplained frame gap ${stage}/${seed}`)
  assert.ok(!r.metrics.terrainSlow.some(s=>s.ms>50),`Slow terrain update ${stage}/${seed}`)
  if([42,73,1337].includes(seed)){
   const pinned=JSON.parse(await readFile(`docs/reviews/stability-10.941/${seed}.json`,'utf8')).samples[0]
   assert.equal(r.route.x,pinned.start[0]);assert.equal(r.route.z,pinned.start[2]);assert.equal(r.route.yaw,pinned.heading)
  }else{
   const pinned=JSON.parse(await readFile('docs/reviews/terrain-closeout-b19/routes.json','utf8')).routes.find(route=>route.seed===seed)
   for(const key of ['x','z','yaw'])assert.equal(r.route[key],pinned[key],`Fallback route changed: ${key}`)
  }
  assert.equal(r.route.seconds,650)
  assert.equal(r.route.clearance,650);assert.equal(r.route.long,true)
 }
 if(stage==='lod')await access(`${dir}/${stage}/${seed}-flight.webm`)
 let horizontalM=0
 for(let i=1;i<r.samples.length;i++)horizontalM+=Math.hypot(r.samples[i].position[0]-r.samples[i-1].position[0],r.samples[i].position[2]-r.samples[i-1].position[2])
 const histogram=Object.entries(r.metrics.histogram).map(([ms,n])=>[Number(ms),n]).sort((a,b)=>a[0]-b[0]),count=histogram.reduce((n,[,v])=>n+v,0)
 let p95Ms=0,cumulative=0
 for(const [ms,n] of histogram){cumulative+=n;if(cumulative>=count*.95){p95Ms=ms;break}}
 rows.push({stage,seed,seconds:r.final.seconds,wallSeconds:r.wallSeconds,horizontalKm:horizontalM/1000,stills:r.pictures.length,minAgl:Math.min(...r.samples.map(s=>s.agl)),maxAgl:Math.max(...r.samples.map(s=>s.agl)),errors:r.errors.length,frames:count,meanFps:count*1000/histogram.reduce((sum,[ms,n])=>sum+ms*n,0),p95Ms,maxFrameMs:histogram.at(-1)?.[0]??0,over100:r.metrics.hitches.length,terrainMaxMs:r.metrics.terrainMaxMs,terrainOver50:r.metrics.terrainSlow.filter(s=>s.ms>50).length,coverageMissing:r.metrics.coverageMissing,coverageMisses:r.metrics.coverageMisses??null,peakMainHeapMB:Math.max(...r.samples.map(s=>s.heapBytes))/1e6,weather:[...new Set(r.samples.map(s=>s.weather.id))],sourceCommit:r.sourceCommit})
}
const runtimeChanges=execFileSync('git',['diff','897807f','--name-only','--','src'],{encoding:'utf8'}).trim().split('\n').filter(p=>p&&p!=='src/core/Version.ts')
assert.deepEqual(runtimeChanges,[],'Physics and production runtime must remain unchanged for this evidence-only batch')
await writeFile(`${dir}/summary.json`,JSON.stringify({base:'897807f',completeEvidence:complete,enduranceSelection:selection,knownOpenPerformanceIssues:fallback?['Seed-1337 review pilot cold hydrology look-ahead stall; no clean full seed-1337 flight. Historical 3.7-second event remains unattributed. See hitch-1337.md.']:[],productionChangesExcludingReleaseMetadata:runtimeChanges,note:'The visual/temporal review is recorded in markdown. This summary validates flight records and frozen runtime, not image appearance. RAF excludes screenshot windows; terrain update timing includes them. Heap is observed, not optimized.',rows},null,2)+'\n')
console.table(rows.map(({stage,seed,seconds,minAgl,maxAgl,over100,terrainMaxMs,peakMainHeapMB})=>({stage,seed,seconds,minAgl,maxAgl,over100,terrainMaxMs,peakMainHeapMB})))
