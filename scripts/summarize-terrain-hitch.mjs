import {readFile,writeFile} from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import assert from 'node:assert/strict'
const directory=process.argv[2]||'docs/reviews/terrain-closeout-b19/diagnostics/profile/endurance'
const diagnostic=JSON.parse(await readFile(`${directory}/1337.diagnostic.json`,'utf8'))
const profile=JSON.parse(gunzipSync(await readFile(`${directory}/1337.cpuprofile.gz`)))
const nodes=new Map(profile.nodes.map(node=>[node.id,node]))
const parents=new Map(profile.nodes.flatMap(node=>(node.children||[]).map(child=>[child,node.id])))
const stacks=new Map()
for(let index=0;index<profile.samples.length;index++){
 let id=profile.samples[index],stack=[]
 while(nodes.has(id)){stack.push(nodes.get(id).callFrame.functionName||'(anonymous)');id=parents.get(id)}
 if(!stack.includes('before'))continue
 const key=stack.reverse().join(' > ')
 stacks.set(key,(stacks.get(key)||0)+profile.timeDeltas[index]/1000)
}
const calls=diagnostic.calls.filter(call=>call.seconds>=171.7&&call.seconds<=172.1).sort((a,b)=>b.ms-a.ms)
assert.equal(calls[0].label,'review');assert.equal(calls[0].key,'before');assert.ok(calls[0].ms>50)
assert.ok([...stacks.keys()].some(stack=>stack.includes('before > sampleGeographySurfaceInto > sampleHydrologyInto > catchment > buildCatchmentSteps > regionalDrainageSteps')))
const frames=diagnostic.frames.flatMap((frame,index)=>index?[{seconds:frame.seconds,gapMs:frame.raf-diagnostic.frames[index-1].raf,observedGapMs:frame.observed-diagnostic.frames[index-1].observed}]:[])
const result={note:'Diagnostic only. CPU sampling and trace startup perturb timing. Attribution uses the separate recurring review-hook task, not the profiler startup gap.',calls,frames:frames.filter(frame=>frame.seconds>=171.7&&frame.seconds<=172.1),longTasks:diagnostic.longTasks,reviewCpuStacks:[...stacks].map(([stack,ms])=>({stack,ms})).sort((a,b)=>b.ms-a.ms)}
await writeFile(`${directory}/attribution.json`,JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({slowestCall:calls[0],longTasks:diagnostic.longTasks,reviewCpuMs:[...stacks.values()].reduce((a,b)=>a+b,0)},null,2))
