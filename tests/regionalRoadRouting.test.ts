import { afterEach, describe, expect, it, vi } from 'vitest'
import { roadBetweenSettlements } from '../src/world/RegionalRoads'
import { setWorldSeed } from '../src/world/noise'
import { createClimateSample } from '../src/world/Geography'
import * as terrain from '../src/world/terrainSample'
import type { SettlementPlan, SettlementRoad } from '../src/world/SettlementPlan'
import { coastalRoadRoute, terrainRoadRoute, roundRoadRoute, MAX_REGIONAL_ROUTE_PROBES,
  MAX_REGIONAL_ROUTE_STATIONS, refineRoadRoute, MAX_ROUTE_REFINEMENT_PROBES } from '../src/world/RoadRouting'
import { groundRoad } from '../src/world/RoadSurface'
import * as surfaces from '../src/world/RoadSurface'

afterEach(() => vi.restoreAllMocks())

function site(id: string, x: number): SettlementPlan {
  return { id, x, y: 120, z: 0, radius: 1400, kind: 'village', biome: 'plains', buildings: [],
    roads: [{ width: 10, points: [{ x: x - 500, y: 120.45, z: 0 }, { x: x + 500, y: 120.45, z: 0 }] }] }
}

function windingValley(x: number): number {
  const t = Math.max(0, Math.min(1, (x + 11500) / 23000))
  return 2000 * Math.sin(2 * Math.PI * t) * Math.sin(Math.PI * t)
}

function routeMetrics(road: SettlementRoad) {
  let maxGrade = 0, maxHeight = 0
  for (let i = 0; i < road.points.length; i++) {
    const point = road.points[i]!
    maxHeight = Math.max(maxHeight, point.y)
    if (i) {
      const previous = road.points[i - 1]!
      maxGrade = Math.max(maxGrade, Math.abs(point.y - previous.y) / Math.hypot(point.x - previous.x, point.z - previous.z))
    }
  }
  return { maxGrade, maxHeight }
}

