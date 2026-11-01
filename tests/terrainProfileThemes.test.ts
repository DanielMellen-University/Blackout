import { afterEach, describe, expect, it } from 'vitest'
import { generatedThemeForProfile, getTerrainProfile, MISSION_THEMES, setTerrainProfile, type TerrainProfile } from '../src/world/TerrainProfile'

afterEach(() => setTerrainProfile(null))

describe('terrain profiles', () => {
  it('maps each generated course profile to its mission theme', () => {
    const themes = ['desert', 'valley', 'coastal', 'volcanic', 'waterway'].map(name => generatedThemeForProfile(`generated-${name}`))
    expect(themes).toEqual([...MISSION_THEMES])
  })

  it('returns null for free flight and unknown values', () => {
    for (const value of [undefined, null, 'free', 'generated-', 7, {}]) expect(generatedThemeForProfile(value)).toBeNull()
  })

  it('stores and clears the active profile', () => {
    const profile: TerrainProfile = { theme: 'desert-run', landscapeRevision: 1, routeRevision: 1, originX: 0, originZ: 0,
      yaw: 0, baseHeight: 100, relief: 200, valleyHalfWidth: 800, phase: 0, dry: true }
    setTerrainProfile(profile)
    expect(getTerrainProfile()).toBe(profile)
    setTerrainProfile(null)
    expect(getTerrainProfile()).toBeNull()
  })
})
