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
    // Fallback still draws until replacement coverage permits actual retirement.
    expect(coarse.terrainMesh.geometry.index!.count).toBeGreaterThan(original.index!.count)
    internal.chunks.delete(fine.key)
    internal.queueEdgeJoins(fine)
    internal.drainBuildQueue()
    expect(coarse.terrainMesh.geometry.index!.count).toBe(original.index!.count)
    internal.chunks.set(fine.key, fine) // retain cleanup ownership
  } finally { terrain.dispose() }
})

it('clips a partially wet bank at the upper surface crossing', () => {
  const a = tile(0, 2, false), b = tile(420, 3, true)
  for (let x = 0; x <= 3; x++) b.waterLevels[x] = 60
  const joined = joinTerrainEdges(a, a.heights.length, [terrainEdgeJoin(a, b)!]), p = joined.getAttribute('position')
  const zs = Array.from({ length: p.count - a.heights.length }, (_, i) => p.getZ(i + a.heights.length) + 210)
  expect(Math.min(...zs)).toBeCloseTo(140 * 15.02 / (60 + 8 * Math.sin(Math.PI / 3)), 3)
  expect(Math.max(...zs)).toBe(420)
  a.geometry.dispose(); b.geometry.dispose(); joined.dispose()
})

it('owns its published buffers across larger and smaller subsequent seam builds', () => {
  const a = tile(0, 2, false), b = tile(420, 3, true)
  const first = joinTerrainEdges(a, a.heights.length, [terrainEdgeJoin(a, b)!])
  const saved = Object.fromEntries(Object.entries(first.attributes).map(([name, attr]) => [name, [...attr.array]]))
  const savedIndices = [...first.index!.array]
  const large = tile(0, 12, false), fine = tile(420, 24, true)
  const second = joinTerrainEdges(large, large.heights.length, [terrainEdgeJoin(large, fine)!])
  const small = joinTerrainEdges(a, a.heights.length, [])
  for (const [name, values] of Object.entries(saved)) expect([...first.getAttribute(name).array]).toEqual(values)
  expect([...first.index!.array]).toEqual(savedIndices)
  expect(small.getAttribute('position').count).toBe(a.heights.length)
  expect(small.index!.count).toBe(a.geometry.index!.count)
  expect(second.getAttribute('position').array.buffer).not.toBe(first.getAttribute('position').array.buffer)
  for (const g of [a.geometry, b.geometry, large.geometry, fine.geometry, first, second, small]) g.dispose()
})

it('checks distant neighbor bounds without reading their geometry or contact payload', async () => {
  const { Scene } = await import('three')
  const { TerrainSystem } = await import('../src/world/TerrainSystem')
  const system = new TerrainSystem(new Scene())
  const internal = system as unknown as { chunks: Map<string, unknown>; seamKeys: Set<string>; queueEdgeJoins(chunk: unknown): void }
  const owner = { originX: 0, originZ: 0, size: 1, segs: 24, key: 'owner' }
  try {
    for (let i = 0; i < 100; i++) internal.chunks.set(String(i), {
      originX: 10000 + i * 420, originZ: 10000, size: 1, segs: 12,
      get terrainMesh() { throw Error('Unrelated geometry was inspected') },
      get heights() { throw Error('Unrelated contact data was inspected') },
    })
    internal.queueEdgeJoins(owner)
    expect(internal.seamKeys.size).toBe(0)
  } finally { internal.chunks.clear(); system.dispose() }
})

it('joins the exposed shoreline bank down to water when the other bed is submerged', () => {
  const a = tile(0, 2, false), b = tile(420, 3, true)
  a.waterLevels.fill(35); b.waterLevels.fill(35)
  const beforeA = [...a.heights], beforeB = [...b.heights]
  const joined = joinTerrainEdges(a, a.heights.length, [terrainEdgeJoin(a, b)!])
  const p = joined.getAttribute('position')
  expect(p.count).toBeGreaterThan(a.heights.length)
  const added = Array.from({ length: p.count - a.heights.length }, (_, i) => i + a.heights.length)
  expect(Math.min(...added.map(i => p.getY(i)))).toBeCloseTo(35.02, 4)
  expect(Math.max(...added.map(i => p.getY(i)))).toBeGreaterThan(50)
  expect([...a.heights]).toEqual(beforeA); expect([...b.heights]).toEqual(beforeB)
  a.geometry.dispose(); b.geometry.dispose(); joined.dispose()
})

