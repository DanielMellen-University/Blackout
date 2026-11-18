// Recompute this bounded review without accepting partial flights as passes.
import assert from 'node:assert/strict'
import { readFile, writeFile, readdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { summarizeFlightFrames } from './lib/review-frame-metrics.mjs'
const root = process.argv[2] || 'docs/reviews/performance-11.043'
const read = async name => JSON.parse(await readFile(`${root}/${name}`, 'utf8'))
const median = values => { const a = values.toSorted((a,b)=>a-b), n=a.length; return n%2 ? a[(n-1)/2] : (a[n/2-1]+a[n/2])/2 }
const before=await read('cpu-before.json'), after=await read('cpu-after.json'), browser=await read('browser-cpu.json')
assert.deepEqual(before.identity,after.identity)
for(const r of [...before.runs,...after.runs,...browser.cases]) assert.equal(r.target,2801.531937224386)
const cpuRows=[]
for(const r of [before,after]) cpuRows.push({runtime:'Node',mode:r.mode,samples:r.runs.length,medianLargestSliceMs:median(r.runs.map(x=>x.maxSliceMs)),worstSliceMs:Math.max(...r.runs.map(x=>x.maxSliceMs)),medianTimedCpuMs:median(r.runs.map(x=>x.cpuMs))})
for(const mode of ['before','after']) {
 const rows=browser.cases.filter(x=>x.mode===mode)
 cpuRows.push({runtime:'browser',mode,samples:rows.length,medianLargestSliceMs:median(rows.map(x=>x.maxSliceMs)),worstSliceMs:Math.max(...rows.map(x=>x.maxSliceMs)),medianTimedCpuMs:median(rows.map(x=>x.cpuMs)),medianWallMs:median(rows.map(x=>x.wallMs)),longTasks:rows.reduce((s,x)=>s+x.longTasks.length,0)})
}
const missionRows=[]
for(const mode of ['before','after']) for(const [mission,seed] of [['waterway-tour',1337],['coastal-run',42]]) {
 const file=`generator-${mode}/${mission}-${seed}.json`, r=await read(file)
 assert.equal(r.capture,false);assert.equal(r.profile,false);assert.equal(r.smoke,false);assert.equal(r.pass,false)
 assert.deepEqual(r.errors,[]);assert.deepEqual(r.captureWindows,[]);assert.equal(r.final.camera,'chase')
 assert.equal(r.final.course,mission);assert.equal(r.final.seed,seed)
 for(let i=1;i<r.frameTimes.length;i++) assert.ok(Math.abs(r.frameTimes[i].start-r.frameTimes[i-1].end)<.001)
 const metrics=summarizeFlightFrames(r.frameTimes)
 for(const [k,v] of Object.entries(metrics)) assert.equal(r.metrics[k],v)
 missionRows.push({file,mode,mission,seed,complete:false,simulatedSeconds:r.final.seconds,wallSeconds:r.wallSeconds,...metrics,peakMainHeapMB:Math.max(r.metrics.heapMB,...r.samples.map(s=>s.heapMB)),passedGates:r.final.next,totalGates:r.final.total,phase:r.final.phase,status:r.final.status,coverageSamplesAfter10:r.samples.filter(s=>s.seconds>10).length,coverageMissSamples:r.samples.filter(s=>s.seconds>10&&!s.coverage).length})
}
const b19Rows=[]
for(const mode of ['before','after']) {
 const file=`b19-${mode}.json`,r=await read(file),m=r.metrics
 assert.deepEqual(r.errors,[]);assert.equal(r.final.seed,1337);assert.equal(r.final.status,'ok');assert.equal(r.final.onGround,false)
 assert.ok(r.runtime.renderer.includes('SwiftShader'));assert.ok(r.final.seconds<171.85)
 const buckets=Object.entries(m.histogram).map(([ms,count])=>({ms:Number(ms),count})).sort((a,b)=>a.ms-b.ms)
 assert.equal(buckets.reduce((s,x)=>s+x.count,0),m.frames)
 const p95Target=Math.ceil(m.frames*.95);let counted=0,p95Ms
 for(const b of buckets){counted+=b.count;if(counted>=p95Target){p95Ms=b.ms;break}}
 b19Rows.push({file,mode,complete:false,simulatedSeconds:r.final.seconds,wallSeconds:r.wallSeconds,frames:m.frames,p95Ms,maxHistogramMs:buckets.at(-1).ms,over100:m.hitches.length,terrainMaxMs:m.terrainMaxMs,survey:m.survey??null,renderer:r.runtime.renderer})
}
const old=await read('b19-before.json'),next=await read('b19-after.json')
for(const [file,sha] of Object.entries(old.sourceHashes)) if(file!=='src/core/Version.ts') assert.equal(next.sourceHashes[file],sha,file)
assert.equal(next.reviewSurveySha256,createHash('sha256').update(await readFile('scripts/lib/terrain-review-survey.ts')).digest('hex'))
async function checkSizes(dir) { for(const entry of await readdir(dir,{withFileTypes:true})) {const path=`${dir}/${entry.name}`;if(entry.isDirectory())await checkSizes(path);else assert.ok((await stat(path)).size<=1048576,`Oversize artifact: ${path}`)} }
await checkSizes(root)
await writeFile(`${root}/summary.json`,JSON.stringify({identityPass:true,allFlightsComplete:false,historicalNumbersReverified:false,cpuRows,missionRows,b19Rows},null,2)+'\n')
console.log('Identity and partial metrics verified; historical flight acceptance remains incomplete.')
