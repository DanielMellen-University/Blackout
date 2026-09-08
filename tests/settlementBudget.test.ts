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
})
