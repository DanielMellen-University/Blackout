import {readFileSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const dir=process.argv[2]||'docs/reviews/wet-edges-10.932'
const read=name=>JSON.parse(readFileSync(`${dir}/${name}.json`,'utf8'))
const a=read('attributes-after'),b=read('attributes-before'),coverage=read('coverage'),oldCoverage=read('coverage-before')
assert.equal(a.results.length,b.results.length)
for(let i=0;i<a.results.length;i++){
 const x=a.results[i],y=b.results[i]
 assert.equal(x.seed,y.seed);assert.deepEqual(x.jobs,y.jobs);assert.deepEqual(x.physicalHashes,y.physicalHashes)
 assert.deepEqual(x.points.map(p=>[p.x,p.z]),y.points.map(p=>[p.x,p.z]))
 for(const p of x.points){assert.ok(p.normalDelta<1e-7);assert.ok(p.colorDelta<1e-7)}
}
assert.deepEqual(coverage.results,oldCoverage.results)
assert.ok(coverage.results.every(r=>r.probes.every(p=>p.covered)))
const before=read('before'),after=read('after')
assert.deepEqual(before.errors,[]);assert.deepEqual(after.errors,[])
assert.equal(before.results.length,8);assert.equal(after.results.length,8)
for(let i=0;i<8;i++){
 const x=before.results[i],y=after.results[i]
 assert.equal(x.seed,y.seed);assert.equal(x.mode,y.mode);assert.deepEqual(x.pose,y.pose)
 assert.equal(y.scan.camera,y.mode)
 // LOD contact settling may move a pose vertically. Do not hide it.
 assert.equal(x.scan.position[0],y.scan.position[0]);assert.equal(x.scan.position[2],y.scan.position[2])
}
const seeds=[42,2026,9001,808].map(seed=>{
 const br=b.results.filter(r=>r.seed===seed),ar=a.results.filter(r=>r.seed===seed)
 const max=(rs,key)=>Math.max(...rs.flatMap(r=>r.points.map(p=>p[key])))
 return {seed,pairs:br.length,sharedWetPoints:br.reduce((n,r)=>n+r.points.length,0),maxNormalBefore:max(br,'normalDelta'),maxNormalAfter:max(ar,'normalDelta'),maxColorBefore:max(br,'colorDelta'),maxColorAfter:max(ar,'colorDelta')}
})
const result={seeds,pairs:a.results.length,physicalHashesMatch:true,coveredGaps:coverage.results.length,coveredProbes:coverage.results.reduce((n,r)=>n+r.probes.length,0),maximumExposedGapM:Math.max(...coverage.results.map(r=>r.exposed)),visualPairs:8,verticalPoseDeltas:before.results.map((v,i)=>({seed:v.seed,mode:v.mode,deltaM:after.results[i].scan.position[1]-v.scan.position[1]})),scope:'Shared wet vertices and sampled exposed gap coverage only; unchanged water meshes and physical payloads. No universal coast or water-surface stitching claim.'}
writeFileSync(`${dir}/summary.json`,JSON.stringify(result,null,2)+'\n');console.log(result)
