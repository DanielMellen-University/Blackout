// Independently project every added triangle in the actual resident edge plane.
import { createServer } from 'vite'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const baseline = process.env.SHORE_BASELINE_SOURCE ? readFileSync(process.env.SHORE_BASELINE_SOURCE, 'utf8') : null
const geometryBaseline = process.env.TERRAIN_GEOMETRY_BASELINE_SOURCE ? readFileSync(process.env.TERRAIN_GEOMETRY_BASELINE_SOURCE, 'utf8') : null
const loader = await createServer({ cacheDir: '/tmp/blackout-shore-buffer-cache',
  server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom',
  plugins: baseline || geometryBaseline ? [{ name: 'frozen-shore-seams', enforce: 'pre', transform(code, id) {
    if (baseline && id.endsWith('/TerrainSeams.ts')) return baseline
    if (geometryBaseline && id.endsWith('/TerrainGeometry.ts')) return geometryBaseline
  } }] : [] })
const hash = arrays => {
  const h = createHash('sha256')
  for (const a of arrays.filter(Boolean)) h.update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength))
  return h.digest('hex')
}
try {
  const { generateTerrainGeometry, deserializeTerrainGeometry } = await loader.ssrLoadModule('/src/world/TerrainGeometry.ts')
  const { joinTerrainEdges, terrainEdgeJoin } = await loader.ssrLoadModule('/src/world/TerrainSeams.ts')
  const { setWorldSeed } = await loader.ssrLoadModule('/src/world/noise.ts')
  const { clearOpsPad } = await loader.ssrLoadModule('/src/world/terrainSample.ts')
  const review = JSON.parse(readFileSync(process.argv[2], 'utf8')), results = []
  const seen = new Set()
  for (const view of review.results) for (const fixture of view.scan.cases) {
    const key = JSON.stringify([view.seed, fixture.jobs, fixture.t]); if (seen.has(key)) continue
    seen.add(key); setWorldSeed(view.seed); clearOpsPad()
    const data = fixture.jobs.map(job => generateTerrainGeometry(...job, [true, true, true, true]))
    const tiles = data.map((d, i) => ({ originX: fixture.jobs[i][0], originZ: fixture.jobs[i][1], size: fixture.jobs[i][3],
      segs: d.segs, heights: d.heights, waterLevels: d.waterLevels, geometry: deserializeTerrainGeometry(d.ground) }))
    const [a, b] = tiles, join = terrainEdgeJoin(a, b), base = a.geometry.getAttribute('position').count
    const geometry = joinTerrainEdges(a, base, [join]), p = geometry.getAttribute('position'), index = geometry.index.array
    const along = i => (join.edge % 2 ? p.getZ(i) + a.originZ : p.getX(i) + a.originX) + 420 * a.size / 2
    const covered = (t, y) => {
      for (let i = 0; i < index.length; i += 3) {
        const [u, v, w] = [index[i], index[i + 1], index[i + 2]]
        if (u < base || v < base || w < base) continue
        const ax = along(u), ay = p.getY(u), bx = along(v), by = p.getY(v), cx = along(w), cy = p.getY(w)
        const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(det) < 1e-8) continue
        const s = ((by - cy) * (t - cx) + (cx - bx) * (y - cy)) / det
        const r = ((cy - ay) * (t - cx) + (ax - cx) * (y - cy)) / det
        if (Math.min(s, r, 1 - s - r) >= -1e-4) return true
      }
      return false
    }
    const lo = Math.max(Math.min(fixture.va.h, fixture.vb.h), fixture.va.w + .02, fixture.vb.w + .02)
    const hi = Math.max(fixture.va.h, fixture.vb.h)
    const probes = [.05, .25, .5, .75, .95].map(f => ({ y: lo + (hi - lo) * f, covered: covered(fixture.t, lo + (hi - lo) * f) }))
    results.push({ seed: view.seed, ...fixture, probes, baseVertices: base, joinedVertices: p.count,
      coreHashes: data.map(d => hash([d.heights, d.waterLevels, d.ground.attributes.position.array,
        d.ground.index, ...Object.values(d.water?.attributes ?? {}).map(a => a.array), d.water?.index])) })
    tiles.forEach(t => t.geometry.dispose()); geometry.dispose()
  }
  writeFileSync(process.argv[3], JSON.stringify({ baseline: !!baseline, geometryBaseline: !!geometryBaseline, results }, null, 2) + '\n')
  console.log('fixtures', results.length, 'uncovered', results.filter(r => r.probes.some(p => !p.covered)).length)
} finally { await loader.close() }
