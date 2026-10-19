import { afterEach, expect, it, vi } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad, sampleClimate } from '../src/world/terrainSample'
import * as terrain from '../src/world/terrainSample'
import { createClimateSample } from '../src/world/Geography'
import { settlementForCell, type SettlementPlan } from '../src/world/SettlementPlan'
import { buildableRegionalLinksForSettlement, roadBetweenSettlements } from '../src/world/RegionalRoads'
import * as routing from '../src/world/RoadRouting'
import * as surfaces from '../src/world/RoadSurface'

afterEach(() => { clearOpsPad(); vi.restoreAllMocks() })

it.each([
  [42, -6, -4, '-6,-4|-7,-5'],
  [42, -7, -5, '-6,-4|-7,-5'],
  [1337, 6, -6, '6,-6|7,-6'],
] as const)('recovers seed-%s coastal village %s,%s inside the existing physical bounds', (seed, cx, cz, key) => {
  clearOpsPad(); setWorldSeed(seed)
  const plan = settlementForCell(cx, cz)!
  const attempts: string[] = []
  const links = buildableRegionalLinksForSettlement(plan, settlementForCell, [], link => {
    attempts.push(link.key)
    return roadBetweenSettlements(link.from, link.to, settlementForCell)
  })
  expect(attempts.length).toBeLessThanOrEqual(4)
  expect(links.map(link => link.key)).toEqual([key])
  const link = links[0]!, road = roadBetweenSettlements(link.from, link.to, settlementForCell)!
  expect(roadBetweenSettlements(link.to, link.from, settlementForCell)).toEqual(road)
  expect(road.points.length).toBeLessThanOrEqual(surfaces.MAX_ROAD_PROFILE_POINTS)
  expect(surfaces.bridgeSupportPoints(road).length).toBeLessThanOrEqual(surfaces.MAX_ROAD_SUPPORTS)
  expect(routing.roadGradeValid(road)).toBe(true)
  expect(road.points[0]!.structure).toBe('ground'); expect(road.points.at(-1)!.structure).toBe('ground')
  let wet = 0, dry = 0
  for (let i = 0; i < road.points.length; i++) {
    const point = road.points[i]!, before = road.points[Math.max(0, i - 1)]!
    const length = Math.hypot(point.x - before.x, point.z - before.z)
    const ground = sampleClimate(point.x, point.z)
    if (ground.height <= (ground.waterLevel ?? 0) + 1) {
      expect(point.bridge).toBe(true)
      expect(point.y).toBeGreaterThanOrEqual((ground.waterLevel ?? 0) + surfaces.ROAD_BRIDGE_CLEARANCE)
    }
    wet = point.bridge ? wet + length : 0
    dry = !point.bridge && point.structure !== 'ground' ? dry + length : 0
    expect(wet).toBeLessThanOrEqual(surfaces.MAX_ROAD_BRIDGE_SPAN)
    expect(dry).toBeLessThanOrEqual(surfaces.MAX_DRY_ROAD_STRUCTURE_SPAN)
    expect(point.y - Math.min(point.groundY!, point.leftGroundY!, point.rightGroundY!)).toBeLessThanOrEqual(surfaces.MAX_ROAD_STRUCTURE_HEIGHT)
  }
}, 60000)

it('shares one 5000-probe allowance across coastal repairs and never builds a fifth profile', () => {
  const base = createClimateSample()
  vi.spyOn(terrain, 'sampleClimateInto').mockImplementation((out, x) => {
    Object.assign(out, base); out.height = x > 10000 && x < 11000 ? 170 : 20; out.waterLevel = 0
    return out
  })
  let finite = 0, exhausted = 0
  vi.spyOn(routing, 'refineRoadRoute').mockImplementation((_road, sample) => {
    for (let i = 0; i < 5001; i++) Number.isFinite(sample(500, 0).height) ? finite++ : exhausted++
    return null
  })
  const detour = vi.spyOn(routing, 'coastalRoadRoute').mockImplementation((_a, _b, sample) => {
    expect(Number.isNaN(sample(500, 0).height)).toBe(true)
    return null
  })
  const profiles = vi.spyOn(surfaces, 'groundRoad')
  const site = (id: string, x: number): SettlementPlan => ({ id, x, z: 0, y: 20, radius: 1400,
    kind: 'village', biome: 'plains', buildings: [], roads: [{ width: 10, points: [{ x: x - 500, z: 0, y: 20.45 }, { x: x + 500, z: 0, y: 20.45 }] }] })
  expect(roadBetweenSettlements(site('0,0', 0), site('1,0', 24000))).toBeNull()
  expect(finite).toBe(5000); expect(exhausted).toBe(1)
  expect(detour).toHaveBeenCalledOnce()
  expect(profiles.mock.calls.length).toBeLessThanOrEqual(4)
})
