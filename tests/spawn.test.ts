import { describe, expect, it } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import { waterLandmarks } from '../src/world/Hydrology'
import {
  clearOpsPad,
  emergencySpawn,
  findPlayableSpawn,
  isUsableAirfield,
  sampleClimate,
} from '../src/world/terrainSample'

describe('airfield spawn', () => {
  it('provides a finite bounded recovery pad for pathological first boots', () => {
    setWorldSeed(1)
    clearOpsPad()
    const pad = emergencySpawn()
    expect(pad).toMatchObject({ x: 0, z: 0, yaw: 0 })
    expect(['plains', 'desert', 'forest']).toContain(pad.biome)
    expect(Number.isFinite(pad.y)).toBe(true)
    expect(pad.y).toBeGreaterThanOrEqual(8)
    expect(pad.y).toBeLessThanOrEqual(120)
  })

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

  it('reuses a deterministic natural pad across repeated default searches', () => {
    setWorldSeed(73)
    clearOpsPad()
    const first = findPlayableSpawn()
    const second = findPlayableSpawn()
    expect(first).not.toBeNull()
    expect(second).toEqual(first)
  }, 25_000)

  it('keeps the deterministic startup seed corpus playable', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      setWorldSeed(seed)
      clearOpsPad()
      const pad = findPlayableSpawn()
      expect(pad, `seed ${seed} should produce a playable pad`).not.toBeNull()
      if (!pad) continue
      expect(isUsableAirfield(pad), `seed ${seed} pad should remain dry`).toBe(true)
      expect(pad.biome).not.toBe('ocean')
      expect(pad.biome).not.toBe('water')
    }
    clearOpsPad()
  }, 120_000)
})
