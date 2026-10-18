// CPU-only equality and allocation diagnostic. Run after flight capture.
import { createServer } from 'vite'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const baseline = process.env.ROAD_FIT_BASELINE_SOURCE ? readFileSync(process.env.ROAD_FIT_BASELINE_SOURCE, 'utf8') : null
const loader = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom',
  plugins: baseline ? [{ name: 'road-fit-baseline', enforce: 'pre', transform(code, id) {
    if (id.endsWith('/RoadTerrainFit.ts')) return baseline
  } }] : [] })
try {
  const { fitRoadTerrainSteps } = await loader.ssrLoadModule('/src/world/RoadTerrainFit.ts')
  const results = []
  for (const fixture of ['flat', 'rough', 'soil', 'translated']) {
    const positions = [], offsets = [], indices = []
    for (let i = 0; i <= 1000; i++) {
      const x = i * 24, z = Math.sin(i * .027) * 190, y = 100 + Math.sin(i * .07) * 40
      positions.push(x, y + .45, z + 5, x, y + .45, z, x, y + .45, z - 5)
      offsets.push(.45, .45, .45)
      if (i) {
        const a = (i - 1) * 3, b = i * 3
        indices.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2)
      }
    }
    if (fixture === 'flat') for (let i = 1; i < positions.length; i += 3) positions[i] = 100.45
    if (fixture === 'soil') {
      for (let i = 0; i < offsets.length; i += 3) {
        positions[(i + 1) * 3 + 2] = positions[i * 3 + 2]
        positions[(i + 1) * 3 + 1] -= .3; offsets[i + 1] = .15
      }
    }
    const inputs = [positions, offsets, indices], runs = [], heap = []
    let result
    for (let run = 0; run < 6; run++) {
      const [p, o, ids] = inputs.map(a => [...a]), start = performance.now()
      const steps = fitRoadTerrainSteps(p, o, ids, fixture === 'translated' ? 113644.112 : 0,
        fixture === 'translated' ? -55704.222 : 0, fixture === 'flat' ? () => 100 : undefined)
      let next = steps.next(), yields = 0, peak = process.memoryUsage().heapUsed
      while (!next.done) { yields++; peak = Math.max(peak, process.memoryUsage().heapUsed); next = steps.next() }
      runs.push(performance.now() - start); heap.push(peak)
      const hash = createHash('sha256')
      for (const a of [new Float32Array(p), new Float32Array(o), new Uint32Array(next.value)]) hash.update(new Uint8Array(a.buffer))
      result = { fixture, hash: hash.digest('hex'), vertices: o.length, indices: next.value.length, yields }
    }
    results.push({ ...result, timingsMs: runs, heapPeaksBytes: heap,
      warmMedianMs: runs.slice(1).sort((a,b) => a-b)[2] })
  }
  writeFileSync(process.argv[2], JSON.stringify({ baseline: !!baseline, scope: 'CPU fitter diagnostic, process heap is not flight acceptance', results }, null, 2) + '\n')
} finally { await loader.close() }
