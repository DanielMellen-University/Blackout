// Compare shared wet vertices on exactly the same generated mixed-LOD pairs.
import {createServer} from 'vite'
import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const baseline=process.env.TERRAIN_GEOMETRY_BASELINE_SOURCE ? readFileSync(process.env.TERRAIN_GEOMETRY_BASELINE_SOURCE,'utf8'):null
const loader=await createServer({cacheDir:'/tmp/blackout-wet-attributes',server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',plugins:baseline?[{name:'baseline',enforce:'pre',transform(code,id){if(id.endsWith('/TerrainGeometry.ts'))return baseline}}]:[]})
const digest=d=>{const h=createHash('sha256');for(const a of [d.heights,d.waterLevels,d.ground.attributes.position.array,d.ground.index,...Object.values(d.water?.attributes??{}).map(a=>a.array),d.water?.index].filter(Boolean))h.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));return h.digest('hex')}
try{
 const {generateTerrainGeometry:generate}=await loader.ssrLoadModule('/src/world/TerrainGeometry.ts')
 const {setWorldSeed}=await loader.ssrLoadModule('/src/world/noise.ts')
 const {clearOpsPad,sampleClimate}=await loader.ssrLoadModule('/src/world/terrainSample.ts')
 const {waterLandmarks,riverReaches}=await loader.ssrLoadModule('/src/world/Hydrology.ts')
 const prior=JSON.parse(readFileSync(process.argv[2],'utf8')),pairs=new Map()
 for(const v of prior.results)for(const c of v.scan.cases)pairs.set(JSON.stringify([v.seed,c.jobs]),{seed:v.seed,jobs:c.jobs,kind:'coast'})
 // Explicit generated lake/river fixtures supplement the resident coast scan.
 for(const seed of [42,2026,9001,808]){
  setWorldSeed(seed);clearOpsPad()
  const regions=[]
  for(let ring=0;ring<=3;ring++)for(let x=-ring;x<=ring;x++)for(let z=-ring;z<=ring;z++)if(Math.max(Math.abs(x),Math.abs(z))===ring)regions.push([x,z])
  for(const kind of ['lake','river']){
   let p=null
   for(const [cx,cz] of regions){const r=kind==='river'?riverReaches(cx,cz)[0]:null;p=kind==='lake'?waterLandmarks(cx,cz).find(p=>!p.sea&&!p.pond):r?{x:(r.ax+r.bx)/2,z:(r.az+r.bz)/2}:null;if(p)break}
   if(!p)throw Error('Missing '+kind+' seed '+seed)
   const x=Math.floor(p.x/840)*840,z=Math.floor(p.z/840)*840
   for(const jobs of [[[x,z,1,2],[x+840,z,2,4]],[[x,z,1,2],[x,z+840,2,4]],[[x-840,z,2,2],[x,z,1,2]]])pairs.set(JSON.stringify([seed,jobs]),{seed,jobs,kind})
  }
 }
 const results=[]
 for(const {seed,jobs,kind} of pairs.values()){
  setWorldSeed(seed);clearOpsPad();const data=jobs.map(j=>generate(...j)),points=[]
  for(let iz=0;iz<=data[0].segs;iz++)for(let ix=0;ix<=data[0].segs;ix++){
   if(ix&&iz&&ix!==data[0].segs&&iz!==data[0].segs)continue
   const x=jobs[0][0]+ix*420*jobs[0][3]/data[0].segs,z=jobs[0][1]+iz*420*jobs[0][3]/data[0].segs
   const bx=(x-jobs[1][0])*data[1].segs/(420*jobs[1][3]),bz=(z-jobs[1][1])*data[1].segs/(420*jobs[1][3])
   if(bx<0||bz<0||bx>data[1].segs||bz>data[1].segs||Math.abs(bx-Math.round(bx))>1e-7||Math.abs(bz-Math.round(bz))>1e-7)continue
   const ids=[iz*(data[0].segs+1)+ix,Math.round(bz)*(data[1].segs+1)+Math.round(bx)]
   const climate=sampleClimate(x,z);if(climate.height>(climate.waterLevel??0)+2)continue
   const values=name=>data.map((d,j)=>Array.from(d.ground.attributes[name].array.subarray(ids[j]*3,ids[j]*3+3)))
   const colors=values('color'),normals=values('normal')
   points.push({x,z,biome:climate.biome,features:climate.features,colors,normals,colorDelta:Math.max(...colors[0].map((v,i)=>Math.abs(v-colors[1][i]))),normalDelta:Math.hypot(...normals[0].map((v,i)=>v-normals[1][i]))})
  }
  if(points.length)results.push({seed,jobs,kind,segs:data.map(d=>d.segs),physicalHashes:data.map(digest),points})
 }
 writeFileSync(process.argv[3],JSON.stringify({baseline:!!baseline,results},null,2)+'\n')
 console.log('pairs',results.length,'points',results.flatMap(r=>r.points).length,'max color',Math.max(...results.flatMap(r=>r.points.map(p=>p.colorDelta))),'max normal',Math.max(...results.flatMap(r=>r.points.map(p=>p.normalDelta))))
}finally{await loader.close()}
