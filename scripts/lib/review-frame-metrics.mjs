// Keep native RAF observations intact. Never trim slow frames by duration.
export function summarizeFlightFrames(frames, omit = 10) {
 const values = frames.slice(omit).map(f => typeof f === 'number' ? f : f.ms).sort((a,b)=>a-b)
 if (!values.length || values.some(v=>!Number.isFinite(v)||v<=0)) throw Error('Invalid RAF observations')
 const sum=values.reduce((a,b)=>a+b,0)
 return {frames:values.length,fps:values.length*1000/sum,p50:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],max:values.at(-1),over50:values.filter(v=>v>50).length,over100:values.filter(v=>v>100).length}
}
export function assertCaptureFreeTiming(run) {
 if(run.capture!==false || run.profile!==false || run.smoke || run.pictures.length || (run.captureWindows||[]).length)
  throw Error('Timing acceptance requires a complete capture-free, unprofiled flight')
 if(run.final.camera!=='chase')throw Error('Timing acceptance requires the fixed chase camera')
 return summarizeFlightFrames(run.frameTimes)
}
