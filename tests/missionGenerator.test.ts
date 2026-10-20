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
      expect(spec.landingRunway).toMatchObject(spec.start)
      for (const point of [spec.start, spec.landingRunway, ...spec.course])
        for (const axis of ['x', 'y', 'z'] as const) expect(Number.isFinite(point[axis])).toBe(true)
      for (let i = 1; i < spec.course.length; i++) expect(Math.hypot(spec.course[i]!.x - spec.course[i-1]!.x, spec.course[i]!.z - spec.course[i-1]!.z)).toBeGreaterThan(800)
    }
    expect(generateMission(seed)).toEqual(generateMission(seed))
  })
  it('has exactly two themes, varies seeds, and separates the theme route and world identities', () => {
    expect(MISSION_THEMES).toEqual(['desert-run', 'mountain-valley-run'])
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
      expect(sample.height).toBeGreaterThan(spec.start.y)
      expect(waterLandmarks(0, 0)).toHaveLength(0)
      expect(riverReaches(0, 0)).toHaveLength(0)
      setTerrainProfile({ ...spec.terrain })
      expect(sampleGeography(point.x, point.z)).toEqual(sample)
    }
  } finally { setTerrainProfile(null) }
  expect(getTerrainProfile()).toBeNull()
  expect(sampleGeographyHeight(800, 3000)).toBe(original)
})
