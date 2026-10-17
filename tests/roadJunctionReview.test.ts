import { afterEach, expect, it, vi } from 'vitest'
import { Mesh, Scene } from 'three'
import { SettlementSystem } from '../src/world/SettlementSystem'
import { groundRoad } from '../src/world/RoadSurface'
import type { SettlementPlan, SettlementRoad } from '../src/world/SettlementPlan'
import * as terrain from '../src/world/terrainSample'
import { SurfaceDraper } from '../src/world/SurfaceDraper'

afterEach(() => vi.restoreAllMocks())

it('inspects only junctions whose exact source street plan is loaded and clears them on reseed', () => {
  const base = terrain.sampleClimate(0, 0)
  vi.spyOn(terrain, 'sampleClimate').mockImplementation((_x, _z, out) => {
    const sample = Object.assign(out ?? { ...base }, base)
    sample.height = 20; sample.waterLevel = 0
    return sample
  })
  const road = groundRoad([{ x: -250, z: 0 }, { x: 250, z: 0 }], 10, () => ({ height: 20, waterLevel: 0 }))!
  const a: SettlementPlan = { id: 'a', kind: 'village', biome: 'plains', x: -250, y: 20, z: 0,
    radius: 1000, buildings: [], roads: [groundRoad([{ x: -300, z: 0 }, { x: -250, z: 0 }], 6,
      () => ({ height: 20, waterLevel: 0 }))!] }
  const b: SettlementPlan = { ...a, id: 'b', x: 250, roads: [] }
  const system = new SettlementSystem(new Scene())
  const internal = system as unknown as {
    connections: Map<string, unknown>; loadedCollisionPlans: SettlementPlan[]
    loaded: Map<string, unknown>; build(plan: SettlementPlan): unknown
    buildRegionalRoad(road: SettlementRoad, a: SettlementPlan, b: SettlementPlan): unknown
  }
  try {
    internal.connections.set('a|b', internal.buildRegionalRoad(road, a, b))
    expect(system.nearestRoadJoinView(0, 0)).toBeNull()
    expect(system.nearestRoadReview(0, 0)).toEqual({ key: 'a|b', road })
    internal.loadedCollisionPlans.push({ ...a, x: -500 })
    expect(system.nearestRoadJoinView(0, 0)).toBeNull()
    internal.loadedCollisionPlans.push(a)
    internal.loaded.set(a.id, internal.build(a))
    const view = system.nearestRoadJoinView(0, 0)!
    expect(view.x).toBe(-250); expect(view.z).toBe(0)
    expect(view.y).toBeCloseTo(20.45); expect(view.dx).toBeCloseTo(1)
    expect(view.id).toBe('a|b')
    expect(view.localY).toBeCloseTo(20.45)
    expect(view.roadY).toBeCloseTo(20.45)
    expect(view.shoulderY).toBeCloseTo(20.3)
    const asphalt = system.root.getObjectByName('RegionalRoadAsphalt') as Mesh
    const positions = asphalt.geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i++) positions.setY(i, positions.getY(i) + 2)
    expect(system.nearestRoadJoinView(0, 0)!.roadY).toBeCloseTo(22.45)
    system.clearAll()
    expect(system.nearestRoadJoinView(0, 0)).toBeNull()
    expect(system.nearestRoadReview(0, 0)).toBeNull()
  } finally { system.dispose() }
})

it('retains raised ground centres between the road edges instead of cutting through a crest', () => {
  const road: SettlementRoad = { width: 10, points: [0, 24].map(x => ({ x, y: 102.45, z: 0,
    leftX: x, leftY: 100.45, leftZ: 5, rightX: x, rightY: 100.45, rightZ: -5, structure: 'ground' as const })) }
  const scene = new Scene(), system = new SettlementSystem(scene)
  try {
    const plan: SettlementPlan = { id: 'crest', kind: 'village', biome: 'plains', x: 0, y: 100, z: 0,
      radius: 1000, buildings: [], roads: [road] }
    ;(system as unknown as { build(plan: SettlementPlan): unknown }).build(plan)
    const geometry = (scene.getObjectByName('SettlementRoads') as Mesh).geometry
    const positions = geometry.getAttribute('position')
    expect(positions.count).toBe(6)
    expect(geometry.getIndex()!.count).toBe(12)
    const unique = new Set<string>()
    for (let i = 0; i < positions.count; i++) unique.add(`${positions.getX(i)},${positions.getZ(i)}`)
    expect(unique.size).toBe(positions.count)
    let centres = 0
    for (let i = 0; i < positions.count; i++) if (positions.getZ(i) === 0) {
      expect(positions.getY(i)).toBeCloseTo(2.45); centres++
    }
    expect(centres).toBeGreaterThan(0)
  } finally { system.dispose() }
})

