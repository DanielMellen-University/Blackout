import { afterEach, expect, it, vi } from 'vitest'
import { RoadClearance } from '../src/world/RoadClearance'
import type { SettlementBuilding, SettlementPlan } from '../src/world/SettlementPlan'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad } from '../src/world/terrainSample'
import { settlementForCell } from '../src/world/SettlementPlan'
import { regionalLinksForSettlement, roadBetweenSettlements } from '../src/world/RegionalRoads'
import { compactRegionalRoadLink, MAX_ROAD_CLEARANCE_CELLS } from '../src/world/RegionalRoads'
import * as terrain from '../src/world/terrainSample'

afterEach(() => { vi.restoreAllMocks(); clearOpsPad() })

function building(x = 0, z = 0, yaw = 0): SettlementBuilding {
  return { x, y: 100, z, width: 20, depth: 80, height: 20, yaw,
    roof: 'flat', shape: 'block', wallColor: 0, roofColor: 0 }
}
function plan(buildings: SettlementBuilding[]): SettlementPlan {
  return { id: '0,0', kind: 'village', biome: 'plains', x: 0, y: 100, z: 0, radius: 500, buildings, roads: [] }
}
it('checks full rotated building footprints and road shoulders, not just sampled centres', () => {
  const index = new RoadClearance([plan([building(512, -512, Math.PI / 4)])], 18)
  expect(index.allows({ x: -2000, z: -512 }, { x: 2000, z: -512 })).toBe(false)
  expect(index.allows({ x: 512, z: -2000 }, { x: 512, z: 2000 })).toBe(false)
  expect(index.allows({ x: 450, z: -530 }, { x: 450, z: -490 })).toBe(true)
  const straight = new RoadClearance([plan([building()])], 18)
  expect(straight.allows({ x: 24, z: -100 }, { x: 24, z: 100 })).toBe(false)
  expect(straight.allows({ x: 26, z: -100 }, { x: 26, z: 100 })).toBe(true)
  const diagonal = new RoadClearance([plan([{ ...building(0, 0, Math.PI / 4), width: 10, depth: 120 }])], 10)
  expect(diagonal.allows({ x: 40, z: 40 }, { x: 40, z: 40 })).toBe(false)
  expect(diagonal.allows({ x: -40, z: 40 }, { x: -40, z: 40 })).toBe(true)
})
it('reserves service canopies and handles zero-length, reversed and distant segments', () => {
  const b = building(200)
  b.service = { x: -512, y: 100, z: 512, yaw: Math.PI / 2 }
  const index = new RoadClearance([plan([b])], 10)
  const a = { x: -512, z: -1000 }, c = { x: -512, z: 2000 }
  expect(index.allows(a, c)).toBe(false); expect(index.allows(c, a)).toBe(false)
  expect(index.allows(a, a)).toBe(true)
  expect(index.allows(b, b)).toBe(false)
  expect(index.allows({ x: 1e8, z: 1e8 }, { x: 1e8 + 62000, z: 1e8 + 62000 })).toBe(true)
  expect(index.allows({ x: NaN, z: 0 }, a)).toBe(false)
})
it.each([[1337, 1, 1], [1, -7, -5]])('retains clear generated connectors in seed %i at %i,%i', (seed, cx, cz) => {
  clearOpsPad(); setWorldSeed(seed!)
  const source = settlementForCell(cx!, cz!)!
  let connected = 0
  for (const link of regionalLinksForSettlement(source)) {
    const plans: SettlementPlan[] = []
    const resolve = (x: number, z: number) => {
      const p = settlementForCell(x, z)
      if (p) plans.push(p)
      return p
    }
    const road = roadBetweenSettlements(link.from, link.to, resolve)
    if (!road) continue
    connected++
    expect(new RoadClearance(plans, road.width).routeAllows(road.points)).toBe(true)
  }
  expect(connected).toBeGreaterThan(0)
}, 60000)

