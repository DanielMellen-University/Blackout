import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const root='docs/reviews/generator'
const beforeDir=`${root}/stutter-profile/desert-run-42`
const before=JSON.parse(gunzipSync(await readFile(`${beforeDir}/hitch-trace.json.gz`))).traceEvents
const readback=before.filter(e=>e.name==='GLES2::ReadPixels'&&e.ph==='X').sort((a,b)=>b.dur-a.dur)[0]
assert.ok(readback?.dur>200000)
const main=before.filter(e=>e.pid===readback.pid&&e.tid===readback.tid&&e.ph==='X')
const beforeResult={readbackMs:readback.dur/1000,commitMs:Math.max(...main.filter(e=>e.name==='Commit').map(e=>e.dur))/1000,gpuWaitMs:Math.max(...main.filter(e=>e.name==='ImplementationBase::WaitForCmd').map(e=>e.dur))/1000}
const afterDir=`${root}/stutter-final-profile/desert-run-42`
const compressed=await readFile(`${afterDir}/trace.json.gz`)
const events=JSON.parse(gunzipSync(compressed)).traceEvents
const mark=events.find(e=>e.name==='review-flight-start')
assert.ok(mark,'Flight clock mark missing')
const r=JSON.parse(await readFile(`${afterDir}/run.json`,'utf8'))
assert.equal(r.profile,true);assert.equal(r.capture,false);assert.equal(r.timingEligible,false)
assert.equal(r.final.contextAttributes.desynchronized,true);assert.equal(r.final.contextAttributes.antialias,true);assert.equal(r.final.contextAttributes.alpha,false)
const duration=r.frameTimes.at(-1).end-r.frameTimes[0].start
const spans=events.filter(e=>e.pid===mark.pid&&e.tid===mark.tid&&e.ph==='X'&&e.ts>=mark.ts&&e.ts<=mark.ts+duration*1000)
const afterResult={profiledDiagnosticOnly:true,observedMaxMs:r.metrics.max,readbackCount:spans.filter(e=>e.name==='GLES2::ReadPixels').length,maxReadbackMs:Math.max(0,...spans.filter(e=>e.name==='GLES2::ReadPixels').map(e=>e.dur/1000)),maxMainTaskMs:Math.max(0,...spans.filter(e=>e.name==='RunTask').map(e=>e.dur/1000)),contextAttributes:r.final.contextAttributes,traceSha256:createHash('sha256').update(compressed).digest('hex')}
assert.ok(afterResult.maxReadbackMs<100)
await writeFile(`${root}/stutter-attribution.json`,JSON.stringify({before:beforeResult,after:afterResult,note:'Native compositor readback and nested GPU wait overlap. Profiling runs are excluded from flight acceptance. Raw capture-free acceptance uses separate unprofiled sessions.'},null,2)+'\n')
console.log({before:beforeResult,after:afterResult})
