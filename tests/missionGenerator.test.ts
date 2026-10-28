import { describe, expect, it } from 'vitest'
import { generateMission } from '../src/systems/MissionGenerator'
import { MISSION_THEMES } from '../src/world/TerrainProfile'

describe('approved seeded mission generator', () => {
  it.each([1, 42, 73, 808, 1337, -94.123456])('repeats complete specs for seed %s', seed => {
    for (const theme of MISSION_THEMES) {
      const spec = generateMission(seed, theme)
      expect(generateMission(seed, theme)).toEqual(spec)
      expect(spec.theme).toBe(theme)
      expect(spec.course).toHaveLength(spec.goals.gates)
      expect(spec.goals).toEqual({ gates: spec.course.length })
      expect(spec.landingRunway.yaw).toBe(spec.start.yaw)
      expect(Math.hypot(spec.landingRunway.x - spec.start.x, spec.landingRunway.z - spec.start.z)).toBeCloseTo(45)
      for (const point of [spec.start, spec.landingRunway, ...spec.course])
        for (const axis of ['x', 'y', 'z'] as const) expect(Number.isFinite(point[axis])).toBe(true)
      for (let i = 1; i < spec.course.length; i++) expect(Math.hypot(spec.course[i]!.x - spec.course[i-1]!.x, spec.course[i]!.z - spec.course[i-1]!.z)).toBeGreaterThan(80)
    }
    expect(generateMission(seed)).toEqual(generateMission(seed))
  })
  it('has exactly the delivered approved themes, varies seeds, and separates the theme route and world identities', () => {
    expect(MISSION_THEMES).toEqual(['desert-run', 'mountain-valley-run', 'coastal-island-run', 'volcanic-run', 'waterway-run'])
    expect(generateMission(42)).not.toEqual(generateMission(73))
    expect(generateMission(42, 'desert-run')).not.toEqual(generateMission(42, 'mountain-valley-run'))
    expect(generateMission(42).terrain.landscapeRevision).toBeGreaterThan(29)
    expect(generateMission(42).terrain.routeRevision).toBeGreaterThan(32)
  })
  it.each([NaN, Infinity, 1e30])('rejects invalid seed %s', seed => expect(() => generateMission(seed)).toThrow())
})

import { getTerrainProfile, setTerrainProfile } from '../src/world/TerrainProfile'
import { setWorldSeed } from '../src/world/noise'
import { sampleGeography, sampleGeographyHeight, sampleGeographySurfaceHeight } from '../src/world/Geography'
import { riverReaches, waterLandmarks } from '../src/world/Hydrology'

it('reshapes the shared geography paths and clears back to the original world', () => {
  setWorldSeed(42)
  setTerrainProfile(null)
  const original = sampleGeographyHeight(800, 3000)
  try {
    for (const theme of MISSION_THEMES) {
      const spec = generateMission(42, theme)
      setTerrainProfile(spec.terrain)
      const point = spec.course[1]!
      const sample = sampleGeography(point.x, point.z)
      expect(sample.height).toBe(sampleGeographyHeight(point.x, point.z))
      expect(Math.max(sample.waterLevel, sample.height)).toBe(sampleGeographySurfaceHeight(point.x, point.z))
      // Sparse 8 to 20 gate lines: any gate shows the reshaped theme ground.
      const ground = spec.course.map(p => sampleGeographyHeight(p.x, p.z))
      if (theme !== 'coastal-island-run' && theme !== 'waterway-run') expect(Math.max(...ground)).toBeGreaterThan(spec.start.y)
      else expect(spec.course.some((p, i) => ground[i]! < p.y - 120)).toBe(true)
      if (theme !== 'waterway-run') {
        expect(waterLandmarks(0, 0)).toHaveLength(0)
        expect(riverReaches(0, 0)).toHaveLength(0)
      }
      setTerrainProfile({ ...spec.terrain })
      expect(sampleGeography(point.x, point.z)).toEqual(sample)
    }
  } finally { setTerrainProfile(null) }
  expect(getTerrainProfile()).toBeNull()
  expect(sampleGeographyHeight(800, 3000)).toBe(original)
})

