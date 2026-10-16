import { afterEach, expect, it, vi } from 'vitest'
import { settlementForCell } from '../src/world/SettlementPlan'
import * as layout from '../src/world/SettlementLayout'
import * as terrain from '../src/world/terrainSample'
import { setWorldSeed } from '../src/world/noise'

afterEach(() => { terrain.clearOpsPad(); vi.restoreAllMocks() })

it('keeps buildings out of dry viaduct footprints while retaining nearby ground-street frontage', () => {
  setWorldSeed(98877); terrain.clearOpsPad()
  const base = terrain.sampleClimate(0, 0)
  let origin: { x: number; z: number; c: number; s: number } | null = null
  vi.spyOn(terrain, 'sampleClimate').mockImplementation((x, z, out) => {
    const sample = Object.assign(out ?? { ...base }, base)
    const localX = origin ? origin.c * (x - origin.x) - origin.s * (z - origin.z) : 0
    sample.height = localX >= 200 && localX <= 320 ? -10 : localX > 320 ? 45 : 6
    sample.waterLevel = 0; sample.biome = 'plains'
    return sample
  })
  vi.spyOn(layout, 'settlementLayout').mockImplementation((plan, rand) => {
    const angle = rand(30) * Math.PI * 2
    origin = { x: plan.x, z: plan.z, c: Math.cos(angle), s: Math.sin(angle) }
    const lot = (x: number, z: number): layout.LocalLot => ({ x, z, width: 16, depth: 16, height: 12,
      yaw: 0, shape: 'block', use: 'house', district: 'residential' })
    return { target: 9, spaces: [], roads: [
      { width: 10, points: [{ x: -400, z: 0 }, { x: 700, z: 0 }] },
      { width: 8, points: [{ x: -350, z: 35 }, { x: 170, z: 35 }] },
    ], lots: [lot(100, 0), ...Array.from({ length: 8 }, (_, i) => lot(-300 + i * 40, 70))] }
  })
  const plan = settlementForCell(0, 0, 'village')!
  expect(plan).not.toBeNull()
  expect(plan.roads.some(road => road.points.some(point => point.structure === 'viaduct'))).toBe(true)
  const c = origin!.c, s = origin!.s
  const underBridge = plan.buildings.filter(b => {
    const dx = b.x - plan.x, dz = b.z - plan.z
    return Math.abs(c * dx - s * dz - 100) < .01 && Math.abs(s * dx + c * dz) < .01
  })
  expect(underBridge).toHaveLength(0)
  expect(plan.buildings).toHaveLength(8)
})
