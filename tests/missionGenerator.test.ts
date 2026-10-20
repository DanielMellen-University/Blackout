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
      expect(spec.goals).toMatchObject({ landingRequired: true, scoring: 'existing-medals' })
      expect(spec.landingRunway.yaw).toBe(spec.start.yaw)
      expect(Math.hypot(spec.landingRunway.x - spec.start.x, spec.landingRunway.z - spec.start.z)).toBeCloseTo(45)
      for (const point of [spec.start, spec.landingRunway, ...spec.course])
        for (const axis of ['x', 'y', 'z'] as const) expect(Number.isFinite(point[axis])).toBe(true)
      for (let i = 1; i < spec.course.length; i++) expect(Math.hypot(spec.course[i]!.x - spec.course[i-1]!.x, spec.course[i]!.z - spec.course[i-1]!.z)).toBeGreaterThan(800)
    }
    expect(generateMission(seed)).toEqual(generateMission(seed))
  })
  it('has exactly the delivered approved themes, varies seeds, and separates the theme route and world identities', () => {
    expect(MISSION_THEMES).toEqual(['desert-run', 'mountain-valley-run', 'coastal-island-run'])
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
      expect(sample.height).toBe(sampleGeographySurfaceHeight(point.x, point.z))
      if (theme !== 'coastal-island-run') expect(sample.height).toBeGreaterThan(spec.start.y)
      else expect(sample.height).toBeLessThan(spec.course[1]!.y - 120)
      expect(waterLandmarks(0, 0)).toHaveLength(0)
      expect(riverReaches(0, 0)).toHaveLength(0)
      setTerrainProfile({ ...spec.terrain })
      expect(sampleGeography(point.x, point.z)).toEqual(sample)
    }
  } finally { setTerrainProfile(null) }
  expect(getTerrainProfile()).toBeNull()
  expect(sampleGeographyHeight(800, 3000)).toBe(original)
})

import { Scene } from 'three'
import { MissionSystem } from '../src/systems/Mission'
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
    expect(mission.totalGates).toBe(5)
    expect(mission.routeFallbackUsed).toBe(false)
    expect(mission.timeAllowanceSec).toBeGreaterThan(80)
    const replay = resolveCourseReplaySeed(courseDefinitionForId('desert-run'), seed)
    const record = courseRunId(replay)
    expect(record).toBe(`seed:${seed}:generated-desert:r32:l30:q33`)
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
    expect(mission.totalGates).toBe(5)
    const replay = resolveCourseReplaySeed(courseDefinitionForId('mountain-valley-run'), seed)
    expect(courseRunId(replay)).toBe(`seed:${seed}:generated-valley:r32:l30:q33`)
    expect(courseSessionId('mountain-valley-run', seed, spec.profile)).toBe(courseRunId(replay))
    expect(courseRunId(replay)).not.toBe(courseRunId(resolveCourseReplaySeed(courseDefinitionForId('desert-run'), seed)))
  } finally { mission.dispose(); setTerrainProfile(null); clearOpsPad() }
})

import { settlementAnchorCells, settlementForCell } from '../src/world/SettlementPlan'
import { getOpsPad } from '../src/world/terrainSample'

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
