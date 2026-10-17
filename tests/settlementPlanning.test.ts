import { afterEach, expect, it, vi } from 'vitest'
import { settlementLayout, type LocalLot } from '../src/world/SettlementLayout'
import * as layouts from '../src/world/SettlementLayout'
import { settlementForCell, type SettlementPlan } from '../src/world/SettlementPlan'
import * as terrain from '../src/world/terrainSample'
import { setWorldSeed } from '../src/world/noise'

const plan: SettlementPlan = { id: 'planning', kind: 'village', biome: 'plains', x: 0, y: 100, z: 0,
  radius: 3000, buildings: [], roads: [] }
const rand = (n: number) => ((Math.sin(n * 7.137) * 43758.5453) % 1 + 1) % 1
const dry = () => ({ height: 100, waterLevel: 0 })
afterEach(() => { terrain.clearOpsPad(); vi.restoreAllMocks() })

it('orders compact village core, housing and industrial frontage with varied physical footprints', () => {
  const layout = settlementLayout(plan, rand, dry)
  const core = layout.lots.filter(l => l.district === 'centre')
  const housing = layout.lots.filter(l => l.district === 'residential')
  const industry = layout.lots.filter(l => l.district === 'industrial')
  const meanRadius = (lots: LocalLot[]) => lots.reduce((sum, l) => sum + Math.hypot(l.x, l.z), 0) / lots.length
  expect(meanRadius(core)).toBeLessThan(meanRadius(housing))
  expect(meanRadius(core)).toBeLessThan(meanRadius(industry))
  expect(industry.every(l => ['workshop', 'depot', 'civic'].includes(l.use))).toBe(true)
  for (const use of ['farmhouse', 'rowhouse', 'inn', 'depot']) expect(layout.lots.some(l => l.use === use)).toBe(true)
  const plaza = layout.spaces.find(s => s.use === 'plaza')!
  const park = layout.spaces.find(s => s.use === 'park')!
  expect(plaza.width * plaza.depth).toBeLessThan(1500)
  expect(park.width * park.depth).toBeLessThan(2200)
  expect(layout.spaces.some(s => s.use === 'path' && s.width === 3)).toBe(true)
  expect(layout.target).toBeGreaterThanOrEqual(22)
  expect(layout.target).toBeLessThanOrEqual(65)
  expect(layout.roads.length).toBeLessThan(16)
})

it('surveys whole farm parcels with at most 324 probes, rejects wet/steep land and retains rural access', () => {
  for (const sample of [() => ({ height: -1, waterLevel: 0 }),
    (x: number, z: number) => ({ height: 10000 + x + z, waterLevel: 0 })]) {
    const survey = vi.fn(sample)
    const layout = settlementLayout(plan, rand, survey)
    expect(layout.lots.some(l => l.farm !== undefined)).toBe(false)
    expect(layout.spaces.some(s => s.use === 'field')).toBe(false)
    expect(survey.mock.calls.length).toBeLessThanOrEqual(324)
    expect(layout.roads.some(r => r.width === 6)).toBe(true)
  }
  const flat = settlementLayout(plan, rand, dry)
  for (const field of flat.spaces.filter(s => s.use === 'field')) {
    expect(flat.lots.filter(l => l.farm === field.farm).map(l => l.use)).toEqual(['barn', 'farmhouse'])
  }
  expect(settlementLayout({ ...plan, biome: 'snow' }, rand, dry).spaces.some(s => s.use === 'field')).toBe(false)
})

it('uses a bounded alternative gentle farm site when its first yard is submerged', () => {
  const initial = settlementLayout(plan, rand, dry)
  const barn = initial.lots.find(l => l.farm === 0 && l.use === 'barn')!
  const house = initial.lots.find(l => l.farm === 0 && l.use === 'farmhouse')!
  const centre = { x: (barn.x * 45 + house.x * 55) / 100, z: (barn.z * 45 + house.z * 55) / 100 }
  const sample = vi.fn((x: number, z: number) => ({ height: Math.hypot(x - centre.x, z - centre.z) < 8 ? -2 : 100, waterLevel: 0 }))
  const next = settlementLayout(plan, rand, sample)
  const moved = next.lots.find(l => l.farm === 0 && l.use === 'barn')!
  expect(moved).toBeDefined()
  expect(Math.hypot(moved.x - barn.x, moved.z - barn.z)).toBeGreaterThan(50)
  expect(sample.mock.calls.length).toBeLessThanOrEqual(324)
  expect(next).toEqual(settlementLayout(plan, rand, sample))
})