import { Scene } from 'three'
import { MissionSystem, buildMissionRoute } from '../src/systems/Mission'
import { setOpsPad, clearOpsPad } from '../src/world/terrainSample'
import { courseDefinitionForId, courseRunId, courseSessionId, resolveCourseReplaySeed } from '../src/systems/CourseLibrary'

it.each([42, 73, 808])('flies the desert recipe through the existing mission and record system on seed %s', seed => {
  const spec = generateMission(seed, 'desert-run')
  setWorldSeed(seed); setTerrainProfile(spec.terrain)
  setOpsPad(spec.landingRunway.x, spec.landingRunway.z, spec.landingRunway.y, spec.landingRunway.yaw)
  const mission = new MissionSystem(new Scene())
  try {
    mission.start(spec.start.x, spec.start.y, spec.start.z, spec.start.yaw, spec.profile)
    expect(mission.routeProfile).toBe(spec.profile)
    expect(mission.totalGates).toBe(spec.goals.gates)
    expect(mission.routeFallbackUsed).toBe(false)
    expect(mission.timeAllowanceSec).toBeGreaterThan(55)
    const replay = resolveCourseReplaySeed(courseDefinitionForId('desert-run'), seed)
    const record = courseRunId(replay)
    expect(record).toBe(`seed:${seed}:generated-desert:r32:l33:q56:s2`)
    expect(courseSessionId('desert-run', seed, spec.profile)).toBe(record)
    for (let x = -12000; x <= 12000; x += 2000) {
      const sample = sampleGeography(spec.terrain.originX + x, spec.terrain.originZ + x)
      expect(['desert', 'mesa']).toContain(sample.biome)
      expect(sample.moisture).toBeLessThan(.1)
    }
  } finally { mission.dispose(); setTerrainProfile(null); clearOpsPad() }
})

it('keeps fractional generated seeds replayable and separate in existing record storage', () => {
  const base = courseDefinitionForId('desert-run')
  const first = resolveCourseReplaySeed(base, 42.123456)
  const second = resolveCourseReplaySeed(base, 42.654321)
  expect(first.seed).toBe(42.123456)
  expect(courseSessionId('desert-run', 42.123456, 'generated-desert')).toBe(courseRunId(first))
  expect(courseRunId(first)).not.toBe(courseRunId(second))
  expect(courseRunId(first)).not.toBe(courseRunId(resolveCourseReplaySeed(courseDefinitionForId('contour-circuit'), 42)))
})

it.each([42, 73, 808, 1337, 2026, 9001])('keeps a wide low valley corridor between huge mountain walls on seed %s', seed => {
  const spec = generateMission(seed, 'mountain-valley-run'), t = spec.terrain
  setWorldSeed(seed); setTerrainProfile(t)
  setOpsPad(spec.landingRunway.x, spec.landingRunway.z, spec.landingRunway.y, spec.landingRunway.yaw)
  const sample = (right: number, forward: number) => sampleGeographyHeight(t.originX + Math.cos(t.yaw) * right + Math.sin(t.yaw) * forward, t.originZ - Math.sin(t.yaw) * right + Math.cos(t.yaw) * forward)
  const mission = new MissionSystem(new Scene())
  try {
    for (let forward = -4000; forward <= 4000; forward += 800) {
      // More than four kilometres of low floor covers all course gates, their
      // wing corridor, and room to establish turns with the b20/b21 controls.
      for (const right of [-2000, 0, 2000]) expect(sample(right, forward) - t.baseHeight).toBeLessThan(30)
      for (const right of [-6500, 6500]) expect(sample(right, forward) - t.baseHeight).toBeGreaterThan(6000)
    }
    mission.start(spec.start.x, spec.start.y, spec.start.z, spec.start.yaw, spec.profile)
    expect(mission.routeProfile).toBe('generated-valley')
    expect(mission.routeFallbackUsed).toBe(false)
    expect(mission.totalGates).toBe(spec.goals.gates)
    const replay = resolveCourseReplaySeed(courseDefinitionForId('mountain-valley-run'), seed)
    expect(courseRunId(replay)).toBe(`seed:${seed}:generated-valley:r32:l33:q57:s2`)
    expect(courseSessionId('mountain-valley-run', seed, spec.profile)).toBe(courseRunId(replay))
    expect(courseRunId(replay)).not.toBe(courseRunId(resolveCourseReplaySeed(courseDefinitionForId('desert-run'), seed)))
  } finally { mission.dispose(); setTerrainProfile(null); clearOpsPad() }
})

