import { describe, expect, it, vi } from 'vitest'
import { InstancedMesh, Mesh, Scene, type Group } from 'three'
import { SurfaceDraper } from '../src/world/SurfaceDraper'
import { groundRoad } from '../src/world/RoadSurface'
import { hitsSettlement, roadObstacleBuildings, SettlementSystem } from '../src/world/SettlementSystem'
import type { SettlementPlan } from '../src/world/SettlementPlan'

const road = groundRoad([{ x: -250, z: 0 }, { x: 250, z: 0 }], 10,
  x => ({ height: Math.abs(x) < 70 ? -10 : 2, waterLevel: 0 }))!
const plan: SettlementPlan = { id: 'bridge', kind: 'village', biome: 'plains', x: 0, y: 2, z: 0,
  radius: 1000, buildings: [], roads: [road] }

describe('shared bridge obstacles', () => {
  it('releases regional support instances on unload without disposing shared geometry', () => {
    const scene = new Scene(), system = new SettlementSystem(scene)
    type Road = { root: Group; collisionPlan: SettlementPlan }
    const internal = system as unknown as {
      connections: Map<string, Road>; roadCollisionPlans: SettlementPlan[]
      draper: SurfaceDraper
      buildRegionalRoad(road: typeof plan.roads[number], a: SettlementPlan, b: SettlementPlan): Road
      removeRoad(road: Road): void
    }
    internal.draper = new SurfaceDraper(() => 2, () => 0)
    const untrack = vi.spyOn(internal.draper, 'remove')
    try {
      const loaded = internal.buildRegionalRoad(road, { ...plan, id: 'a', x: -250 }, { ...plan, id: 'b', x: 250 })
      internal.connections.set('a|b', loaded)
      const piers = loaded.root.getObjectByName('RegionalBridgePiers') as InstancedMesh
      expect(piers).toBeInstanceOf(InstancedMesh)
      const releaseInstances = vi.spyOn(piers, 'dispose')
      const sharedGeometry = vi.spyOn(piers.geometry, 'dispose')
      const deck = loaded.root.getObjectByName('RegionalBridgeDeck') as Mesh
      const releaseDeck = vi.spyOn(deck.geometry, 'dispose')
      expect(internal.roadCollisionPlans).toContain(loaded.collisionPlan)
      internal.removeRoad(loaded); internal.connections.delete('a|b')
      expect(releaseInstances).toHaveBeenCalledTimes(1)
      expect(sharedGeometry).not.toHaveBeenCalled()
      expect(releaseDeck).toHaveBeenCalledTimes(1)
      expect(untrack).toHaveBeenCalledWith(deck.geometry)
      expect(internal.roadCollisionPlans).not.toContain(loaded.collisionPlan)
      expect(loaded.root.parent).toBeNull()
      system.clearAll(); system.dispose()
      expect(releaseInstances).toHaveBeenCalledTimes(1)
      expect(releaseDeck).toHaveBeenCalledTimes(1)
      expect(sharedGeometry).toHaveBeenCalledTimes(1)
    } finally { system.dispose(); vi.restoreAllMocks() }
  })

  it('keeps clear space below the deck while colliding with decks and piers', () => {
    const deck = road.points.find(p => p.bridge)!
    expect(roadObstacleBuildings([road]).length).toBeGreaterThan(1)
    expect(hitsSettlement(plan, 0, deck.y - .5, 0)).toBe(true)
    expect(hitsSettlement(plan, 0, deck.y + 15, 0)).toBe(false)
    expect(hitsSettlement(plan, 0, deck.y - 4, 3)).toBe(false)
    expect(hitsSettlement(plan, deck.x, deck.y - 4, deck.z)).toBe(true)
  })

  it('renders local bridges and catches high-speed sweeps across regional bridge volumes', () => {
    const scene = new Scene(), system = new SettlementSystem(scene)
    const internal = system as unknown as {
      build(plan: SettlementPlan): unknown
      buildRegionalRoad(road: typeof plan.roads[number], a: SettlementPlan, b: SettlementPlan): unknown
    }
    try {
      internal.build(plan)
      expect(scene.getObjectByName('SettlementBridgeDecks')).toBeDefined()
      expect(scene.getObjectByName('SettlementBridgePiers')).toBeDefined()
      const a = { ...plan, id: 'a', x: -250, roads: [] }, b = { ...plan, id: 'b', x: 250, roads: [] }
      internal.buildRegionalRoad(road, a, b)
      expect(system.segmentHitsObstacle({ x: 0, y: 6.5, z: -100 }, { x: 0, y: 6.5, z: 100 })).toBe(true)
      expect(system.segmentHitsObstacle({ x: 0, y: 30, z: -100 }, { x: 0, y: 30, z: 100 })).toBe(false)
      expect(system.segmentMayHitObstacle({ x: 0, z: -100 }, { x: 0, z: 100 })).toBe(true)
      expect(system.hitObstacle(0, 6.5, 0)).toBe(true)
    } finally { system.dispose() }
  })
})
