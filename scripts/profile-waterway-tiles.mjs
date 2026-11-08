import { createHash } from 'node:crypto'
import { createServer } from 'vite'
import { performance } from 'node:perf_hooks'
import { availableParallelism } from 'node:os'

// CPU microbench of six Waterway near tiles. This is not FPS, a GPU frame
// time, or a memory measurement. The worker protocol clones the mission
// profile before every tile, matching terrain.worker.ts postMessage clones,
// which replace the profile object the hydrology cache keys on. The stable
// protocol sets that profile once, matching a warm main-thread fallback.
const args = new URLSearchParams(process.argv.slice(2).map(arg => arg.replace(/^--/, '')).join('&'))
const parsedSamples = Number(args.get('samples') ?? 8)
const samples = Number.isFinite(parsedSamples) ? Math.max(2, Math.min(30, Math.floor(parsedSamples))) : 8
const protocol = args.get('protocol') === 'stable' ? 'stable' : 'worker-clone'
const seeds = (args.get('seeds') ?? '42,1337,9001').split(',').map(Number).filter(Number.isFinite)
const CHUNK = 420

function conventionalMedian(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  if (n === 0) return null
  if (n % 2 === 1) return sorted[(n - 1) / 2]
  return (sorted[n / 2 - 1] + sorted[n / 2]) / 2
}

function digest(parts) {
  const hash = createHash('sha256')
  for (const part of parts) {
    if (typeof part === 'string') hash.update(part)
    else hash.update(Buffer.from(part.buffer, part.byteOffset, part.byteLength))
  }
  return hash.digest('hex')
}

function geometryDigest(tiles) {
  const parts = []
  for (const tile of tiles) {
    parts.push(`${tile.originX},${tile.originZ},${tile.segs}`)
    parts.push(tile.heights, tile.waterLevels)
    for (const mesh of [tile.ground, tile.water]) {
      if (!mesh) { parts.push('none'); continue }
      for (const name of Object.keys(mesh.attributes).sort()) {
        parts.push(name)
        parts.push(mesh.attributes[name].array)
      }
      parts.push(mesh.index ?? 'no-index')
    }
  }
  return digest(parts)
}

const loader = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { generateMission } = await loader.ssrLoadModule('/src/systems/MissionGenerator.ts')
  const { generateTerrainGeometry } = await loader.ssrLoadModule('/src/world/TerrainGeometry.ts')
  const { setWorldSeed } = await loader.ssrLoadModule('/src/world/noise.ts')
  const { setTerrainProfile } = await loader.ssrLoadModule('/src/world/TerrainProfile.ts')
  const { setOpsPad, clearOpsPad } = await loader.ssrLoadModule('/src/world/terrainSample.ts')
  const { CATCHMENT_SIZE } = await loader.ssrLoadModule('/src/world/Hydrology.ts')
  const cases = []
  for (const seed of seeds) {
    const spec = generateMission(seed, 'waterway-run')
    const terrain = spec.terrain
    const pad = spec.landingRunway
    const yaw = terrain.yaw
    const world = (right, forward) => ({
      x: terrain.originX + Math.cos(yaw) * right + Math.sin(yaw) * forward,
      z: terrain.originZ - Math.sin(yaw) * right + Math.cos(yaw) * forward,
    })
    // River/lake junction anchors. Snap to the 420 m grid and keep six distinct tiles.
    const anchors = [[1000, 1800], [2100, 3300], [1100, 2400], [1100, 800], [1100, -200], [1250, -900]]
    const tiles = []
    for (const [right, forward] of anchors) {
      const point = world(right, forward)
      let x = Math.floor(point.x / CHUNK) * CHUNK
      let z = Math.floor(point.z / CHUNK) * CHUNK
      while (tiles.some(tile => tile.x === x && tile.z === z)) x += CHUNK
      tiles.push({
        x, z,
        catchment: `${Math.floor(x / CATCHMENT_SIZE)},${Math.floor(z / CATCHMENT_SIZE)}`,
      })
    }
    const runs = []
    let built = []
    for (let sample = 0; sample < samples; sample++) {
      clearOpsPad()
      setTerrainProfile(null)
      setWorldSeed(seed + 1)
      setWorldSeed(seed)
      if (protocol === 'stable') {
        setTerrainProfile(terrain)
        setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
      }
      const tileMs = []
      if (sample === samples - 1) built = []
      for (const tile of tiles) {
        const start = performance.now()
        if (protocol === 'worker-clone') {
          setTerrainProfile(structuredClone(terrain))
          setWorldSeed(seed)
          setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
        }
        const data = generateTerrainGeometry(tile.x, tile.z, 0, 1, [false, false, false, false], 'full')
        tileMs.push(performance.now() - start)
        if (sample === samples - 1) built.push({ ...data, originX: tile.x, originZ: tile.z })
      }
      runs.push({ totalMs: tileMs.reduce((sum, ms) => sum + ms, 0), tileMs })
    }
    const geometry = geometryDigest(built)
    const totals = runs.map(run => run.totalMs)
    const sorted = [...totals].sort((a, b) => a - b)
    cases.push({
      seed,
      origin: [terrain.originX, terrain.originZ],
      tiles,
      catchments: [...new Set(tiles.map(tile => tile.catchment))],
      samples: totals,
      tileMs: runs.map(run => run.tileMs),
      sortedMs: sorted,
      medianMs: conventionalMedian(totals),
      minMs: sorted[0],
      maxMs: sorted[sorted.length - 1],
      geometry,
    })
  }
  console.log(JSON.stringify({
    scope: 'CPU Waterway near-tile geometry only; not FPS, GPU frames, or memory',
    protocol,
    median: 'conventional: average of the two central sorted samples when the count is even',
    node: process.version,
    parallelism: availableParallelism(),
    samples,
    cases,
  }, null, 2))
} finally {
  await loader.close()
}
