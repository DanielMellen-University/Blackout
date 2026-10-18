// Offline generated-world survey. Do not run alongside measured browser flights.
import { createServer } from 'vite'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
const output=process.argv[2] || 'docs/reviews/roads-10.927/before.json'
const seeds=(process.env.COAST_SEEDS || '73,42,808,1337').split(',').map(Number)
const perSeed=Number(process.env.COAST_SITES || 2), rows=[], rejected=[]
const loader=await createServer({cacheDir:'/tmp/blackout-927-coast-survey',server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',plugins:[{name:'coast-rejections',enforce:'pre',transform(code,id){
 if(!['RegionalRoads.ts','RoadSurface.ts','RoadRouting.ts'].some(name=>id.endsWith('/'+name)))return
 const file=id.split('/').at(-1)
 return code.split('\n').map((line,i)=>line.replace(/return null\b/g,`return (globalThis as any).__coastReject(${JSON.stringify(file)},${i+1})`)).join('\n')
}}]})
globalThis.__coastReject=(file,line)=>{if(rejected.length<60)rejected.push({file,line});return null}
try{
 const {setWorldSeed}=await loader.ssrLoadModule('/src/world/noise.ts'),{clearOpsPad}=await loader.ssrLoadModule('/src/world/terrainSample.ts')
 const {settlementForCell}=await loader.ssrLoadModule('/src/world/SettlementPlan.ts'),{coastField}=await loader.ssrLoadModule('/src/world/Coastline.ts')
 const {buildableRegionalLinksForSettlement,roadBetweenSettlements}=await loader.ssrLoadModule('/src/world/RegionalRoads.ts')
 const {bridgeSupportPoints}=await loader.ssrLoadModule('/src/world/RoadSurface.ts')
 for(const seed of seeds){
  setWorldSeed(seed);clearOpsPad();const sites=[]
  if(process.env.COAST_FIXTURES){for(const f of JSON.parse(readFileSync(process.env.COAST_FIXTURES,'utf8')).sites.filter(f=>f.seed===seed)){const [x,z]=f.id.split(',').map(Number);const p=settlementForCell(x,z);if(p)sites.push(p)}}
  else for(let ring=0;ring<=18 && sites.length<perSeed;ring++)for(let x=-ring;x<=ring && sites.length<perSeed;x++)for(let z=-ring;z<=ring && sites.length<perSeed;z++){
   if(ring && Math.max(Math.abs(x),Math.abs(z))!==ring)continue
   const p=settlementForCell(x,z);if(p?.kind==='village' && p.y<25 && coastField(p.x,p.z)<.035)sites.push(p)
  }
  if(sites.length<perSeed)throw Error('Insufficient coastal villages for seed '+seed)
  for(const p of sites){
   const attempts=[]
   const links=buildableRegionalLinksForSettlement(p,settlementForCell,[],link=>{
    rejected.length=0;const started=performance.now(),road=roadBetweenSettlements(link.from,link.to,settlementForCell)
    const failures=[...rejected], ms=performance.now()-started
    let validation=null
    if(road){
     let wetSpan=0,maxWetSpan=0,drySpan=0,maxDrySpan=0,maxHeight=0,maxGrade=0
     for(let i=0;i<road.points.length;i++){
      const a=road.points[i],b=road.points[Math.max(0,i-1)],step=Math.hypot(a.x-b.x,a.z-b.z)
      wetSpan=a.bridge?wetSpan+step:0;maxWetSpan=Math.max(maxWetSpan,wetSpan)
      drySpan=!a.bridge && a.structure!=='ground'?drySpan+step:0;maxDrySpan=Math.max(maxDrySpan,drySpan)
      maxHeight=Math.max(maxHeight,a.y-Math.min(a.groundY??a.y,a.leftGroundY??a.y,a.rightGroundY??a.y))
      if(step)maxGrade=Math.max(maxGrade,Math.abs(a.y-b.y)/step)
     }
     const reverse=roadBetweenSettlements(link.to,link.from,settlementForCell)
     validation={points:road.points.length,supports:bridgeSupportPoints(road).length,maxWetSpan,maxDrySpan,maxHeight,maxGrade,canonical:JSON.stringify(road)===JSON.stringify(reverse),dryEnds:[road.points[0],road.points.at(-1)].every(v=>!v.bridge&&v.structure==='ground'),hash:createHash('sha256').update(JSON.stringify(road)).digest('hex')}
     if(!validation.canonical||!validation.dryEnds||validation.points>8192||validation.supports>192||maxHeight>96.000001||maxGrade>.240001||maxWetSpan>1824.000001||maxDrySpan>1224.000001)throw Error('Invalid accepted road '+link.key)
    }
    attempts.push({key:link.key,from:link.from.id,to:link.to.id,attachments:{from:link.from.roads[0].points[0],to:link.to.roads[0].points[0]},elevations:{from:link.from.y,to:link.to.y},accepted:!!road,ms,failures,validation});return road
   })
   rows.push({seed,id:p.id,x:p.x,y:p.y,z:p.z,coast:coastField(p.x,p.z),links:links.map(l=>l.key),attempts});console.log(seed,p.id,links.length?'connected':'cut off',attempts.map(a=>a.key+':'+a.accepted).join(' '))
  }
 }
 const sources=Object.fromEntries(['RegionalRoads','RoadRouting','RoadSurface','RoadClearance','SettlementPlan','terrainSample','noise'].map(n=>{const p=`src/world/${n}.ts`;return [p,createHash('sha256').update(readFileSync(p)).digest('hex')]}))
 writeFileSync(output,JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sources,seeds,sites:rows},null,2)+'\n')
}finally{delete globalThis.__coastReject;await loader.close()}
