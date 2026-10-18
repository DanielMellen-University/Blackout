import { afterEach, expect, it } from 'vitest'
import { BufferAttribute, PlaneGeometry } from 'three'
import { joinTerrainEdges, terrainEdgeJoin, type TerrainEdgeTile } from '../src/world/TerrainSeams'
import { clearOpsPad } from '../src/world/terrainSample'
import { setWorldSeed } from '../src/world/noise'
import { deserializeTerrainGeometry, generateTerrainGeometry, type TerrainLod } from '../src/world/TerrainGeometry'

afterEach(clearOpsPad)
const tile = (x: number, segs: number, high: boolean): TerrainEdgeTile => {
  const geometry = new PlaneGeometry(420, 420, segs, segs); geometry.rotateX(-Math.PI / 2)
  const heights = new Float32Array((segs + 1) ** 2), levels = new Float32Array(heights.length)
  const color = new Float32Array(heights.length * 3).fill(.5)
  for (let z = 0; z <= segs; z++) for (let ix = 0; ix <= segs; ix++) {
    const i = z * (segs + 1) + ix
    heights[i] = high ? 45 + 8 * Math.sin(z / segs * Math.PI) : 30
    geometry.getAttribute('position').setY(i, heights[i]!)
  }
  geometry.setAttribute('color', new BufferAttribute(color, 3))
  return { originX: x, originZ: 0, segs, size: 1, heights, waterLevels: levels, geometry }
}

it('closes the higher fine edge at every knot of non-nested grids without changing core/contact buffers', () => {
  const a = tile(0, 2, false), b = tile(420, 3, true), join = terrainEdgeJoin(a, b)!
  expect(join.edge).toBe(1)
  const before = [...a.geometry.getAttribute('position').array], heights = [...a.heights]
  const joined = joinTerrainEdges(a, a.heights.length, [join])
  expect([...a.heights]).toEqual(heights)
  expect([...joined.getAttribute('position').array].slice(0, before.length)).toEqual(before)
  const p = joined.getAttribute('position')
  for (const z of [0, 140, 210, 280, 420]) {
    const vertices = Array.from({ length: p.count - a.heights.length }, (_, i) => i + a.heights.length)
      .filter(i => Math.abs(p.getZ(i) - (z - 210)) < .001)
    expect(vertices.some(i => p.getY(i) === 30)).toBe(true)
    expect(vertices.some(i => p.getY(i) >= 45)).toBe(true)
  }
  // Rebuilding from the saved base counts must not accumulate prior connectors.
  const repeated = joinTerrainEdges({ ...a, geometry: joined }, a.heights.length, [join])
  expect([...repeated.getAttribute('position').array]).toEqual([...p.array])
  expect([...repeated.index!.array]).toEqual([...joined.index!.array])
  a.geometry.dispose(); b.geometry.dispose(); joined.dispose(); repeated.dispose()
})

it('keeps wet edges open and rejects corner-only or overlapping neighbors', () => {
  const a = tile(0, 2, false), b = tile(420, 3, true)
  b.waterLevels.fill(100)
  const joined = joinTerrainEdges(a, a.heights.length, [terrainEdgeJoin(a, b)!])
  expect(joined.getAttribute('position').count).toBe(a.heights.length)
  expect(terrainEdgeJoin(a, { ...b, originZ: 420 })).toBeNull()
  expect(terrainEdgeJoin(a, { ...b, originX: 0 })).toBeNull()
  a.geometry.dispose(); b.geometry.dispose(); joined.dispose()
})

const fixtures: { seed: number; x: number; z: number; jobs: [number, number, TerrainLod, number][] }[] = [
  { seed: 42, x: -15120, z: 14280, jobs: [[-15120, 14280, 2, 2], [-16800, 13440, 2, 4]] },
  { seed: 2026, x: -26880, z: -28140, jobs: [[-26880, -28560, 2, 2], [-28560, -28560, 2, 4]] },
  { seed: 9001, x: -25200, z: -15540, jobs: [[-26040, -15960, 2, 2], [-25200, -16800, 2, 4]] },
  { seed: 808, x: -97020, z: 21840, jobs: [[-97440, 21000, 2, 2], [-97440, 21840, 2, 4]] },
]
it.each(fixtures)('matches the actual dry mixed-LOD normals from seed $seed', ({ seed, x, z, jobs }) => {
  setWorldSeed(seed); clearOpsPad()
  const normals = jobs.map(job => {
    const data = generateTerrainGeometry(...job), step = 420 * job[3] / data.segs
    const i = Math.round((z - job[1]) / step) * (data.segs + 1) + Math.round((x - job[0]) / step)
    const geometry = deserializeTerrainGeometry(data.ground)
    const normal = [...geometry.getAttribute('normal').array.slice(i * 3, i * 3 + 3)]
    geometry.dispose(); return normal
  })
  expect(normals[0]).toEqual(normals[1])
})

