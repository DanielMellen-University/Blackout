// Isolated CPU/byte diagnostic using actual mixed-LOD points from the visual review.
import { createServer } from 'vite'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const baseline = process.env.TERRAIN_GEOMETRY_BASELINE_SOURCE
  ? readFileSync(process.env.TERRAIN_GEOMETRY_BASELINE_SOURCE, 'utf8') : null
const review = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const loader = await createServer({ cacheDir: '/tmp/blackout-edge-review-vite-cache',
  server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom',
  plugins: baseline ? [{ name: 'edge-color-baseline', enforce: 'pre', transform(code, id) {
    if (id.endsWith('/TerrainGeometry.ts')) return baseline
  } }] : [] })
const digest = data => {
  const hash = createHash('sha256')
  hash.update(JSON.stringify({ segs: data.segs, groundBounds: data.ground.bounds, waterBounds: data.water?.bounds }))
  for (const array of [data.heights, data.waterLevels,
    ...Object.entries(data.ground.attributes).filter(([name]) => name !== 'color').map(([, a]) => a.array), data.ground.index,
    ...Object.values(data.water?.attributes ?? {}).map(a => a.array), data.water?.index]) {
    if (array) hash.update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength))
  }
  return hash.digest('hex')
}
try {
  const { generateTerrainGeometry } = await loader.ssrLoadModule('/src/world/TerrainGeometry.ts')
  const { setWorldSeed } = await loader.ssrLoadModule('/src/world/noise.ts')
  const { clearOpsPad } = await loader.ssrLoadModule('/src/world/terrainSample.ts')
  const fixtures = []
  for (const view of review.results.filter(r => r.kind === 'seam' && r.mode === 'cockpit')) {
    setWorldSeed(view.seed); clearOpsPad()
    const { x, z, jobs } = view.seams.worst[0]
    const geometry = jobs.map(job => generateTerrainGeometry(...job))
    const colors = geometry.map((data, j) => {
      const [ox, oz, , size] = jobs[j], step = 420 * size / data.segs
      const ix = (x - ox) / step, iz = (z - oz) / step
      if (Math.abs(ix - Math.round(ix)) > 1e-6 || Math.abs(iz - Math.round(iz)) > 1e-6) throw Error('Unaligned shared vertex')
      const i = Math.round(iz) * (data.segs + 1) + Math.round(ix)
      return Array.from(data.ground.attributes.color.array.subarray(i * 3, i * 3 + 3))
    })
    const timingsMs = []
    for (let run = 0; run < 8; run++) {
      const start = performance.now()
      for (const job of jobs) generateTerrainGeometry(...job)
      timingsMs.push(performance.now() - start)
    }
    const warm = timingsMs.slice(1).sort((a, b) => a - b)
    fixtures.push({ seed: view.seed, x, z, jobs, colors,
      maxColorJump: Math.max(...colors[0].map((v, i) => Math.abs(v - colors[1][i]))),
      structures: geometry.map(digest), segs: geometry.map(g => g.segs), timingsMs, warmMedianMs: warm[3] })
  }
  writeFileSync(process.argv[3], JSON.stringify({ baseline: !!baseline,
    scope: 'Color continuity, unchanged non-color buffers and isolated CPU build cost; no FPS claim', fixtures }, null, 2) + '\n')
} finally { await loader.close() }
