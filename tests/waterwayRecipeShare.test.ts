import { afterEach, describe, expect, it } from 'vitest'
import { generateMission } from '../src/systems/MissionGenerator'
import { sampleGeography } from '../src/world/Geography'
import {
  CATCHMENT_SIZE, hydrologyPreparedAt, prepareHydrologyInBoundsSteps, riverReaches, riverReachesInBounds, waterLandmarks,
} from '../src/world/Hydrology'
import { setWorldSeed } from '../src/world/noise'
import { riverSurface } from '../src/world/RiverSurface'
import { setTerrainProfile, type TerrainProfile } from '../src/world/TerrainProfile'
import { clearOpsPad, setOpsPad } from '../src/world/terrainSample'
import { waterwayDrainage } from '../src/world/WaterwayTerrain'

afterEach(() => { setTerrainProfile(null); clearOpsPad(); setWorldSeed(1337.9182) })

function activate(seed: number): TerrainProfile {
  const spec = generateMission(seed, 'waterway-run')
  const pad = spec.landingRunway
  setWorldSeed(seed)
  setTerrainProfile(spec.terrain)
  setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
  return spec.terrain
}

function shore(cx = 0, cz = 0): number[] {
  const basin = waterLandmarks(cx, cz)[0]
  return basin?.shoreRadii ? Array.from(basin.shoreRadii) : []
}

function courseHeights(seed: number): number[] {
  const spec = generateMission(seed, 'waterway-run')
  return spec.course.map(point => sampleGeography(point.x, point.z).height)
}

describe('shared Waterway drainage recipe', () => {
  it('reuses one basin and reach identity while bins stay per catchment', () => {
    const profile = activate(42)
    const yaw = profile.yaw
    const point = (right: number, forward: number) => ({
      x: profile.originX + Math.cos(yaw) * right + Math.sin(yaw) * forward,
      z: profile.originZ - Math.sin(yaw) * right + Math.cos(yaw) * forward,
    })
    const samples = [point(1100, -2000), point(2100, 3300), point(1100, 2400)]
    const minX = Math.min(...samples.map(p => p.x)) - 400
    const minZ = Math.min(...samples.map(p => p.z)) - 400
    const maxX = Math.max(...samples.map(p => p.x)) + 400
    const maxZ = Math.max(...samples.map(p => p.z)) + 400
    expect(Math.floor(minZ / CATCHMENT_SIZE)).not.toBe(Math.floor(maxZ / CATCHMENT_SIZE))
    const near = riverReachesInBounds(minX, minZ, maxX, maxZ)
    const again = riverReachesInBounds(minX, minZ, maxX, maxZ)
    expect(near.length).toBeGreaterThan(0)
    expect(new Set(near.map(reach => reach.id)).size).toBe(near.length)
    expect(again.map(reach => reach.id)).toEqual(near.map(reach => reach.id))
    expect(riverReaches(0, 0)[0]).toBe(riverReaches(2, 3)[0])
    expect(waterLandmarks(0, 0)[0]).toBe(waterLandmarks(2, 3)[0])
    expect(riverReachesInBounds(2 * CATCHMENT_SIZE + 100, 3 * CATCHMENT_SIZE + 100,
      2 * CATCHMENT_SIZE + 800, 3 * CATCHMENT_SIZE + 800)).toEqual([])
    const direct = waterwayDrainage(profile)
    const shared = riverReaches(0, 0)
    expect(shared).toHaveLength(direct.reaches.length)
    for (let i = 0; i < shared.length; i++) {
      const fromShared = riverSurface(shared[i]!, [])
      const fromDirect = riverSurface(direct.reaches[i]!, direct.basins)
      expect(Array.from(fromShared.sections)).toEqual(Array.from(fromDirect.sections))
      expect(Array.from(fromShared.caps)).toEqual(Array.from(fromDirect.caps))
      expect(fromShared.triangles ? Array.from(fromShared.triangles) : undefined)
        .toEqual(fromDirect.triangles ? Array.from(fromDirect.triangles) : undefined)
    }
  })

  it('keeps the recipe across a profile clone and catchment eviction', () => {
    const profile = activate(9001)
    const reach = riverReaches(0, 0)[0]
    const surface = riverSurface(reach!, [])
    expect(hydrologyPreparedAt(100, 100)).toBe(true)
    setTerrainProfile(structuredClone(profile))
    expect(hydrologyPreparedAt(100, 100)).toBe(false)
    expect(riverReaches(0, 0)[0]).toBe(reach)
    expect(riverSurface(riverReaches(0, 0)[0]!, [])).toBe(surface)
    setTerrainProfile({ ...profile, relief: profile.relief + 25 })
    expect(riverReaches(0, 0)[0]).toBe(reach)
    for (let i = 1; i <= 128; i++) riverReaches(i, 4)
    expect(riverReaches(0, 0)[0]).toBe(reach)
    expect(riverSurface(reach!, [])).toBe(surface)
  })

  it('invalidates on seed, phase and dry transitions and restores the same samples', () => {
    const profile = activate(1337)
    const heights = courseHeights(1337)
    const savedShore = shore()
    const reach = riverReaches(0, 0)[0]
    setWorldSeed(7)
    expect(riverReaches(0, 0)[0]).not.toBe(reach)
    expect(shore()).not.toEqual(savedShore)
    setWorldSeed(1337)
    setTerrainProfile(profile)
    expect(riverReaches(0, 0)[0]).not.toBe(reach)
    expect(shore()).toEqual(savedShore)
    expect(courseHeights(1337)).toEqual(heights)
    const restored = riverReaches(0, 0)[0]
    setTerrainProfile({ ...profile, phase: profile.phase + 0.01 })
    expect(riverReaches(0, 0)[0]).not.toBe(restored)
    setTerrainProfile(profile)
    expect(shore()).toEqual(savedShore)
    setTerrainProfile({ ...profile, dry: true })
    const dry = sampleGeography(profile.originX, profile.originZ)
    expect(dry.waterLevel).toBe(0)
    expect(dry.features.river).toBe(0)
    expect(dry.features.lake).toBe(0)
    setTerrainProfile(profile)
    expect(shore()).toEqual(savedShore)
    expect(courseHeights(1337)).toEqual(heights)
    setWorldSeed(99)
    setWorldSeed(1337)
    expect(riverReaches(0, 0)[0]).toBe(riverReaches(1, 0)[0])
    expect(shore()).toEqual(savedShore)
  })

  it('lets an interleaved prepare observe a seed change before it builds', () => {
    // Waterway catchment builds do not yield, so a second iterator cannot
    // resume a half-built recipe. It reads the seed on its first step.
    const profile = activate(42)
    const savedShore = shore()
    const left = prepareHydrologyInBoundsSteps(10, 10, 10, 10)
    const right = prepareHydrologyInBoundsSteps(CATCHMENT_SIZE + 10, 10, CATCHMENT_SIZE + 10, 10)
    expect(left.next().done).toBe(true)
    const reach = riverReaches(0, 0)[0]
    setWorldSeed(99)
    expect(right.next().done).toBe(true)
    expect(riverReaches(1, 0)[0]).not.toBe(reach)
    expect(shore(1, 0)).not.toEqual(savedShore)
    setWorldSeed(42)
    setTerrainProfile(profile)
    expect(riverReaches(0, 0)[0]).not.toBe(reach)
    expect(shore()).toEqual(savedShore)
    expect(riverReaches(0, 0)[0]).toBe(riverReaches(2, 0)[0])
  })
})