describe('terrain-aware regional routing', () => {
  it('bounds corridor work and preserves exact endpoints through corner rounding', () => {
    const sample = vi.fn(() => ({ height: 120, waterLevel: 0 }))
    const start = { x: 100_000_000, z: -100_000_000 }, end = { x: start.x + 62_000, z: start.z + 10_000 }
    const route = terrainRoadRoute(start, end, sample, 1000)!
    expect(route).not.toBeNull()
    expect(route.length).toBeLessThanOrEqual(MAX_REGIONAL_ROUTE_STATIONS + 1)
    expect(sample.mock.calls.length).toBeLessThanOrEqual(MAX_REGIONAL_ROUTE_PROBES)
    const rounded = roundRoadRoute(route)
    expect(rounded[0]).toEqual(start); expect(rounded.at(-1)).toEqual(end)
    expect(rounded.length).toBeLessThanOrEqual((MAX_REGIONAL_ROUTE_STATIONS + 1) * 4)
    const dx = end.x - start.x, dz = end.z - start.z
    let previous = -Infinity
    for (const point of rounded) {
      const forward = (point.x - start.x) * dx + (point.z - start.z) * dz
      expect(forward).toBeGreaterThanOrEqual(previous); previous = forward
    }
  })

  it('copies mutable sampler values and rejects malformed or unreachable corridors', () => {
    const start = { x: -11500, z: 0 }, end = { x: 11500, z: 0 }
    const fresh = (x: number, z: number) => ({ height: 120 + Math.max(0, Math.abs(z - windingValley(x)) - 500), waterLevel: 0 })
    const scratch = { height: 0, waterLevel: 0 }
    const mutable = (x: number, z: number) => Object.assign(scratch, fresh(x, z))
    expect(terrainRoadRoute(start, end, mutable)).toEqual(terrainRoadRoute(start, end, fresh))
    const invalid = vi.fn(() => ({ height: Number.NaN }))
    expect(terrainRoadRoute(start, end, invalid)).toBeNull()
    expect(invalid.mock.calls.length).toBeLessThanOrEqual(2)
    invalid.mockClear()
    expect(terrainRoadRoute(start, { x: Infinity, z: 0 }, invalid)).toBeNull()
    expect(invalid).not.toHaveBeenCalled()
  })

  it('rejects too many local patches before probing and leaves the original profile untouched', () => {
    const sample = (x: number) => ({ height: 120 + Math.sin(x / 150) * 100, waterLevel: 0 })
    const road = groundRoad([{ x: 0, z: 0 }, { x: 12_000, z: 0 }], 10, sample)!
    const before = JSON.stringify(road), probes = vi.fn(sample)
    expect(refineRoadRoute(road, probes)).toBeNull()
    expect(probes).not.toHaveBeenCalled()
    expect(probes.mock.calls.length).toBeLessThanOrEqual(MAX_ROUTE_REFINEMENT_PROBES)
    expect(JSON.stringify(road)).toBe(before)
  })

  it('bounds the probes of an eligible local ridge repair without mutating its source', () => {
    const sample = (x: number, z: number) => ({ height: 120 + Math.max(0, 120 - Math.abs(x - 1500) * .3 - Math.abs(z) * .5), waterLevel: 0 })
    const road = groundRoad([{ x: 0, z: 0 }, { x: 3000, z: 0 }], 10, sample)!
    const before = JSON.stringify(road), probes = vi.fn(sample)
    refineRoadRoute(road, probes)
    expect(probes.mock.calls.length).toBeGreaterThan(0)
    expect(probes.mock.calls.length).toBeLessThanOrEqual(MAX_ROUTE_REFINEMENT_PROBES)
    expect(JSON.stringify(road)).toBe(before)
  })

  it('follows an S-shaped valley instead of climbing the opposing ridge walls', () => {
    setWorldSeed(1)
    const base = createClimateSample()
    vi.spyOn(terrain, 'sampleClimateInto').mockImplementation((out, x, z) => {
      Object.assign(out, base)
      out.height = 120 + Math.max(0, Math.abs(z - windingValley(x)) - 500) * .75
      out.waterLevel = 0
      return out
    })
    const road = roadBetweenSettlements(site('0,0', -12000), site('1,0', 12000))!
    expect(road).not.toBeNull()
    expect(Math.min(...road.points.map(point => point.z))).toBeLessThan(-600)
    expect(Math.max(...road.points.map(point => point.z))).toBeGreaterThan(600)
    const metrics = routeMetrics(road)
    expect(metrics.maxHeight).toBeLessThan(300)
    expect(metrics.maxGrade).toBeLessThan(.24)
  })

  it('finds a shoreline route around a broad lake and remains discovery-order deterministic', () => {
    setWorldSeed(1)
    const base = createClimateSample()
    vi.spyOn(terrain, 'sampleClimateInto').mockImplementation((out, x, z) => {
      Object.assign(out, base); out.height = Math.abs(x) < 1300 && Math.abs(z) < 2500 ? -10 : 120
      out.waterLevel = 0; return out
    })
    const a = site('0,0', -12000), b = site('1,0', 12000)
    const road = roadBetweenSettlements(a, b)!
    expect(road).not.toBeNull()
    expect(Math.max(...road.points.map(point => Math.abs(point.z)))).toBeGreaterThan(2300)
    expect(routeMetrics(road).maxGrade).toBeLessThanOrEqual(.24)
    expect(roadBetweenSettlements(b, a)).toEqual(road)
  })

  it.each(['cliff', 'sea'] as const)('rejects an unavoidable %s instead of drawing an impossible road', barrier => {
    const base = createClimateSample()
    vi.spyOn(terrain, 'sampleClimateInto').mockImplementation((out, x) => {
      Object.assign(out, base)
      out.height = barrier === 'cliff' ? x < 0 ? 120 : 1120 : Math.abs(x) < 1500 ? -10 : 120
      out.waterLevel = 0; return out
    })
    const profiles = vi.spyOn(surfaces, 'groundRoad')
    expect(roadBetweenSettlements(site('0,0', -12000), site('1,0', 12000))).toBeNull()
    expect(profiles.mock.calls.length).toBeLessThanOrEqual(4)
  })
})

