// Actual resident edge fixtures, with physical mismatch and render-only coverage separated.
import { createServer } from 'vite'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const baseline = process.env.TERRAIN_GEOMETRY_BASELINE_SOURCE ? readFileSync(process.env.TERRAIN_GEOMETRY_BASELINE_SOURCE, 'utf8') : null
const loader = await createServer({ cacheDir: '/tmp/blackout-geometry-review-cache', server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom',
  plugins: baseline ? [{ name: 'frozen-terrain', enforce: 'pre', transform(code, id) { if (id.endsWith('/TerrainGeometry.ts')) return baseline } }] : [] })
const hash = arrays => { const h = createHash('sha256'); for (const a of arrays.filter(Boolean)) h.update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); return h.digest('hex') }
try {
  const { generateTerrainGeometry, deserializeTerrainGeometry } = await loader.ssrLoadModule('/src/world/TerrainGeometry.ts')
  const { joinTerrainEdges, terrainEdgeJoin } = await loader.ssrLoadModule('/src/world/TerrainSeams.ts')
  const { setWorldSeed } = await loader.ssrLoadModule('/src/world/noise.ts')
  const { clearOpsPad } = await loader.ssrLoadModule('/src/world/terrainSample.ts')
  const review = JSON.parse(readFileSync(process.argv[2], 'utf8')), fixtures = []
  const historical = JSON.parse(readFileSync('docs/reviews/terrain-10.923/before.json', 'utf8'))
  for (const view of review.results.filter(r => r.kind === 'seam' && r.mode === 'cockpit')) {
    setWorldSeed(view.seed); clearOpsPad()
    const unique = new Map()
    const old = historical.results.find(r => r.seed === view.seed && r.kind === 'seam' && r.mode === 'cockpit')
    for (const w of [...(old?.seams.worst ?? []), ...view.seams.worst, ...(view.seams.worstHeight ?? []), ...(view.seams.worstNormal ?? [])]) unique.set(JSON.stringify(w.jobs), w)
    for (const { jobs } of unique.values()) {
      const data = jobs.map(j => generateTerrainGeometry(...j, [true, true, true, true]))
      const tiles = data.map((d, i) => ({ originX: jobs[i][0], originZ: jobs[i][1], size: jobs[i][3], segs: d.segs,
        heights: d.heights, waterLevels: d.waterLevels, geometry: deserializeTerrainGeometry(d.ground) }))
      tiles.sort((a,b)=>420*b.size/b.segs-420*a.size/a.segs)
      const [a,b] = tiles, join = terrainEdgeJoin(a,b)
      if (!join) continue // Corner-only shared points do not form a seam.
      const sample = (tile,t) => {
        const vertical=join.edge%2===1, step=420*tile.size/tile.segs
        const q=(t-(vertical?tile.originZ:tile.originX))/step, lo=Math.min(tile.segs-1,Math.max(0,Math.floor(q))), f=q-lo
        const x=vertical?(join.edge===1?a.originX+420*a.size:a.originX):t
        const z=vertical?t:(join.edge===2?a.originZ+420*a.size:a.originZ)
        const idx=k=>vertical?k*(tile.segs+1)+Math.round((x-tile.originX)/step):Math.round((z-tile.originZ)/step)*(tile.segs+1)+k
        const i=idx(lo), j=idx(lo+1), mix=(v,w)=>v+(w-v)*f
        const n=tile.geometry.getAttribute('normal')
        return {height:mix(tile.heights[i],tile.heights[j]),level:mix(tile.waterLevels[i],tile.waterLevels[j]),normal:[0,1,2].map(c=>mix(n.getComponent(i,c),n.getComponent(j,c))),shared:Math.abs(q-Math.round(q))<1e-6}
      }
      const knots = new Set([join.start,join.end])
      for(const tile of tiles)for(let i=0;i<=tile.segs;i++){const t=(join.edge%2?tile.originZ:tile.originX)+i*420*tile.size/tile.segs;if(t>=join.start&&t<=join.end)knots.add(t)}
      const uncoveredSamples=[]
      let maxHeightDelta=0,maxSharedHeightDelta=0,maxSharedNormalDelta=0,maxUncoveredBefore=0,maxUncoveredAfter=0,dryKnots=0
      const joined=joinTerrainEdges(a,a.geometry.getAttribute('position').count,[join])
      const p=joined.getAttribute('position'),core=a.geometry.getAttribute('position').count
      const ordered = [...knots].sort((a,b)=>a-b)
      const probes = [...ordered, ...ordered.slice(1).map((t,i)=>(t+ordered[i])/2)]
      const coveredAt = (t,y) => {
        const index=joined.index.array, along=i=>(join.edge%2?p.getZ(i)+a.originZ:p.getX(i)+a.originX)+420*a.size/2
        for(let i=0;i<index.length;i+=3){
          const [u,v,w]=[index[i],index[i+1],index[i+2]];if(u<core||v<core||w<core)continue
          const ax=along(u),ay=p.getY(u),bx=along(v),by=p.getY(v),cx=along(w),cy=p.getY(w)
          const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(det)<1e-8)continue
          const s=((by-cy)*(t-cx)+(cx-bx)*(y-cy))/det,r=((cy-ay)*(t-cx)+(ax-cx)*(y-cy))/det
          if(Math.min(s,r,1-s-r)>=-1e-4)return true
        }return false
      }
      for(const t of probes) {
        const va=sample(a,t),vb=sample(b,t)
        if(Math.min(va.height,vb.height)<=Math.max(va.level,vb.level)+2)continue
        dryKnots++;const gap=Math.abs(va.height-vb.height);maxHeightDelta=Math.max(maxHeightDelta,gap)
        if(va.shared&&vb.shared){maxSharedHeightDelta=Math.max(maxSharedHeightDelta,gap);maxSharedNormalDelta=Math.max(maxSharedNormalDelta,Math.hypot(...va.normal.map((v,i)=>v-vb.normal[i])))}
        const uncovered=Math.max(0,vb.height-va.height,va.height-60-vb.height);maxUncoveredBefore=Math.max(maxUncoveredBefore,uncovered)
        const covered=gap<.002||[.1,.5,.9].every(f=>coveredAt(t,va.height+(vb.height-va.height)*f))
        maxUncoveredAfter=Math.max(maxUncoveredAfter,covered?0:uncovered)
        if(!covered&&uncovered>.001)uncoveredSamples.push({t,va,vb,gap})
      }
      fixtures.push({seed:view.seed,jobs,segs:data.map(d=>d.segs),dryKnots,maxHeightDelta,maxSharedHeightDelta,maxSharedNormalDelta,
        maxUncovered:baseline?maxUncoveredBefore:maxUncoveredAfter,baseVertices:core,joinedVertices:p.count,uncoveredSamples:baseline?undefined:uncoveredSamples,
        physicalHashes:data.map(d=>hash([d.heights,d.waterLevels,...Object.values(d.water?.attributes??{}).map(v=>v.array),d.water?.index])),
        groundCoreHashes:data.map(d=>hash([d.ground.attributes.position.array.subarray(0,d.heights.length*3),d.ground.index.subarray(0,d.segs*d.segs*6)]))})
      tiles.forEach(t=>t.geometry.dispose());joined.dispose()
    }
  }
  writeFileSync(process.argv[3],JSON.stringify({baseline:!!baseline,scope:'Shared normals, unmodified physical heights/water, and uncovered dry-edge gap. Baseline assumes its existing coarse 60 m downward skirt.',fixtures},null,2)+'\n')
} finally { await loader.close() }
