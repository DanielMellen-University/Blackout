import { Group, InstancedMesh, Mesh, PerspectiveCamera, Scene } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettlementSystem } from '../src/world/SettlementSystem'
import type { SettlementPlan, SettlementRoad } from '../src/world/SettlementPlan'
import type { RegionalRoadEndpoint } from '../src/world/RegionalRoads'

vi.mock('../src/world/SettlementPlan', async importOriginal => ({
  ...await importOriginal<object>(), settlementForCell: () => null,
}))

function plan(): SettlementPlan {
  return { id: 'assembly', kind: 'village', biome: 'plains', x: 3000, y: 100, z: 3000, radius: 300,
    ground: [{ use: 'park', color: 0x65754e, positions: [2990, 100.12, 3010, 2990, 101.12, 3030, 3010, 100.62, 3010] }],
    buildings: Array.from({ length: 80 }, (_, i) => ({ x: 2900 + i * 3, y: 100, z: 2900,
      width: 12, depth: 24, height: 15, yaw: .4, shape: 'block', roof: 'pitched', wallColor: 0xc5c3b3, roofColor: 0x8b5343 })),
    roads: [{ width: 12, points: Array.from({ length: 300 }, (_, i) => ({ x: 2800 + i * 2, y: 100, z: 3000 })) }] }
}
type Internals = {
  build(plan: SettlementPlan): { root: Group }
  buildSteps(plan: SettlementPlan): Generator<void, { root: Group }>
  buildRegionalRoad(road: SettlementRoad, a: RegionalRoadEndpoint, b: RegionalRoadEndpoint): { root: Group }
  buildRegionalRoadSteps(road: SettlementRoad, a: RegionalRoadEndpoint, b: RegionalRoadEndpoint): Generator<void, { root: Group }>
  root: Group; checked: Set<string>; ready: { key: string; plan: SettlementPlan }[]
  assembly: { steps: Generator<void, unknown> } | null
  draper: { surfaces: unknown[] }
}
const internals = (system: SettlementSystem) => system as unknown as Internals
function snapshot(root: Group) {
  const result: unknown[] = []
  root.traverse(object => {
    if (!(object instanceof Mesh)) return
    result.push({ name: object.name, position: object.position.toArray(), scale: object.scale.toArray(),
      attributes: Object.fromEntries(Object.entries(object.geometry.attributes).map(([key, attr]) => [key, Array.from(attr.array)])),
      index: object.geometry.index ? Array.from(object.geometry.index.array) : null,
      matrices: object instanceof InstancedMesh ? Array.from(object.instanceMatrix.array) : null,
      colors: object instanceof InstancedMesh && object.instanceColor ? Array.from(object.instanceColor.array) : null })
  })
  return result
}
function finish<T>(steps: Generator<void, T>): T {
  let result = steps.next(), count = 1
  while (!result.done && count++ < 10000) result = steps.next()
  if (!result.done) throw new Error('Assembly failed to finish')
  expect(count).toBeGreaterThan(10)
  return result.value
}
afterEach(() => vi.restoreAllMocks())