describe('bounded coastal detours', () => {
  it('can leave a blocked shore join sideways while the tapered route cannot', () => {
    const start = { x: 0, z: 0 }, end = { x: 12000, z: 0 }
    const allows = (a: { x: number; z: number }, b: { x: number; z: number }) =>
      !((a.x === 0 && a.z === 0 && b.x > 0) || (b.x === 0 && b.z === 0 && a.x > 0))
    const sample = vi.fn(() => ({ height: 20, waterLevel: 0 }))
    expect(terrainRoadRoute(start, end, sample, 0, false, allows)).toBeNull()
    sample.mockClear()
    const route = coastalRoadRoute(start, end, sample, allows)!
    expect(route).not.toBeNull()
    expect(route[0]).toEqual(start); expect(route.at(-1)).toEqual(end)
    expect(route[1]!.x).toBe(0); expect(Math.abs(route[1]!.z)).toBeGreaterThan(0)
    expect(route.length).toBeLessThanOrEqual((MAX_REGIONAL_ROUTE_STATIONS + 1) * 11)
    expect(sample.mock.calls.length).toBeLessThanOrEqual(MAX_ROUTE_REFINEMENT_PROBES)
    for (let i = 1; i < route.length; i++) expect(allows(route[i - 1]!, route[i]!)).toBe(true)
  })

  it('copies mutable samples, bounds exhausted searches and rejects invalid data', () => {
    const start = { x: 10000000, z: -10000000 }, end = { x: start.x + 62000, z: start.z + 10000 }
    const fresh = (x: number, z: number) => ({ height: 120 + Math.sin(x / 4000) * 30 + Math.cos(z / 3000) * 10 })
    const scratch = { height: 0 }
    expect(coastalRoadRoute(start, end, (x, z) => Object.assign(scratch, fresh(x, z))))
      .toEqual(coastalRoadRoute(start, end, fresh))
    const sample = vi.fn(fresh)
    // Isolate the goal while permitting exhaustive travel around it.
    const allows = (_a: { x: number; z: number }, b: { x: number; z: number }) =>
      Math.hypot(b.x - end.x, b.z - end.z) > 1000
    expect(coastalRoadRoute(start, end, sample, allows)).toBeNull()
    expect(sample.mock.calls.length).toBeLessThanOrEqual(MAX_ROUTE_REFINEMENT_PROBES)
    expect(coastalRoadRoute(start, end, () => ({ height: NaN }))).toBeNull()
    expect(coastalRoadRoute(start, { x: Infinity, z: 0 }, sample)).toBeNull()
  })
})

it('fits a narrow inland departure into the existing coastal lanes and probe budget', () => {
  const start = { x: 0, z: 0 }, end = { x: 12000, z: 0 }
  const allows = (a: { x: number; z: number }, b: { x: number; z: number }) =>
    Math.abs(a.z) <= 100 && Math.abs(b.z) <= 100 &&
    !((a.x === 0 && a.z === 0 && b.x > 0) || (b.x === 0 && b.z === 0 && a.x > 0))
  const sample = vi.fn(() => ({ height: 20, waterLevel: 0 }))
  const route = coastalRoadRoute(start, end, sample, allows)!
  expect(route).not.toBeNull()
  expect(route[0]).toEqual(start); expect(route.at(-1)).toEqual(end)
  expect(route[1]!.x).toBe(0)
  expect(Math.abs(route[1]!.z)).toBeGreaterThan(0)
  expect(Math.abs(route[1]!.z)).toBeLessThanOrEqual(100)
  expect(sample.mock.calls.length).toBeLessThanOrEqual(MAX_ROUTE_REFINEMENT_PROBES)
  for (let i = 1; i < route.length; i++) expect(allows(route[i - 1]!, route[i]!)).toBe(true)
})