function fixture() {
  setWorldSeed(1)
  vi.spyOn(terrain, 'sampleClimateInto').mockImplementation(out => {
    out.height = 120; out.waterLevel = 0; out.landform.ridge = 0; out.landform.alpineValley = 0; return out
  })
  const a = { ...plan([]), x: 12000, z: 12000, y: 120 }
  const b = { ...plan([]), id: '1,0', x: 36000, z: 12000, y: 120 }
  for (const p of [a, b]) p.roads = [{ width: 10, points: [{ x: p.x - 200, y: 120.45, z: p.z }, { x: p.x + 200, y: 120.45, z: p.z }] }]
  const link = compactRegionalRoadLink({ key: '0,0|1,0', from: a, to: b })!
  const baseline = roadBetweenSettlements(link.from, link.to)!
  expect(baseline).not.toBeNull()
  return { a, b, link, baseline }
}

it('reroutes an actual near-endpoint footprint cut instead of deleting the building', () => {
  const { a, b, link, baseline } = fixture()
  const point = baseline.points[12]!
  a.buildings.push({ ...building(point.x, point.z, .45), width: 100, depth: 100 })
  const before = JSON.stringify(a)
  const index = new RoadClearance([a], 10)
  expect(index.routeAllows(baseline.points)).toBe(false)
  const road = roadBetweenSettlements(a, b)!
  expect(road).not.toBeNull(); expect(index.routeAllows(road.points)).toBe(true)
  expect(roadBetweenSettlements(b, a)).toEqual(road)
  expect(JSON.stringify(a)).toBe(before)
  const resolve = (cx: number, cz: number) => cz === 0 ? cx === 0 ? a : cx === 1 ? b : null : null
  expect(roadBetweenSettlements(link.from, link.to, resolve)).toEqual(road)
})

it('avoids intermediate and relocated protected settlements without depending on loaded roots', () => {
  const { a, b, link, baseline } = fixture()
  const point = baseline.points[Math.floor(baseline.points.length / 2)]!
  const obstacle = { ...plan([building(point.x, point.z, -.6)]), id: '0,1' }
  const resolve = vi.fn((cx: number, cz: number) => `${cx},${cz}` === a.id ? a : `${cx},${cz}` === b.id ? b :
    `${cx},${cz}` === obstacle.id ? obstacle : null)
  const road = roadBetweenSettlements(link.from, link.to, resolve)!
  expect(road).not.toBeNull()
  const index = new RoadClearance([obstacle], 10)
  expect(index.routeAllows(baseline.points)).toBe(false); expect(index.routeAllows(road.points)).toBe(true)
  expect(resolve.mock.calls.length).toBeLessThanOrEqual(MAX_ROAD_CLEARANCE_CELLS + 2)
  expect(new Set(resolve.mock.calls.map(([x, z]) => `${x},${z}`)).size).toBe(resolve.mock.calls.length)
  const moved = { ...obstacle, id: '100,100' }
  const endpointsOnly = (cx: number, cz: number) => `${cx},${cz}` === a.id ? a : `${cx},${cz}` === b.id ? b : null
  const protectedRoad = roadBetweenSettlements(link.from, link.to, endpointsOnly, [moved])!
  expect(protectedRoad).not.toBeNull(); expect(index.routeAllows(protectedRoad.points)).toBe(true)
})

it('rejects stale compact endpoints or an obstructed attachment without a partial road', () => {
  const { a, b, link } = fixture()
  const resolve = (cx: number, cz: number) => cz === 0 ? cx === 0 ? a : cx === 1 ? b : null : null
  expect(roadBetweenSettlements({ ...link.from, x: link.from.x + 1 }, link.to, resolve)).toBeNull()
  expect(roadBetweenSettlements({ ...link.from, kind: 'city' }, link.to, resolve)).toBeNull()
  const point = link.from.roads[0]!.points[0]!
  a.buildings.push(building(point.x, point.z))
  expect(roadBetweenSettlements(link.from, link.to, resolve)).toBeNull()
})
