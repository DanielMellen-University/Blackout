import { afterEach, describe, expect, it, vi } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import { regionalRoadKey, roadBetweenSettlements, selectRegionalRoadLinks, shouldConnectSettlements,
  settlementRoadAttachment, MAX_ROAD_ATTACHMENT_CANDIDATES } from '../src/world/RegionalRoads'
import type { SettlementPlan } from '../src/world/SettlementPlan'
import * as terrain from '../src/world/terrainSample'
import { createClimateSample } from '../src/world/Geography'

afterEach(() => vi.restoreAllMocks())

function ruralTerrain(extraWet: (x: number, z: number) => boolean = () => false) {
  const base = terrain.sampleClimateInto(createClimateSample(), 0, 0)
  vi.spyOn(terrain, 'sampleClimateInto').mockImplementation((out, x, z) => {
    Object.assign(out, base)
    out.height = Math.abs(x) < 120 || extraWet(x, z) ? 90 : 120 + Math.sin(x / 3000) * 15 + Math.cos(z / 5000) * 8
    out.waterLevel = 97
    return out
  })
}

function plan(id: string, x: number, z: number, kind: 'city' | 'village' = 'village'): SettlementPlan {
  return {
    id, x, y: 120, z, kind, radius: kind === 'city' ? 9000 : 1400, biome: 'plains', buildings: [],
    roads: [{ width: 20, points: [
      { x: x - 500, y: 120, z }, { x, y: 120, z }, { x: x + 500, y: 120, z },
    ] }],
  }
}

function connectedPair(): [SettlementPlan, SettlementPlan] {
  const a = plan('0,0', -12000, 2000)
  for (let i = 1; i < 20; i++) {
    const b = plan(`${i},1`, 16000 + i * 700, 11000 + i * 110)
    if (shouldConnectSettlements(a, b)) return [a, b]
  }
  throw new Error('Expected at least one seeded regional connection')
}

