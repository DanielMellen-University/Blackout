// Compare full rendered seam bytes against a frozen revision on the measured tile pairs.
import { createServer } from 'vite'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const ref = process.argv[2] || 'd0b4a6c'
const output = process.argv[3] || 'docs/reviews/performance-10.926/seam-buffers.json'
const baseline = execFileSync('git',['show',`${ref}:src/world/TerrainSeams.ts`],{encoding:'utf8'})
const fixtures = JSON.parse(readFileSync('docs/reviews/terrain-10.924/after-edges.json','utf8')).fixtures
const hash = geometry => {
 const h = createHash('sha256')
 for (const [name,a] of Object.entries(geometry.attributes)) { h.update(name); h.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength)) }
 const a = geometry.index.array;h.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));return h.digest('hex')
}
const stages=[]
for (const frozen of [true,false]) {
 const loader=await createServer({cacheDir:`/tmp/blackout-926-seam-${frozen}`,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',plugins:frozen?[{name:'frozen-seams',enforce:'pre',transform(code,id){if(id.endsWith('/TerrainSeams.ts'))return baseline}}]:[]})
 try {
  const {generateTerrainGeometry,deserializeTerrainGeometry}=await loader.ssrLoadModule('/src/world/TerrainGeometry.ts')
  const {joinTerrainEdges,terrainEdgeJoin}=await loader.ssrLoadModule('/src/world/TerrainSeams.ts')
  const {setWorldSeed}=await loader.ssrLoadModule('/src/world/noise.ts'),{clearOpsPad}=await loader.ssrLoadModule('/src/world/terrainSample.ts')
  const rows=[]
  for(const f of fixtures){
   setWorldSeed(f.seed);clearOpsPad()
   const tiles=f.jobs.map(job=>{const d=generateTerrainGeometry(...job,[true,true,true,true]);return {originX:job[0],originZ:job[1],size:job[3],segs:d.segs,heights:d.heights,waterLevels:d.waterLevels,geometry:deserializeTerrainGeometry(d.ground)}}).sort((a,b)=>420*b.size/b.segs-420*a.size/a.segs)
   const [a,b]=tiles,base=a.geometry.getAttribute('position').count,join=terrainEdgeJoin(a,b)
   const first=joinTerrainEdges(a,base,[join]),saved=hash(first)
   const second=joinTerrainEdges({...a,geometry:first},base,[join])
   const removed=joinTerrainEdges({...a,geometry:second},base,[])
   if(saved!==hash(first)||saved!==hash(second))throw Error('Published geometry changed across repeat')
   rows.push({seed:f.seed,jobs:f.jobs,hash:saved,restoredHash:hash(removed),vertices:first.getAttribute('position').count,indices:first.index.count})
   for(const g of [...tiles.map(t=>t.geometry),first,second,removed])g.dispose()
  }
  stages.push(rows)
 }finally{await loader.close()}
}
if(JSON.stringify(stages[0])!==JSON.stringify(stages[1]))throw Error('Seam buffers differ from baseline')
writeFileSync(output,JSON.stringify({baselineRef:ref,pairs:stages[0].length,exact:true,fixtures:stages[1]},null,2)+'\n')
console.log('Exact full attribute/index and restored-skirt hashes on',stages[0].length,'tile pairs')
