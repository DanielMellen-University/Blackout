import { Object3D, Scene } from 'three'
import { clearOpsPad, setOpsPad } from '../src/world/terrainSample'
import { describe, expect, it, vi } from 'vitest'
import type { SettlementPlan } from '../src/world/SettlementPlan'

const mockAnchorState = { rejectPrimary: false }
const settlementCallCount = { value: 0 }

vi.mock('../src/world/SettlementPlan', () => ({
  SETTLEMENT_CELL_SIZE: 24000,
  settlementForCell: (cx: number, cz: number, forcedAnchor?: 'city' | 'village') => {
    settlementCallCount.value++
    if (Math.abs(cx) > 1 || Math.abs(cz) > 1) return null
    if (mockAnchorState.rejectPrimary && ((cx === 1 && cz === 0) || (cx === 0 && cz === 1))) return null
    const plan = planFor(cx, cz)
    if (forcedAnchor) { plan.kind = forcedAnchor; plan.anchor = forcedAnchor }
    if (cx === 1 && cz === 0) { plan.x = 3000; plan.z = 0 }
    if (cx === 0 && cz === 1) { plan.x = -3000; plan.z = 0 }
    return plan
  },
  settlementAnchorForCell: (cx: number, cz: number) => cx === 1 && cz === 0 ? 'city' : cx === 0 && cz === 1 ? 'village' : null,
  settlementAnchorCells: (kind: 'city' | 'village') => kind === 'city'
    ? [[1, 0], [0, -1]] : [[0, 1], [-1, 0]],
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
  it('reuses the last valid focus when stream coordinates are malformed', () => {
    const system = new SettlementSystem(new Scene())
    const internal = system as unknown as { focusX: number; focusZ: number }
    try {
      expect(() => system.update(Number.NaN, Number.POSITIVE_INFINITY)).not.toThrow()
      expect(internal.focusX).toBe(0)
      expect(internal.focusZ).toBe(0)

      system.update(3000, 3000)
      system.update(Number.NEGATIVE_INFINITY, Number.NaN)
      expect(internal.focusX).toBe(3000)
      expect(internal.focusZ).toBe(3000)
      expect((system as unknown as { lastCellX: number }).lastCellX).toBe(3)
      expect((system as unknown as { lastCellZ: number }).lastCellZ).toBe(3)
    } finally {
      system.dispose()
    }
  })

  it('applies a bounded detail radius without touching loaded landmarks', () => {
    const system = new SettlementSystem(new Scene())
    try {
      system.setDetailRadius(2800)
      expect((system as unknown as { detailRadius: number }).detailRadius).toBe(2800)
      system.setDetailRadius(Number.NaN)
      expect((system as unknown as { detailRadius: number }).detailRadius).toBe(4200)
      system.setDetailRadius(10_000)
      expect((system as unknown as { detailRadius: number }).detailRadius).toBe(6000)
      system.setRoadDetailRadius(12_000)
      expect((system as unknown as { roadDetailRadius: number }).roadDetailRadius).toBe(12_000)
      system.setRoadDetailRadius(Number.NaN)
      expect((system as unknown as { roadDetailRadius: number }).roadDetailRadius).toBe(18_120)
      system.setRoadDetailRadius(100_000)
      expect((system as unknown as { roadDetailRadius: number }).roadDetailRadius).toBe(23_120)
    } finally {
      system.dispose()
    }
  })

  it('keeps radar landmark range checks squared and malformed-safe', () => {
    const system = new SettlementSystem(new Scene())
    const internals = system as unknown as { loadedCollisionPlans: SettlementPlan[] }
    try {
      const near = planFor(0, 0)
      near.x = 300
      near.z = 400
      const far = planFor(0, 1)
      far.x = 2_000
      far.z = 0
      internals.loadedCollisionPlans.push(near, far)
      expect(system.getRadarLandmarks(0, 0, 500).map(landmark => landmark.id)).toEqual([near.id])
      expect(system.getRadarLandmarks(0, 0, Number.NaN)).toHaveLength(0)
      expect(system.getRadarLandmarks(Number.POSITIVE_INFINITY, 0, 1_000).map(landmark => landmark.id)).toEqual([near.id])
    } finally {
      system.dispose()
    }
  })

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

  it('keeps the bounded collision-plan view ordered when a loaded plan is removed', () => {
    const system = new SettlementSystem(new Scene())
    const internals = system as unknown as {
      loaded: Map<string, { plan: SettlementPlan; root: Object3D }>
      loadedCollisionPlans: SettlementPlan[]
      remove: (settlement: { plan: SettlementPlan; root: Object3D }) => void
      deleteLoaded: (key: string) => void
    }
    try {
      for (let frame = 0; frame < 24; frame++) system.update(0, 0)
      const entries = [...internals.loaded.entries()]
      expect(entries.length).toBeGreaterThanOrEqual(3)
      const target = entries[Math.floor(entries.length / 2)]
      if (!target) return
      const before = [...internals.loadedCollisionPlans]
      internals.remove(target[1])
      internals.deleteLoaded(target[0])
      expect(internals.loadedCollisionPlans).toEqual(before.filter(plan => plan !== target[1].plan))
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

  it('ranks admission and eviction with squared distances', () => {
    const system = new SettlementSystem(new Scene())
    const originalHypot = Math.hypot
    let hypotCalls = 0
    try {
      for (let frame = 0; frame < 24; frame++) system.update(0, 0)
      const loaded = (system as unknown as { loaded: Map<string, { plan: SettlementPlan }> }).loaded
      expect(loaded.size).toBe(MAX_LOADED_SETTLEMENTS)
      const canLoad = (system as unknown as { canLoad(plan: SettlementPlan, x: number, z: number): boolean }).canLoad
      Math.hypot = ((...values: number[]) => {
        hypotCalls++
        return originalHypot(...values)
      }) as typeof Math.hypot
      // Beyond the fog envelope, and farther than every loaded root, both
      // reject exactly as before without a root per candidate or loaded plan.
      expect(canLoad.call(system, planFor(3, 3), 0, 0)).toBe(false)
      let farthest = 0
      for (const entry of loaded.values()) farthest = Math.max(farthest, entry.plan.x * entry.plan.x + entry.plan.z * entry.plan.z)
      const outer = planFor(0, 0)
      outer.id = 'outer-village'
      outer.x = Math.sqrt(farthest) + 50
      outer.z = 0
      expect(canLoad.call(system, outer, 0, 0)).toBe(false)
      expect(loaded.size).toBe(MAX_LOADED_SETTLEMENTS)
      expect(hypotCalls).toBe(0)
    } finally {
      Math.hypot = originalHypot
      system.dispose()
    }
  })

  it('does not load a cell-edge plan whose actual buildings are beyond the fog envelope', () => {
    const system = new SettlementSystem(new Scene())
    try {
      const canLoad = (system as unknown as { canLoad(plan: SettlementPlan, x: number, z: number): boolean }).canLoad
      const distant = planFor(3, 3)
      expect(canLoad.call(system, distant, 0, 0)).toBe(false)
    } finally {
      system.dispose()
    }
  })

  it('primes protected city and village anchors before ordinary streaming', () => {
    const system = new SettlementSystem(new Scene())
    try {
      setOpsPad(0, 0, 100)
      ;(system as unknown as { primeAnchors(x: number, z: number): void }).primeAnchors(0, 0)
      expect(system.count).toBe(2)
      expect(system.buildingCount).toBe(2)
    } finally {
      system.dispose()
      clearOpsPad()
    }
  })

  it('retries an anchor rejected by a temporarily full budget', () => {
    const system = new SettlementSystem(new Scene())
    const internals = system as unknown as {
      canLoad: (plan: SettlementPlan, x: number, z: number) => boolean
      checked: Set<string>
      loaded: Map<string, { plan: SettlementPlan }>
      primeAnchors: (x: number, z: number) => void
    }
    const originalCanLoad = internals.canLoad.bind(system)
    internals.canLoad = () => false
    try {
      setOpsPad(0, 0, 100)
      internals.primeAnchors(0, 0)
      expect(system.count).toBe(0)
      expect(internals.checked.size).toBe(0)

      // Restore the real admission check once the ordinary budget clears.
      internals.canLoad = originalCanLoad
      for (let frame = 0; frame < 30; frame++) system.update(0, 0)
      expect(internals.loaded.has('1,0')).toBe(true)
      expect(internals.loaded.has('0,1')).toBe(true)
    } finally {
      system.dispose()
      clearOpsPad()
    }
  })

  it('throttles protected retries while the instance budget stays full', () => {
    const system = new SettlementSystem(new Scene())
    const internals = system as unknown as {
      canLoad: (plan: SettlementPlan, x: number, z: number) => boolean
      primeAnchors: (x: number, z: number) => void
      retryProtectedAnchors: (x: number, z: number) => void
      protectedRetryCooldown: number
    }
    internals.canLoad = () => false
    try {
      setOpsPad(0, 0, 100)
      internals.primeAnchors(0, 0)
      settlementCallCount.value = 0
      internals.retryProtectedAnchors(0, 0)
      const callsAfterRetry = settlementCallCount.value
      expect(callsAfterRetry).toBeGreaterThan(0)
      expect(internals.protectedRetryCooldown).toBeGreaterThan(0)

      // A second retry in the same window should be a no-op instead of
      // rebuilding both deterministic plans and filtering the queue again.
      internals.retryProtectedAnchors(0, 0)
      expect(settlementCallCount.value).toBe(callsAfterRetry)
    } finally {
      system.dispose()
      clearOpsPad()
    }
  })

  it('moves a rejected protected anchor to a deterministic fallback cell', () => {
    const system = new SettlementSystem(new Scene())
    try {
      mockAnchorState.rejectPrimary = true
      setOpsPad(0, 0, 100)
      ;(system as unknown as { primeAnchors(x: number, z: number): void }).primeAnchors(0, 0)
      const loaded = (system as unknown as { loaded: Map<string, { plan: SettlementPlan }> }).loaded
      expect(loaded.has('0,-1')).toBe(true)
      expect(loaded.has('-1,0')).toBe(true)
      expect([...loaded.values()].map(({ plan }) => plan.anchor)).toEqual(expect.arrayContaining(['city', 'village']))
    } finally {
      mockAnchorState.rejectPrimary = false
      system.dispose()
      clearOpsPad()
    }
  })

  it('restores fallback anchors with their protected tier after a stream reset', () => {
    const system = new SettlementSystem(new Scene())
    try {
      mockAnchorState.rejectPrimary = true
      setOpsPad(0, 0, 100)
      ;(system as unknown as { primeAnchors(x: number, z: number): void }).primeAnchors(0, 0)
      ;(system as unknown as { update(x: number, z: number): void }).update(100000, 100000)
      ;(system as unknown as { update(x: number, z: number): void }).update(0, 0)
      const loaded = (system as unknown as { loaded: Map<string, { plan: SettlementPlan }> }).loaded
      expect([...loaded.values()].map(({ plan }) => plan.anchor)).toEqual(expect.arrayContaining(['city', 'village']))
    } finally {
      mockAnchorState.rejectPrimary = false
      system.dispose()
      clearOpsPad()
    }
  })
})
