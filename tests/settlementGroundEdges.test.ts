import { describe, expect, it } from 'vitest'
import { settlementGroundPatch } from '../src/world/SettlementGround'

const flat = () => ({ height: 100, waterLevel: 0 })

describe('settlement ground patch edges', () => {
  it('rejects a zero-size space', () => {
    const space = { x: 0, z: 0, width: 0, depth: 64, yaw: 0, use: 'park' as const, color: 0x65754e }
    expect(settlementGroundPatch(space, 0, 0, 0, flat)).toBeNull()
    expect(settlementGroundPatch({ ...space, width: 64, depth: 0 }, 0, 0, 0, flat)).toBeNull()
  })

  it('rejects a non-finite space instead of sampling NaN ground', () => {
    const space = { x: 0, z: 0, width: Number.NaN, depth: 64, yaw: 0, use: 'park' as const, color: 0x65754e }
    expect(settlementGroundPatch(space, 0, 0, 0, flat)).toBeNull()
  })

  it('rejects a space too large for the vertex budget', () => {
    const space = { x: 0, z: 0, width: 100000, depth: 100000, yaw: 0, use: 'park' as const, color: 0x65754e }
    expect(settlementGroundPatch(space, 0, 0, 0, flat)).toBeNull()
  })

  it('draps a small field patch with a whole number of vertices', () => {
    const space = { x: 0, z: 0, width: 64, depth: 64, yaw: 0, use: 'field' as const, color: 0x65754e }
    const patch = settlementGroundPatch(space, 0, 0, 0, flat)
    expect(patch).not.toBeNull()
    expect(patch!.positions.length % 3).toBe(0)
    expect(patch!.positions.length).toBeGreaterThan(0)
    for (const y of patch!.positions.filter((_, i) => i % 3 === 1)) expect(y).toBeCloseTo(100.12, 8)
  })
})
