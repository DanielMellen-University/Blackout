// Generated profiles and independent terrain samples. No browser/performance measurement.
import { createServer } from 'vite'
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const loader = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
 const {setWorldSeed} = await loader.ssrLoadModule('/src/world/noise.ts')
 const {clearOpsPad} = await loader.ssrLoadModule('/src/world/terrainSample.ts')
 const {settlementForCell} = await loader.ssrLoadModule('/src/world/SettlementPlan.ts')
 const {buildableRegionalLinksForSettlement, roadBetweenSettlements} = await loader.ssrLoadModule('/src/world/RegionalRoads.ts')
 const {auditRoad, auditStreetEnds} = await loader.ssrLoadModule('/tests/helpers/roadIntegrity.ts')
 const corpus = JSON.parse(readFileSync('tests/fixtures/village-coverage.json', 'utf8')), rows = [], streets = []
 for (const seed of [42,73,808,1337]) {
  clearOpsPad(); setWorldSeed(seed); const seen = new Set()
  for (const site of corpus.sites.filter(s=>s.seed===seed)) {
   const [cx,cz]=site.id.split(',').map(Number), plan=settlementForCell(cx,cz)
   streets.push({seed,site:plan.id,...auditStreetEnds(plan)})
   plan.roads.forEach((road,index)=>rows.push({seed,site:plan.id,key:`local/${plan.id}/${index}`,kind:'local',...auditRoad(road)}))
   for(const link of buildableRegionalLinksForSettlement(plan)) {
    if(seen.has(link.key))continue;seen.add(link.key)
    const road=roadBetweenSettlements(link.from,link.to,settlementForCell)
    const plans=[link.from,link.to].map(p=>settlementForCell(...p.id.split(',').map(Number)))
    rows.push({seed,site:plan.id,key:link.key,kind:'regional',...auditRoad(road,plans)})
   }
  }
 }
 const sources=Object.fromEntries(['RegionalRoads','RoadRouting','RoadSurface','SettlementPlan','SettlementSystem','RoadTerrainFit'].map(n=>[n,createHash('sha256').update(readFileSync(`src/world/${n}.ts`)).digest('hex')]))
 const result={sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sources,seeds:[42,73,808,1337],streets,rows}
 writeFileSync(process.argv[2]||'docs/reviews/roads-10.940/before.json',JSON.stringify(result,null,2)+'\n')
 console.log(JSON.stringify({roads:rows.length,segments:rows.reduce((n,r)=>n+r.segments,0),failures:rows.filter(r=>r.failures.length).map(r=>({seed:r.seed,key:r.key,failures:r.failures.slice(0,10)}))},null,2))
}finally{await loader.close()}