it('does not publish orphan fields when a farm member fails final footprint validation', () => {
  setWorldSeed(1091201); terrain.clearOpsPad()
  const base = terrain.sampleClimate(0, 0)
  vi.spyOn(terrain, 'sampleClimate').mockImplementation((_x, _z, out) => Object.assign(out ?? {}, base,
    { height: 100, waterLevel: 0, biome: 'plains' }) as typeof base)
  vi.spyOn(layouts, 'settlementLayout').mockImplementation(() => {
    const lot = (x: number, z: number, use: LocalLot['use'], farm?: number): LocalLot =>
      ({ x, z, use, farm, yaw: 0, width: 18, depth: 18, height: 12, shape: 'block', district: 'rural' })
    return { target: 12, roads: [{ width: 8, points: [{ x: -500, z: 0 }, { x: 500, z: 0 }] }],
      lots: [lot(0, 0, 'barn', 0), lot(0, 50, 'farmhouse', 0),
        ...Array.from({ length: 10 }, (_, i) => lot(-400 + i * 80, -50, 'house'))],
      spaces: [{ x: 200, z: 170, width: 100, depth: 100, yaw: 0, use: 'field', color: 0x98875a, farm: 0 }] }
  })
  const generated = settlementForCell(0, 0, 'village')!
  expect(generated).not.toBeNull()
  expect(generated.buildings.some(b => b.use === 'farmhouse')).toBe(true)
  expect(generated.buildings.some(b => b.use === 'barn')).toBe(false)
  expect(generated.ground?.some(g => g.use === 'field')).toBe(false)
})

it('retains a complete dry farm and fuel pad in actual seed-73 terrain', () => {
  setWorldSeed(73); terrain.clearOpsPad()
  const generated = settlementForCell(-6, -3)!
  expect(generated).not.toBeNull()
  expect(generated.buildings.some(b => b.use === 'barn')).toBe(true)
  expect(generated.buildings.some(b => b.use === 'farmhouse')).toBe(true)
  expect(generated.buildings.some(b => b.use === 'gas-station' && b.service)).toBe(true)
  expect(generated.ground?.filter(g => g.use === 'field')).toHaveLength(2)
  expect(generated.roads.some(r => r.gateway)).toBe(true)
  expect(generated.ground?.some(g => g.use === 'plaza')).toBe(true)
})

it('rejects an incomplete fuel pad before reserving its building footprint or gateway', () => {
  setWorldSeed(1091202); terrain.clearOpsPad()
  const base = terrain.sampleClimate(0, 0)
  let origin = { x: 0, z: 0, c: 1, s: 0 }
  vi.spyOn(terrain, 'sampleClimate').mockImplementation((x, z, out) => {
    const lx = origin.c * (x - origin.x) - origin.s * (z - origin.z)
    const lz = origin.s * (x - origin.x) + origin.c * (z - origin.z)
    return Object.assign(out ?? {}, base, { height: lx > 350 && lz > 26 && lz < 46 ? -5 : 100,
      waterLevel: 0, biome: 'plains' }) as typeof base
  })
  vi.spyOn(layouts, 'settlementLayout').mockImplementation((p, r) => {
    const a = r(30) * Math.PI * 2
    origin = { x: p.x, z: p.z, c: Math.cos(a), s: Math.sin(a) }
    const lot = (x: number, z: number, use: LocalLot['use']): LocalLot =>
      ({ x, z, use, yaw: 0, width: 18, depth: 18, height: 12, shape: 'block', district: 'rural' })
    return { target: 12, roads: [{ width: 8, gateway: true, points: [{ x: -500, z: 0 }, { x: 500, z: 0 }] }],
      lots: [lot(400, 60, 'gas-station'), lot(400, 60, 'house'),
        ...Array.from({ length: 10 }, (_, i) => lot(-400 + i * 80, -50, 'house'))],
      spaces: [{ x: 400, z: 28, width: 50, depth: 30, yaw: 0, use: 'forecourt', color: 0x888888, service: true }] }
  })
  const generated = settlementForCell(0, 0, 'village')!
  expect(generated).not.toBeNull()
  expect(generated.buildings).toHaveLength(11)
  expect(generated.buildings.some(b => b.use === 'gas-station')).toBe(false)
  expect(generated.roads.some(r => r.gateway)).toBe(false)
  expect(generated.ground?.some(g => g.use === 'forecourt')).toBe(false)
})
