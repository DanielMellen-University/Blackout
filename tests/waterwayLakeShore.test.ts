import { afterEach, describe, expect, it } from 'vitest'
import { basinDistance } from '../src/world/Hydrology'
import { setTerrainProfile, type TerrainProfile } from '../src/world/TerrainProfile'
import { waterwayDrainage } from '../src/world/WaterwayTerrain'

const profile: TerrainProfile = { theme: 'waterway-run', landscapeRevision: 1, routeRevision: 1, originX: 1000, originZ: -2000,
  yaw: .4, baseHeight: 120, relief: 300, valleyHalfWidth: 900, phase: 1.3, dry: false }

afterEach(() => setTerrainProfile(null))

describe('Waterway lake and channel', () => {
  it('caches one refined shoreline that lies on the lake boundary', () => {
    setTerrainProfile(profile)
    const { basins } = waterwayDrainage(profile)
    const lake = basins[0]!
    expect(lake.shoreRadii).toHaveLength(256)
    for (let i = 0; i < 256; i += 2) {
      const angle = i / 256 * Math.PI * 2, r = lake.shoreRadii![i]!
      expect(Math.abs(basinDistance(lake, lake.x + Math.cos(angle) * r, lake.z + Math.sin(angle) * r))).toBeLessThan(.5)
    }
    expect(lake.boundsRadius).toBeGreaterThanOrEqual(Math.max(...lake.shoreRadii!))
  })

  it('builds 22 joined 500 m reaches that start at a source and end at the lake', () => {
    const { reaches } = waterwayDrainage(profile)
    expect(reaches).toHaveLength(22)
    expect(reaches[0]!.source).toBe(true)
    expect(reaches.at(-1)!.terminal).toBe(true)
    for (let i = 1; i < reaches.length; i++) {
      expect(reaches[i]!.ax).toBeCloseTo(reaches[i - 1]!.bx, 6)
      expect(reaches[i]!.az).toBeCloseTo(reaches[i - 1]!.bz, 6)
    }
  })
})
