import { describe, expect, it } from 'vitest'
import { settlementLayout } from '../src/world/SettlementLayout'
import { settlementGroundPatch } from '../src/world/SettlementGround'
import { hitsSettlement, SettlementSystem } from '../src/world/SettlementSystem'
import type { SettlementPlan } from '../src/world/SettlementPlan'
import { Scene } from 'three'

const plan: SettlementPlan = { id: 'layout', kind: 'village', biome: 'plains', x: 0, y: 100, z: 0,
  radius: 3000, buildings: [], roads: [] }
const rand = (n: number) => ((Math.sin(n * 7.137) * 43758.5453) % 1 + 1) % 1

describe('road-led settlement places', () => {
  it('is deterministic, keeps rural clusters compact and proposes country services and farmland', () => {
    const layout = settlementLayout(plan, rand)
    expect(layout).toEqual(settlementLayout(plan, rand))
    expect(layout.lots.some(lot => lot.use === 'barn')).toBe(true)
    expect(layout.spaces.some(space => space.use === 'field')).toBe(true)
    expect(layout.spaces.some(space => space.use === 'park')).toBe(true)
    expect(layout.lots.filter(lot => lot.district === 'residential')
      .every(lot => Math.hypot(lot.x, lot.z) < 650)).toBe(true)
    expect(layout.target).toBeLessThanOrEqual(70)
    expect(layout.lots.every(lot => lot.width >= 13 && lot.width < 100 && lot.height <= 28)).toBe(true)
  })

  it('gives cities a broad, mixed-use district network with bounded proposals and open space', () => {
    const layout = settlementLayout({ ...plan, kind: 'city', radius: 9000 }, rand)
    expect(new Set(layout.lots.map(lot => lot.district)))
      .toEqual(new Set(['centre', 'residential', 'commercial', 'industrial']))
    expect(layout.lots.some(lot => lot.use === 'office' && lot.height > 200)).toBe(true)
    expect(layout.lots.some(lot => lot.use === 'warehouse')).toBe(true)
    expect(layout.spaces.filter(space => space.use === 'park').length).toBeGreaterThanOrEqual(3)
    expect(Math.max(...layout.lots.map(lot => Math.hypot(lot.x, lot.z)))).toBeGreaterThan(7200)
    expect(layout.roads.length).toBeLessThan(128)
    expect(layout.lots.length).toBeLessThan(24_000)
    expect(layout.target).toBeGreaterThanOrEqual(660)
  })

  it('drapes every park vertex over relief and rejects submerged and steep surfaces', () => {
    const space = { x: 0, z: 0, width: 80, depth: 64, yaw: .3, use: 'park' as const, color: 0x65754e }
    const ground = (x: number, z: number) => ({ height: 100 + x * .05 + z * .02, waterLevel: 0 })
    const patch = settlementGroundPatch(space, 3000, -4000, .4, ground)!
    expect(patch.positions.length).toBeGreaterThan(0)
    for (let i = 0; i < patch.positions.length; i += 3) {
      expect(patch.positions[i + 1]).toBeCloseTo(ground(patch.positions[i]!, patch.positions[i + 2]!).height + .12)
    }
    expect(settlementGroundPatch(space, 0, 0, 0, () => ({ height: -5, waterLevel: 0 }))).toBeNull()
    expect(settlementGroundPatch(space, 0, 0, 0, x => ({ height: 1000 + x, waterLevel: 0 }))).toBeNull()
  })

  it('renders and collides with service canopies and columns without filling the space below', () => {
    const building = { x: 0, y: 100, z: 0, width: 30, depth: 20, height: 8, yaw: 0,
      use: 'gas-station' as const, shape: 'block' as const, roof: 'flat' as const,
      wallColor: 0xffffff, roofColor: 0x555555, service: { x: 0, y: 100, z: -30, yaw: 0 } }
    const servicePlan = { ...plan, buildings: [building] }
    expect(hitsSettlement(servicePlan, 0, 103, -30)).toBe(false)
    expect(hitsSettlement(servicePlan, 0, 106.5, -30)).toBe(true)
    expect(hitsSettlement(servicePlan, 10, 103, -36)).toBe(true)
    expect(hitsSettlement(servicePlan, 5, 101, -33)).toBe(true)
    const scene = new Scene(), system = new SettlementSystem(scene)
    try {
      const internal = system as unknown as { build(plan: SettlementPlan): unknown }
      internal.build(servicePlan)
      expect(scene.getObjectByName('SettlementFuelStations')).toBeDefined()
    } finally { system.dispose() }
  })
})
