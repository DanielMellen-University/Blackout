import { createServer } from 'vite'
import { performance } from 'node:perf_hooks'
import { availableParallelism } from 'node:os'

// This measures geometry generation on the CPU, not browser frames or GPU work.
// HMR is disabled and the loader always closes: no listening or lingering server.
const args = new URLSearchParams(process.argv.slice(2).map(arg => arg.replace(/^--/, '')).join('&'))
const parsedSamples = Number(args.get('samples') ?? 8)
const samples = Number.isFinite(parsedSamples) ? Math.max(2, Math.min(100, Math.floor(parsedSamples))) : 8
const parsedSeed = Number(args.get('seed') ?? 1337)
const seed = Number.isFinite(parsedSeed) ? parsedSeed : 1337
const sliced = args.has('sliced')
const loader = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { generateTerrainGeometry, generateTerrainGeometrySteps, CHUNK_SIZE } = await loader.ssrLoadModule('/src/world/TerrainGeometry.ts')
  const { setWorldSeed } = await loader.ssrLoadModule('/src/world/noise.ts')
  const { clearOpsPad } = await loader.ssrLoadModule('/src/world/terrainSample.ts')
  setWorldSeed(seed)
  clearOpsPad()
  const cases = [
    { name: 'near', lod: 0, size: 1, quality: 'full' },
    { name: 'mid', lod: 1, size: 1, quality: 'full' },
    { name: 'far', lod: 2, size: 8, quality: 'full' },
    { name: 'far-fallback', lod: 2, size: 8, quality: 'fallback' },
  ]
  const results = cases.map(profile => {
    const timings = []
    let sliceCount = 0
    let maxSliceMs = 0
    const maxPhaseMs = {}
    let payloadBytes = 0
    for (let index = 0; index < samples; index++) {
      const start = performance.now()
      const input = [index * CHUNK_SIZE, -index * CHUNK_SIZE, profile.lod, profile.size,
        [false, false, false, false], profile.quality]
      let data
      if (sliced) {
        const steps = generateTerrainGeometrySteps(...input)
        while (true) {
          const sliceStart = performance.now()
          const result = steps.next()
          const elapsed = performance.now() - sliceStart
          sliceCount++
          maxSliceMs = Math.max(maxSliceMs, elapsed)
          const phase = result.done ? 'serialize' : result.value
          maxPhaseMs[phase] = Math.max(maxPhaseMs[phase] ?? 0, elapsed)
          if (result.done) { data = result.value; break }
        }
      } else {
        data = generateTerrainGeometry(...input)
      }
      timings.push(performance.now() - start)
      const buffers = new Set([data.heights.buffer, data.waterLevels.buffer])
      for (const geometry of [data.ground, data.water]) {
        if (!geometry) continue
        for (const attribute of Object.values(geometry.attributes)) buffers.add(attribute.array.buffer)
        if (geometry.index) buffers.add(geometry.index.buffer)
      }
      payloadBytes = Math.max(payloadBytes, [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0))
    }
    const firstBuildMs = timings[0]
    const warm = timings.slice(1).sort((a, b) => a - b)
    const quantile = q => warm[Math.min(warm.length - 1, Math.floor(warm.length * q))]
    return { ...profile, samples, firstBuildMs, warmMedianMs: quantile(.5), warmP95Ms: quantile(.95),
      maxMs: Math.max(...timings), maxPayloadBytes: payloadBytes,
      ...(sliced ? { sliceCount, maxSliceMs, maxPhaseMs } : {}) }
  })
  console.log(JSON.stringify({ scope: 'CPU terrain geometry only; not FPS or rendering', seed,
    node: process.version, parallelism: availableParallelism(), sliced,
    route: 'northeast diagonal from world origin', results }, null, 2))
} finally {
  await loader.close()
}
