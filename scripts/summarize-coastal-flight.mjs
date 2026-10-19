import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const dir=process.argv[2]||'docs/reviews/coastal-flight-10.936',rows=[],pairs=[],data={}
const routes=JSON.parse(await readFile(`${dir}/routes.json`,'utf8')).routes
for(const stage of ['before','after']){
 data[stage]=[]
 for(const route of routes){
  const r=JSON.parse(await readFile(`${dir}/${stage}/${route.seed}.json`,'utf8'))
  const hash=createHash('sha256').update(JSON.stringify(route)).digest('hex')
  if(r.routeHash!==hash||r.errors.length||r.seconds!==180||r.stills.at(-1).elapsed!==180||r.samples.length<50||r.stills.length!==7)throw Error('Incomplete flight '+stage+'/'+route.seed)
  if(r.samples.some(s=>s.seed!==route.seed||s.activeCamera!==s.camera||s.ratio!==1||Math.abs(s.field-.001)>.0001))throw Error('Incorrect flight path/camera')
  if(new Set(r.stills.map(s=>s.camera)).size!==2)throw Error('Missing camera')
  const row={stage,seed:route.seed,seconds:r.seconds,wallSeconds:r.wallSeconds,distanceM:r.stills.at(-1).distance,
   samples:r.samples.length,stills:r.stills.length,bankIntervals:r.samples.reduce((n,s)=>n+s.count,0),
   failureSamples:r.samples.filter(s=>s.failures).length,failedIntervals:r.samples.reduce((n,s)=>n+s.failures,0),
   sharedWetPoints:r.samples.reduce((n,s)=>n+s.shared,0),maxNormal:Math.max(...r.samples.map(s=>s.maxNormal)),maxColor:Math.max(...r.samples.map(s=>s.maxColor)),
   fallbackFailureSamples:r.samples.filter(s=>s.cases.some(c=>c.fading.some(Boolean)&&c.probes.some(p=>!p.covered))).length,
   maxPendingSeams:Math.max(...r.samples.map(s=>s.pendingSeams)),maxResidents:Math.max(...r.samples.map(s=>s.stats.loaded)),endResidents:r.samples.at(-1).stats.loaded,maxReady:Math.max(...r.samples.map(s=>s.stats.ready)),maxBlocked:Math.max(...r.samples.map(s=>s.blockedTiles??0))}
  rows.push(row);data[stage].push(r)
  for(const scan of r.samples)pairs.push({seed:route.seed,scan:{cases:scan.cases}})
 }
}
for(let i=0;i<routes.length;i++){
 const a=data.before[i],b=data.after[i]
 if(a.hookHash!==createHash('sha256').update(await readFile(`${dir}/baseline-hook.js`)).digest('hex')||b.hookHash!==createHash('sha256').update(await readFile('scripts/browser-coastal-flight.js')).digest('hex')||a.runtime.queueEdgeJoins===b.runtime.queueEdgeJoins||!b.runtime.queueEdgeJoins.includes('edgePending')||b.runtime.drainBuildQueue.indexOf('while (this.seamKeys.size')>b.runtime.drainBuildQueue.indexOf('while (this.ready.length'))throw Error('Wrong served source')
}
await writeFile(`${dir}/summary.json`,JSON.stringify(rows,null,2)+'\n')
await writeFile(`${dir}/resident-pairs.json`,JSON.stringify({results:pairs},null,2)+'\n')
console.log(rows)