it('restores original skirts when a neighbor leaves and does not accumulate connectors', () => {
  setWorldSeed(42); clearOpsPad()
  const jobs: [number, number, TerrainLod, number][] = [[-15120, 14280, 2, 2], [-16800, 13440, 2, 4]]
  const tiles = jobs.map(job => {
    const d = generateTerrainGeometry(...job, [true, true, true, true])
    return { originX: job[0], originZ: job[1], segs: d.segs, size: job[3], heights: d.heights,
      waterLevels: d.waterLevels, geometry: deserializeTerrainGeometry(d.ground) }
  }).sort((a, b) => b.size / b.segs - a.size / a.segs)
  const a = tiles[0]!, b = tiles[1]!, base = a.geometry.getAttribute('position').count
  const original = [...a.geometry.index!.array]
  const first = joinTerrainEdges(a, base, [terrainEdgeJoin(a, b)!])
  const second = joinTerrainEdges({ ...a, geometry: first }, base, [terrainEdgeJoin(a, b)!])
  expect([...second.index!.array]).toEqual([...first.index!.array])
  expect([...second.getAttribute('position').array]).toEqual([...first.getAttribute('position').array])
  const restored = joinTerrainEdges({ ...a, geometry: second }, base, [])
  expect([...restored.index!.array]).toEqual(original)
  expect([...restored.getAttribute('position').array]).toEqual([...a.geometry.getAttribute('position').array])
  for (const g of [a.geometry, b.geometry, first, second, restored]) g.dispose()
})

it('splits a crossing edge without producing a folded wall above both surfaces', () => {
  const a = tile(0, 2, false), b = tile(420, 3, true)
  for (let z = 0; z <= 3; z++) for (let x = 0; x <= 3; x++) b.heights[z * 4 + x] = 20 + z * 12
  const joined = joinTerrainEdges(a, a.heights.length, [terrainEdgeJoin(a, b)!]), p = joined.getAttribute('position')
  const crossing = Array.from({ length: p.count - a.heights.length }, (_, i) => i + a.heights.length)
    .filter(i => Math.abs(p.getZ(i) + 93.3333333333) < .001)
  expect(crossing.length).toBeGreaterThan(0)
  expect(crossing.every(i => p.getY(i) === 30)).toBe(true)
  a.geometry.dispose(); b.geometry.dispose(); joined.dispose()
})

it('publishes joins within the attachment cap and restores coverage after neighbor retirement', async () => {
  const { Scene } = await import('three')
  const { TerrainSystem } = await import('../src/world/TerrainSystem')
  setWorldSeed(42); clearOpsPad()
  const terrain = new TerrainSystem(new Scene())
  // Exercise actual installation and publication with the same measured tiles.
  const internal = terrain as unknown as {
    generation: number; maxUploadsPerFrame: number
    desiredTiles: Map<string, { cx: number; cz: number; size: number; dist: number }>
    chunks: Map<string, { key: string; fadingOut: boolean; terrainMesh: { geometry: PlaneGeometry }; heights: Float32Array }>
    seamKeys: Set<string>
    install(job: unknown, data: unknown): void
    drainBuildQueue(): void
    queueEdgeJoins(chunk: unknown): void
  }
  try {
    const jobs: [number, number, TerrainLod, number][] = [[-15120, 14280, 2, 2], [-16800, 13440, 2, 4]]
    for (const [x, z, lod, size] of jobs) {
      const cx = x / 420, cz = z / 420, key = `${cx},${cz}:${size}`
      internal.desiredTiles.set(key, { cx, cz, size, dist: 20 })
      internal.install({ cx, cz, size, lod, generation: internal.generation }, generateTerrainGeometry(x, z, lod, size, [true, true, true, true]))
    }
    internal.maxUploadsPerFrame = 1
    const coarse = internal.chunks.get('-40,32:4')!, fine = internal.chunks.get('-36,34:2')!
    const original = coarse.terrainMesh.geometry, heights = [...coarse.heights]
    expect(internal.seamKeys.size).toBe(1)
    internal.drainBuildQueue()
    expect(internal.seamKeys.size).toBe(0)
    expect(coarse.terrainMesh.geometry).not.toBe(original)
    expect([...coarse.heights]).toEqual(heights)
    fine.fadingOut = true
    internal.queueEdgeJoins(fine)
    internal.drainBuildQueue()
    expect(coarse.terrainMesh.geometry.index!.count).toBe(original.index!.count)
  } finally { terrain.dispose() }
})

it('clips a partially wet interval instead of leaving its dry portion uncovered', () => {
  const a = tile(0, 2, false), b = tile(420, 3, true)
  for (let x = 0; x <= 3; x++) b.waterLevels[x] = 60
  const joined = joinTerrainEdges(a, a.heights.length, [terrainEdgeJoin(a, b)!]), p = joined.getAttribute('position')
  const zs = Array.from({ length: p.count - a.heights.length }, (_, i) => p.getZ(i + a.heights.length) + 210)
  expect(Math.min(...zs)).toBeCloseTo(140 * 32 / 60, 3)
  expect(Math.max(...zs)).toBe(420)
  a.geometry.dispose(); b.geometry.dispose(); joined.dispose()
})