it('closes near-water dry gaps without an artificial two metre exclusion band', () => {
  const a = tile(0, 2, false), b = tile(420, 3, true)
  a.waterLevels.fill(29); b.waterLevels.fill(29)
  const joined = joinTerrainEdges(a, a.heights.length, [terrainEdgeJoin(a, b)!])
  expect(joined.getAttribute('position').count).toBeGreaterThan(a.heights.length)
  expect(Math.min(...Array.from(joined.getAttribute('position').array).filter((_, i) => i % 3 === 1))).toBe(30)
  a.geometry.dispose(); b.geometry.dispose(); joined.dispose()
})

it('clips crossed water grades without covering submerged beds or protruding above the bank', () => {
  const a = tile(0, 2, false), b = tile(420, 3, true)
  for (let z = 0; z <= 2; z++) for (let x = 0; x <= 2; x++) a.waterLevels[z * 3 + x] = 55 - z * 20
  for (let z = 0; z <= 3; z++) for (let x = 0; x <= 3; x++) b.waterLevels[z * 4 + x] = 15 + z * 40 / 3
  const joined = joinTerrainEdges(a, a.heights.length, [terrainEdgeJoin(a, b)!]), p = joined.getAttribute('position')
  const highAt = (t: number) => {
    const q = t * 3 / 420, lo = Math.min(2, Math.floor(q)), f = q - lo
    return b.heights[lo * 4]! * (1 - f) + b.heights[(lo + 1) * 4]! * f
  }
  let checked = 0
  for (let i = a.heights.length; i < p.count; i++) {
    const t = p.getZ(i) + 210, w = Math.max(55 - t * 40 / 420, 15 + t * 40 / 420)
    expect(p.getY(i)).toBeGreaterThanOrEqual(w + .0199)
    expect(p.getY(i)).toBeLessThanOrEqual(highAt(t) + .0001)
    checked++
  }
  expect(checked).toBeGreaterThan(12)
  // The switch of the two independent water grades is explicitly a knot.
  expect(Array.from({ length: p.count - a.heights.length }, (_, i) => p.getZ(i + a.heights.length))
    .some(z => Math.abs(z) < .001)).toBe(true)
  a.geometry.dispose(); b.geometry.dispose(); joined.dispose()
})

it.each([
  { seed: 2026, jobs: [[-178920, -162120, 2, 2], [-178080, -162120, 1, 2]], t: -161997, lo: .490585786955697, hi: .8367384374141691 },
  { seed: 9001, jobs: [[-130620, -113400, 1, 1], [-130200, -113400, 1, 1]], t: -113007.5, lo: .35948909393378703, hi: .6951107308268547 },
])('covers the actual near-water edge gap in seed $seed', ({ seed, jobs, t, lo, hi }) => {
  setWorldSeed(seed); clearOpsPad()
  const tiles = jobs.map(job => {
    const d = generateTerrainGeometry(job[0]!, job[1]!, job[2]! as TerrainLod, job[3]!)
    return { originX: job[0]!, originZ: job[1]!, size: job[3]!, segs: d.segs,
      heights: d.heights, waterLevels: d.waterLevels, geometry: deserializeTerrainGeometry(d.ground) }
  })
  const [a, b] = tiles as [TerrainEdgeTile, TerrainEdgeTile]
  const base = a.geometry.getAttribute('position').count
  const joined = joinTerrainEdges(a, base, [terrainEdgeJoin(a, b)!])
  const p = joined.getAttribute('position'), index = joined.index!
  const along = (i: number) => p.getZ(i) + a.originZ + 420 * a.size / 2
  for (const f of [.05, .25, .5, .75, .95]) {
    const y = lo + (hi - lo) * f
    let covered = false
    for (let j = 0; j < index.count; j += 3) {
      const u = index.getX(j), v = index.getX(j + 1), w = index.getX(j + 2)
      if (Math.min(u, v, w) < base) continue
      const ax = along(u), ay = p.getY(u), bx = along(v), by = p.getY(v), cx = along(w), cy = p.getY(w)
      const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
      if (Math.abs(det) < 1e-8) continue
      const s = ((by - cy) * (t - cx) + (cx - bx) * (y - cy)) / det
      const r = ((cy - ay) * (t - cx) + (ax - cx) * (y - cy)) / det
      if (Math.min(s, r, 1 - s - r) >= -1e-4) { covered = true; break }
    }
    expect(covered).toBe(true)
  }
  expect([...p.array].slice(0, base * 3)).toEqual([...a.geometry.getAttribute('position').array])
  a.geometry.dispose(); b.geometry.dispose(); joined.dispose()
})
