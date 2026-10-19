import { Scene } from 'three'
import { afterEach, expect, it } from 'vitest'
import { TerrainSystem } from '../src/world/TerrainSystem'
import { generateTerrainGeometry, type TerrainLod } from '../src/world/TerrainGeometry'
import { clearOpsPad } from '../src/world/terrainSample'
import { setWorldSeed } from '../src/world/noise'

afterEach(clearOpsPad)
function fixture() {
  setWorldSeed(2026); clearOpsPad()
  const system = new TerrainSystem(new Scene())
  const s = system as unknown as {
    generation: number; maxUploadsPerFrame: number; focusX: number; focusZ: number
    desiredTiles: Map<string, unknown>; chunks: Map<string, any>; seamKeys: Set<string>
    install(job: unknown, data: unknown): void; drainBuildQueue(): void; queueEdgeJoins(chunk: unknown): void
    updateFades(x: number, z: number, dt: number): void
  }
  s.maxUploadsPerFrame = 1; s.focusX = -178000; s.focusZ = -162000
  const install = (x: number, z: number, lod: TerrainLod) => {
    const cx = x / 420, cz = z / 420, size = 2, key = `${cx},${cz}:${size}`
    s.desiredTiles.set(key, { cx, cz, size, dist: lod === 2 ? 20 : 5 })
    s.install({ cx, cz, size, lod, generation: s.generation }, generateTerrainGeometry(x, z, lod, size, [true, true, true, true]))
    const chunk = s.chunks.get(key)!; chunk.alpha = 1
    return chunk
  }
  return { system, s, install }
}

it('keeps an exposed wet-bank connector to an opaque neighbor held for unfinished replacement coverage', () => {
  const { system, s, install } = fixture()
  try {
    const a = install(-178920, -162120, 2), b = install(-178080, -162120, 1)
    s.drainBuildQueue()
    const joined = a.terrainMesh.geometry.getAttribute('position').count
    expect(joined).toBeGreaterThan(a.seamBaseVertices)
    const physical = [...a.heights], water = [...a.waterLevels]
    b.fadingOut = true
    // An adjacent installation can legitimately queue this owner while the
    // old neighbor still supplies opaque coverage for missing child tiles.
    s.seamKeys.add(a.key); s.drainBuildQueue()
    expect(a.terrainMesh.geometry.getAttribute('position').count).toBe(joined)
    expect([...a.heights]).toEqual(physical); expect([...a.waterLevels]).toEqual(water)
    s.chunks.delete(b.key); s.queueEdgeJoins(b); s.drainBuildQueue()
    expect(a.terrainMesh.geometry.getAttribute('position').count).toBe(a.seamBaseVertices)
    s.chunks.set(b.key, b) // retain lifecycle ownership for test cleanup
  } finally { system.dispose() }
})

it('publishes a new fine-neighbor bank while its coarse owner is still held as opaque fallback', () => {
  const { system, s, install } = fixture()
  try {
    const a = install(-178920, -162120, 2)
    install(-178080, -162120, 2)
    s.drainBuildQueue(); a.fadingOut = true
    const heights = [...a.heights]
    install(-178080, -162120, 1)
    expect(s.seamKeys.has(a.key)).toBe(true)
    s.drainBuildQueue()
    expect(a.terrainMesh.geometry.getAttribute('position').count).toBeGreaterThan(a.seamBaseVertices)
    expect([...a.heights]).toEqual(heights)
    expect(s.maxUploadsPerFrame).toBe(1)
  } finally { system.dispose() }
})

it('holds new presentation for queued bank uploads without delaying contact or increasing the upload cap', () => {
  const { system, s, install } = fixture()
  try {
    const a = install(-178920, -162120, 2), b = install(-178080, -162120, 1)
    b.alpha = 0; b.fadeAge = 0; b.root.visible = false
    const contact = system.sampleMeshHeight(b.originX + 100, b.originZ + 100)
    expect(contact).not.toBeNull()
    expect(s.seamKeys.has(a.key)).toBe(true)
    s.updateFades(0, 0, .1)
    expect(b.fadeAge).toBe(0); expect(b.alpha).toBe(0); expect(b.root.visible).toBe(false)
    expect(system.sampleMeshHeight(b.originX + 100, b.originZ + 100)).toBe(contact)
    s.drainBuildQueue(); s.updateFades(0, 0, .1)
    expect(b.fadeAge).toBe(.1); expect(b.alpha).toBeGreaterThan(0); expect(b.root.visible).toBe(true)
    expect(system.sampleMeshHeight(b.originX + 100, b.originZ + 100)).toBe(contact)
    expect(s.maxUploadsPerFrame).toBe(1)
  } finally { system.dispose() }
})

it.each([
  { seed: 73, jobs: [[15120, -16800, 2, 4], [16800, -15960, 1, 2]], x: 16800, z: -15225 },
  { seed: 1337, jobs: [[21840, 18480, 2, 4], [23520, 18480, 1, 2]], x: 23520, z: 18690 },
  { seed: 7, jobs: [[-11760, 8400, 2, 4], [-10080, 9240, 1, 2]], x: -10080, z: 9345 },
  { seed: 31415, jobs: [[-8400, -3360, 2, 4], [-6720, -2520, 1, 2]], x: -6720, z: -1995 },
])('retains common near-water edge lighting in added coastal seed $seed', ({ seed, jobs, x, z }) => {
  setWorldSeed(seed); clearOpsPad()
  const values = jobs.map(job => {
    const data = generateTerrainGeometry(job[0]!, job[1]!, job[2]! as TerrainLod, job[3]!)
    const step = 420 * job[3]! / data.segs
    const ix = (x - job[0]!) / step, iz = (z - job[1]!) / step
    expect(ix).toBeCloseTo(Math.round(ix), 7); expect(iz).toBeCloseTo(Math.round(iz), 7)
    const i = Math.round(iz) * (data.segs + 1) + Math.round(ix)
    expect(data.heights[i]!).toBeLessThanOrEqual(data.waterLevels[i]! + 2)
    return ['normal', 'color'].map(name => Array.from(data.ground.attributes[name]!.array.slice(i * 3, i * 3 + 3)))
  })
  expect(values[0]).toEqual(values[1])
})


it('publishes queued banks ahead of a continuing ready-result stream within one upload', () => {
  const { system, s, install } = fixture()
  try {
    const coarse = install(-178920, -162120, 2)
    install(-178080, -162120, 1)
    const internal = s as any
    const key = '100,100:2'
    internal.desiredTiles.set(key, { cx: 100, cz: 100, size: 2, dist: 20 })
    internal.ready.push({ job: { cx: 100, cz: 100, size: 2, lod: 2, generation: internal.generation },
      data: generateTerrainGeometry(42000, 42000, 2, 2) })
    expect(s.seamKeys.has(coarse.key)).toBe(true)
    s.drainBuildQueue()
    expect(s.seamKeys.has(coarse.key)).toBe(false)
    expect(internal.ready).toHaveLength(1)
    expect(internal.chunks.has(key)).toBe(false)
    expect(coarse.terrainMesh.geometry.getAttribute('position').count).toBeGreaterThan(coarse.seamBaseVertices)
  } finally { system.dispose() }
})
