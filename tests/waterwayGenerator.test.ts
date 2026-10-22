import { afterEach, expect, it } from 'vitest'
import baseline from './fixtures/generated-before-waterway.json'
import { generateMission } from '../src/systems/MissionGenerator'
import { setTerrainProfile, type MissionTheme } from '../src/world/TerrainProfile'
import { setWorldSeed } from '../src/world/noise'
import { sampleGeography } from '../src/world/Geography'
import { sampleTerrainSurfaceHeightFast, waterBodyFromClimate, setOpsPad, clearOpsPad } from '../src/world/terrainSample'
import { buildMissionRoute, missionLegClearance } from '../src/systems/Mission'
import { coastField } from '../src/world/Coastline'

afterEach(() => { setTerrainProfile(null); clearOpsPad() })
it('preserves the four original landscapes and separates changed routes', () => {
  for (const { spec, samples } of baseline) {
    const current = generateMission(spec.seed, spec.theme as MissionTheme)
    expect(current.terrain).toEqual({ ...spec.terrain, routeRevision: spec.terrain.routeRevision + 10 })
    expect(current.start).toEqual(spec.start)
    expect(current.landingRunway).toEqual(spec.landingRunway)
    expect(current.course).not.toEqual(spec.course)
    setWorldSeed(spec.seed); setTerrainProfile(spec.terrain as Parameters<typeof setTerrainProfile>[0])
    expect(spec.course.map(p => sampleGeography(p.x, p.z))).toEqual(samples)
  }
})
it.each([42, 1337, 9001, 31415, ...Array.from({ length: 32 }, (_, i) => i + 70)])('has reachable river and lake, a clear course and dry aligned approach on seed %s', seed => {
  const spec = generateMission(seed, 'waterway-run'), pad = spec.landingRunway
  expect(generateMission(seed, 'waterway-run')).toEqual(spec)
  setWorldSeed(seed); setTerrainProfile(spec.terrain); setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
  expect(spec.terrain.dry).toBe(false)
  const bodies = spec.course.map(p => waterBodyFromClimate(sampleGeography(p.x, p.z)))
  expect(bodies).toContain('river')
  expect(bodies).toContain('lake')
  const local = (r: number, f: number) => ({ x: pad.x + Math.cos(pad.yaw) * r + Math.sin(pad.yaw) * f,
    z: pad.z - Math.sin(pad.yaw) * r + Math.cos(pad.yaw) * f })
  for (let f = -1400; f < 80; f += 40) {
    const p = local(0, f), g = sampleGeography(p.x, p.z)
    expect(g.height).toBeGreaterThan(g.waterLevel)
    expect(coastField(p.x, p.z)).toBe(1)
    expect(sampleTerrainSurfaceHeightFast(p.x, p.z) - pad.y).toBeLessThan(1.4 - Math.min(-80, f) * .052 - 2)
  }
  let previous = spec.start
  for (const [leg, point] of buildMissionRoute(spec.start.x, spec.start.y, spec.start.z, spec.start.yaw, spec.profile).entries()) {
    const dx = point.x - previous.x, dz = point.z - previous.z, length = Math.hypot(dx, dz)
    for (let i = 1; i <= 60; i++) for (const side of [-52, 0, 52]) {
      const fraction = i / 60, x = previous.x + dx * fraction + dz / length * side,
        z = previous.z + dz * fraction - dx / length * side, y = previous.y + (point.y - previous.y) * fraction
      expect(y - sampleTerrainSurfaceHeightFast(x, z)).toBeGreaterThanOrEqual(missionLegClearance(leg, length * fraction, length) - .5)
    }
    previous = { ...point, yaw: spec.start.yaw }
  }
})
