import { Scene } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { SettlementPlan } from '../src/world/SettlementPlan'

vi.mock('../src/world/SettlementPlan', () => ({
  SETTLEMENT_CELL_SIZE: 24000,
  settlementForCell: (cx: number, cz: number) => Math.abs(cx) <= 1 && Math.abs(cz) <= 1 ? planFor(cx, cz) : null,
}))

import { MAX_LOADED_BUILDINGS, MAX_LOADED_SETTLEMENTS, SettlementSystem } from '../src/world/SettlementSystem'

function planFor(cx: number, cz: number): SettlementPlan {
  const x = cx * 24000 + 12000, z = cz * 24000 + 12000
  return {
    id: `${cx},${cz}`,
    kind: 'village',
    biome: 'plains',
    x,
    y: 100,
    z,
    radius: 200,
    roads: [{ width: 20, points: [{ x: x - 80, y: 100, z }, { x: x + 80, y: 100, z }] }],
    buildings: [{
      x,
      y: 100,
      z,
      width: 80,
      depth: 80,
      height: 40,
      yaw: 0,
      shape: 'block',
      roof: 'pitched',
      wallColor: 0xc5c3b3,
      roofColor: 0x8b5343,
    }],
  }
}

describe('settlement streaming budgets', () => {
  it('caps nearby generated settlements before they allocate visible instance buffers', () => {
    const system = new SettlementSystem(new Scene())
    try {
      for (let frame = 0; frame < 24; frame++) system.update(0, 0)
      expect(system.count).toBe(MAX_LOADED_SETTLEMENTS)
      expect(system.buildingCount).toBeLessThanOrEqual(MAX_LOADED_BUILDINGS)
      for (let frame = 0; frame < 12; frame++) system.update(200000, 200000)
      expect(system.count).toBe(0)
      expect(system.buildingCount).toBe(0)
    } finally {
      system.dispose()
    }
  })

  it('evicts stale landmarks when a nearby plan would otherwise exceed instances', () => {
    const system = new SettlementSystem(new Scene())
    try {
      for (let frame = 0; frame < 24; frame++) system.update(0, 0)
      const loaded = (system as unknown as { loaded: Map<string, { plan: SettlementPlan }> }).loaded
      expect(loaded.size).toBe(MAX_LOADED_SETTLEMENTS)
      // Simulate several large villages already occupying the shared instance
      // budget, then offer a nearer city-sized plan. The loader should evict
      // only the farthest stale roots until both caps are satisfied.
      for (const entry of loaded.values()) entry.plan.buildings = Array.from({ length: 400 }, () => entry.plan.buildings[0]!)
      const candidate = planFor(0, 0)
      candidate.id = 'nearby-city'
      candidate.kind = 'city'
      candidate.x = 0
      candidate.z = 0
      candidate.buildings = Array.from({ length: 500 }, () => candidate.buildings[0]!)
      const canLoad = (system as unknown as { canLoad(plan: SettlementPlan, x: number, z: number): boolean }).canLoad
      expect(canLoad.call(system, candidate, 0, 0)).toBe(true)
      expect(system.count).toBeLessThan(MAX_LOADED_SETTLEMENTS)
      expect(system.buildingCount + candidate.buildings.length).toBeLessThanOrEqual(MAX_LOADED_BUILDINGS)
    } finally {
      system.dispose()
    }
  })
})