describe('regional settlement roads', () => {
  it('selects a sparse deterministic subset and gives links a stable key', () => {
    setWorldSeed(1)
    const a = plan('0,0', 0, 0)
    const decisions = Array.from({ length: 20 }, (_, i) => {
      const b = plan(`${i + 1},0`, 44000 + i * 700, 8000)
      return shouldConnectSettlements(a, b)
    })
    expect(decisions.filter(Boolean).length).toBeGreaterThan(0)
    expect(decisions.filter(Boolean).length).toBeLessThan(decisions.length)
    expect(decisions).toEqual(Array.from({ length: 20 }, (_, i) =>
      shouldConnectSettlements(a, plan(`${i + 1},0`, 44000 + i * 700, 8000))))
    expect(regionalRoadKey(a, plan('2,0', 20000, 0))).toBe(regionalRoadKey(plan('2,0', 20000, 0), a))
  })

  it('builds a curved ground-following route with explicit supported crossings', () => {
    setWorldSeed(1)
    ruralTerrain()
    const [a, b] = connectedPair()
    const road = roadBetweenSettlements(a, b)
    expect(road).not.toBeNull()
    expect(road!.points.length).toBeGreaterThan(100)
    expect(road!.width).toBe(10)
    const start = road!.points[0]!, end = road!.points.at(-1)!
    expect(start.x).toBeGreaterThan(a.x)
    expect(end.x).toBeLessThan(b.x)
    let bend = 0
    const dx = end.x - start.x, dz = end.z - start.z, length = Math.hypot(dx, dz)
    for (let i = 1; i < road!.points.length; i++) {
      const previous = road!.points[i - 1]!, point = road!.points[i]!
      const step = Math.hypot(point.x - previous.x, point.z - previous.z)
      expect(step).toBeLessThanOrEqual(24.000001)
      if (point.structure === 'ground') expect(point.y - point.groundY!).toBeCloseTo(.45)
      else expect(['bridge', 'embankment', 'viaduct']).toContain(point.structure)
      bend = Math.max(bend, Math.abs((point.x - start.x) * dz - (point.z - start.z) * dx) / length)
      expect(point.leftX).toBeTypeOf('number')
      expect(point.rightX).toBeTypeOf('number')
      expect(point.bridge === undefined || typeof point.bridge === 'boolean').toBe(true)
    }
    expect(bend).toBeGreaterThan(100)
  })

  it('uses wider highways whenever a city is an endpoint', () => {
    setWorldSeed(1)
    ruralTerrain()
    const [a, b] = connectedPair()
    a.kind = 'city'; a.radius = 9000
    const road = roadBetweenSettlements(a, b)
    expect(road).not.toBeNull()
    expect(road!.width).toBe(18)
  })

  it('attaches to an actual ground street instead of the furthest bridge or ramp', () => {
    setWorldSeed(1)
    const [a, b] = connectedPair()
    ruralTerrain(x => Math.abs(x - (a.x + 1200)) < 70)
    a.roads[0]!.points.push({ x: a.x + 1200, y: 145, z: a.z, bridge: true, structure: 'bridge' },
      { x: a.x + 900, y: 140, z: a.z, structure: 'viaduct' })
    const road = roadBetweenSettlements(a, b)
    expect(road).not.toBeNull()
    expect(road!.points[0]!.x).toBe(a.x + 500)
    expect(road!.points[0]!.z).toBe(a.z)
    expect(road!.points[0]!.structure).toBe('ground')
    expect(road!.points.at(-1)!.structure).toBe('ground')
  })

  it('reconstructs the same canonical road when discovered from either endpoint', () => {
    setWorldSeed(1); ruralTerrain()
    const [a, b] = connectedPair()
    const forward = roadBetweenSettlements(a, b), reverse = roadBetweenSettlements(b, a)
    expect(forward).not.toBeNull()
    expect(JSON.stringify(forward) === JSON.stringify(reverse), 'both discoveries must generate identical full profiles').toBe(true)
  })

  it('steps inland when the highway shoulder would extend into water and bounds endpoint probes', () => {
    const base = terrain.sampleClimateInto(createClimateSample(), 0, 0)
    const sample = vi.spyOn(terrain, 'sampleClimateInto').mockImplementation((out, x, z) => {
      Object.assign(out, base); out.height = x > 110 && z > 4 ? -3 : 6; out.waterLevel = 0
      return out
    })
    const a = plan('0,0', 0, 0), b = plan('1,0', 1000, 0)
    a.roads = [{ width: 6, points: [
      { x: 100, y: 6.45, z: 0, structure: 'ground' }, { x: 120, y: 6.45, z: 0, structure: 'ground' },
    ] }]
    expect(settlementRoadAttachment(a, b, 18)).toBe(a.roads[0]!.points[0])
    expect(sample.mock.calls.length).toBeLessThanOrEqual(MAX_ROAD_ATTACHMENT_CANDIDATES * 5)
    a.roads = []
    expect(settlementRoadAttachment(a, b, 18)).toBeNull()
    a.roads = [{ width: 6, points: [{ x: 100, y: 30, z: 0, bridge: true }] }]
    expect(settlementRoadAttachment(a, b, 18)).toBeNull()
  })

  it('does not turn a large failed shoreline into an unbounded endpoint search', () => {
    const base = terrain.sampleClimateInto(createClimateSample(), 0, 0)
    const sample = vi.spyOn(terrain, 'sampleClimateInto').mockImplementation((out, _x, z) => {
      Object.assign(out, base); out.height = z > 13 ? -3 : 6; out.waterLevel = 0
      return out
    })
    const a = plan('0,0', 0, 0), b = plan('1,0', 30000, 0)
    a.roads = [{ width: 6, points: Array.from({ length: 10_000 }, (_, x) => ({ x, y: 6.45, z: 0 })) }]
    expect(settlementRoadAttachment(a, b, 18)).toBeNull()
    expect(sample).toHaveBeenCalledTimes(MAX_ROAD_ATTACHMENT_CANDIDATES * 5)
    sample.mockClear()
    expect(settlementRoadAttachment(a, b, NaN)).toBeNull()
    expect(sample).not.toHaveBeenCalled()
  })

  it('ranks regional candidates with squared distances', () => {
    setWorldSeed(1)
    const village = plan('0,0', 0, 0, 'village')
    const nearVillage = plan('1,0', 18000, 0, 'village')
    const farVillage = plan('3,0', 36000, 0, 'village')
    const city = plan('2,0', 30000, 0, 'city')
    const originalHypot = Math.hypot
    let hypotCalls = 0
    Math.hypot = ((...values: number[]) => {
      hypotCalls++
      return originalHypot(...values)
    }) as typeof Math.hypot
    try {
      const links = selectRegionalRoadLinks(village, [farVillage, nearVillage, city])
      expect(links).toHaveLength(1)
      expect(links[0]!.from.kind === 'city' || links[0]!.to.kind === 'city').toBe(true)
      // Connection gates and ranking both compare squared ranges, so the
      // planner no longer roots while choosing a regional spoke.
      expect(hypotCalls).toBe(0)
      hypotCalls = 0
      const sameTier = selectRegionalRoadLinks(village, [farVillage, nearVillage])
      expect(sameTier).toHaveLength(1)
      const other = sameTier[0]!.from.id === village.id ? sameTier[0]!.to : sameTier[0]!.from
      expect(other.id).toBe(nearVillage.id)
      expect(hypotCalls).toBe(0)
    } finally {
      Math.hypot = originalHypot
    }
  })


  it('gates regional connections with squared distances', () => {
    setWorldSeed(1)
    const hub = plan('0,0', 0, 0, 'city')
    // City radius 9000 => near-band reject below 5850 m.
    const near = plan('1,0', 4000, 0, 'village')
    const mid = plan('2,0', 30000, 0, 'village')
    const far = plan('3,0', 50000, 0, 'village')
    const tooFar = plan('4,0', 70000, 0, 'village')
    const originalHypot = Math.hypot
    let hypotCalls = 0
    Math.hypot = ((...values: number[]) => {
      hypotCalls++
      return originalHypot(...values)
    }) as typeof Math.hypot
    try {
      // Overlapping footprints stay rejected; mid-range stays accepted; the
      // hard outer envelope stays rejected. Sparse long links keep their
      // seeded roll without materializing a root for the range checks.
      expect(shouldConnectSettlements(hub, near)).toBe(false)
      expect(shouldConnectSettlements(hub, mid)).toBe(true)
      expect(shouldConnectSettlements(hub, tooFar)).toBe(false)
      const midDecision = shouldConnectSettlements(hub, far)
      expect(typeof midDecision).toBe('boolean')
      expect(hypotCalls).toBe(0)
    } finally {
      Math.hypot = originalHypot
    }
  })

  it('gives a village priority access to a reachable city hub', () => {
    setWorldSeed(1)
    const village = plan('0,0', 0, 0, 'village')
    const nearbyVillage = plan('1,0', 18000, 0, 'village')
    const city = plan('2,0', 30000, 0, 'city')
    const links = selectRegionalRoadLinks(village, [nearbyVillage, city])
    expect(links).toHaveLength(1)
    expect(links[0]!.from.kind === 'city' || links[0]!.to.kind === 'city').toBe(true)
  })

  it('gives a city priority access to nearby village spokes', () => {
    setWorldSeed(1)
    const city = plan('0,0', 0, 0, 'city')
    const nearbyCity = plan('1,0', 19000, 0, 'city')
    const village = plan('2,0', 17000, 9000, 'village')
    const links = selectRegionalRoadLinks(city, [nearbyCity, village])
    expect(links).toHaveLength(2)
    expect(links[0]!.from.kind === 'village' || links[0]!.to.kind === 'village').toBe(true)
  })
})