describe('cooperative settlement attachment', () => {
  it('prepares real shader variants before flight and releases only fixture-owned resources', async () => {
    const scene = new Scene(), system = new SettlementSystem(scene)
    const ownedDisposals: ReturnType<typeof vi.fn>[] = [], sharedDisposals: ReturnType<typeof vi.spyOn>[] = []
    const compileAsync = vi.fn(async (fixtures: Group) => {
      expect(scene.children).not.toContain(fixtures)
      const colors = fixtures.children.filter(object => object instanceof InstancedMesh && object.instanceColor)
      expect(colors.length).toBeGreaterThan(0)
      const materialSet = new Set()
      fixtures.traverse(object => {
        if (!(object instanceof Mesh)) return
        materialSet.add(object.material)
        if (object instanceof InstancedMesh) {
          const dispose = vi.fn(); object.addEventListener('dispose', dispose); ownedDisposals.push(dispose)
        }
        if (object.geometry.getAttribute('color')) {
          const dispose = vi.fn(); object.geometry.addEventListener('dispose', dispose); ownedDisposals.push(dispose)
        } else sharedDisposals.push(vi.spyOn(object.geometry, 'dispose'))
      })
      expect(materialSet.size).toBeGreaterThan(10)
      return fixtures
    })
    try {
      const gl = { isContextLost: () => false, fenceSync: () => ({}), flush: vi.fn(),
        clientWaitSync: () => 1, deleteSync: vi.fn(), TIMEOUT_EXPIRED: 0 } as unknown as WebGL2RenderingContext
      await system.warmupMaterials({ compileAsync, render: vi.fn(), getContext: () => gl }, new PerspectiveCamera(), scene)
      expect(compileAsync).toHaveBeenCalledOnce()
      for (const dispose of ownedDisposals) expect(dispose).toHaveBeenCalledOnce()
      for (const dispose of sharedDisposals) expect(dispose).not.toHaveBeenCalled()
    } finally { vi.restoreAllMocks(); system.dispose() }
  })

  it('publishes exactly the synchronous geometry and collision after private preparation', () => {
    const a = new SettlementSystem(new Scene()), b = new SettlementSystem(new Scene())
    try {
      const expected = internals(a).build(plan())
      const steps = internals(b).buildSteps(plan())
      expect(steps.next().done).toBe(false)
      expect(internals(b).root.children).toHaveLength(0)
      expect(b.hitObstacle(3000, 105, 2900)).toBe(false)
      const actual = finish(steps)
      expect(snapshot(actual.root)).toEqual(snapshot(expected.root))
      expect(internals(b).root.children).toEqual([actual.root])
    } finally { a.dispose(); b.dispose() }
  })

  it('keeps regional geometry and all bridge collision parts through yielded preparation', () => {
    const a = new SettlementSystem(new Scene()), b = new SettlementSystem(new Scene())
    const p = plan(), from = { id: 'a', x: 2800, z: 3000, biome: 'plains' } as RegionalRoadEndpoint
    const to = { ...from, id: 'b', x: 3400 }
    const road: SettlementRoad = { width: 12, points: p.roads[0]!.points.map((point, i) => ({ ...point,
      y: i > 100 && i < 200 ? 115 : 100, groundY: 95,
      structure: i > 100 && i < 200 ? 'viaduct' : 'ground', bridge: i > 100 && i < 200 })) }
    try {
      const expected = internals(a).buildRegionalRoad(road, from, to)
      const steps = internals(b).buildRegionalRoadSteps(road, from, to)
      expect(steps.next().done).toBe(false)
      expect(internals(b).root.children).toHaveLength(0)
      const actual = finish(steps)
      expect(snapshot(actual.root)).toEqual(snapshot(expected.root))
      expect(b.hitObstacle(3100, 114, 3000)).toBe(a.hitObstacle(3100, 114, 3000))
      expect(b.hitObstacle(3100, 114, 3000)).toBe(true)
    } finally { a.dispose(); b.dispose() }
  })

  it('uses separate frames and cancels departed work without publishing or retaining drape buffers', () => {
    const system = new SettlementSystem(new Scene(), () => 100), s = internals(system)
    try {
      system.update(3000, 3000, 0)
      s.checked.add('0,0'); s.ready.push({ key: '0,0', plan: plan() })
      let clock = 0
      vi.spyOn(performance, 'now').mockImplementation(() => clock += 3)
      for (let i = 0; i < 20; i++) system.update(3000, 3000, 0)
      expect(s.assembly).not.toBeNull()
      expect(system.count).toBe(0)
      expect(s.root.children).toHaveLength(0)
      system.update(1000000, 1000000, 0)
      expect(s.assembly).toBeNull()
      expect(system.count).toBe(0)
      expect(s.draper.surfaces).toHaveLength(0)
    } finally { system.dispose() }
  })

  it('commits a staged root once, with collision, and clears an in-progress build on reset', () => {
    const system = new SettlementSystem(new Scene(), () => 100), s = internals(system)
    try {
      system.update(3000, 3000, 0)
      s.checked.add('0,0'); s.ready.push({ key: '0,0', plan: plan() })
      let clock = 0
      vi.spyOn(performance, 'now').mockImplementation(() => clock += 3)
      system.update(3000, 3000, 0)
      expect(system.count).toBe(0)
      for (let i = 0; i < 200; i++) system.update(3000, 3000, 0)
      expect(system.count).toBe(1)
      expect(system.hitObstacle(3000, 105, 2900)).toBe(true)
      expect(s.root.children).toHaveLength(1)
      system.clearAll()
      expect(s.root.children).toHaveLength(0)
      s.checked.add('0,0'); s.ready.push({ key: '0,0', plan: plan() })
      system.update(3000, 3000, 0); expect(s.assembly).not.toBeNull()
      system.clearAll(); expect(s.assembly).toBeNull()
      expect(s.draper.surfaces).toHaveLength(0)
    } finally { system.dispose() }
  })
})
