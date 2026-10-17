import { createServer } from 'vite'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const baseline = process.env.TERRAIN_BASELINE_SOURCE ? readFileSync(process.env.TERRAIN_BASELINE_SOURCE, 'utf8') : null
const loader = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom',
  plugins: baseline ? [{ name: 'palette-baseline', enforce: 'pre', transform(code, id) {
    if (id.endsWith('/terrainSample.ts')) return baseline
  } }] : [] })
try {
  const { biomeColor, biomeColorInto, clearOpsPad, setOpsPad, sampleClimate } = await loader.ssrLoadModule('/src/world/terrainSample.ts')
  const { setWorldSeed } = await loader.ssrLoadModule('/src/world/noise.ts')
  const { generateTerrainGeometry } = await loader.ssrLoadModule('/src/world/TerrainGeometry.ts')
  setWorldSeed(1); clearOpsPad()
  const landform = { ridge: .6, alpineValley: .4, plateau: .7, caldera: .5, dunes: .8,
    badlands: .9, karst: .7, alluvial: .8, glacial: .7, foothills: .8 }
  const features = { river: .6, lake: 0, pond: 0, stream: .7, ravine: .3 }
  const pairs = [['plains', 'snow'], ['mountain', 'snow'], ['plains', 'volcanic'], ['tundra', 'plains'],
    ['saltflat', 'desert'], ['savanna', 'swamp'], ['mesa', 'desert']]
  const boundaries = pairs.map(([a, b]) => {
    const colors = [-.000001, .000001].map(d => biomeColor(d < 0 ? a : b, 1400, .5, 520, 640,
      features, 0, 1, d < 0 ? b : a, .499999, [[a, .5 - d], [b, .5 + d]], landform))
    return { a, b, colors, maxJump: Math.max(...colors[0].map((v, i) => Math.abs(v - colors[1][i]))) }
  })
  const pure = ['plains', 'forest', 'rainforest', 'desert', 'mesa', 'swamp', 'hills', 'mountain', 'snow',
    'tundra', 'savanna', 'volcanic', 'saltflat', 'runway'].map(biome => ({ biome,
      colors: [-1600, 0, 520, 1500].map(x => biomeColor(biome, 1400, .5, x, 640, features, 0, 1, biome, 0, undefined, landform)) }))
  const structuralDigest = data => {
    const hash = createHash('sha256')
    hash.update(JSON.stringify({ segs: data.segs, groundBounds: data.ground.bounds, waterBounds: data.water?.bounds }))
    for (const array of [data.heights, data.waterLevels,
      ...Object.entries(data.ground.attributes).filter(([key]) => key !== 'color').map(([, a]) => a.array), data.ground.index,
      ...Object.values(data.water?.attributes ?? {}).map(a => a.array), data.water?.index]) {
      if (array) hash.update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength))
    }
    return hash.digest('hex')
  }
  const fixtures = [[0, 0, 0], [0, 0, 1, 2, [true, true, true, true]], [-22050, -28350, 0],
    [-6720, -6720, 2, 32], [-420, 420, 2, 8, [true, false, true, false], 'fallback'], [0, 0, 0]]
  const geometry = fixtures.map((input, i) => {
    if (i === 5) setOpsPad(0, 0, 42, .4)
    const data = generateTerrainGeometry(...input), timingsMs = []
    for (let run = 0; run < 6; run++) {
      const start = performance.now(); generateTerrainGeometry(...input); timingsMs.push(performance.now() - start)
    }
    const warm = timingsMs.slice(1).sort((a, b) => a - b), buffers = new Set([data.heights.buffer, data.waterLevels.buffer])
    for (const g of [data.ground, data.water]) if (g) {
      for (const a of Object.values(g.attributes)) buffers.add(a.array.buffer)
      if (g.index) buffers.add(g.index.buffer)
    }
    return { input, pad: i === 5, structure: structuralDigest(data), timingsMs,
      warmMedianMs: warm[2], maxPayloadBytes: [...buffers].reduce((sum, b) => sum + b.byteLength, 0) }

  })
  clearOpsPad()
  const climates = Array.from({ length: 1200 }, (_, i) => {
    const [x, z] = [[0, 0], [-92800, -13600], [-30000, -27600], [-113644, -55704]][i % 4]
    return { x: x + Math.floor(i / 4) % 20 * 140, z: z + Math.floor(i / 80) * 140 }
  }).map(p => ({ ...p, c: sampleClimate(p.x, p.z) }))
  const out = [0, 0, 0], timings = []
  for (let run = 0; run < 16; run++) {
    const start = performance.now()
    for (const { x, z, c } of climates) biomeColorInto(out, c.biome, c.height, c.moisture, x, z,
      c.features, c.coastal, c.land, c.biomeB, c.biomeMix, c.biomeWeights, c.landform)
    timings.push(performance.now() - start)
  }
  const warm = timings.slice(4).sort((a, b) => a - b)
  const result = { scope: 'CPU color evaluation and terrain builds only, no FPS claim', node: process.version, baseline: !!baseline,
    boundaries, pure, geometry, cpu: { callsPerRun: climates.length, timingsMs: timings,
      warmMedianMs: warm[Math.floor(warm.length / 2)], warmP95Ms: warm.at(-1) } }
  writeFileSync(process.argv[2], JSON.stringify(result, null, 2) + '\n')
} finally { await loader.close() }
