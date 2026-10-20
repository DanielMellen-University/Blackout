import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeFlightFrames, assertCaptureFreeTiming } from './lib/review-frame-metrics.mjs'
test('keeps the long flight interval and strict 50/100 ms boundaries',()=>{
 const frames=[...Array(10).fill(500),16,50,100,450]
 const m=summarizeFlightFrames(frames)
 assert.equal(m.frames,4);assert.equal(m.max,450);assert.equal(m.over50,2);assert.equal(m.over100,1)
 assert.equal(m.fps,4000/616)
})
test('rejects captures, profiler, smoke and camera changes as acceptance evidence',()=>{
 const r={capture:false,profile:false,smoke:false,pictures:[],captureWindows:[],final:{camera:'chase'},frameTimes:Array(20).fill({ms:16})}
 assert.equal(assertCaptureFreeTiming(r).max,16)
 for(const change of [{capture:true},{profile:true},{smoke:true},{pictures:['still.jpg']},{captureWindows:[{start:1,end:2}]},{final:{camera:'cockpit'}}])
  assert.throws(()=>assertCaptureFreeTiming({...r,...change}))
 assert.throws(()=>assertCaptureFreeTiming({...r,capture:undefined}))
})
