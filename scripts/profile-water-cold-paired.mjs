// Alternate reference/candidate cold builds so host and JIT drift are visible in controls.
import { createServer } from 'vite'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { cpus, availableParallelism } from 'node:os'
const args=new URLSearchParams(process.argv.slice(2).map(s=>s.replace(/^--/,'')).join('&'))
const samples=Number(args.get('samples')||12), ref=args.get('baseline')||'c4cf05bc', output=args.get('output')
if(!output||!Number.isInteger(samples)||samples<3)throw Error('Use --output=file.json --baseline=ref --samples=12')
const contexts=[]
const summarize=values=>{const a=values.toSorted((a,b)=>a-b),n=a.length;return{median:n%2?a[n>>1]:(a[n/2-1]+a[n/2])/2,p95:a[Math.ceil(n*.95)-1],max:a.at(-1)}}
const owned=['TerrainGeometry','TerrainWaterBed','WaterSystem','Coastline','terrainSample']
try {
  for(const baseline of [true,false]){
    const frozen=new Map(baseline?owned.map(n=>[`/src/world/${n}.ts`,execFileSync('git',['show',`${ref}:src/world/${n}.ts`],{encoding:'utf8'})]):[])
    const loader=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',plugins:[{name:'paired-cold-reference',enforce:'pre',transform(code,id){for(const [suffix,source]of frozen)if(id.endsWith(suffix))return source}}]})
    contexts.push({loader,baseline,results:[]})
    const c=contexts.at(-1)
    c.noise=await loader.ssrLoadModule('/src/world/noise.ts')
    c.profile=await loader.ssrLoadModule('/src/world/TerrainProfile.ts')
    c.terrain=await loader.ssrLoadModule('/src/world/terrainSample.ts')
    c.hydro=await loader.ssrLoadModule('/src/world/Hydrology.ts')
    c.geometry=await loader.ssrLoadModule('/src/world/TerrainGeometry.ts')
  }
  for(const seed of [1,73,1337])for(const kind of ['hydrology','near','far']){
    const [x,z]=seed===1337?[63840,34860]:seed===73?[-8400,-20580]:[-33600,-18480]
    const groups=contexts.map(c=>({context:c,seed,kind,x,z,runs:[]}))
    for(let run=0;run<samples;run++)for(const g of run%2?groups.toReversed():groups){
      const {context:c}=g
      c.terrain.clearOpsPad();c.profile.setTerrainProfile(null);c.noise.setWorldSeed(seed+100000)
      const invalid=c.hydro.prepareHydrologyInBoundsSteps(x,z,x,z);invalid.next();invalid.return();c.noise.setWorldSeed(seed)
      const steps=kind==='hydrology'?c.hydro.prepareHydrologyInBoundsSteps(x,z,x,z):c.geometry.generateTerrainGeometrySteps(x,z,kind==='near'?0:2,kind==='near'?1:8)
      const phases={},slices=[],cpuStart=process.cpuUsage(),start=performance.now()
      let value
      while(true){const at=performance.now(),r=steps.next(),ms=performance.now()-at,p=phases[r.done?'finalize':r.value]??={totalMs:0,maxMs:0,count:0};p.totalMs+=ms;p.maxMs=Math.max(p.maxMs,ms);p.count++;slices.push(ms);if(r.done){value=r.value;break}}
      const wallMs=performance.now()-start,cpu=process.cpuUsage(cpuStart),h=createHash('sha256')
      if(kind==='hydrology')h.update(JSON.stringify({basins:c.hydro.waterLandmarks(Math.floor(x/32000),Math.floor(z/32000)),reaches:c.hydro.riverReaches(Math.floor(x/32000),Math.floor(z/32000))}))
      else for(const a of [value.heights,value.waterLevels,...[value.ground,value.water].flatMap(g=>g?[...Object.values(g.attributes).map(a=>a.array),g.index].filter(Boolean):[])])h.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength))
      g.runs.push({run,order:run%2?(c.baseline?1:0):(c.baseline?0:1),wallMs,workMs:slices.reduce((a,b)=>a+b,0),processCpuMs:(cpu.user+cpu.system)/1000,maxSliceMs:Math.max(...slices),slices:slices.length,phases,sha256:h.digest('hex')})
    }
    for(const {context,...g}of groups){
      g.workMs=summarize(g.runs.map(r=>r.workMs));g.processCpuMs=summarize(g.runs.map(r=>r.processCpuMs));g.largestSliceMs=summarize(g.runs.map(r=>r.maxSliceMs))
      g.phases=[...new Set(g.runs.flatMap(r=>Object.keys(r.phases)))].map(phase=>({phase,totalMs:summarize(g.runs.map(r=>r.phases[phase]?.totalMs||0)),largestSliceMs:summarize(g.runs.map(r=>r.phases[phase]?.maxMs||0))}))
      context.results.push(g);console.log(context.baseline?'before':'after',seed,kind,g.workMs,g.largestSliceMs)
    }
  }
  await writeFile(output,JSON.stringify({node:process.version,cpu:cpus()[0].model,availableParallelism:availableParallelism(),samples,baselineRef:ref,candidateDiff:execFileSync('git',['diff','--','src/world/WaterSystem.ts'],{encoding:'utf8'}),
    method:'Two isolated module loaders in one Node process. For each seed/case, 12 reference/candidate cold pairs, alternating AB and BA. Queried alternate seed clears drainage/hydrology caches before each build. JIT retained, first pair included. Work is summed iterator next() wall time; process CPU includes overhead and VM helpers. Median averages middle values, p95 nearest rank. No browser or tests launched during the study; normal host applications remain active. Unmodified one-catchment hydrology is the drift control.',
    before:contexts[0].results,after:contexts[1].results},null,2)+'\n')
}finally{for(const c of contexts)await c.loader.close()}
