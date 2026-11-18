// CPU reproduction of b19's exact seed/catchment boundary, independent of GPU.
import { createServer } from 'vite'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { cpus, totalmem } from 'node:os'
const mode = process.argv[2], output = process.argv[3]
if (!['before', 'after'].includes(mode) || !output) throw Error('Usage: node scripts/measure-terrain-lookahead.mjs before|after output.json')
const loader = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
try {
  const { setWorldSeed } = await loader.ssrLoadModule('/src/world/noise.ts')
  const { setTerrainProfile } = await loader.ssrLoadModule('/src/world/TerrainProfile.ts')
  const { prepareHydrologyInBoundsSteps, waterLandmarks, riverReaches } = await loader.ssrLoadModule('/src/world/Hydrology.ts')
  const { sampleTerrainSurfaceHeightFast, clearOpsPad } = await loader.ssrLoadModule('/src/world/terrainSample.ts')
  const { generateTerrainGeometry } = await loader.ssrLoadModule('/src/world/TerrainGeometry.ts')
  const { generateMission } = await loader.ssrLoadModule('/src/systems/MissionGenerator.ts')
  const { TerrainReviewSurvey } = await loader.ssrLoadModule('/scripts/lib/terrain-review-survey.ts')
  const drain = steps => { while (!steps.next().done) {} }
  const reset = () => {
    clearOpsPad(); setTerrainProfile(null); setWorldSeed(1338)
    const invalidate = prepareHydrologyInBoundsSteps(56063, 34982, 56063, 34982)
    invalidate.next(); invalidate.return(); setWorldSeed(1337)
    drain(prepareHydrologyInBoundsSteps(56063, 34982, 56063, 34982))
  }
  const distances = [0, 500, 1000, 1800, 3000, 4500, 6000, 8000], runs = []
  for (let i = 0; i < 8; i++) {
    reset()
    const start = performance.now(), slices = []
    let target, pendingRetries = 0
    if (mode === 'before') {
      target = Math.max(...distances.map(d => sampleTerrainSurfaceHeightFast(56063 + d, 34982) + 650 - d * .025))
      slices.push(performance.now() - start)
    } else {
      const survey = new TerrainReviewSurvey()
      while ((target = survey.sample(56063, 34982, Math.PI / 2, 650, distances)) === null) {
        pendingRetries++
        const at = performance.now(); survey.advance(); slices.push(performance.now() - at)
        await new Promise(resolve => setImmediate(resolve))
      }
      survey.reset()
    }
    runs.push({ target, elapsedMs: performance.now() - start, cpuMs: slices.reduce((a,b)=>a+b,0), maxSliceMs: Math.max(...slices), slices: slices.length, pendingRetries })
  }
  const identity = { catchment: hash({ basins: waterLandmarks(2, 1), reaches: riverReaches(2, 1) }), tiles: [], routes: [] }
  for (const [x,z,lod,size] of [[63840,34860,0,1],[63840,34440,1,2],[63840,33600,2,8]]) {
    const tile = generateTerrainGeometry(x,z,lod,size)
    const digest = createHash('sha256')
    digest.update(JSON.stringify({originX:tile.originX,originZ:tile.originZ,segs:tile.segs}))
    for (const a of [tile.heights,tile.waterLevels]) digest.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength))
    for (const mesh of [tile.ground,tile.water]) {
      digest.update(JSON.stringify(mesh?.bounds ?? null))
      for (const [name,attr] of Object.entries(mesh?.attributes ?? {}).sort(([a],[b])=>a.localeCompare(b))) {
        digest.update(name); digest.update(new Uint8Array(attr.array.buffer,attr.array.byteOffset,attr.array.byteLength))
      }
      if (mesh?.index) digest.update(new Uint8Array(mesh.index.buffer,mesh.index.byteOffset,mesh.index.byteLength))
    }
    identity.tiles.push({x,z,lod,size,sha256:digest.digest('hex')})
  }
  for (const seed of [42,1337,9001]) for (const theme of ['desert-run','mountain-valley-run','coastal-island-run','volcanic-run','waterway-run'])
    identity.routes.push({seed,theme,sha256:hash(generateMission(seed,theme))})
  const median = values => { const a=values.toSorted((a,b)=>a-b); return (a[3]+a[4])/2 }
  await writeFile(output, JSON.stringify({mode,node:process.version,cpu:cpus()[0].model,logicalCpus:cpus().length,totalMemoryBytes:totalmem(),method:'Eight independent cold (2,1) builds; (1,1) warm. Exact b19 points x=56063+d,z=34982,seed=1337. After uses cooperative steps with event-loop yields; CPU/slice times, not FPS or a hard deadline.',runs,medianCpuMs:median(runs.map(r=>r.cpuMs)),medianMaxSliceMs:median(runs.map(r=>r.maxSliceMs)),identity},null,2)+'\n')
  console.log(output)
} finally { await loader.close() }
