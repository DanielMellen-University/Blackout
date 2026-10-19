// Select explicit supported crossings from the already-audited generated corpus.
import {createServer} from 'vite'
import {readFileSync,writeFileSync} from 'node:fs'
const loader=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
try{
 const {setWorldSeed}=await loader.ssrLoadModule('/src/world/noise.ts')
 const {clearOpsPad}=await loader.ssrLoadModule('/src/world/terrainSample.ts')
 const {settlementForCell}=await loader.ssrLoadModule('/src/world/SettlementPlan.ts')
 const {buildableRegionalLinksForSettlement,roadBetweenSettlements}=await loader.ssrLoadModule('/src/world/RegionalRoads.ts')
 const {auditRoad}=await loader.ssrLoadModule('/tests/helpers/roadIntegrity.ts')
 const coverage=JSON.parse(readFileSync('tests/fixtures/village-coverage.json','utf8')),rows=[]
 for(const seed of [42,73,808,1337]){
  setWorldSeed(seed);clearOpsPad();let best=null;const seen=new Set()
  for(const site of coverage.sites.filter(s=>s.seed===seed)){
   const [x,z]=site.id.split(',').map(Number),plan=settlementForCell(x,z)
   for(const link of buildableRegionalLinksForSettlement(plan)){
    if(seen.has(link.key))continue;seen.add(link.key)
    const road=roadBetweenSettlements(link.from,link.to,settlementForCell),audit=auditRoad(road)
    for(let i=0;i<road.points.length;i++){
     const p=road.points[i];if(!p.bridge&&p.structure!=='viaduct')continue
     const start=i,wet=!!p.bridge
     while(i+1<road.points.length&&(wet?road.points[i+1].bridge:!road.points[i+1].bridge&&road.points[i+1].structure==='viaduct'))i++
     const index=Math.floor((start+i)/2),span=Math.hypot(road.points[i].x-p.x,road.points[i].z-p.z),score=(wet?100000:0)+span
     if(!best||score>best.worst.score)best={seed,site:site.id,key:link.key,kind:'regional',...audit,structure:wet?'bridge':'viaduct',span,range:[start,i],worst:{index,score,x:road.points[index].x,z:road.points[index].z}}
    }
   }
  }
  if(!best||best.failures.length)throw Error('No audited supported crossing '+seed)
  rows.push(best);console.log(seed,best.key,best.structure,best.span.toFixed(1))
 }
 writeFileSync('docs/reviews/infrastructure-10.942/bridges.json',JSON.stringify({seeds:[42,73,808,1337],rows},null,2)+'\n')
}finally{await loader.close()}
