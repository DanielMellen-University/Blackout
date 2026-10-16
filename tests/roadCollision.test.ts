import { describe, expect, it } from 'vitest'
import { Scene } from 'three'
import { groundRoad } from '../src/world/RoadSurface'
import { hitsSettlement, roadObstacleBuildings, SettlementSystem } from '../src/world/SettlementSystem'
import type { SettlementPlan } from '../src/world/SettlementPlan'

const road = groundRoad([{ x: -250, z: 0 }, { x: 250, z: 0 }], 10,
  x => ({ height: Math.abs(x) < 70 ? -10 : 2, waterLevel: 0 }))!
const plan: SettlementPlan = { id: 'bridge', kind: 'village', biome: 'plains', x: 0, y: 2, z: 0,
  radius: 1000, buildings: [], roads: [road] }

describe('shared bridge obstacles', () => {
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
