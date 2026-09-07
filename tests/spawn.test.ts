import { describe, expect, it } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import { waterLandmarks } from '../src/world/Hydrology'
import {
  clearOpsPad,
  findPlayableSpawn,
  isUsableAirfield,
  sampleClimate,
} from '../src/world/terrainSample'

describe('airfield spawn', () => {
  it('rejects a pad whose climate is ocean even if labeled plains', () => {
    setWorldSeed(1)
    clearOpsPad()
    const ocean = waterLandmarks(-1, -1).find(b => b.sea)!
    expect(sampleClimate(ocean.x, ocean.z).biome).toBe('ocean')
    expect(
      isUsableAirfield({
        x: ocean!.x,
        z: ocean!.z,
        y: 8,
        yaw: 0,
        biome: 'plains',
      }),
    ).toBe(false)
  })

  it('does not hand back an ocean or water airfield on a historically failing seed', () => {
    setWorldSeed(2)
    clearOpsPad()
    const pad = findPlayableSpawn()
    expect(pad).not.toBeNull()
    expect(pad!.biome).not.toBe('ocean')
    expect(pad!.biome).not.toBe('water')
    expect(isUsableAirfield(pad!)).toBe(true)
    const jet = sampleClimate(pad!.x, pad!.z)
    expect(jet.biome).not.toBe('ocean')
    expect(jet.biome).not.toBe('water')
  }, 25_000)
})