import { settlementAnchorCells, settlementForCell } from '../src/world/SettlementPlan'
import { getOpsPad, sampleTerrainSurfaceHeightFast } from '../src/world/terrainSample'
import { MAX_ROUTE_BEND_M } from '../src/systems/MissionGates'

it('invalidates settlement and anchor caches when the same seed and pad change theme', () => {
  const desert = generateMission(42, 'desert-run'), valley = generateMission(42, 'mountain-valley-run')
  setWorldSeed(42)
  setOpsPad(desert.landingRunway.x, desert.landingRunway.z, desert.landingRunway.y, desert.landingRunway.yaw)
  try {
    setTerrainProfile(valley.terrain)
    expect(settlementAnchorCells('city', getOpsPad()).length).toBeGreaterThan(0)
    setTerrainProfile(desert.terrain)
    expect(settlementAnchorCells('city', getOpsPad())).toEqual([])
    expect(settlementForCell(0, 0, 'city')).toBeNull()
    setTerrainProfile(valley.terrain)
    expect(settlementAnchorCells('city', getOpsPad()).length).toBeGreaterThan(0)
    setTerrainProfile(desert.terrain)
    expect(settlementForCell(0, 0, 'city')).toBeNull()
  } finally { setTerrainProfile(null); clearOpsPad() }
})

it.each([42, 1337, 9001])('uses terrain-derived heights and bends gates at most 160 m toward lower ground on seed %s', seed => {
  try {
    let bentGates = 0
    for (const theme of MISSION_THEMES) {
      const spec = generateMission(seed, theme), pad = spec.landingRunway
      setWorldSeed(seed); setTerrainProfile(spec.terrain); setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
      const route = buildMissionRoute(spec.start.x, spec.start.y, spec.start.z, spec.start.yaw, spec.profile)
      expect(route).toHaveLength(spec.course.length)
      for (let i = 0; i < route.length; i++) {
        const shift = Math.hypot(route[i]!.x - spec.course[i]!.x, route[i]!.z - spec.course[i]!.z)
        // Gate 1, the two runway-axis gates and every Waterway gate stay seeded.
        if (i === 0 || i >= route.length - 2 || theme === 'waterway-run') expect(shift).toBe(0)
        expect(shift).toBeLessThanOrEqual(MAX_ROUTE_BEND_M + 1e-6)
        if (shift > 0) {
          bentGates++
          const seeded = sampleTerrainSurfaceHeightFast(spec.course[i]!.x, spec.course[i]!.z)
          expect(sampleTerrainSurfaceHeightFast(route[i]!.x, route[i]!.z)).toBeLessThan(seeded)
        }
      }
      let x = spec.start.x, z = spec.start.z, hx = Math.sin(spec.start.yaw), hz = Math.cos(spec.start.yaw)
      for (const [index, point] of route.entries()) {
        const dx = point.x - x, dz = point.z - z, leg = Math.hypot(dx, dz)
        if (index > 0) {
          expect(leg).toBeGreaterThanOrEqual(800)
          expect(leg).toBeLessThanOrEqual(2500)
        }
        expect(Math.acos(Math.min(1, (dx * hx + dz * hz) / leg)) * 180 / Math.PI).toBeLessThan(75)
        hx = dx / leg; hz = dz / leg; x = point.x; z = point.z
      }
      expect(route.some((point, i) => Math.abs(point.y - spec.course[i]!.y) > 5)).toBe(true)
    }
    expect(bentGates).toBeGreaterThan(0)
  } finally { setTerrainProfile(null); clearOpsPad() }
})