it('fills the asphalt join without laying a gravel cap across the incoming lane', () => {
  const base = terrain.sampleClimate(0, 0)
  vi.spyOn(terrain, 'sampleClimate').mockImplementation((_x, _z, out) => {
    const sample = Object.assign(out ?? { ...base }, base)
    sample.height = 100; sample.waterLevel = 0
    return sample
  })
  const road = groundRoad([{ x: 0, z: 0 }, { x: 100, z: 0 }], 10, () => ({ height: 100 }))!
  const scene = new Scene(), system = new SettlementSystem(scene)
  const a: SettlementPlan = { id: 'a', kind: 'village', biome: 'plains', x: 0, y: 100, z: 0,
    radius: 1000, buildings: [], roads: [road] }
  try {
    ;(system as unknown as { buildRegionalRoad(road: SettlementRoad, a: SettlementPlan, b: SettlementPlan): unknown })
      .buildRegionalRoad(road, a, { ...a, id: 'b', x: 100 })
    const shoulder = scene.getObjectByName('RegionalRoadShoulder') as Mesh
    const asphalt = scene.getObjectByName('RegionalRoadAsphalt') as Mesh
    const ribbonVertices = road.points.length * 3
    expect(shoulder.geometry.getAttribute('position').count).toBe(ribbonVertices)
    expect(asphalt.geometry.getAttribute('position').count).toBe(ribbonVertices + 24)
    expect(asphalt.geometry.getIndex()!.count).toBe((road.points.length - 1) * 12 + 72)
  } finally { system.dispose() }
})

it('shares junction centres across street strips and refits each physical vertex once', () => {
  const roads = [
    groundRoad([{ x: -24, z: 0 }, { x: 0, z: 0 }, { x: 24, z: 0 }], 10, () => ({ height: 100 }))!,
    groundRoad([{ x: 0, z: -24 }, { x: 0, z: 0 }, { x: 0, z: 24 }], 10, () => ({ height: 100 }))!,
  ]
  const scene = new Scene(), system = new SettlementSystem(scene)
  try {
    const plan: SettlementPlan = { id: 'shared', kind: 'village', biome: 'plains', x: 0, y: 100, z: 0,
      radius: 1000, buildings: [], roads }
    ;(system as unknown as { build(plan: SettlementPlan): unknown }).build(plan)
    const geometry = (scene.getObjectByName('SettlementRoads') as Mesh).geometry
    const positions = geometry.getAttribute('position'), indices = geometry.getIndex()!
    expect(positions.count).toBe(17)
    expect(indices.count).toBe(48)
    const shared: number[] = []
    for (let i = 0; i < positions.count; i++) if (positions.getX(i) === 0 && positions.getZ(i) === 0) shared.push(i)
    expect(shared).toHaveLength(1)
    const sample = vi.fn((x: number, z: number) => 100 + x * .01 + z * .02)
    const draper = new SurfaceDraper(sample, () => 1)
    draper.add(geometry, 0, 100, 0)
    expect(draper.update()).toBe(17)
    expect(sample).toHaveBeenCalledTimes(17)
    expect(positions.getY(shared[0]!)).toBeCloseTo(.45)
    draper.clear()
  } finally { system.dispose() }
})

it('keeps long-road vertex/refit work below the previous edge-only ribbon despite retaining the centreline', () => {
  const base = terrain.sampleClimate(0, 0)
  vi.spyOn(terrain, 'sampleClimate').mockImplementation((_x, _z, out) => {
    const sample = Object.assign(out ?? { ...base }, base)
    sample.height = 100; sample.waterLevel = 0
    return sample
  })
  const road = groundRoad([{ x: 0, z: 0 }, { x: 24_000, z: 0 }], 10, () => ({ height: 100 }))!
  const scene = new Scene(), system = new SettlementSystem(scene)
  const a: SettlementPlan = { id: 'a', kind: 'village', biome: 'plains', x: 0, y: 100, z: 0,
    radius: 1000, buildings: [], roads: [road] }
  try {
    ;(system as unknown as { buildRegionalRoad(road: SettlementRoad, a: SettlementPlan, b: SettlementPlan): unknown })
      .buildRegionalRoad(road, a, { ...a, id: 'b', x: 24_000 })
    const geometry = (scene.getObjectByName('RegionalRoadAsphalt') as Mesh).geometry
    const positions = geometry.getAttribute('position')
    expect(positions.count).toBe(3027)
    expect(positions.count).toBeLessThan((road.points.length - 1) * 6)
    expect(geometry.getIndex()!.count).toBe(12072)
    const sample = vi.fn(() => 200), draper = new SurfaceDraper(sample, () => 1)
    draper.add(geometry, 12_000, 0, 0)
    for (let i = 0; i < 100 && positions.getY(0) < 150; i++) draper.update()
    expect(positions.getY(0)).toBeCloseTo(200.45)
    expect(sample).toHaveBeenCalledTimes(positions.count)
    draper.clear()
  } finally { system.dispose() }
})
