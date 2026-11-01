import { afterEach, describe, expect, it } from 'vitest'
import { coastField } from '../src/world/Coastline'
import { setTerrainProfile, type TerrainProfile } from '../src/world/TerrainProfile'

const base: TerrainProfile = { theme: 'desert-run', landscapeRevision: 1, routeRevision: 1, originX: 0, originZ: 0,
  yaw: 0, baseHeight: 100, relief: 200, valleyHalfWidth: 800, phase: 0, dry: true }

afterEach(() => setTerrainProfile(null))

describe('coastField under mission profiles', () => {
  it('has no sea on dry or Waterway profiles', () => {
    setTerrainProfile(base)
    expect(coastField(50000, -30000)).toBe(1)
    setTerrainProfile({ ...base, theme: 'waterway-run', dry: false })
    expect(coastField(-80000, 12000)).toBe(1)
  })

  it('puts land at the home island centre and sea far offshore on the island run', () => {
    setTerrainProfile({ ...base, theme: 'coastal-island-run', dry: false })
    expect(coastField(-650, -1900)).toBeGreaterThan(0)
    expect(coastField(40000, 40000)).toBeLessThan(0)
  })
})
